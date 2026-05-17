/**
 * Rotas do painel administrativo — requer role=admin.
 */
import type { BaseRouteDeps } from '../types.ts';
import { withAdminRLS, getDb } from '../lib/rls-context.ts'; // getDb usado nos handlers de patients e patch
import { createRetentionService } from '../services/retention.service.ts';
import { createAdminService } from '../services/admin.service.ts';

function assertAdmin(req: any, res: any): boolean {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Acesso negado.' });
    return false;
  }
  return true;
}

export function registerAdminRoutes(deps: BaseRouteDeps) {
  const adminService = createAdminService();

  // Lista todos os nutricionistas (paginado)
  deps.app.get('/api/admin/nutritionists', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const filter = ['atLimit', 'churnRisk'].includes(req.query.filter as string)
        ? (req.query.filter as 'atLimit' | 'churnRisk')
        : undefined;
      await withAdminRLS(async () => {
        res.json(await adminService.listNutritionists({ page, limit, filter }));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Conta total de pacientes
  deps.app.get('/api/admin/patients/count', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        const count = await getDb().patient.count();
        res.json({ count });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Retorna stats ricas do painel admin
  deps.app.get('/api/admin/stats', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        res.json(await adminService.getStats());
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Retorna stats expandidas com métricas mensais de negócio
  deps.app.get('/api/admin/stats/expanded', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        res.json(await adminService.getExpandedStats());
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Atualiza plan de um nutricionista (role é controlado internamente via banco)
  deps.app.patch('/api/admin/nutritionists/:id', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    if (req.body.role !== undefined) {
      return res.status(400).json({ error: 'Alteração de role não é permitida por esta interface.' });
    }
    const { id } = req.params;
    try {
      await withAdminRLS(async () => {
        const target = await getDb().nutritionist.findUnique({
          where: { id },
          select: { email: true, plan: true },
        });

        const updateData: any = { ...req.body };
        if (req.body.plan !== undefined) {
          updateData.planOverridedByAdmin = true;
        }
        const data = await getDb().nutritionist.update({ where: { id }, data: updateData });

        adminService.logAudit({
          adminId: req.user.uid,
          adminEmail: req.user.email || '',
          action: 'set_plan',
          targetId: id,
          targetEmail: target?.email || '',
          previousValue: target?.plan,
          newValue: req.body.plan,
        }).catch(() => {});

        res.json(data);
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Remove permanentemente pacientes com soft delete há mais de 30 dias (LGPD)
  const retentionService = createRetentionService();

  deps.app.post('/api/admin/retention-cleanup', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        const result = await retentionService.cleanupSoftDeleted(30);

        adminService.logAudit({
          adminId: req.user.uid,
          adminEmail: req.user.email || '',
          action: 'retention_cleanup',
          newValue: `${result.deletedCount} pacientes removidos`,
        }).catch(() => {});

        res.json({ message: `${result.deletedCount} pacientes removidos permanentemente.`, ...result });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Retorna logs de auditoria das ações admin
  deps.app.get('/api/admin/audit-logs', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        res.json(await adminService.getAuditLogs(50));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Conta pacientes pendentes de remoção permanente (LGPD)
  deps.app.get('/api/admin/retention/pending', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        const count = await retentionService.countPendingDeletion(30);
        res.json({ count });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Retorna dados operacionais: incomplete profiles, sem pacientes, planos manuais
  deps.app.get('/api/admin/operational', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        res.json(await adminService.getOperationalData());
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
