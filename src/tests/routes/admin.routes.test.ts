import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerAdminRoutes } from '../../server/routes/admin.routes.ts';
import { createAdminService } from '../../server/services/admin.service.ts';
import { createAdminStatsService } from '../../server/services/admin-stats.service.ts';
import { createAdminClinicalViewService } from '../../server/services/admin-clinical-view.service.ts';

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
    getNutritionistById: vi.fn().mockResolvedValue({ id: '1', name: 'Nutri Teste', plan: 'free' }),
    updateNutritionistProfile: vi.fn().mockResolvedValue({
      nutritionist: { id: '1', plan: 'premium' },
      email: 'n@test.com',
      changes: [{ field: 'plan', previousValue: 'free', newValue: 'premium' }],
    }),
    logAudit: vi.fn().mockResolvedValue(undefined),
    getAuditLogs: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../server/services/admin-stats.service.ts', () => ({
  createAdminStatsService: vi.fn(() => ({
    getRevenueByMonth: vi.fn().mockResolvedValue([]),
    getPatientsGrowthByMonth: vi.fn().mockResolvedValue([]),
    getNewSubscribersByMonth: vi.fn().mockResolvedValue([]),
    getConsultationsByMonth: vi.fn().mockResolvedValue([]),
    getMealPlansByMonth: vi.fn().mockResolvedValue([]),
    getPlanDistribution: vi.fn().mockResolvedValue({ free: 0, premium: 0, admin: 0, total: 0 }),
  })),
}));

