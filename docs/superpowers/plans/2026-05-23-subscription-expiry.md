# Subscription Expiry Middleware — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um middleware Express que rebaixa automaticamente o plano de `premium` para `free` em toda request autenticada quando `currentPeriodEnd` estiver vencido, sem depender de webhooks do Asaas.

**Architecture:** Um middleware de factory (`createSubscriptionExpiryMiddleware`) que consulta a tabela `subscriptions` e, se o período expirou, atualiza `req.user` de forma síncrona e dispara o upsert no banco como fire-and-forget. Composto com `authenticate` no `server.ts` para ser aplicado em todas as rotas autenticadas sem tocar os arquivos de rota.

**Tech Stack:** Express, Prisma (via `getDb()`), Vitest, TypeScript strict.

---

## Mapa de arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `src/server/middlewares/subscription-expiry.ts` | Lógica do middleware de expiração |
| Criar | `src/tests/middlewares/subscription-expiry.middleware.test.ts` | Testes unitários do middleware |
| Modificar | `server.ts` | Compor `checkExpiry` com `authenticate` |

---

### Task 1: Middleware de expiração de assinatura (TDD)

**Files:**
- Create: `src/server/middlewares/subscription-expiry.ts`
- Create: `src/tests/middlewares/subscription-expiry.middleware.test.ts`

- [ ] **Step 1: Criar o arquivo de testes**

Crie `src/tests/middlewares/subscription-expiry.middleware.test.ts` com o conteúdo abaixo:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSubscriptionExpiryMiddleware } from '../../server/middlewares/subscription-expiry.ts';

const mockUpsert = vi.fn().mockResolvedValue({});

vi.mock('../../server/services/subscription.service.ts', () => ({
  createSubscriptionService: vi.fn(() => ({
    upsert: mockUpsert,
    getByNutritionistId: vi.fn(),
  })),
}));

const mockFindUnique = vi.fn();

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: vi.fn(() => ({
    subscription: { findUnique: mockFindUnique },
  })),
}));

vi.mock('../../server/logger.ts', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

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
    const middleware = createSubscriptionExpiryMiddleware();
    const req = makeReq({ dbPlan: 'free' });
    await middleware(req, res, next);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('chama next() sem query se isAdmin for true', async () => {
    const middleware = createSubscriptionExpiryMiddleware();
    const req = makeReq({ isAdmin: true });
    await middleware(req, res, next);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('chama next() sem downgrade se currentPeriodEnd for null', async () => {
    mockFindUnique.mockResolvedValue({ currentPeriodEnd: null });
    const middleware = createSubscriptionExpiryMiddleware();
    const req = makeReq();
    await middleware(req, res, next);
    expect(req.user.isPremium).toBe(true);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('chama next() sem downgrade se currentPeriodEnd for no futuro', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
    mockFindUnique.mockResolvedValue({ currentPeriodEnd: future });
    const middleware = createSubscriptionExpiryMiddleware();
    const req = makeReq();
    await middleware(req, res, next);
    expect(req.user.isPremium).toBe(true);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('rebaixa plano e chama upsert quando currentPeriodEnd expirou', async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    mockFindUnique.mockResolvedValue({ currentPeriodEnd: past });
    const middleware = createSubscriptionExpiryMiddleware();
    const req = makeReq({ uid: 'user123' });
    await middleware(req, res, next);
    expect(req.user.dbPlan).toBe('free');
    expect(req.user.isPremium).toBe(false);
    expect(mockUpsert).toHaveBeenCalledWith('user123', {
      plan: 'free',
      asaasStatus: 'cancelled',
      cancelAtPeriodEnd: false,
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it('chama next() mesmo se a query ao banco lançar erro', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB connection lost'));
    const middleware = createSubscriptionExpiryMiddleware();
    const req = makeReq();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user.isPremium).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes — verificar que falham**

```bash
npm run test -- subscription-expiry
```

Esperado: falha com `Cannot find module '../../server/middlewares/subscription-expiry.ts'`.

- [ ] **Step 3: Criar o middleware**

Crie `src/server/middlewares/subscription-expiry.ts`:

```typescript
import { getDb } from '../lib/rls-context.ts';
import { createSubscriptionService } from '../services/subscription.service.ts';
import { logger } from '../logger.ts';

export function createSubscriptionExpiryMiddleware() {
  const subscriptionService = createSubscriptionService();

  return async (req: any, res: any, next: any) => {
    if (req.user?.isAdmin || req.user?.dbPlan !== 'premium') {
      return next();
    }

    const userId = req.user?.uid;
    if (!userId) return next();

    try {
      const sub = await getDb().subscription.findUnique({
        where: { nutritionistId: userId },
        select: { currentPeriodEnd: true },
      });

      if (!sub?.currentPeriodEnd) return next();

      const isExpired = sub.currentPeriodEnd < new Date();
      if (!isExpired) return next();

      req.user.dbPlan = 'free';
      req.user.isPremium = false;

      subscriptionService
        .upsert(userId, {
          plan: 'free',
          asaasStatus: 'cancelled',
          cancelAtPeriodEnd: false,
        })
        .catch((err: unknown) =>
          logger.error('[SubscriptionExpiry] Erro ao rebaixar plano', err, { userId })
        );
    } catch (err) {
      logger.error('[SubscriptionExpiry] Erro ao verificar expiração', err, { userId });
    }

    return next();
  };
}
```

- [ ] **Step 4: Rodar os testes — verificar que passam**

```bash
npm run test -- subscription-expiry
```

Esperado: 6 testes passando.

- [ ] **Step 5: Rodar o lint**

```bash
npm run lint
```

Esperado: sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add src/server/middlewares/subscription-expiry.ts src/tests/middlewares/subscription-expiry.middleware.test.ts
git commit -m "feat: middleware de expiração automática de assinatura premium"
```

---

### Task 2: Wiring em `server.ts`

**Files:**
- Modify: `server.ts:8,75`

- [ ] **Step 1: Adicionar o import do novo middleware**

No `server.ts`, adicione o import logo após o import de `auth.ts` (linha 8):

```typescript
import { createSubscriptionExpiryMiddleware } from "./src/server/middlewares/subscription-expiry.ts";
```

- [ ] **Step 2: Compor o middleware com `authenticate`**

No `server.ts`, substitua a linha 75:

```typescript
// Antes:
const authenticate = createAuthenticateMiddleware({ admin });

// Depois:
const rawAuthenticate = createAuthenticateMiddleware({ admin });
const checkSubscriptionExpiry = createSubscriptionExpiryMiddleware();

function authenticate(req: any, res: any, next: any) {
  rawAuthenticate(req, res, (err?: any) => {
    if (err) return next(err);
    checkSubscriptionExpiry(req, res, next);
  });
}
```

- [ ] **Step 3: Rodar o lint**

```bash
npm run lint
```

Esperado: sem erros de tipo.

- [ ] **Step 4: Rodar todos os testes**

```bash
npm run test
```

Esperado: todos os testes passando (incluindo os testes de auth existentes).

- [ ] **Step 5: Commit**

```bash
git add server.ts
git commit -m "feat: aplicar verificação de expiração em todas as rotas autenticadas"
```
