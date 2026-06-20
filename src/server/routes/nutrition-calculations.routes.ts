import type { BaseRouteDeps } from '../types.ts';
import { createNutritionCalculationsService } from '../services/nutrition-calculations.service.ts';
import { withNutritionistRLS } from '../lib/rls-context.ts';

export function registerNutritionCalculationsRoutes(deps: BaseRouteDeps) {
  const service = createNutritionCalculationsService();

  deps.app.get('/api/patients/:patientId/calculations', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.list(req.user.uid, req.params.patientId));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.post('/api/patients/:patientId/calculations', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.status(201).json(await service.create(req.user.uid, req.params.patientId, req.body));
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.put('/api/calculations/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.update(req.user.uid, req.params.id, req.body));
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.delete('/api/calculations/:id', deps.authenticate, async (req: any, res: any) => {
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
