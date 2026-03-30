import fs from "node:fs/promises";
import path from "node:path";
import { BlobServiceClient } from "@azure/storage-blob";
import { env, featureFlags } from "../config/env.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const getAzureSpeechToken = async () => {
  if (!featureFlags.hasAzureSpeech) {
    return { configured: false, token: null, region: null };
  }

  const endpoint = `https://${env.azureSpeechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.azureSpeechKey,
      "Content-Length": "0",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Azure speech token failed (${response.status}): ${body}`);
  }

  const token = await response.text();
  return {
    configured: true,
    token,
    region: env.azureSpeechRegion,
  };
};

const makeSafeName = (input) => String(input || "recording.webm").replace(/[^a-zA-Z0-9_.-]/g, "_");

const normalizeRetentionDays = (value, fallback = env.recordingRetentionDays || 60) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(1, Number(fallback || 60));
  return Math.max(1, Math.floor(parsed));
};

const buildRetentionWindow = (retentionDays) => {
  const uploadedMs = Date.now();
  return {
    uploadedAt: new Date(uploadedMs).toISOString(),
    retentionExpiresAt: new Date(uploadedMs + retentionDays * DAY_MS).toISOString(),
  };
};

const toTimestampOrZero = (value) => {
  const parsed = new Date(String(value || "")).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const listEntriesSafe = async (dirPath) => {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
};

const deleteIfExpired = async (filePath, cutoffMs) => {
  try {
    const stat = await fs.stat(filePath);
    const modifiedAt = Number(stat.mtimeMs || 0);
    if (!Number.isFinite(modifiedAt) || modifiedAt >= cutoffMs) return false;
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
};

const removeDirIfEmpty = async (dirPath) => {
  try {
    const entries = await fs.readdir(dirPath);
    if (entries.length === 0) {
      await fs.rmdir(dirPath);
    }
  } catch {}
};

const cleanupExpiredLocalRecordings = async (rootDir, retentionDays) => {
  const retentionMs = normalizeRetentionDays(retentionDays) * DAY_MS;
  const cutoffMs = Date.now() - retentionMs;
  const rootEntries = await listEntriesSafe(rootDir);

  for (const entry of rootEntries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const appointmentEntries = await listEntriesSafe(fullPath);
      for (const appointmentEntry of appointmentEntries) {
        if (!appointmentEntry.isFile()) continue;
        await deleteIfExpired(path.join(fullPath, appointmentEntry.name), cutoffMs);
      }
      await removeDirIfEmpty(fullPath);
      continue;
    }
    if (entry.isFile()) {
      await deleteIfExpired(fullPath, cutoffMs);
    }
  }
};

const cleanupExpiredAzureRecordings = async (containerClient) => {
  let scanned = 0;
  let deleted = 0;
  for await (const blob of containerClient.listBlobsFlat({ includeMetadata: true })) {
    scanned += 1;
    if (scanned > 1200 || deleted >= 150) break;
    const expiresAt = String(blob?.metadata?.retentionexpiresat || "").trim();
    const expiresMs = toTimestampOrZero(expiresAt);
    if (!expiresMs || expiresMs > Date.now()) continue;
    try {
      await containerClient.deleteBlob(blob.name, { deleteSnapshots: "include" });
      deleted += 1;
    } catch {}
  }
};

export const uploadAppointmentAudio = async ({
  appointmentId,
  buffer,
  mimeType,
  fileName,
  retentionDays = env.recordingRetentionDays,
}) => {
  const normalizedRetentionDays = normalizeRetentionDays(retentionDays);
  const { uploadedAt, retentionExpiresAt } = buildRetentionWindow(normalizedRetentionDays);
  const safeName = makeSafeName(fileName);
  const blobName = `${appointmentId}/${Date.now()}-${safeName}`;

  if (!featureFlags.hasAzureBlobStorage) {
    const targetDir = path.resolve(process.cwd(), "uploads", appointmentId);
    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, `${Date.now()}-${safeName}`);
    await fs.writeFile(targetPath, buffer);
    cleanupExpiredLocalRecordings(path.resolve(process.cwd(), "uploads"), normalizedRetentionDays).catch(
      () => {}
    );
    return {
      provider: "local-fallback",
      location: targetPath,
      mimeType,
      blobName,
      uploadedAt,
      retentionDays: normalizedRetentionDays,
      retentionExpiresAt,
    };
  }

  const service = BlobServiceClient.fromConnectionString(env.azureStorageConnectionString);
  const container = service.getContainerClient(env.azureStorageContainer);
  await container.createIfNotExists();

  const blockBlob = container.getBlockBlobClient(blobName);
  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: mimeType || "audio/webm",
    },
    metadata: {
      uploadedat: uploadedAt,
      retentiondays: String(normalizedRetentionDays),
      retentionexpiresat: retentionExpiresAt,
    },
  });
  cleanupExpiredAzureRecordings(container).catch(() => {});

  return {
    provider: "azure-blob",
    location: blockBlob.url,
    mimeType,
    blobName,
    uploadedAt,
    retentionDays: normalizedRetentionDays,
    retentionExpiresAt,
  };
};
