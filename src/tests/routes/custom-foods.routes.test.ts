import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerCustomFoodsRoutes } from '../../server/routes/custom-foods.routes.ts';

const customFood = {
  findMany: vi.fn().mockResolvedValue([]),
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
};

vi.mock('../../server/lib/rls-context.ts', () => ({
  withNutritionistRLS: (_uid: string, fn: () => Promise<any>) => fn(),
  getDb: () => ({ customFood }),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { uid: 'nutri-1' };
    next();
  });
  registerCustomFoodsRoutes({
    app,
    authenticate: (_req: any, _res: any, next: any) => next(),
    requirePremiumOrAdmin: (_req: any, _res: any, next: any) => next(),
    isSuperAdmin: () => false,
    admin: {},
  });
  return app;
}

const baseFood = { name: 'Arroz integral', kcal: 130, protein: 2.7, carbs: 28, fat: 1, baseUnit: 'g', baseQuantity: 100 };

describe('POST /api/custom-foods — validação', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 400 quando falta um campo numérico obrigatório', async () => {
    const { kcal, ...semKcal } = baseFood;
    const res = await request(buildApp()).post('/api/custom-foods').send(semKcal);
    expect(res.status).toBe(400);
    expect(customFood.create).not.toHaveBeenCalled();
  });

  it('ignora nutritionistId/id vindos do body', async () => {
    customFood.create.mockResolvedValue({ id: 'f-1' });
    const res = await request(buildApp())
      .post('/api/custom-foods')
      .send({ ...baseFood, nutritionistId: 'outro', id: 'forjado' });

    expect(res.status).toBe(201);
    const dataEnviada = customFood.create.mock.calls[0][0].data;
    expect(dataEnviada.id).toBeUndefined();
    expect(dataEnviada.nutritionistId).toBe('nutri-1');
  });
});
