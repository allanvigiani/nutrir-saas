import express from "express";
import admin from "firebase-admin";
import { google } from "googleapis";
import { registerApiRoutes } from "./src/server/register-api-routes";
import { createAuthenticateMiddleware, requirePremiumOrAdmin } from "./src/server/middlewares/auth";
import { createSubscriptionExpiryMiddleware } from "./src/server/middlewares/subscription-expiry";
import { logger } from "./src/server/logger";

console.log("[startup] server-vercel.ts iniciando...");

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-667b6";

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

console.log("[startup] env check:", {
  FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
  FIREBASE_SERVICE_ACCOUNT: !!process.env.FIREBASE_SERVICE_ACCOUNT,
  DATABASE_URL: !!process.env.DATABASE_URL,
  ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
  NODE_ENV: process.env.NODE_ENV,
});

if (!admin.apps.length) {
  let serviceAccount: object | null = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log("[startup] Firebase: service account carregado OK");
    } catch (e) {
      console.error("[startup] Firebase: FIREBASE_SERVICE_ACCOUNT não é JSON válido:", e);
    }
  } else {
    console.warn("[startup] Firebase: FIREBASE_SERVICE_ACCOUNT não configurada — usando applicationDefault()");
  }

  try {
    admin.initializeApp({
      credential: serviceAccount
        ? admin.credential.cert(serviceAccount as admin.ServiceAccount)
        : admin.credential.applicationDefault(),
      projectId: FIREBASE_PROJECT_ID,
    });
    console.log("[startup] Firebase Admin inicializado OK");
  } catch (e) {
    console.error("[startup] Firebase Admin falhou ao inicializar:", e);
  }
}

const app = express();
app.set("trust proxy", true);
app.use(express.json());

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

app.use((req, res, next) => {
  if (req.path.startsWith("/api/asaas-webhook")) {
    logger.info(`Webhook Request`, { method: req.method, path: req.path });
  }
  next();
});

const rawAuthenticate = createAuthenticateMiddleware({ admin });
const checkSubscriptionExpiry = createSubscriptionExpiryMiddleware();

async function authenticate(req: any, res: any, next: any): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    rawAuthenticate(req, res, (err?: any) => {
      if (err) return reject(err);
      resolve();
    });
  }).then(() => checkSubscriptionExpiry(req, res, next))
    .catch((err) => next(err));
}

console.log("[startup] registrando rotas...");
registerApiRoutes({
  app,
  authenticate,
  requirePremiumOrAdmin,
  isSuperAdmin,
  admin,
  google,
  googleClientId: GOOGLE_CALENDAR_CLIENT_ID,
  googleClientSecret: GOOGLE_CALENDAR_CLIENT_SECRET,
  asaasApiUrl: ASAAS_API_URL,
  asaasApiKey: ASAAS_API_KEY,
  asaasWebhookToken: ASAAS_WEBHOOK_TOKEN,
});

console.log("[startup] servidor pronto ✓");

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("Erro não tratado na rota", err, { path: req.path });
  res.status(500).json({ error: err.message || "Erro interno do servidor" });
});

export default app;
