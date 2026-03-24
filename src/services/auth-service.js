import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const USERS_FILE = path.resolve(process.cwd(), "data", "auth-users.json");
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const MFA_FRESH_WINDOW_MS = 1000 * 60 * 15;
const CHALLENGE_TTL_MS = 1000 * 60 * 5;
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

const ensureDataFile = () => {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    const seed = {
      users: [
        buildSeedUser({
          username: "provider1",
          displayName: "Provider User",
          role: "provider",
          password: "Provider@123",
        }),
        buildSeedUser({
          username: "billing1",
          displayName: "Billing User",
          role: "billing",
          password: "Billing@123",
        }),
        buildSeedUser({
          username: "admin1",
          displayName: "Admin User",
          role: "admin",
          password: "Admin@123",
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
    return parsed;
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

const buildSeedUser = ({ username, displayName, role, password }) => {
  const passwordSalt = crypto.randomBytes(16).toString("hex");
  return {
    id: crypto.randomUUID(),
    username: String(username || "").trim().toLowerCase(),
    displayName: String(displayName || "").trim(),
    role: String(role || "provider").trim().toLowerCase(),
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
});

export const loginWithPassword = ({ username, password, ip = "", userAgent = "" }) => {
  const store = readUserStore();
  const user = findUserByUsername(store, username);
  if (!user) {
    return { ok: false, error: "Invalid username or password." };
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
  challengesById.set(challengeId, {
    challengeId,
    userId: unlocked.id,
    setupRequired,
    createdAtMs: nowMs(),
    expiresAtMs: nowMs() + CHALLENGE_TTL_MS,
    ip: String(ip || "").trim(),
    userAgent: String(userAgent || "").trim().slice(0, 300),
  });

  return {
    ok: true,
    challenge: {
      challengeId,
      expiresAt: new Date(nowMs() + CHALLENGE_TTL_MS).toISOString(),
      mfaRequired: true,
      mfaSetupRequired: setupRequired,
      setup: setupRequired
        ? {
            secret: unlocked.totp.secret,
            otpauthUri: buildOtpauthUri({
              username: unlocked.username,
              secret: unlocked.totp.secret,
            }),
          }
        : null,
      user: sanitizePublicUser(unlocked),
    },
  };
};

export const verifyLogin2fa = ({ challengeId, code, ip = "", userAgent = "" }) => {
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

  const secret = String(user?.totp?.secret || "");
  const check = verifyTotpCode({ secret, code, user });
  if (!check.ok) {
    return { ok: false, error: "Invalid 2FA code." };
  }

  const updatedUser = {
    ...user,
    totp: {
      ...user.totp,
      enabled: true,
      enabledAt: user.totp?.enabledAt || nowIso(),
      lastUsedCounter: check.counter,
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
    createdAt: nowIso(),
    createdAtMs: nowMs(),
    expiresAtMs: nowMs() + SESSION_TTL_MS,
    mfaVerifiedAtMs: nowMs(),
    ip: String(ip || challenge.ip || "").trim(),
    userAgent: String(userAgent || challenge.userAgent || "").trim().slice(0, 300),
  };
  sessionsByTokenHash.set(tokenHash, session);

  return {
    ok: true,
    token: rawToken,
    expiresAt: new Date(session.expiresAtMs).toISOString(),
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

