import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock fns so they are available in the vi.mock factory (which gets hoisted to top)
const { mockSubscriptionUpsert, mockNutritionistFindUnique, mockNutritionistUpdate } = vi.hoisted(() => ({
  mockSubscriptionUpsert: vi.fn().mockResolvedValue({}),
  mockNutritionistFindUnique: vi.fn().mockResolvedValue(null),
  mockNutritionistUpdate: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../server/lib/prisma.ts', () => ({
  prisma: {
    subscription: { upsert: mockSubscriptionUpsert, findUnique: vi.fn() },
    nutritionist: {
      findUnique: mockNutritionistFindUnique,
      update: mockNutritionistUpdate,
    },
  },
}));

import { createAsaasService } from '../../server/services/asaas.service.ts';

// ─── Mocks ───────────────────────────────────────────────────────────────────

function makeAsaasClient(overrides: Record<string, any> = {}) {
  return {
    request: vi.fn(),
    ...overrides,
  };
}

// ─── handleWebhookEvent ──────────────────────────────────────────────────────

describe('AsaasService.handleWebhookEvent', () => {
  let asaasClient: ReturnType<typeof makeAsaasClient>;
  let service: ReturnType<typeof createAsaasService>;

  beforeEach(() => {
    asaasClient = makeAsaasClient();
    service = createAsaasService({ asaasClient });
    vi.clearAllMocks();
    mockSubscriptionUpsert.mockResolvedValue({});
    mockNutritionistFindUnique.mockResolvedValue(null);
    mockNutritionistUpdate.mockResolvedValue({});
  });

  it('retorna { ok: true, noUserId: true } quando externalReference está ausente', async () => {
    const result = await service.handleWebhookEvent({ event: 'PAYMENT_CREATED', payment: {} });
    expect(result).toEqual({ ok: true, noUserId: true });
    expect(mockSubscriptionUpsert).not.toHaveBeenCalled();
  });

  it('PAYMENT_CREATED → atualiza asaasStatus para "pending"', async () => {
    await service.handleWebhookEvent({
      event: 'PAYMENT_CREATED',
      payment: { externalReference: 'user123' },
    });
    expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nutritionistId: 'user123' } }),
    );
  });

  it('PAYMENT_RECEIVED → atualiza plano para "premium" e status para "active"', async () => {
    await service.handleWebhookEvent({
      event: 'PAYMENT_RECEIVED',
      payment: { externalReference: 'user123', dueDate: '2026-05-01' },
    });
    expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: 'premium', asaasStatus: 'active' }),
      }),
    );
  });

  it('PAYMENT_CONFIRMED → comporta-se igual ao PAYMENT_RECEIVED', async () => {
    await service.handleWebhookEvent({
      event: 'PAYMENT_CONFIRMED',
      payment: { externalReference: 'user123' },
    });
    expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: 'premium', asaasStatus: 'active' }),
      }),
    );
  });

  it('PAYMENT_OVERDUE → atualiza asaasStatus para "overdue"', async () => {
    await service.handleWebhookEvent({
      event: 'PAYMENT_OVERDUE',
      payment: { externalReference: 'user123' },
    });
    expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ asaasStatus: 'overdue' }),
      }),
    );
  });

  it('PAYMENT_REFUNDED → rebaixa plano para "free" e marca hadRefundBefore', async () => {
    await service.handleWebhookEvent({
      event: 'PAYMENT_REFUNDED',
      payment: { externalReference: 'user123' },
    });
    expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: 'free', hadRefundBefore: true }),
      }),
    );
  });

  it('SUBSCRIPTION_CREATED → salva asaasSubscriptionId', async () => {
    await service.handleWebhookEvent({
      event: 'SUBSCRIPTION_CREATED',
      payment: { externalReference: 'user123' },
      subscription: { id: 'sub_abc', externalReference: 'user123' },
    });
    expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ asaasSubscriptionId: 'sub_abc', asaasStatus: 'active' }),
      }),
    );
  });

  it('SUBSCRIPTION_DELETED → marca cancelAtPeriodEnd e status "cancelled"', async () => {
    await service.handleWebhookEvent({
      event: 'SUBSCRIPTION_DELETED',
      payment: { externalReference: 'user123' },
      subscription: { externalReference: 'user123' },
    });
    expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ asaasStatus: 'cancelled', cancelAtPeriodEnd: true }),
      }),
    );
  });

  it('SUBSCRIPTION_UPDATED ACTIVE → mantém plano "premium"', async () => {
    await service.handleWebhookEvent({
      event: 'SUBSCRIPTION_UPDATED',
      payment: { externalReference: 'user123' },
      subscription: { id: 'sub_abc', status: 'ACTIVE', nextDueDate: '2026-06-01', externalReference: 'user123' },
    });
    expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: 'premium', asaasStatus: 'active' }),
      }),
    );
  });

  it('SUBSCRIPTION_UPDATED INACTIVE → rebaixa para "free"', async () => {
    await service.handleWebhookEvent({
      event: 'SUBSCRIPTION_UPDATED',
      payment: { externalReference: 'user123' },
      subscription: { id: 'sub_abc', status: 'INACTIVE', nextDueDate: null, externalReference: 'user123' },
    });
    expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: 'free', asaasStatus: 'inactive' }),
      }),
    );
  });

  it('retorna { ok: true } ao final de evento processado', async () => {
    const result = await service.handleWebhookEvent({
      event: 'PAYMENT_CREATED',
      payment: { externalReference: 'user123' },
    });
    expect(result).toEqual({ ok: true });
  });
});

