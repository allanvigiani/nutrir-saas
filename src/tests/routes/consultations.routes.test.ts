import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerConsultationsRoutes } from '../../server/routes/consultations.routes.ts';

const consultation = {
  findMany: vi.fn().mockResolvedValue([]),
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  count: vi.fn().mockResolvedValue(0),
};
const patient = { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn() };

vi.mock('../../server/lib/rls-context.ts', () => ({
  withNutritionistRLS: (_uid: string, fn: () => Promise<any>) => fn(),
  getDb: () => ({ consultation, patient }),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { uid: 'nutri-1', isPremium: true, gracePeriodEndAt: null };
    next();
  });
  registerConsultationsRoutes({
    app,
    authenticate: (_req: any, _res: any, next: any) => next(),
    requirePremiumOrAdmin: (_req: any, _res: any, next: any) => next(),
    isSuperAdmin: () => false,
    admin: {},
  });
  return app;
}

const baseConsulta = {
  date: '2026-08-13',
  weight: 70,
  height: 170,
  imc: 24.2,
  anamnesis: 'sem queixas',
  status: 'realized',
};

describe('POST /api/patients/:patientId/consultations — validação', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 400 quando weight/height não são números', async () => {
    const res = await request(buildApp())
      .post('/api/patients/pac-1/consultations')
      .send({ ...baseConsulta, weight: 'setenta' });
    expect(res.status).toBe(400);
    expect(consultation.create).not.toHaveBeenCalled();
  });

  it('ignora nutritionistId/patientId/accessToken vindos do body', async () => {
    consultation.create.mockResolvedValue({ id: 'c-1' });
    const res = await request(buildApp())
      .post('/api/patients/pac-1/consultations')
      .send({ ...baseConsulta, nutritionistId: 'outro', patientId: 'outro-pac', accessToken: 'x' });

    expect(res.status).toBe(201);
    const dataEnviada = consultation.create.mock.calls[0][0].data;
    expect(dataEnviada.accessToken).toBeUndefined();
    expect(dataEnviada.nutritionistId).toBe('nutri-1');
    expect(dataEnviada.patientId).toBe('pac-1');
  });
});

describe('PATCH /api/consultations/:id — validação', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 400 quando anamnesis excede o tamanho máximo', async () => {
    const res = await request(buildApp())
      .patch('/api/consultations/c-1')
      .send({ anamnesis: 'a'.repeat(20001) });
    expect(res.status).toBe(400);
    expect(consultation.update).not.toHaveBeenCalled();
  });
});
