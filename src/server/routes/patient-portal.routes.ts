/**
 * Rotas públicas do portal do paciente — autenticação por access_token (sem JWT).
 * Estas rotas são acessíveis sem autenticação Firebase, apenas com o token do paciente.
 */
import type { BaseRouteDeps } from '../types.ts';
import { prisma } from '../lib/prisma.ts';

export function registerPatientPortalRoutes(deps: BaseRouteDeps) {
  // Verifica o token e retorna dados do paciente + nutricionista
  deps.app.get('/api/portal/patients/:id', async (req: any, res: any) => {
    const { id } = req.params;
    const { token } = req.query;

    if (!token) return res.status(401).json({ error: 'Token obrigatório' });

    try {
      const patient = await prisma.patient.findFirst({
        where: { id, accessToken: token as string },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          cpf: true,
          birthDate: true,
          nutritionistId: true,
        },
      });

      if (!patient) return res.status(401).json({ error: 'Link de acesso inválido ou expirado.' });

      const nutritionist = await prisma.nutritionist.findUnique({
        where: { id: patient.nutritionistId },
        select: { id: true, name: true, crn: true, email: true, photoUrl: true, phone: true },
      });

      return res.json({ patient, nutritionist });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Consultas do paciente via token
  deps.app.get('/api/portal/patients/:id/consultations', async (req: any, res: any) => {
    const { id } = req.params;
    const { token } = req.query;
    if (!token) return res.status(401).json({ error: 'Token obrigatório' });
    try {
      const patient = await prisma.patient.findFirst({ where: { id, accessToken: token as string }, select: { id: true } });
      if (!patient) return res.status(401).json({ error: 'Acesso negado.' });
      const consultations = await prisma.consultation.findMany({
        where: { patientId: id },
        orderBy: { date: 'desc' },
      });
      return res.json(consultations);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Planos alimentares do paciente via token
  deps.app.get('/api/portal/patients/:id/meal-plans', async (req: any, res: any) => {
    const { id } = req.params;
    const { token } = req.query;
    if (!token) return res.status(401).json({ error: 'Token obrigatório' });
    try {
      const patient = await prisma.patient.findFirst({ where: { id, accessToken: token as string }, select: { id: true } });
      if (!patient) return res.status(401).json({ error: 'Acesso negado.' });
      const plans = await prisma.mealPlan.findMany({
        where: { patientId: id },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(plans);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Itens de um plano alimentar via token
  deps.app.get('/api/portal/meal-plans/:planId/items', async (req: any, res: any) => {
    const { planId } = req.params;
    const { token } = req.query;
    if (!token) return res.status(401).json({ error: 'Token obrigatório' });
    try {
      const plan = await prisma.mealPlan.findUnique({
        where: { id: planId },
        include: { patient: { select: { accessToken: true } } },
      });
      if (!plan || plan.patient.accessToken !== token) return res.status(401).json({ error: 'Acesso negado.' });
      const items = await prisma.mealPlanItem.findMany({ where: { mealPlanId: planId } });
      return res.json(items);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Exames do paciente via token
  deps.app.get('/api/portal/patients/:id/lab-exams', async (req: any, res: any) => {
    const { id } = req.params;
    const { token } = req.query;
    if (!token) return res.status(401).json({ error: 'Token obrigatório' });
    try {
      const patient = await prisma.patient.findFirst({ where: { id, accessToken: token as string }, select: { id: true } });
      if (!patient) return res.status(401).json({ error: 'Acesso negado.' });
      const exams = await prisma.labExam.findMany({
        where: { patientId: id },
        orderBy: { date: 'desc' },
      });
      return res.json(exams);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
