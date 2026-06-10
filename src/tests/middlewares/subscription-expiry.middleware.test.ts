import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSubscriptionExpiryMiddleware } from '../../server/middlewares/subscription-expiry.ts';

const mockUpsert = vi.fn().mockResolvedValue({});

const mockFindUnique = vi.fn();

vi.mock('../../server/lib/rls-context.ts', () => ({
  withAdminRLS: vi.fn((fn: () => Promise<any>) => fn()),
  getDb: vi.fn(() => ({
    subscription: { findUnique: mockFindUnique },
  })),
}));

vi.mock('../../server/logger.ts', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

function makeSubscriptionService() {
  return { upsert: mockUpsert };
}

function makeReq(overrides: { uid?: string; dbPlan?: string; isAdmin?: boolean } = {}) {
  const dbPlan = overrides.dbPlan ?? 'premium';
  const isAdmin = overrides.isAdmin ?? false;
  return {
    user: {
      uid: overrides.uid ?? 'user123',
      dbPlan,
      isAdmin,
      isPremium: isAdmin || dbPlan === 'premium',
    },
  } as any;
}

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('SubscriptionExpiryMiddleware', () => {
  let res: ReturnType<typeof makeRes>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    res = makeRes();
    next = vi.fn();
    mockFindUnique.mockReset();
    mockUpsert.mockReset().mockResolvedValue({});
  });

  it('chama next() sem query se dbPlan for free', async () => {
    const middleware = createSubscriptionExpiryMiddleware({ subscriptionService: makeSubscriptionService() });
    const req = makeReq({ dbPlan: 'free' });
    await middleware(req, res, next);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('chama next() sem query se isAdmin for true', async () => {
    const middleware = createSubscriptionExpiryMiddleware({ subscriptionService: makeSubscriptionService() });
    const req = makeReq({ isAdmin: true });
    await middleware(req, res, next);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('chama next() sem downgrade se currentPeriodEnd for null', async () => {
    mockFindUnique.mockResolvedValue({ currentPeriodEnd: null });
    const middleware = createSubscriptionExpiryMiddleware({ subscriptionService: makeSubscriptionService() });
    const req = makeReq();
    await middleware(req, res, next);
    expect(req.user.isPremium).toBe(true);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('chama next() sem downgrade se currentPeriodEnd for no futuro', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
    mockFindUnique.mockResolvedValue({ currentPeriodEnd: future });
    const middleware = createSubscriptionExpiryMiddleware({ subscriptionService: makeSubscriptionService() });
    const req = makeReq();
    await middleware(req, res, next);
    expect(req.user.isPremium).toBe(true);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('rebaixa plano e chama upsert quando currentPeriodEnd expirou', async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    mockFindUnique.mockResolvedValue({ currentPeriodEnd: past });
    const middleware = createSubscriptionExpiryMiddleware({ subscriptionService: makeSubscriptionService() });
    const req = makeReq({ uid: 'user123' });
    await middleware(req, res, next);
    expect(req.user.dbPlan).toBe('free');
    expect(req.user.isPremium).toBe(false);
    expect(mockUpsert).toHaveBeenCalledWith('user123', {
      plan: 'free',
      cancelAtPeriodEnd: false,
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it('chama next() mesmo se a query ao banco lançar erro', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB connection lost'));
    const middleware = createSubscriptionExpiryMiddleware({ subscriptionService: makeSubscriptionService() });
    const req = makeReq();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user.isPremium).toBe(true);
  });
});
