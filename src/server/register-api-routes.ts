import type { AsaasConfig, BaseRouteDeps, GoogleConfig } from "./types.ts";
import { registerAsaasRoutes } from "./routes/asaas.routes.ts";
import { registerEmailRoutes } from "./routes/email.routes.ts";
import { registerGoogleRoutes } from "./routes/google.routes.ts";
import { registerHealthRoutes } from "./routes/health.routes.ts";
import { registerNutritionRoutes } from "./routes/nutrition.routes.ts";
import { registerLogRoutes } from "./routes/log.routes.ts";
import { logger } from "./logger.ts";

type RegisterApiRoutesDeps = BaseRouteDeps & AsaasConfig & GoogleConfig;

export function registerApiRoutes(deps: RegisterApiRoutesDeps) {
  registerEmailRoutes(deps);
  registerHealthRoutes(deps);
  registerGoogleRoutes(deps);
  registerAsaasRoutes(deps);
  registerNutritionRoutes(deps);
  registerLogRoutes(deps.app);

  logger.info("Rotas da API registradas com sucesso");
}
