/**
 * Rotas públicas do portal do paciente — autenticação por access_token (sem JWT).
 * Estas rotas são acessíveis sem autenticação Firebase, apenas com o token do paciente.
 */
import type { BaseRouteDeps } from '../types.ts';
import { withPortalAuth, withAdminRLS, getDb } from '../lib/rls-context.ts';

export function registerPatientPortalRoutes(deps: BaseRouteDeps) {
  // Verifica o token e retorna dados do paciente + nutricionista
  deps.app.get('/api/portal/patients/:id', async (req: any, res: any) => {
    const { id } = req.params;
    const { token } = req.query;

    if (!token) return res.status(401).json({ error: 'Token obrigatório' });

    try {
      await withPortalAuth(id, token as string, async (patient) => {
        const nutritionist = await getDb().nutritionist.findUnique({
          where: { id: patient.nutritionistId },
          select: { id: true, name: true, crn: true, email: true, photoUrl: true, phone: true },
        });
        res.json({ patient, nutritionist });
      });
    } catch (err: any) {
      const status = (err as any).status ?? 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // Consultas do paciente via token
  deps.app.get('/api/portal/patients/:id/consultations', async (req: any, res: any) => {
    const { id } = req.params;
    const { token } = req.query;
    if (!token) return res.status(401).json({ error: 'Token obrigatório' });
    try {
      await withPortalAuth(id, token as string, async () => {
        const consultations = await getDb().consultation.findMany({
          where: { patientId: id },
          orderBy: { date: 'desc' },
        });
        res.json(consultations);
      });
    } catch (err: any) {
      const status = (err as any).status ?? 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // Planos alimentares do paciente via token
  deps.app.get('/api/portal/patients/:id/meal-plans', async (req: any, res: any) => {
    const { id } = req.params;
    const { token } = req.query;
    if (!token) return res.status(401).json({ error: 'Token obrigatório' });
    try {
      await withPortalAuth(id, token as string, async () => {
        const plans = await getDb().mealPlan.findMany({
          where: { patientId: id },
          orderBy: { createdAt: 'desc' },
        });
        res.json(plans);
      });
    } catch (err: any) {
      const status = (err as any).status ?? 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // Itens de um plano alimentar via token
  deps.app.get('/api/portal/meal-plans/:planId/items', async (req: any, res: any) => {
    const { planId } = req.params;
    const { token } = req.query;
    if (!token) return res.status(401).json({ error: 'Token obrigatório' });
    try {
      // Precisamos buscar o plano para descobrir o patientId antes de aplicar o RLS do portal
      const plan = await withAdminRLS(() =>
        getDb().mealPlan.findUnique({
          where: { id: planId },
          select: { patientId: true },
        })
      );
      if (!plan) return res.status(404).json({ error: 'Plano não encontrado.' });

      await withPortalAuth(plan.patientId, token as string, async () => {
        const items = await getDb().mealPlanItem.findMany({ where: { mealPlanId: planId } });
        res.json(items);
      });
    } catch (err: any) {
      const status = (err as any).status ?? 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // Verifica CPF server-side (últimos 3 dígitos)
  deps.app.post('/api/portal/patients/:id/verify-cpf', async (req: any, res: any) => {
    const { id } = req.params;
    const { token, cpfSuffix } = req.body;

    if (!token || !cpfSuffix) return res.status(400).json({ error: 'Token e sufixo obrigatórios.' });

    try {
      await withPortalAuth(id, token, async (patient) => {
        const cleanCpf = patient.cpf.replace(/\D/g, '');
        if (cpfSuffix !== cleanCpf.slice(-3)) {
          res.status(401).json({ error: 'Os 3 últimos dígitos do CPF não conferem.' });
          return;
        }
        res.json({ valid: true });
      });
    } catch (err: any) {
      const status = (err as any).status ?? 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // Exames do paciente via token
  deps.app.get('/api/portal/patients/:id/lab-exams', async (req: any, res: any) => {
    const { id } = req.params;
    const { token } = req.query;
    if (!token) return res.status(401).json({ error: 'Token obrigatório' });
    try {
      await withPortalAuth(id, token as string, async () => {
        const exams = await getDb().labExam.findMany({
          where: { patientId: id },
          orderBy: { date: 'desc' },
        });
        res.json(exams);
      });
    } catch (err: any) {
      const status = (err as any).status ?? 500;
      return res.status(status).json({ error: err.message });
    }
  });
}
