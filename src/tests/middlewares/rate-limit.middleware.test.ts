import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAiLimiter,
  createEmailLimiter,
  createPaymentLimiter,
  createCalendarLimiter,
  createAuthLimiter,
  createGeneralLimiter,
} from '../../server/middlewares/rate-limit.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(ip = '127.0.0.1') {
  // app.get é necessário para o express-rate-limit v8 não lançar no trustProxy check
  return { ip, headers: {}, method: 'POST', path: '/api/test', app: { get: () => undefined } } as any;
}

function makeRes() {
  const res: any = { headersSent: false };
  res.status = vi.fn().mockReturnValue(res);
  res.json   = vi.fn().mockReturnValue(res);
  res.send   = vi.fn().mockReturnValue(res);
  res.setHeader    = vi.fn();
  res.getHeader    = vi.fn().mockReturnValue(undefined);
  res.removeHeader = vi.fn();
  res.end          = vi.fn();
  return res;
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('createAiLimiter', () => {
  it('retorna um middleware (função com 3 parâmetros)', () => {
    const limiter = createAiLimiter();
    expect(typeof limiter).toBe('function');
    expect(limiter.length).toBe(3);
  });

  it('chama next() dentro do limite', async () => {
    const limiter = createAiLimiter();
    const next = vi.fn();
    await limiter(makeReq('10.0.0.1'), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('retorna 429 ao exceder o limite de 50 requisições', async () => {
    const limiter = createAiLimiter();
    const ip = '10.0.0.200';

    for (let i = 0; i < 50; i++) {
      const next = vi.fn();
      await limiter(makeReq(ip), makeRes(), next);
    }

    const next = vi.fn();
    const res  = makeRes();
    await limiter(makeReq(ip), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });
});

describe('createEmailLimiter', () => {
  it('retorna um middleware (função com 3 parâmetros)', () => {
    const limiter = createEmailLimiter();
    expect(typeof limiter).toBe('function');
    expect(limiter.length).toBe(3);
  });

  it('chama next() dentro do limite', async () => {
    const limiter = createEmailLimiter();
    const next = vi.fn();
    await limiter(makeReq('10.1.0.1'), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('createPaymentLimiter', () => {
  it('retorna um middleware (função com 3 parâmetros)', () => {
    const limiter = createPaymentLimiter();
    expect(typeof limiter).toBe('function');
    expect(limiter.length).toBe(3);
  });

  it('chama next() dentro do limite', async () => {
    const limiter = createPaymentLimiter();
    const next = vi.fn();
    await limiter(makeReq('10.2.0.1'), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('createCalendarLimiter', () => {
  it('retorna um middleware (função com 3 parâmetros)', () => {
    const limiter = createCalendarLimiter();
    expect(typeof limiter).toBe('function');
    expect(limiter.length).toBe(3);
  });

  it('chama next() dentro do limite', async () => {
    const limiter = createCalendarLimiter();
    const next = vi.fn();
    await limiter(makeReq('10.3.0.1'), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('createAuthLimiter', () => {
  it('retorna um middleware (função com 3 parâmetros)', () => {
    const limiter = createAuthLimiter();
    expect(typeof limiter).toBe('function');
    expect(limiter.length).toBe(3);
  });

  it('chama next() dentro do limite', async () => {
    const limiter = createAuthLimiter();
    const next = vi.fn();
    await limiter(makeReq('10.4.0.1'), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('createGeneralLimiter', () => {
  it('retorna um middleware (função com 3 parâmetros)', () => {
    const limiter = createGeneralLimiter();
    expect(typeof limiter).toBe('function');
    expect(limiter.length).toBe(3);
  });

  it('chama next() dentro do limite', async () => {
    const limiter = createGeneralLimiter();
    const next = vi.fn();
    await limiter(makeReq('10.5.0.1'), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
