import type { BaseRouteDeps, AsaasConfig } from "../types.ts";
import { createAsaasClient } from "../integrations/asaas.client.ts";
import { createAsaasService } from "../services/asaas.service.ts";
import { createAsaasController } from "../controllers/asaas.controller.ts";

export function registerAsaasRoutes(deps: BaseRouteDeps & AsaasConfig) {
  const asaasClient = createAsaasClient({
    asaasApiUrl: deps.asaasApiUrl,
    asaasApiKey: deps.asaasApiKey,
  });

  const asaasService = createAsaasService({
    asaasClient,
    getDocWithFallback: deps.getDocWithFallback,
    updateDocWithFallback: deps.updateDocWithFallback,
    queryWithFallback: deps.queryWithFallback,
  });

  const controller = createAsaasController({
    isSuperAdmin: deps.isSuperAdmin,
    asaasWebhookToken: deps.asaasWebhookToken,
    asaasService,
  });

  deps.app.get("/api/asaas-webhook", controller.getWebhook);
  deps.app.post(["/api/asaas-webhook", "/api/asaas-webhook/"], controller.postWebhook);

  deps.app.post("/api/create-checkout-session", deps.authenticate, controller.createCheckoutSession);
  deps.app.post("/api/verify-subscription", deps.authenticate, controller.verifySubscription);
  deps.app.post("/api/create-portal-session", deps.authenticate, controller.createPortalSession);
  deps.app.post("/api/cancel-subscription", deps.authenticate, controller.cancelSubscription);
}
