import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthenticateMiddleware } from '../../server/middlewares/auth.ts';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFindUnique = vi.fn().mockResolvedValue({ role: 'nutritionist', plan: 'free' });

vi.mock('../../server/lib/rls-context.ts', () => ({
  withAdminRLS: vi.fn((fn: () => Promise<any>) => fn()),
  getDb: vi.fn(() => ({
    nutritionist: { findUnique: mockFindUnique },
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAdmin(overrides: Record<string, any> = {}) {
  return {
    auth: vi.fn().mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user123', email: 'user@test.com' }),
      ...overrides,
    }),
  };
}

function makeReqWithToken(token: string | null) {
  return {
    headers: {
      authorization: token ? `Bearer ${token}` : undefined,
    },
  } as any;
}

function makeReqNoAuth() {
  return { headers: {} } as any;
}

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('AuthMiddleware', () => {
  let res: ReturnType<typeof makeRes>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    res = makeRes();
    next = vi.fn();
  });

  it('retorna 401 se o header Authorization estiver ausente', async () => {
    const authenticate = createAuthenticateMiddleware({ admin: makeAdmin() });
    await authenticate(makeReqNoAuth(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 401 se o header não começar com "Bearer "', async () => {
    const authenticate = createAuthenticateMiddleware({ admin: makeAdmin() });
    const req = { headers: { authorization: 'Basic sometoken' } } as any;
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 401 se o token for inválido (verifyIdToken lança erro)', async () => {
    const admin = makeAdmin();
    admin.auth.mockReturnValue({
      verifyIdToken: vi.fn().mockRejectedValue(new Error('Token expirado')),
    });

    const authenticate = createAuthenticateMiddleware({ admin });
    await authenticate(makeReqWithToken('invalid-token'), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('chama next() e popula req.user para token válido', async () => {
    const decodedToken = { uid: 'user123', email: 'user@test.com' };
    const admin = makeAdmin();
    admin.auth.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue(decodedToken),
    });

    const req = makeReqWithToken('valid-token');
    const authenticate = createAuthenticateMiddleware({ admin });
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject(decodedToken);
    expect(req.user.dbRole).toBe('nutritionist');
    expect(req.user.dbPlan).toBe('free');
    expect(req.user.isAdmin).toBe(false);
    expect(req.user.isPremium).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('extrai corretamente o token após "Bearer "', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ uid: 'u1' });
    const admin = { auth: vi.fn().mockReturnValue({ verifyIdToken }) };

    const req = makeReqWithToken('meu-token-jwt');
    const authenticate = createAuthenticateMiddleware({ admin });
    await authenticate(req, res, next);

    expect(verifyIdToken).toHaveBeenCalledWith('meu-token-jwt');
  });

  it('não vaza informações do erro ao retornar 401 para token inválido', async () => {
    const admin = makeAdmin();
    admin.auth.mockReturnValue({
      verifyIdToken: vi.fn().mockRejectedValue(new Error('Firebase: ID token has expired')),
    });

    const authenticate = createAuthenticateMiddleware({ admin });
    await authenticate(makeReqWithToken('expired'), res, next);

    const jsonArg = res.json.mock.calls[0][0];
    // Deve retornar mensagem genérica, não detalhes internos do Firebase
    expect(jsonArg.error).not.toContain('Firebase:');
  });
});
