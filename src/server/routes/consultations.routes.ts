import type { BaseRouteDeps } from '../types.ts';
import { createConsultationsService } from '../services/consultations.service.ts';
import { prisma } from '../lib/prisma.ts';

export function registerConsultationsRoutes(deps: BaseRouteDeps) {
  const service = createConsultationsService({ prisma });

  deps.app.get('/api/patients/:patientId/consultations', deps.authenticate, async (req: any, res: any) => {
    return res.json(await service.list(req.user.uid, req.params.patientId));
  });

  deps.app.post('/api/patients/:patientId/consultations', deps.authenticate, async (req: any, res: any) => {
    try {
      const data = await service.create(req.user.uid, req.params.patientId, req.body);
      return res.status(201).json(data);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/consultations/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      return res.json(await service.update(req.user.uid, req.params.id, req.body));
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/consultations/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await service.remove(req.user.uid, req.params.id);
      return res.status(204).send();
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });
}
