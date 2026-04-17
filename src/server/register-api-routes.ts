import type { AsaasConfig, BaseRouteDeps, GoogleConfig } from "./types.ts";
import { registerAsaasRoutes } from "./routes/asaas.routes.ts";
import { registerEmailRoutes } from "./routes/email.routes.ts";
import { registerGoogleRoutes } from "./routes/google.routes.ts";
import { registerHealthRoutes } from "./routes/health.routes.ts";

type RegisterApiRoutesDeps = BaseRouteDeps & AsaasConfig & GoogleConfig;

export function registerApiRoutes(deps: RegisterApiRoutesDeps) {
  registerEmailRoutes(deps);
  registerHealthRoutes(deps);
  registerGoogleRoutes(deps);
  registerAsaasRoutes(deps);
}