// ─── createCheckoutSession ───────────────────────────────────────────────────

describe('AsaasService.createCheckoutSession', () => {
  let asaasClient: ReturnType<typeof makeAsaasClient>;
  let service: ReturnType<typeof createAsaasService>;

  beforeEach(() => {
    asaasClient = makeAsaasClient();
    service = createAsaasService({ asaasClient });
    vi.clearAllMocks();
  });

  it('lança erro se cpfCnpj estiver ausente', async () => {
    await expect(
      service.createCheckoutSession({ userId: 'u1', email: 'test@test.com' }),
    ).rejects.toThrow('CPF ou CNPJ é obrigatório');
  });

  it('lança erro se CPF tiver comprimento inválido', async () => {
    await expect(
      service.createCheckoutSession({ userId: 'u1', email: 'test@test.com', cpfCnpj: '123' }),
    ).rejects.toThrow('CPF ou CNPJ inválido');
  });

  it('reutiliza cliente existente e retorna url de assinatura ativa', async () => {
    asaasClient.request
      .mockResolvedValueOnce({ data: [{ id: 'cust_1', externalReference: 'u1', cpfCnpj: '12345678901' }] }) // GET /customers
      .mockResolvedValueOnce({ data: [{ id: 'sub_active', status: 'ACTIVE' }] }) // GET /subscriptions
      .mockResolvedValueOnce({ data: [{ invoiceUrl: 'https://pay.me/invoice' }] }); // GET /payments

    const result = await service.createCheckoutSession({
      userId: 'u1',
      email: 'test@test.com',
      cpfCnpj: '12345678901',
    });

    expect(result).toMatchObject({ url: 'https://pay.me/invoice' });
  });

  it('cria novo cliente quando não existe', async () => {
    asaasClient.request
      .mockResolvedValueOnce({ data: [] }) // GET /customers → vazio
      .mockResolvedValueOnce({ id: 'cust_new', cpfCnpj: '12345678901' }) // POST /customers
      .mockResolvedValueOnce({ data: [] }) // GET /subscriptions → vazio
      .mockResolvedValueOnce({ id: 'sub_new' }) // POST /subscriptions
      .mockResolvedValueOnce({ data: [{ invoiceUrl: 'https://pay.me/new' }] }); // GET /payments

    const result = await service.createCheckoutSession({
      userId: 'u1',
      email: 'novo@test.com',
      name: 'Novo Usuário',
      cpfCnpj: '12345678901',
    });

    expect(asaasClient.request).toHaveBeenCalledWith(
      '/customers',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toMatchObject({ url: 'https://pay.me/new' });
  });

  it('lança erro se nenhuma cobrança for gerada após criar assinatura', async () => {
    asaasClient.request
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ id: 'cust_new' })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ id: 'sub_new' })
      .mockResolvedValueOnce({ data: [] }); // payments vazio

    await expect(
      service.createCheckoutSession({ userId: 'u1', email: 'a@b.com', cpfCnpj: '12345678901' }),
    ).rejects.toThrow('nenhuma cobrança inicial foi gerada');
  });
});

// ─── verifySubscription ──────────────────────────────────────────────────────

