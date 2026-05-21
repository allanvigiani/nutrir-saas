import type { BaseRouteDeps } from '../types.ts';
import { prisma } from '../lib/prisma.ts';
import { logger } from '../logger.ts';
import { withNutritionistRLS } from '../lib/rls-context.ts';

export function registerSettingsRoutes(deps: BaseRouteDeps) {
  deps.app.get('/api/settings', async (_req: any, res: any) => {
    try {
      const row = await prisma.globalSettings.findUnique({ where: { id: 'global' } });
      return res.json(row?.data ?? {});
    } catch (err: any) {
      logger.error('Erro ao buscar configurações globais', err);
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.put('/api/settings', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const row = await prisma.globalSettings.upsert({
          where: { id: 'global' },
          update: { data: req.body },
          create: { id: 'global', data: req.body },
        });
        res.json(row.data);
      });
    } catch (err: any) {
      logger.error('Erro ao atualizar configurações globais', err);
      return res.status(500).json({ error: err.message });
    }
  });
}
