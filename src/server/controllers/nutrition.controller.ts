import { logger } from "../logger.ts";
import { Request, Response } from 'express';
import { NutritionCalculationInput } from '../services/nutrition.service.ts';

type NutritionControllerDeps = {
  nutritionService: {
    calculateNutrition: (input: NutritionCalculationInput) => any;
  };
};

export function createNutritionController({ nutritionService }: NutritionControllerDeps) {
  async function calculate(req: Request, res: Response) {
    try {
      const input: NutritionCalculationInput = req.body;

      // Validate minimum required inputs
      if (!input.peso || !input.altura || !input.idade || !input.sexo || !input.nivelAtividade || !input.objetivo) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = nutritionService.calculateNutrition(input);
      return res.status(200).json(result);
    } catch (error: any) {
      logger.error("[Nutrition] Calculation error", error);
      return res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  return {
    calculate
  };
}
