import type { BaseRouteDeps } from '../types.ts';
import { createCustomFoodsService } from '../services/custom-foods.service.ts';
import { prisma } from '../lib/prisma.ts';

export function registerCustomFoodsRoutes(deps: BaseRouteDeps) {
  const service = createCustomFoodsService({ prisma });

  deps.app.get('/api/custom-foods', deps.authenticate, async (req: any, res: any) => {
    const data = await service.list(req.user.uid);
    return res.json(data);
  });

  deps.app.post('/api/custom-foods', deps.authenticate, async (req: any, res: any) => {
    try {
      const data = await service.create(req.user.uid, req.body);
      return res.status(201).json(data);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/custom-foods/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      const data = await service.update(req.user.uid, req.params.id, req.body);
      return res.json(data);
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/custom-foods/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await service.remove(req.user.uid, req.params.id);
      return res.status(204).send();
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });
}
