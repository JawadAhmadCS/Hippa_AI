import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const USERS_FILE = path.resolve(process.cwd(), "data", "auth-users.json");
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const MFA_FRESH_WINDOW_MS = 1000 * 60 * 15;
const CHALLENGE_TTL_MS = 1000 * 60 * 5;
const SMS_CODE_TTL_MS = 1000 * 60 * 5;
const SMS_RESEND_COOLDOWN_MS = 1000 * 20;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 1000 * 60 * 10;
const TOTP_WINDOW = 1;
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const sessionsByTokenHash = new Map();
const challengesById = new Map();

const nowMs = () => Date.now();
const nowIso = () => new Date().toISOString();
const isProduction = () => String(process.env.NODE_ENV || "development").toLowerCase() === "production";

const normalizePhone = (value = "") => String(value || "").replace(/[^0-9+]/g, "").trim();

const maskPhone = (value = "") => {
  const normalized = normalizePhone(value);
  if (!normalized) return "";
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***-***-${digits.slice(-4)}`;
};

const normalizeSpecialties = (value) => {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  const normalized = source
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const normalizeUserRecord = (user = {}) => ({
  ...user,
  id: String(user.id || crypto.randomUUID()),
  username: String(user.username || "").trim().toLowerCase(),
  displayName: String(user.displayName || "").trim(),
  role: String(user.role || "provider").trim().toLowerCase(),
  clientId: String(user.clientId || "default-clinic").trim().toLowerCase(),
  clientName: String(user.clientName || "Default Clinic").trim(),
  specialties: normalizeSpecialties(user.specialties),
  phoneNumber: normalizePhone(user.phoneNumber),
  sms2faEnabled:
    typeof user.sms2faEnabled === "boolean" ? user.sms2faEnabled : Boolean(normalizePhone(user.phoneNumber)),
  failedAttempts: Number(user.failedAttempts || 0),
  lockedUntil: String(user.lockedUntil || ""),
  createdAt: String(user.createdAt || nowIso()),
  updatedAt: String(user.updatedAt || nowIso()),
  totp: {
    enabled: Boolean(user?.totp?.enabled),
    secret: String(user?.totp?.secret || randomBase32Secret(20)).toUpperCase(),
    enabledAt: String(user?.totp?.enabledAt || ""),
    lastUsedCounter: Number(user?.totp?.lastUsedCounter ?? -1),
  },
});

const getAvailableFactorsForUser = (user) => {
  const factors = ["totp"];
  const smsAllowed = Boolean(user?.sms2faEnabled && normalizePhone(user?.phoneNumber));
  if (smsAllowed) factors.push("sms");
  return factors;
};

const ensureDataFile = () => {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    const seed = {
      users: [
        buildSeedUser({
          username: "provider1",
          displayName: "Dr. Sarah Ahmed",
          role: "provider",
          password: "Provider@123",
          clientId: "north-hill-clinic",
          clientName: "North Hill Clinic",
          specialties: ["Internal Medicine", "Cardiology"],
          phoneNumber: "+15550001001",
        }),
        buildSeedUser({
          username: "billing1",
          displayName: "Billing User",
          role: "billing",
          password: "Billing@123",
          clientId: "north-hill-clinic",
          clientName: "North Hill Clinic",
          specialties: [],
          phoneNumber: "+15550001002",
        }),
        buildSeedUser({
          username: "provider2",
          displayName: "Dr. Maria Khan",
          role: "provider",
          password: "Provider@123",
          clientId: "city-general-hospital",
          clientName: "City General Hospital",
          specialties: ["Family Medicine", "Pediatrics"],
          phoneNumber: "+15550001003",
        }),
        buildSeedUser({
          username: "admin1",
          displayName: "Admin User",
          role: "admin",
          password: "Admin@123",
          clientId: "city-general-hospital",
          clientName: "City General Hospital",
          specialties: [],
          phoneNumber: "+15550001004",
        }),
      ],
    };
    fs.writeFileSync(USERS_FILE, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
  }
};

const readUserStore = () => {
  ensureDataFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    if (!Array.isArray(parsed?.users)) return { users: [] };
    return {
      ...parsed,
      users: parsed.users.map((user) => normalizeUserRecord(user)),
    };
  } catch {
    return { users: [] };
  }
};

const writeUserStore = (store) => {
  ensureDataFile();
  fs.writeFileSync(USERS_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
};

const randomBase32Secret = (size = 20) => {
  const bytes = crypto.randomBytes(size);
  let output = "";
  for (const byte of bytes) {
    output += BASE32_ALPHABET[byte & 31];
  }
  return output;
};

const base32Decode = (value = "") => {
  const normalized = String(value || "").replace(/=+$/g, "").toUpperCase();
  let bits = "";
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) continue;
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
};

const hashPassword = (password, salt) =>
  crypto.pbkdf2Sync(String(password || ""), salt, 120000, 32, "sha256").toString("hex");

const verifyPassword = (password, user) => {
  const salt = String(user?.passwordSalt || "");
  const digest = String(user?.passwordHash || "");
  if (!salt || !digest) return false;
  const computed = hashPassword(password, salt);
  const left = Buffer.from(computed);
  const right = Buffer.from(digest);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const buildSeedUser = ({
  username,
  displayName,
  role,
  password,
  clientId = "default-clinic",
  clientName = "Default Clinic",
  specialties = [],
  phoneNumber = "",
}) => {
  const passwordSalt = crypto.randomBytes(16).toString("hex");
  return {
    id: crypto.randomUUID(),
    username: String(username || "").trim().toLowerCase(),
    displayName: String(displayName || "").trim(),
    role: String(role || "provider").trim().toLowerCase(),
    clientId: String(clientId || "default-clinic").trim().toLowerCase(),
    clientName: String(clientName || "Default Clinic").trim(),
    specialties: normalizeSpecialties(specialties),
    phoneNumber: normalizePhone(phoneNumber),
    sms2faEnabled: Boolean(normalizePhone(phoneNumber)),
    passwordSalt,
    passwordHash: hashPassword(password, passwordSalt),
    failedAttempts: 0,
    lockedUntil: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    totp: {
      enabled: false,
      secret: randomBase32Secret(20),
      enabledAt: "",
      lastUsedCounter: -1,
    },
  };
};

const sanitizePublicUser = (user) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  role: user.role,
  clientId: user.clientId || "default-clinic",
  clientName: user.clientName || "Default Clinic",
  specialties: normalizeSpecialties(user.specialties),
  phoneMasked: maskPhone(user.phoneNumber),
  sms2faEnabled: Boolean(user?.sms2faEnabled && normalizePhone(user?.phoneNumber)),
  mfaFactors: getAvailableFactorsForUser(user),
  totpEnabled: Boolean(user?.totp?.enabled),
});

const currentTotpCounter = (ms = nowMs()) => Math.floor(ms / 1000 / TOTP_STEP_SECONDS);

const generateTotpCode = ({ secret, counter }) => {
  const key = base32Decode(secret);
  if (!key.length) return null;

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const codeInt =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(codeInt % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
};

const verifyTotpCode = ({ secret, code, user }) => {
  const normalizedCode = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalizedCode)) return { ok: false, reason: "invalid-format" };

  const baseCounter = currentTotpCounter();
  for (let drift = -TOTP_WINDOW; drift <= TOTP_WINDOW; drift += 1) {
    const counter = baseCounter + drift;
    const expected = generateTotpCode({ secret, counter });
    if (!expected) continue;
    if (expected !== normalizedCode) continue;

    if (Number(user?.totp?.lastUsedCounter || -1) >= counter) {
      return { ok: false, reason: "replay-detected" };
    }

    return { ok: true, counter };
  }
  return { ok: false, reason: "mismatch" };
};

const hashToken = (token) => crypto.createHash("sha256").update(String(token || "")).digest("hex");

const buildOtpauthUri = ({ username, secret, issuer = "HIPAA Revenue Assistant" }) => {
  const label = encodeURIComponent(`${issuer}:${username}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
};

