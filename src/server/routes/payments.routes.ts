import type { BaseRouteDeps } from '../types.ts';
import { createPaymentsService } from '../services/payments.service.ts';
import { withNutritionistRLS } from '../lib/rls-context.ts';

export function registerPaymentsRoutes(deps: BaseRouteDeps) {
  const service = createPaymentsService();

  deps.app.get('/api/payments', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.list(req.user.uid));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.post('/api/payments', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const data = await service.create(req.user.uid, { ...req.body, date: new Date(req.body.date) });
        res.status(201).json(data);
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/payments/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.update(req.user.uid, req.params.id, req.body));
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/payments/:id', deps.authenticate, async (req: any, res: any) => {
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
