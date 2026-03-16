import crypto from "node:crypto";
import { env } from "../config/env.js";

const extractBearerToken = (authorizationHeader = "") => {
  const normalized = String(authorizationHeader || "").trim();
  if (!normalized.toLowerCase().startsWith("bearer ")) return "";
  return normalized.slice(7).trim();
};

const safeEquals = (left = "", right = "") => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const routeKey = (method = "", routePath = "") =>
  `${String(method).toUpperCase().trim()} ${String(routePath).trim()}`;

export const requestIdMiddleware = (request, response, next) => {
  const requestId = crypto.randomUUID();
  request.requestId = requestId;
  response.setHeader("x-request-id", requestId);
  next();
};

export const buildCorsOptions = () => {
  if (!env.corsAllowedOrigins.length) {
    return { origin: true };
  }

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, env.corsAllowedOrigins.includes(origin));
    },
  };
};

export const createApiRateLimitMiddleware = () => {
  const bucketByKey = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of bucketByKey.entries()) {
      if (bucket.resetAt <= now) bucketByKey.delete(key);
    }
  }, Math.max(2000, Math.floor(env.rateLimitWindowMs / 2)));
  cleanup.unref?.();

  return (request, response, next) => {
    if (!env.rateLimitEnabled) {
      next();
      return;
    }

    if (request.method === "OPTIONS") {
      next();
      return;
    }

    const now = Date.now();
    const key = `${request.ip || "unknown"}:${request.method}:${request.path}`;
    const current = bucketByKey.get(key);
    if (!current || current.resetAt <= now) {
      bucketByKey.set(key, {
        count: 1,
        resetAt: now + env.rateLimitWindowMs,
      });
      next();
      return;
    }

    if (current.count >= env.rateLimitMaxRequests) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      response.setHeader("Retry-After", retryAfter);
      response.status(429).json({
        error: "Rate limit exceeded. Please retry shortly.",
        requestId: request.requestId,
      });
      return;
    }

    current.count += 1;
    bucketByKey.set(key, current);
    next();
  };
};

export const createApiKeyMiddleware = ({ publicRoutes = [] } = {}) => {
  const publicRouteSet = new Set(publicRoutes.map((route) => routeKey(route.method, route.path)));

  return (request, response, next) => {
    if (!env.requireApiKey) {
      next();
      return;
    }

    const normalized = routeKey(request.method, request.path);
    if (publicRouteSet.has(normalized)) {
      next();
      return;
    }

    if (!env.internalApiKey) {
      response.status(503).json({
        error: "API key auth enabled but INTERNAL_API_KEY is not configured.",
        requestId: request.requestId,
      });
      return;
    }

    const keyFromHeader = String(request.get("x-internal-api-key") || "").trim();
    const keyFromBearer = extractBearerToken(request.get("authorization"));
    const presentedKey = keyFromHeader || keyFromBearer;
    if (!presentedKey || !safeEquals(presentedKey, env.internalApiKey)) {
      response.status(401).json({
        error: "Unauthorized API request.",
        requestId: request.requestId,
      });
      return;
    }

    next();
  };
};