const buildQrImageUrl = (otpauthUri) =>
  `https://quickchart.io/qr?size=220&margin=1&text=${encodeURIComponent(String(otpauthUri || ""))}`;

const generateSmsCode = () => String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

const hashSmsCode = ({ challengeId, code }) =>
  crypto
    .createHash("sha256")
    .update(`${String(challengeId || "").trim()}:${String(code || "").trim()}`)
    .digest("hex");

const findUserByUsername = (store, username) => {
  const normalized = String(username || "").trim().toLowerCase();
  return store.users.find((user) => String(user.username || "").toLowerCase() === normalized) || null;
};

const findUserById = (store, userId) =>
  store.users.find((user) => String(user.id || "") === String(userId || "")) || null;

const persistUpdatedUser = (store, updatedUser) => {
  const index = store.users.findIndex((user) => user.id === updatedUser.id);
  if (index < 0) return;
  store.users.splice(index, 1, updatedUser);
  writeUserStore(store);
};

const isLocked = (user) => {
  const lockedUntilMs = new Date(user?.lockedUntil || "").getTime();
  return Number.isFinite(lockedUntilMs) && lockedUntilMs > nowMs();
};

const cleanupMemory = () => {
  const now = nowMs();
  for (const [id, challenge] of challengesById.entries()) {
    if (challenge.expiresAtMs <= now) challengesById.delete(id);
  }
  for (const [tokenHash, session] of sessionsByTokenHash.entries()) {
    if (session.expiresAtMs <= now) sessionsByTokenHash.delete(tokenHash);
  }
};

