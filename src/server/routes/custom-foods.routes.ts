import type { BaseRouteDeps } from '../types.ts';
import { createCustomFoodsService } from '../services/custom-foods.service.ts';
import { withNutritionistRLS } from '../lib/rls-context.ts';

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
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const data = await service.create(req.user.uid, req.body);
        res.status(201).json(data);
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/custom-foods/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const data = await service.update(req.user.uid, req.params.id, req.body);
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
