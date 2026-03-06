import fs from "node:fs/promises";
import path from "node:path";
import { BlobServiceClient } from "@azure/storage-blob";
import { env, featureFlags } from "../config/env.js";

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

export const uploadAppointmentAudio = async ({ appointmentId, buffer, mimeType, fileName }) => {
  const safeName = makeSafeName(fileName);
  const blobName = `${appointmentId}/${Date.now()}-${safeName}`;

  if (!featureFlags.hasAzureBlobStorage) {
    const targetDir = path.resolve(process.cwd(), "uploads", appointmentId);
    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, `${Date.now()}-${safeName}`);
    await fs.writeFile(targetPath, buffer);
    return {
      provider: "local-fallback",
      location: targetPath,
      mimeType,
      blobName,
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
  });

  return {
    provider: "azure-blob",
    location: blockBlob.url,
    mimeType,
    blobName,
  };
};

