import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { env } from "./config/env.js";
import apiRouter from "./routes/api.js";

const app = express();
const publicPath = path.resolve(process.cwd(), "public");

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicPath));

app.use("/api", apiRouter);

app.get("*", (_request, response) => {
  response.sendFile(path.join(publicPath, "index.html"));
});

app.listen(env.port, () => {
  console.log(`HIPAA revenue assistant prototype listening on http://localhost:${env.port}`);
});

