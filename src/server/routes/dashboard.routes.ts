import type { BaseRouteDeps } from '../types.ts';
import { createDashboardService } from '../services/dashboard.service.ts';
import { getDb, withNutritionistRLS } from '../lib/rls-context.ts';

export function registerDashboardRoutes(deps: BaseRouteDeps) {
  deps.app.get('/api/dashboard', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const service = createDashboardService({ db: getDb() });
        const stats = await service.getStats(req.user.uid);
        res.json(stats);
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
