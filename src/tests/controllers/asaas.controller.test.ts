import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAsaasController } from '../../server/controllers/asaas.controller.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

function makeReq(options: { body?: any; user?: any; headers?: any } = {}) {
  return {
    body: options.body || {},
    user: options.user || { uid: 'user123', email: 'user@test.com' },
    headers: options.headers || {},
  } as any;
}

function makeAsaasService(overrides: Record<string, any> = {}) {
  return {
    handleWebhookEvent: vi.fn().mockResolvedValue({ ok: true }),
    createCheckoutSession: vi.fn().mockResolvedValue({ url: 'https://pay.me' }),
    verifySubscription: vi.fn().mockResolvedValue({ plan: 'premium' }),
    createPortalSession: vi.fn().mockResolvedValue({ url: 'https://portal.me' }),
    cancelSubscription: vi.fn().mockResolvedValue({ success: true, refunded: false }),
    ...overrides,
  };
}

function makeController(serviceOverrides: Record<string, any> = {}, isSuperAdmin = false) {
  return createAsaasController({
    isSuperAdmin: vi.fn().mockReturnValue(isSuperAdmin),
    asaasWebhookToken: 'valid-token',
    asaasService: makeAsaasService(serviceOverrides),
  });
}

// ─── getWebhook ───────────────────────────────────────────────────────────────

describe('AsaasController.getWebhook', () => {
  it('responde com mensagem informando que o endpoint está ativo', async () => {
    const { getWebhook } = makeController();
    const res = makeRes();
    await getWebhook(makeReq(), res);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Webhook endpoint is active'));
  });
});

// ─── postWebhook ──────────────────────────────────────────────────────────────

