import type { BaseRouteDeps } from "../types.ts";
import { createNutritionService } from "../services/nutrition.service.ts";
import { createNutritionController } from "../controllers/nutrition.controller.ts";

export function registerNutritionRoutes(deps: BaseRouteDeps) {
  const nutritionService = createNutritionService();
  const controller = createNutritionController({ nutritionService });

  deps.app.post("/api/nutrition/calculate", deps.authenticate, controller.calculate);
}
