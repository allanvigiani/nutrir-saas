import pino from "pino";
import { Axiom } from "@axiomhq/js";

/**
 * Abstração de Logging para o Sistema (Versão Compatível com Vercel Hobby/Grátis).
 */

const isCloudEnv = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "homolog";
const axiomDataset = process.env.AXIOM_DATASET || "nutrir-saas";
const axiomToken = process.env.AXIOM_TOKEN;

// Cliente Axiom (usado apenas em nuvem)
const axiom = axiomToken ? new Axiom({ token: axiomToken }) : null;

// Logger para Console (usado em Dev para debug visual)
const consoleLogger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss Z",
      ignore: "pid,hostname",
    },
  },
  level: "debug",
});

/**
 * Interface Genérica de Logger
 */
export const logger = {
  info: (message: string, context?: Record<string, any>) => {
    // 1. Sempre logar no console (Vercel também captura isso)
    consoleLogger.info(context || {}, message);

    // 2. Se estiver na nuvem, enviar para o Axiom via SDK (compatível com Serverless)
    if (isCloudEnv && axiom) {
      axiom.ingest(axiomDataset, [{ 
        level: "info", 
        message, 
        ...context, 
        _time: new Date().toISOString() 
      }]);
    }
  },

  error: (message: string, error?: any, context?: Record<string, any>) => {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;

    consoleLogger.error({ ...context, error: errorData }, message);

    if (isCloudEnv && axiom) {
      axiom.ingest(axiomDataset, [{ 
        level: "error", 
        message, 
        error: errorData, 
        ...context, 
        _time: new Date().toISOString() 
      }]);
    }
  },

  warn: (message: string, context?: Record<string, any>) => {
    consoleLogger.warn(context || {}, message);

    if (isCloudEnv && axiom) {
      axiom.ingest(axiomDataset, [{ 
        level: "warn", 
        message, 
        ...context, 
        _time: new Date().toISOString() 
      }]);
    }
  },

  debug: (message: string, context?: Record<string, any>) => {
    consoleLogger.debug(context || {}, message);
    // Debug geralmente não enviamos para o Axiom para economizar volume
  },

  /**
   * Garante que os logs foram enviados antes de encerrar (opcional na maioria dos casos)
   */
  flush: async () => {
    if (axiom) await axiom.flush();
  }
};
