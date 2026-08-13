import type { BaseRouteDeps } from "../types.ts";
import { createEmailService } from "../services/email.service.ts";
import { createEmailController } from "../controllers/email.controller.ts";
import { createPatientsService } from "../services/patients.service.ts";
import { createMealPlansService } from "../services/meal-plans.service.ts";

export function registerEmailRoutes(deps: BaseRouteDeps) {
  const emailService = createEmailService();
  const patientsService = createPatientsService();
  const mealPlansService = createMealPlansService();
  const controller = createEmailController({ emailService, patientsService, mealPlansService });

  deps.app.post("/api/test-email", deps.authenticate, controller.testEmail);
  deps.app.post("/api/send-welcome-email", deps.authenticate, controller.sendWelcomeEmail);
  deps.app.post("/api/send-meal-plan", deps.authenticate, controller.sendMealPlan);
}
