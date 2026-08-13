import { describe, it, expect, vi, beforeEach } from 'vitest';

const nutritionist = { findUnique: vi.fn() };

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({ nutritionist }),
  withNutritionistRLS: (_uid: string, fn: () => Promise<any>) => fn(),
}));

import { createEmailController } from '../../server/controllers/email.controller.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function makeReq(body: Record<string, any> = {}, user: Record<string, any> = { uid: 'nutri-1', email: 'nutri@example.com' }) {
  return { body, user } as any;
}

function makeEmailService() {
  return {
    sendTestEmail: vi.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendMealPlanEmail: vi.fn().mockResolvedValue(undefined),
  };
}

function makePatientsService(patient: any = { id: 'pac-1', name: 'Paciente Teste', email: 'paciente@example.com' }) {
  return {
    getOne: vi.fn(async (_nutritionistId: string, id: string) => {
      if (!patient || patient.id !== id) throw new Error('Paciente não encontrado');
      return patient;
    }),
  };
}

function makeMealPlansService(plan: any = { id: 'mp-1', patient_id: 'pac-1' }) {
  return {
    getOne: vi.fn(async (_nutritionistId: string, id: string) => {
      if (!plan || plan.id !== id) throw new Error('Plano não encontrado');
      return plan;
    }),
  };
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('EmailController.testEmail', () => {
  let res: ReturnType<typeof makeRes>;
  beforeEach(() => { res = makeRes(); });

  it('envia para o e-mail do usuário autenticado, nunca para um endereço do body', async () => {
    const emailService = makeEmailService();
    const { testEmail } = createEmailController({
      emailService,
      patientsService: makePatientsService() as any,
      mealPlansService: makeMealPlansService() as any,
    });

    await testEmail(makeReq({ to: 'atacante@evil.com' }, { uid: 'nutri-1', email: 'nutri@example.com' }), res);

    expect(emailService.sendTestEmail).toHaveBeenCalledWith('nutri@example.com');
    expect(emailService.sendTestEmail).not.toHaveBeenCalledWith('atacante@evil.com');
  });

  it('retorna 400 se o usuário autenticado não tiver e-mail', async () => {
    const emailService = makeEmailService();
    const { testEmail } = createEmailController({
      emailService,
      patientsService: makePatientsService() as any,
      mealPlansService: makeMealPlansService() as any,
    });

    await testEmail(makeReq({}, { uid: 'nutri-1', email: undefined }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(emailService.sendTestEmail).not.toHaveBeenCalled();
  });
});

describe('EmailController.sendWelcomeEmail', () => {
  let res: ReturnType<typeof makeRes>;
  beforeEach(() => {
    res = makeRes();
    nutritionist.findUnique.mockReset();
  });

  it('retorna 400 se patientId estiver ausente', async () => {
    const emailService = makeEmailService();
    const { sendWelcomeEmail } = createEmailController({
      emailService,
      patientsService: makePatientsService() as any,
      mealPlansService: makeMealPlansService() as any,
    });

    await sendWelcomeEmail(makeReq({}), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(emailService.sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('usa e-mail/nome do paciente e do nutricionista vindos do banco, ignorando o body', async () => {
    const emailService = makeEmailService();
    nutritionist.findUnique.mockResolvedValue({
      id: 'nutri-1', name: 'Dra. Real', email: 'real@nutri.com', phone: '11999999999',
    });
    const patientsService = makePatientsService({ id: 'pac-1', name: 'Paciente Real', email: 'paciente-real@example.com' });
    const { sendWelcomeEmail } = createEmailController({
      emailService,
      patientsService: patientsService as any,
      mealPlansService: makeMealPlansService() as any,
    });

    await sendWelcomeEmail(
      makeReq({
        patientId: 'pac-1',
        patientEmail: 'atacante@evil.com',
        nutritionistName: 'Nome Falso',
        nutritionistEmail: 'falso@evil.com',
      }),
      res,
    );

    expect(patientsService.getOne).toHaveBeenCalledWith('nutri-1', 'pac-1');
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        patientEmail: 'paciente-real@example.com',
        patientName: 'Paciente Real',
        nutritionistName: 'Dra. Real',
        nutritionistEmail: 'real@nutri.com',
      }),
    );
  });

  it('retorna 404 quando o paciente não pertence ao nutricionista autenticado (IDOR)', async () => {
    const emailService = makeEmailService();
    const patientsService = makePatientsService(null); // getOne sempre lança "Paciente não encontrado"
    const { sendWelcomeEmail } = createEmailController({
      emailService,
      patientsService: patientsService as any,
      mealPlansService: makeMealPlansService() as any,
    });

    await sendWelcomeEmail(makeReq({ patientId: 'pac-de-outro-nutri' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(emailService.sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('retorna 400 quando o paciente não tem e-mail cadastrado', async () => {
    const emailService = makeEmailService();
    const patientsService = makePatientsService({ id: 'pac-1', name: 'Sem Email', email: null });
    const { sendWelcomeEmail } = createEmailController({
      emailService,
      patientsService: patientsService as any,
      mealPlansService: makeMealPlansService() as any,
    });

    await sendWelcomeEmail(makeReq({ patientId: 'pac-1' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(emailService.sendWelcomeEmail).not.toHaveBeenCalled();
  });
});

describe('EmailController.sendMealPlan', () => {
  let res: ReturnType<typeof makeRes>;
  beforeEach(() => {
    res = makeRes();
    nutritionist.findUnique.mockReset();
  });

  it('retorna 400 se mealPlanId ou pdfBase64 estiverem ausentes', async () => {
    const emailService = makeEmailService();
    const { sendMealPlan } = createEmailController({
      emailService,
      patientsService: makePatientsService() as any,
      mealPlansService: makeMealPlansService() as any,
    });

    await sendMealPlan(makeReq({ pdfBase64: 'abc' }), res);
    expect(res.status).toHaveBeenCalledWith(400);

    res = makeRes();
    await sendMealPlan(makeReq({ mealPlanId: 'mp-1' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('resolve o paciente a partir do plano (mealPlanId), não de dados soltos do body', async () => {
    const emailService = makeEmailService();
    nutritionist.findUnique.mockResolvedValue({ id: 'nutri-1', name: 'Dra. Real' });
    const mealPlansService = makeMealPlansService({ id: 'mp-1', patient_id: 'pac-1' });
    const patientsService = makePatientsService({ id: 'pac-1', name: 'Paciente Real', email: 'paciente-real@example.com' });
    const { sendMealPlan } = createEmailController({
      emailService,
      patientsService: patientsService as any,
      mealPlansService: mealPlansService as any,
    });

    await sendMealPlan(
      makeReq({ mealPlanId: 'mp-1', pdfBase64: 'base64==', patientEmail: 'atacante@evil.com' }),
      res,
    );

    expect(mealPlansService.getOne).toHaveBeenCalledWith('nutri-1', 'mp-1');
    expect(patientsService.getOne).toHaveBeenCalledWith('nutri-1', 'pac-1');
    expect(emailService.sendMealPlanEmail).toHaveBeenCalledWith(
      expect.objectContaining({ patientEmail: 'paciente-real@example.com', nutritionistName: 'Dra. Real' }),
    );
  });

  it('retorna 404 quando o plano não pertence ao nutricionista autenticado (IDOR)', async () => {
    const emailService = makeEmailService();
    const mealPlansService = makeMealPlansService(null); // sempre lança "Plano não encontrado"
    const { sendMealPlan } = createEmailController({
      emailService,
      patientsService: makePatientsService() as any,
      mealPlansService: mealPlansService as any,
    });

    await sendMealPlan(makeReq({ mealPlanId: 'mp-de-outro-nutri', pdfBase64: 'abc' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(emailService.sendMealPlanEmail).not.toHaveBeenCalled();
  });
});