setInterval(cleanupMemory, 60_000).unref?.();

export const getAuthConstants = () => ({
  mfaFreshWindowMs: MFA_FRESH_WINDOW_MS,
  smsCodeTtlMs: SMS_CODE_TTL_MS,
});

export const loginWithPassword = ({ username, password, clientId = "", ip = "", userAgent = "" }) => {
  const store = readUserStore();
  const user = findUserByUsername(store, username);
  if (!user) {
    return { ok: false, error: "Invalid username or password." };
  }

  const normalizedClient = String(clientId || "").trim().toLowerCase();
  if (normalizedClient && normalizedClient !== String(user.clientId || "").toLowerCase()) {
    return { ok: false, error: "This account is not authorized for the selected clinic portal." };
  }

  if (isLocked(user)) {
    return { ok: false, error: "Account temporarily locked due to repeated failed attempts." };
  }

  if (!verifyPassword(password, user)) {
    const next = {
      ...user,
      failedAttempts: Number(user.failedAttempts || 0) + 1,
      updatedAt: nowIso(),
    };
    if (next.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      next.lockedUntil = new Date(nowMs() + LOCK_MS).toISOString();
      next.failedAttempts = 0;
    }
    persistUpdatedUser(store, next);
    return { ok: false, error: "Invalid username or password." };
  }

  const unlocked = {
    ...user,
    failedAttempts: 0,
    lockedUntil: "",
    updatedAt: nowIso(),
  };
  persistUpdatedUser(store, unlocked);

  const challengeId = crypto.randomUUID();
  const setupRequired = !Boolean(unlocked?.totp?.enabled);
  const factors = getAvailableFactorsForUser(unlocked);
  const preferredFactor = factors.includes("totp")
    ? setupRequired
      ? factors.includes("sms")
        ? "sms"
        : "totp"
      : "totp"
    : "sms";
  challengesById.set(challengeId, {
    challengeId,
    userId: unlocked.id,
    setupRequired,
    availableFactors: factors,
    preferredFactor,
    createdAtMs: nowMs(),
    expiresAtMs: nowMs() + CHALLENGE_TTL_MS,
    ip: String(ip || "").trim(),
    userAgent: String(userAgent || "").trim().slice(0, 300),
    smsCodeHash: "",
    smsCodeExpiresAtMs: 0,
    smsSentAtMs: 0,
  });

  const otpauthUri = buildOtpauthUri({
    username: unlocked.username,
    secret: unlocked.totp.secret,
  });

  return {
    ok: true,
    challenge: {
      challengeId,
      expiresAt: new Date(nowMs() + CHALLENGE_TTL_MS).toISOString(),
      mfaRequired: true,
      mfaSetupRequired: setupRequired,
      availableFactors: factors,
      preferredFactor,
      setup: setupRequired
        ? {
            secret: unlocked.totp.secret,
            otpauthUri,
            qrImageUrl: buildQrImageUrl(otpauthUri),
          }
        : null,
      user: sanitizePublicUser(unlocked),
    },
  };
};

const resolveChallengeAndUser = (challengeId) => {
  cleanupMemory();
  const challenge = challengesById.get(String(challengeId || "").trim());
  if (!challenge || challenge.expiresAtMs <= nowMs()) {
    return { ok: false, error: "2FA challenge expired. Please login again." };
  }

  const store = readUserStore();
  const user = findUserById(store, challenge.userId);
  if (!user) {
    challengesById.delete(challenge.challengeId);
    return { ok: false, error: "Invalid user." };
  }

  return { ok: true, challenge, store, user };
};

export const sendLoginSmsCode = ({ challengeId }) => {
  const resolved = resolveChallengeAndUser(challengeId);
  if (!resolved.ok) return resolved;

  const { challenge, user } = resolved;
  if (!getAvailableFactorsForUser(user).includes("sms")) {
    return { ok: false, error: "SMS factor is not configured for this account." };
  }

  if (challenge.smsSentAtMs && nowMs() - challenge.smsSentAtMs < SMS_RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      error: "Please wait a few seconds before requesting another SMS code.",
    };
  }

  const code = generateSmsCode();
  challenge.smsCodeHash = hashSmsCode({ challengeId: challenge.challengeId, code });
  challenge.smsCodeExpiresAtMs = nowMs() + SMS_CODE_TTL_MS;
  challenge.smsSentAtMs = nowMs();
  challengesById.set(challenge.challengeId, challenge);

  return {
    ok: true,
    method: "sms",
    sentAt: nowIso(),
    expiresAt: new Date(challenge.smsCodeExpiresAtMs).toISOString(),
    destination: maskPhone(user.phoneNumber),
    devCode: isProduction() ? undefined : code,
  };
};

