import { z } from 'zod';
import type { BaseRouteDeps } from '../types.ts';
import { createCustomFoodsService } from '../services/custom-foods.service.ts';
import { withNutritionistRLS } from '../lib/rls-context.ts';
import { validateBody } from '../lib/validate.ts';

const customFoodSchema = z.object({
  name: z.string().trim().min(1).max(200),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  baseUnit: z.string().min(1).max(20),
  baseQuantity: z.number(),
  serving: z.record(z.string(), z.unknown()).nullable().optional(),
});
const customFoodCreateSchema = customFoodSchema;
const customFoodUpdateSchema = customFoodSchema.partial();

export function registerCustomFoodsRoutes(deps: BaseRouteDeps) {
  const service = createCustomFoodsService();

  deps.app.get('/api/custom-foods', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const data = await service.list(req.user.uid);
        res.json(data);
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.post('/api/custom-foods', deps.authenticate, async (req: any, res: any) => {
    const body = validateBody(customFoodCreateSchema, req, res);
    if (!body) return;
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const data = await service.create(req.user.uid, body);
        res.status(201).json(data);
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/custom-foods/:id', deps.authenticate, async (req: any, res: any) => {
    const body = validateBody(customFoodUpdateSchema, req, res);
    if (!body) return;
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const data = await service.update(req.user.uid, req.params.id, body);
        res.json(data);
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/custom-foods/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        await service.remove(req.user.uid, req.params.id);
        res.status(204).send();
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });
}
