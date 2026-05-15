import type { BaseRouteDeps } from '../types.ts';
import { createAppointmentsService } from '../services/appointments.service.ts';
import { prisma } from '../lib/prisma.ts';

export function registerAppointmentsRoutes(deps: BaseRouteDeps) {
  const service = createAppointmentsService({ prisma });

  deps.app.get('/api/appointments', deps.authenticate, async (req: any, res: any) => {
    return res.json(await service.list(req.user.uid));
  });

  deps.app.post('/api/appointments', deps.authenticate, async (req: any, res: any) => {
    try {
      const data = await service.create(req.user.uid, { ...req.body, date: new Date(req.body.date) });
      return res.status(201).json(data);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/appointments/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      const data = await service.update(req.user.uid, req.params.id, req.body);
      return res.json(data);
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/appointments/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await service.remove(req.user.uid, req.params.id);
      return res.status(204).send();
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });
}
