import type { BaseRouteDeps } from '../types.ts';
import { createLabExamsService } from '../services/lab-exams.service.ts';
import { prisma } from '../lib/prisma.ts';

export function registerLabExamsRoutes(deps: BaseRouteDeps) {
  const service = createLabExamsService({ prisma });

  deps.app.get('/api/patients/:patientId/lab-exams', deps.authenticate, async (req: any, res: any) => {
    return res.json(await service.list(req.user.uid, req.params.patientId));
  });

  deps.app.post('/api/patients/:patientId/lab-exams', deps.authenticate, async (req: any, res: any) => {
    try {
      return res.status(201).json(await service.create(req.user.uid, req.params.patientId, req.body));
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/lab-exams/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      return res.json(await service.update(req.user.uid, req.params.id, req.body));
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/lab-exams/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await service.remove(req.user.uid, req.params.id);
      return res.status(204).send();
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });
}
