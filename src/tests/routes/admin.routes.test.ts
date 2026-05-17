import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerAdminRoutes } from '../../server/routes/admin.routes.ts';

// Mocks dos módulos de banco
vi.mock('../../server/lib/rls-context.ts', () => ({
  withAdminRLS: vi.fn((fn: () => Promise<any>) => fn()),
  getDb: vi.fn(() => ({
    nutritionist: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ email: 'n@test.com', role: 'nutritionist', plan: 'free' }),
      update: vi.fn().mockResolvedValue({ id: '1' }),
    },
    patient: { count: vi.fn().mockResolvedValue(0) },
  })),
}));

vi.mock('../../server/services/retention.service.ts', () => ({
  createRetentionService: vi.fn(() => ({
    cleanupSoftDeleted: vi.fn().mockResolvedValue({ deletedCount: 0 }),
  })),
}));

vi.mock('../../server/services/admin.service.ts', () => ({
  createAdminService: vi.fn(() => ({
    getStats: vi.fn().mockResolvedValue({}),
    listNutritionists: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 1 }),
    logAudit: vi.fn().mockResolvedValue(undefined),
    getAuditLogs: vi.fn().mockResolvedValue([]),
  })),
}));

function buildApp(isAdmin: boolean, uid = 'u1') {
  const app = express();
  app.use(express.json());

  // Simula middleware de autenticação injetando req.user
  app.use((req: any, _res, next) => {
    req.user = { uid, isAdmin, isPremium: isAdmin };
    next();
  });

  registerAdminRoutes({
    app,
    authenticate: (_req: any, _res: any, next: any) => next(),
    requirePremiumOrAdmin: (_req: any, _res: any, next: any) => next(),
    isSuperAdmin: () => false,
    admin: {},
  });

  return app;
}

describe('Admin routes — guard de acesso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/nutritionists', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).get('/api/admin/nutritionists');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Acesso negado.' });
    });

    it('retorna 200 para admin', async () => {
      const res = await request(buildApp(true)).get('/api/admin/nutritionists');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/admin/patients/count', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).get('/api/admin/patients/count');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Acesso negado.' });
    });

    it('retorna 200 para admin', async () => {
      const res = await request(buildApp(true)).get('/api/admin/patients/count');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count');
    });
  });

  describe('PATCH /api/admin/nutritionists/:id', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).patch('/api/admin/nutritionists/123').send({ plan: 'premium' });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Acesso negado.' });
    });

    it('retorna 200 para admin', async () => {
      const res = await request(buildApp(true)).patch('/api/admin/nutritionists/123').send({ plan: 'premium' });
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /api/admin/nutritionists/:id — self-demotion protection', () => {
    it('retorna 400 se admin tentar alterar role (incluindo o próprio)', async () => {
      const res = await request(buildApp(true, 'admin1'))
        .patch('/api/admin/nutritionists/admin1')
        .send({ role: 'nutritionist' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('role');
    });

    it('permite admin alterar plano do próprio usuário', async () => {
      const res = await request(buildApp(true, 'admin1'))
        .patch('/api/admin/nutritionists/admin1')
        .send({ plan: 'premium' });
      expect(res.status).toBe(200);
    });

    it('retorna 400 ao tentar alterar role de qualquer usuário (role é controlado via banco)', async () => {
      const res = await request(buildApp(true))
        .patch('/api/admin/nutritionists/outro-user')
        .send({ role: 'nutritionist' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('role');
    });
  });

  describe('POST /api/admin/retention-cleanup', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).post('/api/admin/retention-cleanup');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Acesso negado.' });
    });

    it('retorna 200 para admin', async () => {
      const res = await request(buildApp(true)).post('/api/admin/retention-cleanup');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('deletedCount');
    });
  });
});
