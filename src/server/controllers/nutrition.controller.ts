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
      if (!input.peso || !input.altura || input.idade === undefined || input.idade === null || !input.sexo || !input.nivelAtividade || !input.objetivo) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (input.ajusteObjetivoValor !== undefined && input.ajusteObjetivoValor < 0) {
        return res.status(400).json({ error: "ajusteObjetivoValor deve ser um valor não-negativo (magnitude)" });
      }

      if (input.formulaOverride === 'eer') {
        if (input.idadeMeses !== undefined && (!Number.isInteger(input.idadeMeses) || input.idadeMeses < 0 || input.idadeMeses > 35)) {
          return res.status(400).json({ error: "idadeMeses deve ser um número inteiro entre 0 e 35." });
        }
        const idadeMesesValida = input.idadeMeses !== undefined && input.idadeMeses >= 0 && input.idadeMeses <= 35;
        if (input.idade < 3 && !idadeMesesValida) {
          return res.status(400).json({ error: "EER/DRI para menores de 3 anos exige idade em meses (0 a 35)." });
        }
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
