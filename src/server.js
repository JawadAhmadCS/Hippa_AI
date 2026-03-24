import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { env } from "./config/env.js";
import apiRouter from "./routes/api.js";
import {
  buildCorsOptions,
  createApiKeyMiddleware,
  createApiRateLimitMiddleware,
  requestIdMiddleware,
} from "./services/security-service.js";

const app = express();
const publicPath = path.resolve(process.cwd(), "public");

app.disable("x-powered-by");
if (env.trustProxy) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  })
);
app.use(requestIdMiddleware);
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: `${env.requestBodyLimitMb}mb` }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicPath));

app.use(
  "/api",
  createApiRateLimitMiddleware(),
  createApiKeyMiddleware({
    publicRoutes: [
      { method: "GET", path: "/health" },
      { method: "GET", path: "/compliance/status" },
      { method: "POST", path: "/auth/login" },
      { method: "POST", path: "/auth/2fa/verify" },
    ],
  }),
  apiRouter
);

app.get("*", (_request, response) => {
  response.sendFile(path.join(publicPath, "index.html"));
});

app.listen(env.port, () => {
  console.log(`HIPAA revenue assistant prototype listening on http://localhost:${env.port}`);
});
