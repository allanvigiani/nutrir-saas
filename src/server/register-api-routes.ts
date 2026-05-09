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
  createPaymentLimiter,
  createCalendarLimiter,
  createAuthLimiter,
  createGeneralLimiter,
} from "./middlewares/rate-limit.ts";

type RegisterApiRoutesDeps = BaseRouteDeps & AsaasConfig & GoogleConfig;

export function registerApiRoutes(deps: RegisterApiRoutesDeps) {
  const aiLimiter       = createAiLimiter();
  const emailLimiter    = createEmailLimiter();
  const paymentLimiter  = createPaymentLimiter();
  const calendarLimiter = createCalendarLimiter();
  const authLimiter     = createAuthLimiter();
  const generalLimiter  = createGeneralLimiter();

  // ── AI (Gemini) — 10 req/hora ────────────────────────────────────────────
  deps.app.use('/api/nutrition', aiLimiter);

  // ── Email (Brevo) — 20 req/hora ──────────────────────────────────────────
  deps.app.use('/api/send-meal-plan',     emailLimiter);
  deps.app.use('/api/send-welcome-email', emailLimiter);
  deps.app.use('/api/test-email',         emailLimiter);

  // ── Pagamentos (Asaas) — 30 req/15min ───────────────────────────────────
  deps.app.use('/api/create-checkout-session', paymentLimiter);
  deps.app.use('/api/verify-subscription',     paymentLimiter);
  deps.app.use('/api/create-portal-session',   paymentLimiter);
  deps.app.use('/api/cancel-subscription',     paymentLimiter);

  // ── Google Calendar — 30 req/15min ──────────────────────────────────────
  deps.app.use('/api/create-calendar-event', calendarLimiter);

  // ── Google OAuth — 20 req/15min ──────────────────────────────────────────
  deps.app.use('/api/auth/google', authLimiter);

  // ── Geral (logs, health, webhooks) — 100 req/min ────────────────────────
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
