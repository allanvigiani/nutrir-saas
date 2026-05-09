# Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Proteger todas as rotas do backend Express com rate limiting em camadas por nível de custo, prevenindo uso abusivo da API de IA (Gemini), envio de emails (Brevo) e cobranças inesperadas em serviços terceiros.

**Architecture:** Um único arquivo `rate-limit.ts` exporta factory functions para cada tier de limiter (seguindo o padrão factory do projeto). Os limiters são aplicados centralmente em `register-api-routes.ts` antes das rotas, mantendo a política de segurança num único lugar. Usa o in-memory store do `express-rate-limit` (sem Redis — escala suficiente para este produto).

**Tech Stack:** `express-rate-limit` v8.3.2 (já instalado no lock), Express 4, Vitest

---

## Tiers de Rate Limit

| Tier | Rotas | Limite | Janela | Motivo |
|---|---|---|---|---|
| `aiLimiter` | `/api/nutrition/calculate` | 10 req | 60 min | Gemini AI — custo por token |
| `emailLimiter` | `/api/send-*`, `/api/test-email` | 20 req | 60 min | Email via Brevo — custo por envio |
| `paymentLimiter` | `/api/*-checkout-*`, `/api/verify-subscription`, `/api/*-portal-*`, `/api/cancel-*` | 30 req | 15 min | Asaas — prevenir criação massiva de cobranças |
| `calendarLimiter` | `/api/create-calendar-event` | 30 req | 15 min | Google Calendar API quota |
| `authLimiter` | `/api/auth/google/*` | 20 req | 15 min | OAuth — prevenir abuso de redirect |
| `generalLimiter` | `/api/logs`, `/api/health`, webhook | 100 req | 1 min | Sem custo direto mas protege o servidor |

---

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/server/middlewares/rate-limit.ts` | **Criar** — factory functions para cada tier |
| `src/server/register-api-routes.ts` | **Modificar** — aplicar limiters por rota |
| `src/tests/middlewares/rate-limit.middleware.test.ts` | **Criar** — testes dos limiters |
| `package.json` | **Modificar** — declarar `express-rate-limit` como dependência direta |

---

## Task 1: Declarar dependência no package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar express-rate-limit como dependência direta**

```bash
npm install express-rate-limit
```

Saída esperada: `added 0 packages` (já está no lock) e `express-rate-limit` aparece em `dependencies` no `package.json`.

- [ ] **Step 2: Verificar que a versão instalada é ≥ 8**

```bash
node -e "const r = require('express-rate-limit'); console.log(require('./node_modules/express-rate-limit/package.json').version)"
```

Saída esperada: `8.x.x`

---

## Task 2: Criar o middleware de rate limiting

**Files:**
- Create: `src/server/middlewares/rate-limit.ts`
- Test: `src/tests/middlewares/rate-limit.middleware.test.ts`

- [ ] **Step 1: Escrever os testes primeiro**

Criar `src/tests/middlewares/rate-limit.middleware.test.ts`:

```typescript
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
  return { ip, headers: {}, method: 'POST', path: '/api/test' } as any;
}

function makeRes() {
  const res: any = { headersSent: false };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.getHeader = vi.fn().mockReturnValue(undefined);
  res.removeHeader = vi.fn();
  res.end = vi.fn();
  return res;
}

async function callMiddleware(middleware: any, req: any, res: any): Promise<boolean> {
  return new Promise((resolve) => {
    middleware(req, res, () => resolve(true));
    // Se next nunca chamado, o middleware bloqueia
    setTimeout(() => resolve(false), 50);
  });
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
    const req = makeReq('10.0.0.1');
    const res = makeRes();
    await limiter(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('retorna 429 ao exceder o limite de 10 requisições', async () => {
    const limiter = createAiLimiter();
    const res = makeRes();
    const ip = '10.0.0.99';

    // Fazer 10 requisições (dentro do limite)
    for (let i = 0; i < 10; i++) {
      const next = vi.fn();
      await limiter(makeReq(ip), res, next);
    }

    // 11ª requisição deve ser bloqueada
    const next = vi.fn();
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
});

describe('createCalendarLimiter', () => {
  it('retorna um middleware (função com 3 parâmetros)', () => {
    const limiter = createCalendarLimiter();
    expect(typeof limiter).toBe('function');
    expect(limiter.length).toBe(3);
  });
});

describe('createAuthLimiter', () => {
  it('retorna um middleware (função com 3 parâmetros)', () => {
    const limiter = createAuthLimiter();
    expect(typeof limiter).toBe('function');
    expect(limiter.length).toBe(3);
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
    await limiter(makeReq('10.2.0.1'), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
npm run test -- src/tests/middlewares/rate-limit.middleware.test.ts
```

Esperado: `FAIL` com erro de import (arquivo ainda não existe).

- [ ] **Step 3: Criar `src/server/middlewares/rate-limit.ts`**

```typescript
import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';

const RATE_LIMIT_MESSAGE = { error: 'Muitas requisições. Aguarde e tente novamente.' };

/** Gemini AI — custo por token. Limite conservador. */
export function createAiLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });
}

/** Email via Brevo — custo por envio. */
export function createEmailLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });
}

/** Asaas — prevenir criação massiva de cobranças. */
export function createPaymentLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });
}

/** Google Calendar API — respeitar quota diária. */
export function createCalendarLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });
}

/** Google OAuth — prevenir abuso de redirect/callback. */
export function createAuthLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });
}

