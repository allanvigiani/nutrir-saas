import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';

const RATE_LIMIT_MESSAGE = { error: 'Muitas requisições. Aguarde e tente novamente.' };

/** Gemini AI — custo por token. 50 req/hora por IP. */
export function createAiLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 50,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });
}

/** Email via Brevo — custo por envio. 100 req/hora por IP. */
export function createEmailLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });
}

/** Asaas — prevenir criação massiva de cobranças. 150 req/15min por IP. */
export function createPaymentLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 150,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });
}

/** Google Calendar API — respeitar quota diária. 150 req/15min por IP. */
export function createCalendarLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 150,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });
}

/** Google OAuth — prevenir abuso de redirect/callback. 100 req/15min por IP. */
export function createAuthLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });
}

/** Rotas sem custo direto — proteger o servidor. 500 req/min por IP. */
export function createGeneralLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 500,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });
}
