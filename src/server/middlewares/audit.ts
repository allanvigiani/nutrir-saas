import { logger } from "../logger.ts";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const SENSITIVE_KEYS = new Set([
  "senha",
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "token",
  "idToken",
  "accessToken",
  "refreshToken",
  "secret",
  "authorization",
  "apiKey",
]);

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    sanitized[key] = SENSITIVE_KEYS.has(key) ? "[REDACTED]" : value;
  }
  return sanitized;
}

export function createAuditMiddleware() {
  return (req: any, res: any, next: any) => {
    if (!MUTATING_METHODS.has(req.method)) return next();

    const startedAt = Date.now();

    res.on("finish", () => {
      logger.info("[audit] mutation", {
        userId: req.user?.uid ?? null,
        userEmail: req.user?.email ?? null,
        method: req.method,
        route: req.route?.path ?? req.path,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        body: sanitizeBody(req.body),
      });
    });

    next();
  };
}
