import type { AsaasConfig, BaseRouteDeps, GoogleConfig } from "./types.ts";
import { registerAsaasRoutes } from "./routes/asaas.routes.ts";
import { registerEmailRoutes } from "./routes/email.routes.ts";
import { registerGoogleRoutes } from "./routes/google.routes.ts";
import { registerHealthRoutes } from "./routes/health.routes.ts";
import { registerNutritionRoutes } from "./routes/nutrition.routes.ts";
import { registerLogRoutes } from "./routes/log.routes.ts";
import { logger } from "./logger.ts";
import {
  createAiLimiter,
  createEmailLimiter,
  createCalendarLimiter,
  createAuthLimiter,
  createGeneralLimiter,
} from "./middlewares/rate-limit.ts";

type RegisterApiRoutesDeps = BaseRouteDeps & AsaasConfig & GoogleConfig;

export function registerApiRoutes(deps: RegisterApiRoutesDeps) {
  const aiLimiter       = createAiLimiter();
  const emailLimiter    = createEmailLimiter();
  const calendarLimiter = createCalendarLimiter();
  const authLimiter     = createAuthLimiter();
  const generalLimiter  = createGeneralLimiter();

  // ── AI (Gemini) — 50 req/hora ────────────────────────────────────────────
  deps.app.use('/api/nutrition', aiLimiter);

  // ── Email (Brevo) — 100 req/hora ─────────────────────────────────────────
  deps.app.use('/api/send-meal-plan',     emailLimiter);
  deps.app.use('/api/send-welcome-email', emailLimiter);
  deps.app.use('/api/test-email',         emailLimiter);

  // ── Google Calendar — 150 req/15min ──────────────────────────────────────
  deps.app.use('/api/create-calendar-event', calendarLimiter);

  // ── Google OAuth — 100 req/15min ─────────────────────────────────────────
  deps.app.use('/api/auth/google', authLimiter);

  // ── Geral (logs, health, webhooks) — 500 req/min ─────────────────────────
  deps.app.use('/api/logs',          generalLimiter);
  deps.app.use('/api/health',        generalLimiter);
  deps.app.use('/api/asaas-webhook', generalLimiter);

  // ── Registro das rotas (após os limiters) ───────────────────────────────
  registerEmailRoutes(deps);
  registerHealthRoutes(deps);
  registerGoogleRoutes(deps);
  registerAsaasRoutes(deps);
  registerNutritionRoutes(deps);
  registerLogRoutes(deps.app);

  logger.info("Rotas da API registradas com sucesso (rate limiting ativo)");
}
