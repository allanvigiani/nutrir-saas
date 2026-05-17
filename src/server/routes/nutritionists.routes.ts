import type { BaseRouteDeps } from '../types.ts';
import { createNutritionistsService } from '../services/nutritionists.service.ts';
import { prisma } from '../lib/prisma.ts';
import { withNutritionistRLS } from '../lib/rls-context.ts';

export function registerNutritionistsRoutes(deps: BaseRouteDeps) {
  const service = createNutritionistsService();

  deps.app.get('/api/me', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const data = await service.getMe(req.user.uid);
        res.json(data);
      });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  });

  deps.app.patch('/api/me', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const data = await service.updateMe(req.user.uid, req.body);
        res.json(data);
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Verifica duplicidade de campos únicos (crn, cpf, cnpj) excluindo o próprio usuário
  deps.app.get('/api/me/check-unique', deps.authenticate, async (req: any, res: any) => {
    const { field, value } = req.query as { field: string; value: string };
    if (!field || !value) return res.status(400).json({ error: 'Parâmetros obrigatórios: field, value' });
    const allowed = ['crn', 'cpf', 'cnpj'];
    if (!allowed.includes(field)) return res.status(400).json({ error: 'Campo inválido' });
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const existing = await prisma.nutritionist.findFirst({
          where: { [field]: value, NOT: { id: req.user.uid } },
          select: { id: true },
        });
        res.json({ isDuplicate: !!existing });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Endpoint público para verificar duplicidade durante cadastro (sem autenticação)
  deps.app.get('/api/check-unique', async (req: any, res: any) => {
    const { field, value, excludeUid } = req.query as { field: string; value: string; excludeUid?: string };
    if (!field || !value) return res.status(400).json({ error: 'Parâmetros obrigatórios: field, value' });
    const allowed = ['crn', 'cpf', 'cnpj'];
    if (!allowed.includes(field)) return res.status(400).json({ error: 'Campo inválido' });
    try {
      const where: any = { [field]: value };
      if (excludeUid) where.NOT = { id: excludeUid };
      const existing = await prisma.nutritionist.findFirst({ where, select: { id: true } });
      return res.json({ isDuplicate: !!existing });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
