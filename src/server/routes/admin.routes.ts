/**
 * Rotas do painel administrativo — requer role=admin.
 */
import type { BaseRouteDeps } from '../types.ts';
import { prisma } from '../lib/prisma.ts';

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const nutritionist = await prisma.nutritionist.findUnique({ where: { id: req.user.uid }, select: { role: true } });
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
      const data = await prisma.nutritionist.findMany({ orderBy: { createdAt: 'desc' } });
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Conta total de pacientes
  deps.app.get('/api/admin/patients/count', deps.authenticate, async (req: any, res: any) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const count = await prisma.patient.count();
      return res.json({ count });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Atualiza role ou plan de um nutricionista
  deps.app.patch('/api/admin/nutritionists/:id', deps.authenticate, async (req: any, res: any) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const { id } = req.params;
      const data = await prisma.nutritionist.update({ where: { id }, data: req.body });
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
