import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import { registerConnectionHandlers } from "./ws/handler.js";
import { isGeminiConfigured } from "./services/gemini.js";
import { logger } from "./utils/logger.js";

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", geminiConfigured: isGeminiConfigured });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", registerConnectionHandlers);

server.listen(PORT, () => {
  logger.info(`HTTP + WebSocket server listening on port ${PORT}`);
  if (!isGeminiConfigured) {
    logger.warn(
      "GEMINI_API_KEY not set — serving mock card content. Add it to server/.env for real generation."
    );
  }
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception:", err);
});
