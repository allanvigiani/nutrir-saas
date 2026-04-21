import { logger } from "../logger.ts";

export function registerLogRoutes(app: any) {
  /**
   * Endpoint para receber logs do Frontend.
   * Isso permite capturar eventos como Login/Logout no Axiom.
   */
  app.post("/api/logs", (req: any, res: any) => {
    const { level, message, context } = req.body;

    switch (level) {
      case "error":
        logger.error(message, context?.error, context);
        break;
      case "warn":
        logger.warn(message, context);
        break;
      case "info":
      default:
        logger.info(message, context);
        break;
    }

    res.status(204).send();
  });
}