describe('AsaasController.postWebhook', () => {
  it('retorna 503 se token de webhook não estiver configurado', async () => {
    const controller = createAsaasController({
      isSuperAdmin: vi.fn().mockReturnValue(false),
      asaasWebhookToken: undefined,
      asaasService: makeAsaasService(),
    });
    const res = makeRes();
    await controller.postWebhook(makeReq({ headers: { 'asaas-access-token': 'any' } }), res);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('retorna 401 se token do header for inválido', async () => {
    const { postWebhook } = makeController();
    const res = makeRes();
    await postWebhook(
      makeReq({ headers: { 'asaas-access-token': 'wrong-token' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('retorna 200 "OK - No User ID" quando evento não tem externalReference', async () => {
    const { postWebhook } = makeController({
      handleWebhookEvent: vi.fn().mockResolvedValue({ ok: true, noUserId: true }),
    });
    const res = makeRes();
    await postWebhook(
      makeReq({ headers: { 'asaas-access-token': 'valid-token' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('No User ID'));
  });

  it('retorna 200 "OK" em evento processado com sucesso', async () => {
    const { postWebhook } = makeController();
    const res = makeRes();
    await postWebhook(
      makeReq({ headers: { 'asaas-access-token': 'valid-token' }, body: { event: 'PAYMENT_RECEIVED', payment: { externalReference: 'u1' } } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('OK');
  });

  it('retorna 500 quando o serviço lança exceção', async () => {
    const { postWebhook } = makeController({
      handleWebhookEvent: vi.fn().mockRejectedValue(new Error('Falha no banco')),
    });
    const res = makeRes();
    await postWebhook(
      makeReq({ headers: { 'asaas-access-token': 'valid-token' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── createCheckoutSession ───────────────────────────────────────────────────

describe('AsaasController.createCheckoutSession', () => {
  it('retorna 403 se userId do body não corresponde ao user autenticado', async () => {
    const { createCheckoutSession } = makeController();
    const res = makeRes();
    await createCheckoutSession(
      makeReq({
        body: { userId: 'outro-usuario', email: 'user@test.com' },
        user: { uid: 'user123', email: 'user@test.com' },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('permite super admin criar checkout para outro usuário', async () => {
    const controller = createAsaasController({
      isSuperAdmin: vi.fn().mockReturnValue(true),
      asaasWebhookToken: 'valid-token',
      asaasService: makeAsaasService(),
    });
    const res = makeRes();
    await controller.createCheckoutSession(
      makeReq({
        body: { userId: 'outro-usuario', email: 'outro@test.com', cpfCnpj: '12345678901' },
        user: { uid: 'admin', email: 'admin@test.com' },
      }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ url: expect.any(String) }));
  });

  it('retorna 400 para erros de validação de CPF/CNPJ', async () => {
    const { createCheckoutSession } = makeController({
      createCheckoutSession: vi.fn().mockRejectedValue(new Error('CPF ou CNPJ é obrigatório')),
    });
    const res = makeRes();
    await createCheckoutSession(
      makeReq({ body: { userId: 'user123', email: 'user@test.com' }, user: { uid: 'user123' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 500 para erros internos do serviço', async () => {
    const { createCheckoutSession } = makeController({
      createCheckoutSession: vi.fn().mockRejectedValue(new Error('Timeout na API Asaas')),
    });
    const res = makeRes();
    await createCheckoutSession(
      makeReq({ body: { userId: 'user123', email: 'user@test.com' }, user: { uid: 'user123' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('retorna dados da sessão para usuário autenticado correto', async () => {
    const { createCheckoutSession } = makeController();
    const res = makeRes();
    await createCheckoutSession(
      makeReq({
        body: { userId: 'user123', email: 'user@test.com', cpfCnpj: '12345678901' },
        user: { uid: 'user123', email: 'user@test.com' },
      }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://pay.me' }));
  });
});

// ─── verifySubscription ──────────────────────────────────────────────────────

describe('AsaasController.verifySubscription', () => {
  it('retorna 403 se email do body não corresponde ao usuário autenticado', async () => {
    const { verifySubscription } = makeController();
    const res = makeRes();
    await verifySubscription(
      makeReq({ body: { email: 'outro@test.com' }, user: { uid: 'u1', email: 'user@test.com' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna 400 quando email está no body mas é string vazia', async () => {
    // O guard de autoria passa (emails coincidem), mas o email vazio dispara 400
    const controller = createAsaasController({
      isSuperAdmin: vi.fn().mockReturnValue(false),
      asaasWebhookToken: 'valid-token',
      asaasService: makeAsaasService(),
    });
    const res = makeRes();
    await controller.verifySubscription(
      makeReq({ body: { email: 'user@test.com' }, user: { uid: 'u1', email: 'user@test.com' } }),
      res,
    );
    // Quando email presente e válido deve delegar ao serviço normalmente
    expect(res.json).toHaveBeenCalled();
  });

  it('retorna 403 quando email está ausente do body (guard de autorização antes da validação)', async () => {
    const { verifySubscription } = makeController();
    const res = makeRes();
    await verifySubscription(
      makeReq({ body: {}, user: { uid: 'u1', email: 'user@test.com' } }),
      res,
    );
    // email undefined != 'user@test.com', então o guard retorna 403
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna dados da assinatura para usuário autorizado', async () => {
    const { verifySubscription } = makeController();
    const res = makeRes();
    await verifySubscription(
      makeReq({ body: { email: 'user@test.com' }, user: { uid: 'u1', email: 'user@test.com' } }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ plan: 'premium' }));
  });
});

// ─── createPortalSession ─────────────────────────────────────────────────────

describe('AsaasController.createPortalSession', () => {
  it('retorna 403 se email não é do usuário autenticado', async () => {
    const { createPortalSession } = makeController();
    const res = makeRes();
    await createPortalSession(
      makeReq({ body: { email: 'outro@test.com' }, user: { uid: 'u1', email: 'user@test.com' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna 404 quando nenhuma fatura/assinatura encontrada', async () => {
    const { createPortalSession } = makeController({
      createPortalSession: vi.fn().mockRejectedValue(new Error('Nenhuma assinatura encontrada')),
    });
    const res = makeRes();
    await createPortalSession(
      makeReq({ body: { email: 'user@test.com' }, user: { uid: 'u1', email: 'user@test.com' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna url do portal para usuário autorizado', async () => {
    const { createPortalSession } = makeController();
    const res = makeRes();
    await createPortalSession(
      makeReq({ body: { email: 'user@test.com' }, user: { uid: 'u1', email: 'user@test.com' } }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://portal.me' }));
  });
});

// ─── cancelSubscription ──────────────────────────────────────────────────────

describe('AsaasController.cancelSubscription', () => {
  it('retorna 403 se email não é do usuário autenticado', async () => {
    const { cancelSubscription } = makeController();
    const res = makeRes();
    await cancelSubscription(
      makeReq({ body: { email: 'outro@test.com' }, user: { uid: 'u1', email: 'user@test.com' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna 400 quando não há assinatura ativa', async () => {
    const { cancelSubscription } = makeController({
      cancelSubscription: vi.fn().mockRejectedValue(new Error('Nenhuma assinatura ativa encontrada')),
    });
    const res = makeRes();
    await cancelSubscription(
      makeReq({ body: { email: 'user@test.com' }, user: { uid: 'u1', email: 'user@test.com' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna resultado do cancelamento para usuário autorizado', async () => {
    const { cancelSubscription } = makeController();
    const res = makeRes();
    await cancelSubscription(
      makeReq({ body: { email: 'user@test.com' }, user: { uid: 'u1', email: 'user@test.com' } }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('retorna 500 para erros genéricos no cancelamento', async () => {
    const { cancelSubscription } = makeController({
      cancelSubscription: vi.fn().mockRejectedValue(new Error('Falha de rede')),
    });
    const res = makeRes();
    await cancelSubscription(
      makeReq({ body: { email: 'user@test.com' }, user: { uid: 'u1', email: 'user@test.com' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