vi.mock('../../server/services/admin-clinical-view.service.ts', () => ({
  createAdminClinicalViewService: vi.fn(() => ({
    getNutritionistPatients: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 1 }),
    getPatientDetail: vi.fn().mockResolvedValue({ id: 'p1', name: 'Paciente Teste' }),
    patientExists: vi.fn().mockResolvedValue(true),
    getPatientConsultations: vi.fn().mockResolvedValue([]),
    getPatientMealPlans: vi.fn().mockResolvedValue([]),
    mealPlanExists: vi.fn().mockResolvedValue(true),
    getMealPlanItems: vi.fn().mockResolvedValue([]),
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

// Retorna a instância de service (com seus vi.fn() mockados) criada pela chamada mais
// recente de um factory mockado (ex.: createAdminService) — usado para inspecionar
// com quais argumentos os métodos do service foram chamados por uma rota específica.
function lastServiceInstance(factory: any): any {
  const mocked = vi.mocked(factory);
  return mocked.mock.results[mocked.mock.results.length - 1].value;
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

  describe('GET /api/admin/nutritionists/:id', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).get('/api/admin/nutritionists/n1');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Acesso negado.' });
    });

    it('retorna 200 com o nutricionista para admin', async () => {
      const app = buildApp(true);
      const adminServiceInstance = lastServiceInstance(createAdminService);
      adminServiceInstance.getNutritionistById.mockResolvedValueOnce({ id: 'n1', name: 'Nutri', plan: 'premium' });

      const res = await request(app).get('/api/admin/nutritionists/n1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 'n1', name: 'Nutri', plan: 'premium' });
      expect(adminServiceInstance.getNutritionistById).toHaveBeenCalledWith('n1');
    });

    it('retorna 404 quando o id não existe', async () => {
      const app = buildApp(true);
      const adminServiceInstance = lastServiceInstance(createAdminService);
      adminServiceInstance.getNutritionistById.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/admin/nutritionists/inexistente');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Nutricionista não encontrado.' });
    });

    it('não expõe verbos de escrita além do PATCH já existente', async () => {
      const app = buildApp(true);
      expect((await request(app).post('/api/admin/nutritionists/n1')).status).toBe(404);
      expect((await request(app).delete('/api/admin/nutritionists/n1')).status).toBe(404);
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

  describe('PATCH /api/admin/nutritionists/:id — allowlist de campos editáveis (mass assignment)', () => {
    it('retorna 400 se o body só contém role (campo não é aceito pelo schema, é descartado)', async () => {
      const res = await request(buildApp(true, 'admin1'))
        .patch('/api/admin/nutritionists/admin1')
        .send({ role: 'nutritionist' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos.');
    });

    it('permite admin alterar plano do próprio usuário', async () => {
      const res = await request(buildApp(true, 'admin1'))
        .patch('/api/admin/nutritionists/admin1')
        .send({ plan: 'premium' });
      expect(res.status).toBe(200);
    });

    it('ignora role/email/id mesmo quando enviados junto de um campo válido (mass assignment)', async () => {
      const app = buildApp(true);
      const res = await request(app)
        .patch('/api/admin/nutritionists/outro-user')
        .send({ plan: 'premium', role: 'admin', email: 'hacker@test.com', id: 'outro-id' });
      expect(res.status).toBe(200);

      // O ponto central da defesa: o service nunca recebe role/email/id, mesmo que o
      // client os tenha enviado — o Zod já descartou essas chaves antes de chegar aqui.
      const adminServiceInstance = lastServiceInstance(createAdminService);
      expect(adminServiceInstance.updateNutritionistProfile).toHaveBeenCalledWith('outro-user', { plan: 'premium' });
    });

    it('retorna 400 para plano fora do enum permitido', async () => {
      const res = await request(buildApp(true))
        .patch('/api/admin/nutritionists/outro-user')
        .send({ plan: 'ultra' });
      expect(res.status).toBe(400);
    });

    it('retorna 400 quando o body não tem nenhum campo reconhecido', async () => {
      const res = await request(buildApp(true))
        .patch('/api/admin/nutritionists/outro-user')
        .send({ favoriteColor: 'blue' });
      expect(res.status).toBe(400);
    });

    it('retorna 404 quando updateNutritionistProfile não encontra o nutricionista', async () => {
      const app = buildApp(true);
      const adminServiceInstance = lastServiceInstance(createAdminService);
      adminServiceInstance.updateNutritionistProfile.mockResolvedValueOnce(null);

      const res = await request(app).patch('/api/admin/nutritionists/inexistente').send({ plan: 'premium' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Nutricionista não encontrado.' });
    });

    it('gera uma entrada de audit log por campo alterado, com action correta por campo', async () => {
      const app = buildApp(true, 'admin1');
      const adminServiceInstance = lastServiceInstance(createAdminService);
      adminServiceInstance.updateNutritionistProfile.mockResolvedValueOnce({
        nutritionist: { id: 'n1', name: 'Novo Nome', plan: 'premium' },
        email: 'alvo@test.com',
        changes: [
          { field: 'name', previousValue: 'Nome Antigo', newValue: 'Novo Nome' },
          { field: 'plan', previousValue: 'free', newValue: 'premium' },
        ],
      });

      const res = await request(app)
        .patch('/api/admin/nutritionists/n1')
        .send({ name: 'Novo Nome', plan: 'premium' });

      expect(res.status).toBe(200);
      expect(adminServiceInstance.logAudit).toHaveBeenCalledTimes(2);
      expect(adminServiceInstance.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin1',
          action: 'update_profile:name',
          targetId: 'n1',
          targetEmail: 'alvo@test.com',
          previousValue: 'Nome Antigo',
          newValue: 'Novo Nome',
        })
      );
      expect(adminServiceInstance.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'set_plan', previousValue: 'free', newValue: 'premium' })
      );
    });

    it('não gera audit log quando nenhum campo mudou de fato', async () => {
      const app = buildApp(true, 'admin1');
      const adminServiceInstance = lastServiceInstance(createAdminService);
      adminServiceInstance.updateNutritionistProfile.mockResolvedValueOnce({
        nutritionist: { id: 'n1' },
        email: 'alvo@test.com',
        changes: [],
      });

      const res = await request(app).patch('/api/admin/nutritionists/n1').send({ plan: 'free' });

      expect(res.status).toBe(200);
      expect(adminServiceInstance.logAudit).not.toHaveBeenCalled();
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

describe('Admin routes — gráficos de negócio (/api/admin/stats/*)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const seriesCases = [
    { path: '/api/admin/stats/revenue', fn: 'getRevenueByMonth' },
    { path: '/api/admin/stats/patients-growth', fn: 'getPatientsGrowthByMonth' },
    { path: '/api/admin/stats/new-subscribers', fn: 'getNewSubscribersByMonth' },
    { path: '/api/admin/stats/consultations', fn: 'getConsultationsByMonth' },
    { path: '/api/admin/stats/meal-plans', fn: 'getMealPlansByMonth' },
  ] as const;

  for (const { path, fn } of seriesCases) {
    describe(`GET ${path}`, () => {
      it('retorna 403 para não-admin', async () => {
        const res = await request(buildApp(false)).get(`${path}?from=2026-01-01&to=2026-06-01`);
        expect(res.status).toBe(403);
      });

      it('retorna 200 com { data } para admin e período válido', async () => {
        const app = buildApp(true);
        const statsServiceInstance = lastServiceInstance(createAdminStatsService);
        (statsServiceInstance[fn] as any).mockResolvedValueOnce([{ month: '2026-01', value: 5 }]);

        const res = await request(app).get(`${path}?from=2026-01-01&to=2026-06-01`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ data: [{ month: '2026-01', value: 5 }] });
        expect(statsServiceInstance[fn]).toHaveBeenCalledWith(new Date('2026-01-01'), new Date('2026-06-01'));
      });

      it('retorna 400 quando from/to estão ausentes', async () => {
        const res = await request(buildApp(true)).get(path);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Parâmetros inválidos.');
      });

      it('retorna 400 quando from é depois de to (invertido)', async () => {
        const res = await request(buildApp(true)).get(`${path}?from=2026-06-01&to=2026-01-01`);
        expect(res.status).toBe(400);
      });

      it('retorna 400 quando o intervalo excede 24 meses', async () => {
        const res = await request(buildApp(true)).get(`${path}?from=2020-01-01&to=2026-06-01`);
        expect(res.status).toBe(400);
      });

      it('retorna 400 quando from não é uma data válida', async () => {
        const res = await request(buildApp(true)).get(`${path}?from=nao-e-data&to=2026-06-01`);
        expect(res.status).toBe(400);
      });

      it('só aceita GET — POST no mesmo path não é uma rota registrada', async () => {
        const res = await request(buildApp(true)).post(path);
        expect(res.status).toBe(404);
      });
    });
  }

  describe('GET /api/admin/stats/plan-distribution', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).get('/api/admin/stats/plan-distribution');
      expect(res.status).toBe(403);
    });

    it('retorna 200 com a distribuição atual para admin (sem exigir from/to)', async () => {
      const app = buildApp(true);
      const statsServiceInstance = lastServiceInstance(createAdminStatsService);
      statsServiceInstance.getPlanDistribution.mockResolvedValueOnce({ free: 3, premium: 2, admin: 1, total: 6 });

      const res = await request(app).get('/api/admin/stats/plan-distribution');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ free: 3, premium: 2, admin: 1, total: 6 });
    });
  });
});

