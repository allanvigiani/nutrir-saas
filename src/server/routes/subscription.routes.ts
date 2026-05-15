import type { BaseRouteDeps } from '../types.ts';
import { createSubscriptionService } from '../services/subscription.service.ts';
import { prisma } from '../lib/prisma.ts';

export function registerSubscriptionRoutes(deps: BaseRouteDeps) {
  const service = createSubscriptionService({ prisma });

  deps.app.get('/api/subscription', deps.authenticate, async (req: any, res: any) => {
    try {
      const sub = await service.getByNutritionistId(req.user.uid);
      return res.json(sub ?? {});
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.put('/api/subscription', deps.authenticate, async (req: any, res: any) => {
    try {
      const sub = await service.upsert(req.user.uid, req.body);
      return res.json(sub);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Marca lastCheckedAt sem necessidade de corpo
  deps.app.post('/api/subscription/check', deps.authenticate, async (req: any, res: any) => {
    try {
      const sub = await service.upsert(req.user.uid, { lastCheckedAt: new Date() });
      return res.json(sub);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