/** Rotas sem custo direto — proteger servidor. */
export function createGeneralLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 60 * 1000, // 1 min
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
npm run test -- src/tests/middlewares/rate-limit.middleware.test.ts
```

Esperado: todos os testes `PASS`.

---

## Task 3: Aplicar os limiters nas rotas

**Files:**
- Modify: `src/server/register-api-routes.ts`

- [ ] **Step 1: Substituir o conteúdo de `src/server/register-api-routes.ts`**

```typescript
import type { AsaasConfig, BaseRouteDeps, GoogleConfig } from "./types.ts";
import { registerAsaasRoutes } from "./routes/asaas.routes.ts";
import { registerEmailRoutes } from "./routes/email.routes.ts";
import { registerGoogleRoutes } from "./routes/google.routes.ts";
import { registerHealthRoutes } from "./routes/health.routes.ts";
import { registerNutritionRoutes } from "./routes/nutrition.routes.ts";
import { registerLogRoutes } from "./routes/log.routes.ts";
import { logger } from "./logger.ts";
import {
  createAiLimiter,
  createEmailLimiter,
  createPaymentLimiter,
  createCalendarLimiter,
  createAuthLimiter,
  createGeneralLimiter,
} from "./middlewares/rate-limit.ts";

type RegisterApiRoutesDeps = BaseRouteDeps & AsaasConfig & GoogleConfig;

export function registerApiRoutes(deps: RegisterApiRoutesDeps) {
  const aiLimiter       = createAiLimiter();
  const emailLimiter    = createEmailLimiter();
  const paymentLimiter  = createPaymentLimiter();
  const calendarLimiter = createCalendarLimiter();
  const authLimiter     = createAuthLimiter();
  const generalLimiter  = createGeneralLimiter();

  // ── AI (Gemini) ──────────────────────────────────────────────────────────
  deps.app.use('/api/nutrition', aiLimiter);

  // ── Email (Brevo) ────────────────────────────────────────────────────────
  deps.app.use('/api/send-meal-plan',      emailLimiter);
  deps.app.use('/api/send-welcome-email',  emailLimiter);
  deps.app.use('/api/test-email',          emailLimiter);

  // ── Pagamentos (Asaas) ───────────────────────────────────────────────────
  deps.app.use('/api/create-checkout-session', paymentLimiter);
  deps.app.use('/api/verify-subscription',     paymentLimiter);
  deps.app.use('/api/create-portal-session',   paymentLimiter);
  deps.app.use('/api/cancel-subscription',     paymentLimiter);

  // ── Google Calendar ──────────────────────────────────────────────────────
  deps.app.use('/api/create-calendar-event', calendarLimiter);

  // ── Google OAuth ─────────────────────────────────────────────────────────
  deps.app.use('/api/auth/google', authLimiter);

  // ── Geral (logs, health, webhooks) ───────────────────────────────────────
  deps.app.use('/api/logs',            generalLimiter);
  deps.app.use('/api/health',          generalLimiter);
  deps.app.use('/api/asaas-webhook',   generalLimiter);

  // ── Registro das rotas ───────────────────────────────────────────────────
  registerEmailRoutes(deps);
  registerHealthRoutes(deps);
  registerGoogleRoutes(deps);
  registerAsaasRoutes(deps);
  registerNutritionRoutes(deps);
  registerLogRoutes(deps.app);

  logger.info("Rotas da API registradas com sucesso (rate limiting ativo)");
}
```

> **Importante:** Os `deps.app.use()` com limiters devem vir ANTES dos `register*Routes()` para que o middleware seja aplicado antes dos handlers.

- [ ] **Step 2: Verificar TypeScript**

```bash
npm run lint
```

Esperado: zero erros.

- [ ] **Step 3: Rodar todos os testes**

```bash
npm run test
```

Esperado: todos os testes existentes continuam passando + novos testes do rate-limit passam.

---

## Task 4: Verificação end-to-end

- [ ] **Step 1: Subir o servidor em dev**

```bash
npm run dev
```

- [ ] **Step 2: Testar o rate limit na rota de IA**

```bash
# Executar 11 vezes — a 11ª deve retornar 429
for i in $(seq 1 11); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:3000/api/nutrition/calculate \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer INVALID_TOKEN" \
    -d '{}')
  echo "Request $i: $STATUS"
done
```

Esperado:
```
Request 1:  401   ← sem token válido, mas passou pelo rate limiter
Request 2:  401
...
Request 10: 401
Request 11: 429   ← rate limit atingido
```

> Nota: O status 401 é esperado em dev sem token válido. O importante é que a 11ª retorna 429, provando que o rate limit está ativo independente da autenticação.

- [ ] **Step 3: Verificar headers de rate limit na resposta**

```bash
curl -I -X POST http://localhost:3000/api/nutrition/calculate \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Esperado nos headers:
```
RateLimit-Limit: 10
RateLimit-Remaining: 9
RateLimit-Reset: <timestamp>
```

---

## Checklist final

- [ ] `express-rate-limit` declarado em `dependencies` no `package.json`
- [ ] `src/server/middlewares/rate-limit.ts` criado com 6 factory functions
- [ ] `src/tests/middlewares/rate-limit.middleware.test.ts` todos passando
- [ ] `src/server/register-api-routes.ts` com limiters antes dos handlers
- [ ] `npm run lint` zero erros
- [ ] `npm run test` todos passando
- [ ] Limiter da rota `/api/nutrition/calculate` confirmado via curl retornando 429 após 10 req
