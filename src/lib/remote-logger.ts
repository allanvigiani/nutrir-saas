/**
 * Helper para enviar logs do Frontend para o Backend (Axiom).
 */
export const remoteLogger = {
  info: (message: string, context?: any) => {
    return fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "info", message, context }),
    }).catch(() => {}); // Falha silenciosa no front
  },

  error: (message: string, error?: any, context?: any) => {
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
    return fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "warn", message, context }),
    }).catch(() => {});
  },
};