describe('Admin routes — navegação cross-tenant somente leitura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/nutritionists/:id/patients', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).get('/api/admin/nutritionists/n1/patients');
      expect(res.status).toBe(403);
    });

    it('retorna 200 com a lista paginada para admin', async () => {
      const app = buildApp(true);
      const clinicalServiceInstance = lastServiceInstance(createAdminClinicalViewService);
      clinicalServiceInstance.getNutritionistPatients.mockResolvedValueOnce({
        data: [{ id: 'p1' }],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const res = await request(app).get('/api/admin/nutritionists/n1/patients?page=1&limit=20');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: 'p1' }]);
      expect(clinicalServiceInstance.getNutritionistPatients).toHaveBeenCalledWith('n1', { page: 1, limit: 20 });
    });

    it('usa page=1/limit=20 como default quando query ausente', async () => {
      const app = buildApp(true);
      const clinicalServiceInstance = lastServiceInstance(createAdminClinicalViewService);

      await request(app).get('/api/admin/nutritionists/n1/patients');

      expect(clinicalServiceInstance.getNutritionistPatients).toHaveBeenCalledWith('n1', { page: 1, limit: 20 });
    });

    it('retorna 400 para limit acima de 100', async () => {
      const res = await request(buildApp(true)).get('/api/admin/nutritionists/n1/patients?limit=101');
      expect(res.status).toBe(400);
    });

    it('não expõe verbos de escrita (POST/PATCH/DELETE não registrados)', async () => {
      const app = buildApp(true);
      expect((await request(app).post('/api/admin/nutritionists/n1/patients')).status).toBe(404);
      expect((await request(app).patch('/api/admin/nutritionists/n1/patients')).status).toBe(404);
      expect((await request(app).delete('/api/admin/nutritionists/n1/patients')).status).toBe(404);
    });
  });

  describe('GET /api/admin/patients/:id', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).get('/api/admin/patients/p1');
      expect(res.status).toBe(403);
    });

    it('retorna 200 com o paciente (incluindo dados do nutricionista dono) para admin', async () => {
      const app = buildApp(true);
      const clinicalServiceInstance = lastServiceInstance(createAdminClinicalViewService);
      clinicalServiceInstance.getPatientDetail.mockResolvedValueOnce({
        id: 'p1',
        name: 'Paciente',
        nutritionist: { id: 'n1', name: 'Nutri', email: 'n@test.com' },
      });

      const res = await request(app).get('/api/admin/patients/p1');

      expect(res.status).toBe(200);
      expect(res.body.nutritionist.email).toBe('n@test.com');
    });

    it('retorna 404 quando o paciente não existe (ou está soft-deleted)', async () => {
      const app = buildApp(true);
      const clinicalServiceInstance = lastServiceInstance(createAdminClinicalViewService);
      clinicalServiceInstance.getPatientDetail.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/admin/patients/p-deletado');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Paciente não encontrado.' });
    });

    it('não expõe verbos de escrita', async () => {
      const app = buildApp(true);
      expect((await request(app).post('/api/admin/patients/p1')).status).toBe(404);
      expect((await request(app).patch('/api/admin/patients/p1')).status).toBe(404);
      expect((await request(app).delete('/api/admin/patients/p1')).status).toBe(404);
    });
  });

  describe('GET /api/admin/patients/:id/consultations', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).get('/api/admin/patients/p1/consultations');
      expect(res.status).toBe(403);
    });

    it('retorna a lista de consultas para admin', async () => {
      const app = buildApp(true);
      const clinicalServiceInstance = lastServiceInstance(createAdminClinicalViewService);
      clinicalServiceInstance.getPatientConsultations.mockResolvedValueOnce([{ id: 'c1' }]);

      const res = await request(app).get('/api/admin/patients/p1/consultations');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 'c1' }]);
    });

    it('retorna 404 quando o paciente não existe, sem chamar getPatientConsultations', async () => {
      const app = buildApp(true);
      const clinicalServiceInstance = lastServiceInstance(createAdminClinicalViewService);
      clinicalServiceInstance.patientExists.mockResolvedValueOnce(false);

      const res = await request(app).get('/api/admin/patients/p-inexistente/consultations');

      expect(res.status).toBe(404);
      expect(clinicalServiceInstance.getPatientConsultations).not.toHaveBeenCalled();
    });

    it('checa existência via patientExists (leve), não via getPatientDetail (join completo)', async () => {
      const app = buildApp(true);
      const clinicalServiceInstance = lastServiceInstance(createAdminClinicalViewService);

      await request(app).get('/api/admin/patients/p1/consultations');

      expect(clinicalServiceInstance.patientExists).toHaveBeenCalledWith('p1');
      expect(clinicalServiceInstance.getPatientDetail).not.toHaveBeenCalled();
    });

    it('não expõe verbos de escrita', async () => {
      const app = buildApp(true);
      expect((await request(app).post('/api/admin/patients/p1/consultations')).status).toBe(404);
      expect((await request(app).patch('/api/admin/patients/p1/consultations')).status).toBe(404);
      expect((await request(app).delete('/api/admin/patients/p1/consultations')).status).toBe(404);
    });
  });

  describe('GET /api/admin/patients/:id/meal-plans', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).get('/api/admin/patients/p1/meal-plans');
      expect(res.status).toBe(403);
    });

    it('retorna a lista de planos alimentares para admin', async () => {
      const app = buildApp(true);
      const clinicalServiceInstance = lastServiceInstance(createAdminClinicalViewService);
      clinicalServiceInstance.getPatientMealPlans.mockResolvedValueOnce([{ id: 'mp1' }]);

      const res = await request(app).get('/api/admin/patients/p1/meal-plans');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 'mp1' }]);
    });

    it('retorna 404 quando o paciente não existe, sem chamar getPatientMealPlans', async () => {
      const app = buildApp(true);
      const clinicalServiceInstance = lastServiceInstance(createAdminClinicalViewService);
      clinicalServiceInstance.patientExists.mockResolvedValueOnce(false);

      const res = await request(app).get('/api/admin/patients/p-inexistente/meal-plans');

      expect(res.status).toBe(404);
      expect(clinicalServiceInstance.getPatientMealPlans).not.toHaveBeenCalled();
    });

    it('checa existência via patientExists (leve), não via getPatientDetail (join completo)', async () => {
      const app = buildApp(true);
      const clinicalServiceInstance = lastServiceInstance(createAdminClinicalViewService);

      await request(app).get('/api/admin/patients/p1/meal-plans');

      expect(clinicalServiceInstance.patientExists).toHaveBeenCalledWith('p1');
      expect(clinicalServiceInstance.getPatientDetail).not.toHaveBeenCalled();
    });

    it('não expõe verbos de escrita', async () => {
      const app = buildApp(true);
      expect((await request(app).post('/api/admin/patients/p1/meal-plans')).status).toBe(404);
      expect((await request(app).patch('/api/admin/patients/p1/meal-plans')).status).toBe(404);
      expect((await request(app).delete('/api/admin/patients/p1/meal-plans')).status).toBe(404);
    });
  });

  describe('GET /api/admin/meal-plans/:id/items', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).get('/api/admin/meal-plans/mp1/items');
      expect(res.status).toBe(403);
    });

    it('retorna a lista de itens para admin', async () => {
      const app = buildApp(true);
      const clinicalServiceInstance = lastServiceInstance(createAdminClinicalViewService);
      clinicalServiceInstance.getMealPlanItems.mockResolvedValueOnce([{ id: 'i1', meal: 'Café da manhã' }]);

      const res = await request(app).get('/api/admin/meal-plans/mp1/items');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 'i1', meal: 'Café da manhã' }]);
    });

    it('retorna 404 quando o plano alimentar não existe, sem chamar getMealPlanItems', async () => {
      const app = buildApp(true);
      const clinicalServiceInstance = lastServiceInstance(createAdminClinicalViewService);
      clinicalServiceInstance.mealPlanExists.mockResolvedValueOnce(false);

      const res = await request(app).get('/api/admin/meal-plans/mp-inexistente/items');

      expect(res.status).toBe(404);
      expect(clinicalServiceInstance.getMealPlanItems).not.toHaveBeenCalled();
    });

    it('não expõe verbos de escrita', async () => {
      const app = buildApp(true);
      expect((await request(app).post('/api/admin/meal-plans/mp1/items')).status).toBe(404);
      expect((await request(app).patch('/api/admin/meal-plans/mp1/items')).status).toBe(404);
      expect((await request(app).delete('/api/admin/meal-plans/mp1/items')).status).toBe(404);
    });
  });

  it('nenhuma leitura cross-tenant gera audit log', async () => {
    const app = buildApp(true);
    const clinicalServiceInstance = lastServiceInstance(createAdminClinicalViewService);
    clinicalServiceInstance.getPatientDetail.mockResolvedValue({
      id: 'p1',
      nutritionist: { id: 'n1', name: 'Nutri', email: 'n@test.com' },
    });
    const adminServiceInstance = lastServiceInstance(createAdminService);

    await request(app).get('/api/admin/nutritionists/n1/patients');
    await request(app).get('/api/admin/patients/p1');
    await request(app).get('/api/admin/patients/p1/consultations');
    await request(app).get('/api/admin/patients/p1/meal-plans');
    await request(app).get('/api/admin/meal-plans/mp1/items');

    expect(adminServiceInstance.logAudit).not.toHaveBeenCalled();
  });
});
