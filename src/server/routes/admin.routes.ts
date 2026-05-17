/**
 * Rotas do painel administrativo — requer role=admin.
 */
import type { BaseRouteDeps } from '../types.ts';
import { withAdminRLS, getDb } from '../lib/rls-context.ts';
import { createRetentionService } from '../services/retention.service.ts';

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const nutritionist = await withAdminRLS(() =>
    getDb().nutritionist.findUnique({ where: { id: req.user.uid }, select: { role: true } })
  );
  if (nutritionist?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso negado.' });
    return false;
  }
  return true;
}

export function registerAdminRoutes(deps: BaseRouteDeps) {
  // Lista todos os nutricionistas
  deps.app.get('/api/admin/nutritionists', deps.authenticate, async (req: any, res: any) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      await withAdminRLS(async () => {
        const data = await getDb().nutritionist.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(data);
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Conta total de pacientes
  deps.app.get('/api/admin/patients/count', deps.authenticate, async (req: any, res: any) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      await withAdminRLS(async () => {
        const count = await getDb().patient.count();
        res.json({ count });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Atualiza role ou plan de um nutricionista
  deps.app.patch('/api/admin/nutritionists/:id', deps.authenticate, async (req: any, res: any) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const { id } = req.params;
      await withAdminRLS(async () => {
        const data = await getDb().nutritionist.update({ where: { id }, data: req.body });
        res.json(data);
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Remove permanentemente pacientes com soft delete há mais de 30 dias (LGPD)
  deps.app.post('/api/admin/retention-cleanup', deps.authenticate, async (req: any, res: any) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      await withAdminRLS(async () => {
        const retentionService = createRetentionService();
        const result = await retentionService.cleanupSoftDeleted(30);
        res.json({ message: `${result.deletedCount} pacientes removidos permanentemente.`, ...result });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
