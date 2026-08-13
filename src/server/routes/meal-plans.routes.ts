import { z } from 'zod';
import type { BaseRouteDeps } from '../types.ts';
import { createMealPlansService } from '../services/meal-plans.service.ts';
import { createPatientsService } from '../services/patients.service.ts';
import { withNutritionistRLS } from '../lib/rls-context.ts';
import { validateBody } from '../lib/validate.ts';

function computeGracePeriodOver(req: any): boolean {
  if (req.user.isPremium) return false;
  const end = req.user.gracePeriodEndAt;
  return end !== null && new Date(end) < new Date();
}

// Mesmo shape de src/types.ts: { id, label, time?, icon? } — customMeals é array de objetos,
// não de strings (conferido contra os dados reais em produção antes de fechar o schema).
const customMealSchema = z.object({
  id: z.string().max(100),
  label: z.string().max(100),
  time: z.string().max(20).optional(),
  icon: z.string().max(100).optional(),
});

// id/patientId/nutritionistId/accessToken nunca aparecem aqui de propósito — vêm sempre da
// rota/sessão autenticada, nunca do body (mass assignment). `type` também é validado em
// assertValidType no service; repetir aqui só garante um 400 mais cedo com mensagem clara.
const mealPlanSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(['blocks', 'free']).optional(),
  status: z.string().max(30).optional(),
  generalInstructions: z.string().max(5000).nullable().optional(),
  waterIntake: z.string().max(200).nullable().optional(),
  freeTextContent: z.string().max(20000).nullable().optional(),
  mealObservations: z.record(z.string(), z.string().max(4000)).nullable().optional(),
  customMeals: z.array(customMealSchema).max(50).nullable().optional(),
  consultation_id: z.string().max(100).nullable().optional(),
  calculation_id: z.string().max(100).nullable().optional(),
});
const mealPlanCreateSchema = mealPlanSchema;
const mealPlanUpdateSchema = mealPlanSchema.partial();

const mealPlanItemSchema = z.object({
  meal: z.string().min(1).max(100),
  food: z.string().min(1).max(300),
  quantity: z.union([z.string().max(50), z.number()]).optional(),
  unit: z.string().max(30).optional(),
  kcal: z.number().nullable().optional(),
  protein: z.number().nullable().optional(),
  carbs: z.number().nullable().optional(),
  fat: z.number().nullable().optional(),
  base_kcal: z.number().nullable().optional(),
  base_protein: z.number().nullable().optional(),
  base_carbs: z.number().nullable().optional(),
  base_fat: z.number().nullable().optional(),
  base_quantity: z.number().nullable().optional(),
  serving_name: z.string().max(100).nullable().optional(),
  serving_weight: z.number().nullable().optional(),
  weight_in_grams: z.number().nullable().optional(),
  position: z.number().nullable().optional(),
});
const mealPlanItemUpdateSchema = mealPlanItemSchema.partial();
const mealPlanItemsReplaceSchema = z.array(mealPlanItemSchema).max(500);

export function registerMealPlansRoutes(deps: BaseRouteDeps) {
  const service = createMealPlansService();

  // Histórico de planos alimentares de consultas anteriores (deve vir antes de /:patientId/meal-plans)
  deps.app.get('/api/patients/:patientId/meal-plans/history', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const excludeConsultationId = typeof req.query.excludeConsultationId === 'string'
          ? req.query.excludeConsultationId
          : undefined;
        const historico = await service.getHistory(req.user.uid, req.params.patientId, excludeConsultationId);
        res.json(historico);
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.get('/api/patients/:patientId/meal-plans', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.list(req.user.uid, req.params.patientId));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.get('/api/meal-plans/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.getOne(req.user.uid, req.params.id));
      });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  });

  deps.app.post('/api/patients/:patientId/meal-plans', deps.authenticate, async (req: any, res: any) => {
    const body = validateBody(mealPlanCreateSchema, req, res);
    if (!body) return;
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const patientsService = createPatientsService();
        const gracePeriodOver = computeGracePeriodOver(req);
        const readOnly = await patientsService.isPatientReadOnly(req.user.uid, req.params.patientId, gracePeriodOver);
        if (readOnly) {
          return res.status(403).json({ error: 'Este paciente está em somente leitura. Faça upgrade para o plano Premium para retomar o acesso.' });
        }
        res.status(201).json(await service.create(req.user.uid, req.params.patientId, body, req.user.isPremium));
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/meal-plans/:id', deps.authenticate, async (req: any, res: any) => {
    const body = validateBody(mealPlanUpdateSchema, req, res);
    if (!body) return;
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.update(req.user.uid, req.params.id, body));
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/meal-plans/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        await service.remove(req.user.uid, req.params.id);
        res.status(204).send();
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  // Items
  deps.app.get('/api/meal-plans/:mealPlanId/items', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.listItems(req.user.uid, req.params.mealPlanId));
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.post('/api/meal-plans/:mealPlanId/items', deps.authenticate, async (req: any, res: any) => {
    const body = validateBody(mealPlanItemSchema, req, res);
    if (!body) return;
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.status(201).json(await service.createItem(req.user.uid, req.params.mealPlanId, body));
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/meal-plan-items/:id', deps.authenticate, async (req: any, res: any) => {
    const body = validateBody(mealPlanItemUpdateSchema, req, res);
    if (!body) return;
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.updateItem(req.user.uid, req.params.id, body));
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/meal-plan-items/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        await service.removeItem(req.user.uid, req.params.id);
        res.status(204).send();
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  // Replace all items of a meal plan atomically
  deps.app.put('/api/meal-plans/:id/items', deps.authenticate, async (req: any, res: any) => {
    const items = validateBody(mealPlanItemsReplaceSchema, req, res);
    if (!items) return;
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.replaceItems(req.user.uid, req.params.id, items));
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });
}
