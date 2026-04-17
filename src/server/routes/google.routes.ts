import type { BaseRouteDeps, GoogleConfig } from "../types.ts";
import { createGoogleCalendarService } from "../services/google-calendar.service.ts";
import { createGoogleController } from "../controllers/google.controller.ts";

export function registerGoogleRoutes(deps: BaseRouteDeps & GoogleConfig) {
  const googleService = createGoogleCalendarService({
    google: deps.google,
    googleClientId: deps.googleClientId,
    googleClientSecret: deps.googleClientSecret,
    getDocWithFallback: deps.getDocWithFallback,
    updateDocWithFallback: deps.updateDocWithFallback,
    queryWithFallback: deps.queryWithFallback,
  });

  const controller = createGoogleController({
    isSuperAdmin: deps.isSuperAdmin,
    googleService,
  });

  deps.app.get("/api/auth/google/url", controller.getAuthUrl);
  deps.app.get("/api/auth/google/callback", controller.callback);
  deps.app.post("/api/create-calendar-event", deps.authenticate, controller.createCalendarEvent);
}
