import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { createRequire } from "module";
import { createFirestoreHelpers } from "./src/server/firestore-helpers.ts";
import { registerApiRoutes } from "./src/server/register-api-routes.ts";
import { createAuthenticateMiddleware } from "./src/server/middlewares/auth.ts";
import { logger } from "./src/server/logger.ts";

const require = createRequire(import.meta.url);
const firebaseConfig = require("./firebase-applet-config.json");

dotenv.config();

const PORT = 3000;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || "";
const ASAAS_API_URL = process.env.ASAAS_API_URL || "https://sandbox.asaas.com/api/v3";
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;
const GOOGLE_CALENDAR_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || "";
const GOOGLE_CALENDAR_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "";

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function isSuperAdmin(user: { email?: string | null }) {
  const email = (user?.email || "").toLowerCase();
  return email.length > 0 && SUPER_ADMIN_EMAILS.includes(email);
}

async function startServer() {
  const { google } = await import("googleapis");
  const {
    admin,
    getDocWithFallback,
    updateDocWithFallback,
    queryWithFallback,
  } = createFirestoreHelpers(firebaseConfig);

  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());

  // Security Headers
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Content-Security-Policy", [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://*.firebaseio.com https://firestore.googleapis.com",
      "frame-src https://*.firebaseapp.com https://accounts.google.com",
    ].join("; "));
    next();
  });

  // CSRF Protection via SameSite cookies
  app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function(data) {
      res.setHeader("Set-Cookie", `HttpOnly=true; Secure; SameSite=Strict`);
      return originalJson.call(this, data);
    };
    next();
  });

  const authenticate = createAuthenticateMiddleware({ admin });

  app.use((req, res, next) => {
    if (req.path.startsWith("/api/asaas-webhook")) {
      logger.info(`Webhook Request`, { method: req.method, path: req.path });
    }
    next();
  });

  registerApiRoutes({
    app,
    authenticate,
    isSuperAdmin,
    google,
    googleClientId: GOOGLE_CALENDAR_CLIENT_ID,
    googleClientSecret: GOOGLE_CALENDAR_CLIENT_SECRET,
    asaasApiUrl: ASAAS_API_URL,
    asaasApiKey: ASAAS_API_KEY,
    asaasWebhookToken: ASAAS_WEBHOOK_TOKEN,
    getDocWithFallback,
    updateDocWithFallback,
    queryWithFallback,
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error("Erro não tratado na rota", err, { path: req.path });
    res.status(500).json({ error: err.message || "Erro interno do servidor" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Servidor rodando na porta ${PORT}`);
  });
}

startServer();
