import type { BaseRouteDeps } from '../types.ts';
import { createLabExamsService } from '../services/lab-exams.service.ts';
import { withNutritionistRLS } from '../lib/rls-context.ts';

export function registerLabExamsRoutes(deps: BaseRouteDeps) {
  const service = createLabExamsService();

  deps.app.get('/api/patients/:patientId/lab-exams', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.list(req.user.uid, req.params.patientId));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.post('/api/patients/:patientId/lab-exams', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.status(201).json(await service.create(req.user.uid, req.params.patientId, req.body, req.user.isPremium));
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/lab-exams/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.update(req.user.uid, req.params.id, req.body));
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/lab-exams/:id', deps.authenticate, async (req: any, res: any) => {
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
