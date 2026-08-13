import { z } from 'zod';
import type { BaseRouteDeps } from '../types.ts';
import { createPatientsService } from '../services/patients.service.ts';
import { withNutritionistRLS } from '../lib/rls-context.ts';
import { validateBody } from '../lib/validate.ts';

function computeGracePeriodOver(req: any): boolean {
  if (req.user.isPremium) return false;
  const end = req.user.gracePeriodEndAt;
  return end !== null && new Date(end) < new Date();
}

// Só os campos que o cliente pode de fato definir — id/nutritionistId/accessToken/deletedAt
// nunca aparecem aqui, então o Zod já descarta se vierem no body (mass assignment).
const patientCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  birthDate: z.string().min(1).max(20),
  gender: z.string().min(1).max(30),
  objective: z.string().min(1).max(1000),
  activityLevel: z.string().min(1).max(50),
  cpf: z.string().max(20).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  diseases: z.string().max(3000).nullable().optional(),
  medications: z.string().max(3000).nullable().optional(),
  allergies: z.string().max(3000).nullable().optional(),
  photoUrl: z.string().max(2000).nullable().optional(),
  status: z.string().max(30).optional(),
});
const patientUpdateSchema = patientCreateSchema.partial();

export function registerPatientsRoutes(deps: BaseRouteDeps) {
  const service = createPatientsService();

  deps.app.get('/api/patients', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const gracePeriodOver =
          !req.user.isPremium &&
          req.user.gracePeriodEndAt != null &&
          new Date(req.user.gracePeriodEndAt) < new Date();
        res.json(await service.list(req.user.uid, gracePeriodOver));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.get('/api/patients/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const patient = await service.getOne(req.user.uid, req.params.id);
        const gracePeriodOver = computeGracePeriodOver(req);
        const readOnly = await service.isPatientReadOnly(req.user.uid, req.params.id, gracePeriodOver);
        res.json({ ...patient, isReadOnly: readOnly });
      });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  });

  deps.app.post('/api/patients', deps.authenticate, async (req: any, res: any) => {
    const body = validateBody(patientCreateSchema, req, res);
    if (!body) return;
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const data = await service.create(req.user.uid, body, req.user.isPremium);
        res.status(201).json(data);
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/patients/:id', deps.authenticate, async (req: any, res: any) => {
    const body = validateBody(patientUpdateSchema, req, res);
    if (!body) return;
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        res.json(await service.update(req.user.uid, req.params.id, body, req.user.isPremium));
      });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/patients/:id', deps.authenticate, async (req: any, res: any) => {
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
