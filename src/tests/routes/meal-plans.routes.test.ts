import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerMealPlansRoutes } from '../../server/routes/meal-plans.routes.ts';

const mealPlan = {
  findMany: vi.fn().mockResolvedValue([]),
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  count: vi.fn().mockResolvedValue(0),
};
const mealPlanItem = {
  findMany: vi.fn().mockResolvedValue([]),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn().mockResolvedValue({}),
};
const patient = { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn() };

vi.mock('../../server/lib/rls-context.ts', () => ({
  withNutritionistRLS: (_uid: string, fn: () => Promise<any>) => fn(),
  getDb: () => ({ mealPlan, mealPlanItem, patient }),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { uid: 'nutri-1', isPremium: true, gracePeriodEndAt: null };
    next();
  });
  registerMealPlansRoutes({
    app,
    authenticate: (_req: any, _res: any, next: any) => next(),
    requirePremiumOrAdmin: (_req: any, _res: any, next: any) => next(),
    isSuperAdmin: () => false,
    admin: {},
  });
  return app;
}

describe('POST /api/patients/:patientId/meal-plans — validação', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 400 sem name', async () => {
    const res = await request(buildApp()).post('/api/patients/pac-1/meal-plans').send({});
    expect(res.status).toBe(400);
    expect(mealPlan.create).not.toHaveBeenCalled();
  });

  it('retorna 400 com type fora do enum', async () => {
    const res = await request(buildApp())
      .post('/api/patients/pac-1/meal-plans')
      .send({ name: 'Plano A', type: 'invalido-xyz' });
    expect(res.status).toBe(400);
    expect(mealPlan.create).not.toHaveBeenCalled();
  });

  it('ignora nutritionistId/patientId/accessToken vindos do body', async () => {
    mealPlan.create.mockResolvedValue({ id: 'mp-1' });
    const res = await request(buildApp())
      .post('/api/patients/pac-1/meal-plans')
      .send({ name: 'Plano A', nutritionistId: 'outro', patientId: 'outro-pac', accessToken: 'x' });

    expect(res.status).toBe(201);
    const dataEnviada = mealPlan.create.mock.calls[0][0].data;
    expect(dataEnviada.accessToken).toBeUndefined();
    expect(dataEnviada.nutritionistId).toBe('nutri-1');
    expect(dataEnviada.patientId).toBe('pac-1');
  });
});

describe('PUT /api/meal-plans/:id/items — validação', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 400 quando o body não é um array de itens válido', async () => {
    mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1', deletedAt: null });
    const res = await request(buildApp())
      .put('/api/meal-plans/mp-1/items')
      .send({ not: 'an array' });
    expect(res.status).toBe(400);
    expect(mealPlanItem.deleteMany).not.toHaveBeenCalled();
  });

  it('retorna 400 quando um item não tem food/meal', async () => {
    const res = await request(buildApp())
      .put('/api/meal-plans/mp-1/items')
      .send([{ meal: 'cafe-da-manha' }]);
    expect(res.status).toBe(400);
  });

  it('aceita lista vazia (limpa os itens do plano)', async () => {
    mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1', deletedAt: null });
    const res = await request(buildApp()).put('/api/meal-plans/mp-1/items').send([]);
    expect(res.status).toBe(200);
    expect(mealPlanItem.deleteMany).toHaveBeenCalledWith({ where: { mealPlanId: 'mp-1' } });
  });
});
