import pino from "pino";

/**
 * Abstração de Logging para o Sistema.
 * 
 * Esta estrutura permite que você mude de plataforma (Axiom, Google Cloud, BetterStack)
 * apenas alterando a configuração do 'transport' neste arquivo, sem tocar no resto do código.
 */

// Consideramos ambientes de "nuvem" tanto produção quanto homologação
const isCloudEnv = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "homolog";

// Configuração do Transport (Onde os logs serão enviados)
const transport = pino.transport({
  targets: [
    // Em produção, envia para o Axiom
    ...(isCloudEnv && process.env.AXIOM_TOKEN
      ? [
          {
            target: "@axiomhq/pino",
            options: {
              dataset: process.env.AXIOM_DATASET || "nutrir-saas",
              token: process.env.AXIOM_TOKEN,
            },
            level: "info",
          },
        ]
      : []),
    // No console (Dev), exibe os logs de forma legível
    {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
      level: "debug",
    },
  ],
});

// Instância base do Pino
const pinoLogger = pino(transport);

/**
 * Interface Genérica de Logger
 */
export const logger = {
  /**
   * Log de Informação Geral
   */
  info: (message: string, context?: Record<string, any>) => {
    pinoLogger.info(context || {}, message);
  },

  /**
   * Log de Erro
   */
  error: (message: string, error?: any, context?: Record<string, any>) => {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;

    pinoLogger.error({ ...context, error: errorData }, message);
  },

  /**
   * Log de Aviso
   */
  warn: (message: string, context?: Record<string, any>) => {
    pinoLogger.warn(context || {}, message);
  },

  /**
   * Log de Debug (útil em desenvolvimento)
   */
  debug: (message: string, context?: Record<string, any>) => {
    pinoLogger.debug(context || {}, message);
  },
};
