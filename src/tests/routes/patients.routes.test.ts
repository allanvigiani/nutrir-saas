import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerPatientsRoutes } from '../../server/routes/patients.routes.ts';

const patient = {
  findMany: vi.fn().mockResolvedValue([]),
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  count: vi.fn().mockResolvedValue(0),
};

vi.mock('../../server/lib/rls-context.ts', () => ({
  withNutritionistRLS: (_uid: string, fn: () => Promise<any>) => fn(),
  getDb: () => ({ patient }),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { uid: 'nutri-1', isPremium: true, gracePeriodEndAt: null };
    next();
  });
  registerPatientsRoutes({
    app,
    authenticate: (_req: any, _res: any, next: any) => next(),
    requirePremiumOrAdmin: (_req: any, _res: any, next: any) => next(),
    isSuperAdmin: () => false,
    admin: {},
  });
  return app;
}

describe('POST /api/patients — validação', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 400 quando faltam campos obrigatórios', async () => {
    const res = await request(buildApp()).post('/api/patients').send({ name: 'Fulano' });
    expect(res.status).toBe(400);
    expect(patient.create).not.toHaveBeenCalled();
  });

  it('retorna 400 quando um campo excede o tamanho máximo', async () => {
    const res = await request(buildApp())
      .post('/api/patients')
      .send({
        name: 'a'.repeat(500),
        birthDate: '2000-01-01',
        gender: 'feminino',
        objective: 'emagrecimento',
        activityLevel: 'moderado',
      });
    expect(res.status).toBe(400);
    expect(patient.create).not.toHaveBeenCalled();
  });

  it('aceita payload válido e ignora accessToken/id/nutritionistId vindos do body (mass assignment)', async () => {
    patient.create.mockResolvedValue({ id: 'p-1' });
    const res = await request(buildApp())
      .post('/api/patients')
      .send({
        name: 'Fulano de Tal',
        birthDate: '2000-01-01',
        gender: 'masculino',
        objective: 'ganho de massa',
        activityLevel: 'ativo',
        accessToken: 'token-escolhido-pelo-cliente',
        id: 'id-forjado',
        nutritionistId: 'outro-nutricionista',
      });

    expect(res.status).toBe(201);
    const dataEnviada = patient.create.mock.calls[0][0].data;
    expect(dataEnviada.accessToken).toBeUndefined();
    expect(dataEnviada.id).toBeUndefined();
    expect(dataEnviada.nutritionistId).toBe('nutri-1');
  });
});

describe('PATCH /api/patients/:id — validação', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 400 quando um campo tem tipo errado', async () => {
    const res = await request(buildApp()).patch('/api/patients/p-1').send({ name: 12345 });
    expect(res.status).toBe(400);
    expect(patient.update).not.toHaveBeenCalled();
  });

  it('aceita atualização parcial válida', async () => {
    patient.findFirst.mockResolvedValue({ id: 'p-1', nutritionistId: 'nutri-1', deletedAt: null });
    patient.update.mockResolvedValue({ id: 'p-1' });
    const res = await request(buildApp()).patch('/api/patients/p-1').send({ phone: '11999999999' });
    expect(res.status).toBe(200);
    expect(patient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { phone: '11999999999' } }),
    );
  });
});
