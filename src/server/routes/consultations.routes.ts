import { z } from 'zod';
import type { BaseRouteDeps } from '../types.ts';
import { createConsultationsService } from '../services/consultations.service.ts';
import { createPatientsService } from '../services/patients.service.ts';
import { withNutritionistRLS } from '../lib/rls-context.ts';
import { validateBody } from '../lib/validate.ts';

function computeGracePeriodOver(req: any): boolean {
  if (req.user.isPremium) return false;
  const end = req.user.gracePeriodEndAt;
  return end !== null && new Date(end) < new Date();
}

// patientId/nutritionistId/id/accessToken de propósito fora do schema — o frontend legado
// manda esses campos no body, mas o Zod descarta o que não está declarado aqui.
const consultationSchema = z.object({
  date: z.string().min(1).max(30),
  weight: z.number(),
  height: z.number(),
  imc: z.number(),
  fatPercentage: z.number().nullable().optional(),
  waist: z.number().nullable().optional(),
  hip: z.number().nullable().optional(),
  abdomen: z.number().nullable().optional(),
  arm: z.number().nullable().optional(),
  anamnesis: z.string().max(20000),
  observations: z.string().max(20000).nullable().optional(),
  complaints: z.string().max(20000).nullable().optional(),
  objectives: z.string().max(20000).nullable().optional(),
  status: z.string().max(30),
});
const consultationCreateSchema = consultationSchema;
const consultationUpdateSchema = consultationSchema.partial();

export function registerConsultationsRoutes(deps: BaseRouteDeps) {
  const service = createConsultationsService();

  deps.app.get('/api/patients/:patientId/consultations', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.list(req.user.uid, req.params.patientId));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.post('/api/patients/:patientId/consultations', deps.authenticate, async (req: any, res: any) => {
    const body = validateBody(consultationCreateSchema, req, res);
    if (!body) return;
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const patientsService = createPatientsService();
        const gracePeriodOver = computeGracePeriodOver(req);
        const readOnly = await patientsService.isPatientReadOnly(req.user.uid, req.params.patientId, gracePeriodOver);
        if (readOnly) {
          return res.status(403).json({ error: 'Este paciente está em somente leitura. Faça upgrade para o plano Premium para retomar o acesso.' });
        }
        const data = await service.create(req.user.uid, req.params.patientId, body, req.user.isPremium);
        res.status(201).json(data);
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/consultations/:id', deps.authenticate, async (req: any, res: any) => {
    const body = validateBody(consultationUpdateSchema, req, res);
    if (!body) return;
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.update(req.user.uid, req.params.id, body));
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/consultations/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        await service.remove(req.user.uid, req.params.id);
        res.status(204).send();
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });
}
