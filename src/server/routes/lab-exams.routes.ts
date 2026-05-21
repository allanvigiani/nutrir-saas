import type { BaseRouteDeps } from '../types.ts';
import { createLabExamsService } from '../services/lab-exams.service.ts';
import { createPatientsService } from '../services/patients.service.ts';
import { withNutritionistRLS } from '../lib/rls-context.ts';

function computeGracePeriodOver(req: any): boolean {
  if (req.user.isPremium) return false;
  const end = req.user.gracePeriodEndAt;
  return end !== null && new Date(end) < new Date();
}

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
        const patientsService = createPatientsService();
        const gracePeriodOver = computeGracePeriodOver(req);
        const readOnly = await patientsService.isPatientReadOnly(req.user.uid, req.params.patientId, gracePeriodOver);
        if (readOnly) {
          return res.status(403).json({ error: 'Este paciente está em somente leitura. Faça upgrade para o plano Premium para retomar o acesso.' });
        }
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