export const verifyLogin2fa = ({ challengeId, code, method = "totp", ip = "", userAgent = "" }) => {
  cleanupMemory();
  const resolved = resolveChallengeAndUser(challengeId);
  if (!resolved.ok) return resolved;
  const { challenge, store, user } = resolved;

  const preferred = String(challenge.preferredFactor || "totp").toLowerCase();
  const normalizedMethod = String(method || preferred || "totp").toLowerCase();
  const factors = getAvailableFactorsForUser(user);
  const selectedMethod = factors.includes(normalizedMethod) ? normalizedMethod : preferred;

  let totpCounter = Number(user?.totp?.lastUsedCounter ?? -1);

  if (selectedMethod === "sms") {
    const normalizedCode = String(code || "").replace(/\s+/g, "");
    if (!/^\d{6}$/.test(normalizedCode)) {
      return { ok: false, error: "Invalid 2FA code." };
    }

    const expiresAtMs = Number(challenge.smsCodeExpiresAtMs || 0);
    if (!challenge.smsCodeHash || !expiresAtMs || expiresAtMs <= nowMs()) {
      return { ok: false, error: "SMS code expired. Request a new code." };
    }

    const expectedHash = hashSmsCode({
      challengeId: challenge.challengeId,
      code: normalizedCode,
    });
    const left = Buffer.from(String(challenge.smsCodeHash), "utf8");
    const right = Buffer.from(String(expectedHash), "utf8");
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      return { ok: false, error: "Invalid 2FA code." };
    }

    challenge.smsCodeHash = "";
    challenge.smsCodeExpiresAtMs = 0;
    challengesById.set(challenge.challengeId, challenge);
  } else {
    const secret = String(user?.totp?.secret || "");
    const check = verifyTotpCode({ secret, code, user });
    if (!check.ok) {
      return { ok: false, error: "Invalid 2FA code." };
    }
    totpCounter = check.counter;
  }

  const updatedUser = {
    ...user,
    totp: {
      ...user.totp,
      enabled: selectedMethod === "totp" ? true : Boolean(user.totp?.enabled),
      enabledAt: selectedMethod === "totp" ? user.totp?.enabledAt || nowIso() : user.totp?.enabledAt || "",
      lastUsedCounter: selectedMethod === "totp" ? totpCounter : Number(user?.totp?.lastUsedCounter ?? -1),
    },
    updatedAt: nowIso(),
  };
  persistUpdatedUser(store, updatedUser);
  challengesById.delete(challenge.challengeId);

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const session = {
    sessionId: crypto.randomUUID(),
    userId: updatedUser.id,
    username: updatedUser.username,
    role: updatedUser.role,
    displayName: updatedUser.displayName,
    clientId: updatedUser.clientId || "default-clinic",
    clientName: updatedUser.clientName || "Default Clinic",
    specialties: normalizeSpecialties(updatedUser.specialties),
    createdAt: nowIso(),
    createdAtMs: nowMs(),
    expiresAtMs: nowMs() + SESSION_TTL_MS,
    mfaVerifiedAtMs: nowMs(),
    mfaMethod: selectedMethod,
    ip: String(ip || challenge.ip || "").trim(),
    userAgent: String(userAgent || challenge.userAgent || "").trim().slice(0, 300),
  };
  sessionsByTokenHash.set(tokenHash, session);

  return {
    ok: true,
    token: rawToken,
    expiresAt: new Date(session.expiresAtMs).toISOString(),
    mfaMethod: selectedMethod,
    user: sanitizePublicUser(updatedUser),
  };
};

export const authenticateToken = (token) => {
  cleanupMemory();
  const tokenHash = hashToken(token);
  const session = sessionsByTokenHash.get(tokenHash);
  if (!session) return null;
  if (session.expiresAtMs <= nowMs()) {
    sessionsByTokenHash.delete(tokenHash);
    return null;
  }

  session.expiresAtMs = nowMs() + SESSION_TTL_MS;
  return {
    sessionId: session.sessionId,
    userId: session.userId,
    username: session.username,
    role: session.role,
    displayName: session.displayName,
    clientId: session.clientId || "default-clinic",
    clientName: session.clientName || "Default Clinic",
    specialties: normalizeSpecialties(session.specialties),
    mfaMethod: session.mfaMethod || "totp",
    mfaVerifiedAtMs: session.mfaVerifiedAtMs,
    expiresAt: new Date(session.expiresAtMs).toISOString(),
  };
};

export const revokeSession = (token) => {
  const tokenHash = hashToken(token);
  return sessionsByTokenHash.delete(tokenHash);
};

export const requiresRecentMfa = (session, maxAgeMs = MFA_FRESH_WINDOW_MS) =>
  nowMs() - Number(session?.mfaVerifiedAtMs || 0) <= Number(maxAgeMs || MFA_FRESH_WINDOW_MS);