describe('AsaasService.verifySubscription', () => {
  let asaasClient: ReturnType<typeof makeAsaasClient>;
  let service: ReturnType<typeof createAsaasService>;

  beforeEach(() => {
    asaasClient = makeAsaasClient();
    service = createAsaasService({ asaasClient });
    vi.clearAllMocks();
  });

  it('retorna no_customer quando nenhum cliente encontrado', async () => {
    asaasClient.request.mockResolvedValueOnce({ data: [] });
    const result = await service.verifySubscription('ghost@test.com');
    expect(result.status).toBe('no_customer');
  });

  it('retorna none quando sem assinatura', async () => {
    asaasClient.request
      .mockResolvedValueOnce({ data: [{ id: 'cust_1' }] })
      .mockResolvedValueOnce({ data: [] });
    const result = await service.verifySubscription('no-sub@test.com');
    expect(result.status).toBe('none');
    expect(result.plan).toBe('free');
  });

  it('retorna plan "premium" para assinatura ACTIVE com pagamento confirmado', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    asaasClient.request
      .mockResolvedValueOnce({ data: [{ id: 'cust_1' }] })
      .mockResolvedValueOnce({ data: [{ id: 'sub_1', status: 'ACTIVE', dateCreated: '2026-01-01', nextDueDate: dueDateStr }] })
      .mockResolvedValueOnce({ data: [{ id: 'pay_1' }] }) // ?status=CONFIRMED
      .mockResolvedValueOnce({ data: [] });                // ?status=RECEIVED

    const result = await service.verifySubscription('premium@test.com');
    expect(result.plan).toBe('premium');
    expect(result.status).toBe('ACTIVE');
  });

  it('retorna plan "free" para assinatura ACTIVE sem pagamentos confirmados', async () => {
    asaasClient.request
      .mockResolvedValueOnce({ data: [{ id: 'cust_1' }] })
      .mockResolvedValueOnce({ data: [{ id: 'sub_1', status: 'ACTIVE', dateCreated: '2026-01-01', nextDueDate: '2026-05-01' }] })
      .mockResolvedValueOnce({ data: [] }) // ?status=CONFIRMED
      .mockResolvedValueOnce({ data: [] }); // ?status=RECEIVED

    const result = await service.verifySubscription('pending@test.com');
    expect(result.plan).toBe('free');
  });
});

// ─── cancelSubscription ──────────────────────────────────────────────────────

describe('AsaasService.cancelSubscription', () => {
  let asaasClient: ReturnType<typeof makeAsaasClient>;
  let service: ReturnType<typeof createAsaasService>;

  beforeEach(() => {
    asaasClient = makeAsaasClient();
    service = createAsaasService({ asaasClient });
    vi.clearAllMocks();
    mockNutritionistFindUnique.mockResolvedValue(null);
    mockSubscriptionUpsert.mockResolvedValue({});
    mockNutritionistUpdate.mockResolvedValue({});
  });

  it('retorna success=true silenciosamente quando nenhum cliente encontrado', async () => {
    asaasClient.request.mockResolvedValueOnce({ data: [] });
    const result = await service.cancelSubscription('ghost@test.com');
    expect(result.success).toBe(true);
    expect(result.refunded).toBe(false);
  });

  it('lança erro quando não há assinatura ativa', async () => {
    asaasClient.request
      .mockResolvedValueOnce({ data: [{ id: 'cust_1' }] })
      .mockResolvedValueOnce({ data: [{ id: 'sub_1', status: 'INACTIVE' }] });

    await expect(service.cancelSubscription('user@test.com')).rejects.toThrow(
      'Nenhuma assinatura ativa encontrada',
    );
  });

  it('cancela assinatura e faz reembolso se ≤ 7 dias', async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 2); // 2 dias atrás

    asaasClient.request
      .mockResolvedValueOnce({ data: [{ id: 'cust_1' }] })
      .mockResolvedValueOnce({ data: [{ id: 'sub_1', status: 'ACTIVE', dateCreated: recentDate.toISOString() }] })
      .mockResolvedValueOnce({ data: [{ id: 'pay_1' }] }) // pagamentos confirmados
      .mockResolvedValueOnce({}) // POST /refund
      .mockResolvedValueOnce({}); // DELETE /subscription

    mockNutritionistFindUnique.mockResolvedValue({ id: 'doc_user1', subscription: null });

    const result = await service.cancelSubscription('user@test.com');
    expect(result.refunded).toBe(true);
    expect(result.success).toBe(true);
  });

  it('cancela assinatura SEM reembolso se > 7 dias', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10); // 10 dias atrás

    asaasClient.request
      .mockResolvedValueOnce({ data: [{ id: 'cust_1' }] })
      .mockResolvedValueOnce({ data: [{ id: 'sub_1', status: 'ACTIVE', dateCreated: oldDate.toISOString() }] })
      .mockResolvedValueOnce({}); // DELETE /subscription

    const result = await service.cancelSubscription('old@test.com');
    expect(result.refunded).toBe(false);
    expect(result.success).toBe(true);
  });

  it('atualiza subscription após cancelamento bem-sucedido', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);

    asaasClient.request
      .mockResolvedValueOnce({ data: [{ id: 'cust_1' }] })
      .mockResolvedValueOnce({ data: [{ id: 'sub_1', status: 'ACTIVE', dateCreated: oldDate.toISOString() }] })
      .mockResolvedValueOnce({});

    mockNutritionistFindUnique.mockResolvedValue({ id: 'doc_user1', subscription: null });

    await service.cancelSubscription('user@test.com');

    expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ asaasStatus: 'cancelled', cancelAtPeriodEnd: true }),
      }),
    );
  });
});
