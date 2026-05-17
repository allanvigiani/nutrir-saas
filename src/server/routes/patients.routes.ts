import type { BaseRouteDeps } from '../types.ts';
import { createPatientsService } from '../services/patients.service.ts';
import { withNutritionistRLS } from '../lib/rls-context.ts';

export function registerPatientsRoutes(deps: BaseRouteDeps) {
  const service = createPatientsService();

  deps.app.get('/api/patients', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.list(req.user.uid));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.get('/api/patients/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.getOne(req.user.uid, req.params.id));
      });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  });

  deps.app.post('/api/patients', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const data = await service.create(req.user.uid, req.body, req.user.isPremium);
        res.status(201).json(data);
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/patients/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.update(req.user.uid, req.params.id, req.body, req.user.isPremium));
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/patients/:id', deps.authenticate, async (req: any, res: any) => {
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
