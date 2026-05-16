import type { BaseRouteDeps } from '../types.ts';
import { createDashboardService } from '../services/dashboard.service.ts';
import { prisma } from '../lib/prisma.ts';

export function registerDashboardRoutes(deps: BaseRouteDeps) {
  const service = createDashboardService({ prisma });

  deps.app.get('/api/dashboard/stats', deps.authenticate, async (req: any, res: any) => {
    try {
      return res.json(await service.getStats(req.user.uid));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
