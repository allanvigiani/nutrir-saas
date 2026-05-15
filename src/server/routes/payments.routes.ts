import type { BaseRouteDeps } from '../types.ts';
import { createPaymentsService } from '../services/payments.service.ts';
import { prisma } from '../lib/prisma.ts';

export function registerPaymentsRoutes(deps: BaseRouteDeps) {
  const service = createPaymentsService({ prisma });

  deps.app.get('/api/payments', deps.authenticate, async (req: any, res: any) => {
    return res.json(await service.list(req.user.uid));
  });

  deps.app.post('/api/payments', deps.authenticate, async (req: any, res: any) => {
    try {
      const data = await service.create(req.user.uid, { ...req.body, date: new Date(req.body.date) });
      return res.status(201).json(data);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/payments/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      return res.json(await service.update(req.user.uid, req.params.id, req.body));
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/payments/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await service.remove(req.user.uid, req.params.id);
      return res.status(204).send();
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });
}
