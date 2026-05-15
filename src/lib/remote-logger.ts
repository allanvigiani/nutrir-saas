const CONSENT_KEY = 'nutrir_cookie_consent';

function analyticsAllowed(): boolean {
  return localStorage.getItem(CONSENT_KEY) === 'all';
}

/**
 * Helper para enviar logs do Frontend para o Backend (Axiom).
 * Só envia quando o usuário consentiu com cookies analíticos (LGPD).
 */
export const remoteLogger = {
  info: (message: string, context?: any) => {
    if (!analyticsAllowed()) return Promise.resolve();
    return fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "info", message, context }),
    }).catch(() => {});
  },

  error: (message: string, error?: any, context?: any) => {
    if (!analyticsAllowed()) return Promise.resolve();
    const errorData = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    return fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "error", message, context: { ...context, error: errorData } }),
    }).catch(() => {});
  },

  warn: (message: string, context?: any) => {
    if (!analyticsAllowed()) return Promise.resolve();
    return fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "warn", message, context }),
    }).catch(() => {});
  },
};
