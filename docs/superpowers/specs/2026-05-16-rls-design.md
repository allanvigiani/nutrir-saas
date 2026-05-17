# Row Level Security (RLS) — Design Spec

**Data:** 2026-05-16
**Motivação:** Garantir que vazamento de credenciais do banco ou bug de código nunca exponha dados de um tenant a outro. Saúde do paciente é dado sensível — o banco deve ser a última linha de defesa.

---

## Contexto técnico crítico

O Neon usa **PgBouncer em transaction mode**. Cada query implícita do Prisma usa uma conexão diferente do pool. Por isso, `set_config` feito em uma query **não persiste** para a próxima. A solução correta é usar `SET LOCAL` dentro de uma `$transaction` explícita — tudo na mesma conexão.

---

## Arquitetura

```
Request HTTP
  ↓
Express route handler
  → withNutritionistRLS(uid, async () => {
      prisma.$transaction(async (tx) => {
        SET LOCAL app.current_nutritionist_id = uid
        txStorage.run(tx, fn)         ← AsyncLocalStorage armazena tx
          → service.list(uid)
              → getDb().patient.findMany()  ← retorna tx
                  → PostgreSQL verifica RLS policy
      })
    })
```

**Dois contextos de sessão PostgreSQL:**

| Contexto | Variável | Quem usa |
|---|---|---|
| Nutricionista autenticado | `app.current_nutritionist_id` | Rotas com `authenticate` |
| Paciente via portal | `app.current_patient_id` | Rotas `/api/portal/...` |
| Admin / sistema | `app.rls_bypass = 'true'` | Admin routes |

**Acesso direto ao banco sem contexto → zero dados visíveis** (FORCE ROW LEVEL SECURITY, sem bypass para variável não setada).

---

## Arquivos

### Criar
- `src/server/lib/rls-context.ts` — AsyncLocalStorage + helpers
- `prisma/migrations/YYYYMMDD_add_rls/migration.sql` — RLS + policies

### Modificar — Services (trocar `prisma.X` por `getDb().X`)
- `patients.service.ts`
- `consultations.service.ts`
- `lab-exams.service.ts`
- `meal-plans.service.ts`
- `appointments.service.ts`
- `nutrition-calculations.service.ts`
- `custom-foods.service.ts`
- `payments.service.ts`
- `nutritionists.service.ts`
- `account-export.service.ts`
- `retention.service.ts`
- `google-calendar.service.ts`
- `dashboard.service.ts`
- `subscription.service.ts`

### Modificar — Routes (wrap em `withNutritionistRLS` / `withPatientRLS` / `withAdminRLS`)
- `patients.routes.ts`
- `consultations.routes.ts`
- `lab-exams.routes.ts`
- `meal-plans.routes.ts`
- `appointments.routes.ts`
- `nutrition-calculations.routes.ts`
- `custom-foods.routes.ts`
- `payments.routes.ts`
- `nutritionists.routes.ts`
- `settings.routes.ts`
- `account-export.routes.ts`
- `account.routes.ts`
- `auth.routes.ts`
- `dashboard.routes.ts`
- `subscription.routes.ts`
- `patient-portal.routes.ts`
- `admin.routes.ts`
- `google.routes.ts`

---

## `src/server/lib/rls-context.ts`

```typescript
import { AsyncLocalStorage } from 'async_hooks';
import { PrismaClient } from '@prisma/client';
import { prisma } from './prisma.ts';

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

const txStorage = new AsyncLocalStorage<TxClient>();

export function getDb(): PrismaClient | TxClient {
  return txStorage.getStore() ?? prisma;
}

async function setRLSConfig(tx: TxClient, config: {
  nutritionistId?: string;
  patientId?: string;
  bypass?: boolean;
}): Promise<void> {
  await (tx as any).$executeRaw`
    SELECT
      set_config('app.current_nutritionist_id', ${config.nutritionistId ?? ''}, true),
      set_config('app.current_patient_id',      ${config.patientId ?? ''},      true),
      set_config('app.rls_bypass',              ${config.bypass ? 'true' : ''}, true)
  `;
}

export async function withNutritionistRLS<T>(
  nutritionistId: string,
  fn: () => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setRLSConfig(tx as TxClient, { nutritionistId });
    return txStorage.run(tx as TxClient, fn);
  });
}

export async function withPatientRLS<T>(
  patientId: string,
  fn: () => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setRLSConfig(tx as TxClient, { patientId });
    return txStorage.run(tx as TxClient, fn);
  });
}

export async function withAdminRLS<T>(fn: () => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setRLSConfig(tx as TxClient, { bypass: true });
    return txStorage.run(tx as TxClient, fn);
  });
}
```

---

## Migration SQL

### Tabelas cobertas

`patients`, `consultations`, `lab_exams`, `meal_plans`, `meal_plan_items`, `appointments`, `nutrition_calculations`, `custom_foods`, `payments`, `subscriptions`, `nutritionists`

### Estrutura das policies por tabela

**patients:**
```sql
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;

CREATE POLICY patients_nutritionist ON patients FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY patients_self ON patients FOR SELECT
  USING (id = current_setting('app.current_patient_id', true));

CREATE POLICY patients_admin ON patients FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');
```

**consultations, appointments, meal_plans, nutrition_calculations:**
- Policy nutritionista: `WHERE "nutritionistId" = current_setting(...)`
- Policy paciente (SELECT): `WHERE "patientId" = current_setting('app.current_patient_id', true)`
- Policy admin bypass

**lab_exams** (sem `nutritionistId` direto):
- Policy nutritionista: `WHERE EXISTS (SELECT 1 FROM patients WHERE id = "patientId" AND "nutritionistId" = current_setting(...))`
- Policy paciente (SELECT): `WHERE "patientId" = current_setting(...)`
- Policy admin bypass

**meal_plan_items** (sem `nutritionistId` ou `patientId` direto):
- Policy nutritionista: `WHERE EXISTS (SELECT 1 FROM meal_plans WHERE id = "mealPlanId" AND "nutritionistId" = current_setting(...))`
- Policy paciente (SELECT): `WHERE EXISTS (SELECT 1 FROM meal_plans WHERE id = "mealPlanId" AND "patientId" = current_setting(...))`
- Policy admin bypass

**custom_foods, payments, subscriptions:**
- Policy nutritionista: `WHERE "nutritionistId" = current_setting(...)`
- Policy admin bypass

**nutritionists:**
- Policy self: `WHERE id = current_setting('app.current_nutritionist_id', true)` (ALL)
- Policy admin bypass

---

## Mudanças nos services

Troca mecânica em todas as funções que fazem queries Prisma:

```typescript
// ANTES
import { prisma } from '../lib/prisma.ts';
return prisma.patient.findMany({ ... });

// DEPOIS
import { getDb } from '../lib/rls-context.ts';
return getDb().patient.findMany({ ... });
```

O `getDb()` retorna o transaction client (`tx`) quando dentro de um contexto RLS, ou o `prisma` global quando fora (migrations, testes, sistema).

---

## Mudanças nos route handlers

```typescript
// Rotas autenticadas (nutricionista)
deps.app.get('/api/patients', deps.authenticate, async (req, res) => {
  await withNutritionistRLS(req.user.uid, async () => {
    const patients = await service.list(req.user.uid);
    res.json(patients);
  });
});

// Rotas do portal (paciente) — problema de bootstrap:
// Com FORCE RLS, findFirst sem contexto retorna zero linhas.
// Solução: withPortalAuth valida o token via admin bypass, depois
// executa fn() no contexto withPatientRLS do paciente encontrado.
//
// withPortalAuth é exportado de rls-context.ts:
// async function withPortalAuth<T>(id, token, fn: (patient) => Promise<T>)
//   1. withAdminRLS → findFirst({ where: { id, accessToken: token } })
//   2. se não encontrado → throw 'Acesso negado'
//   3. withPatientRLS(patient.id, () => fn(patient))

deps.app.post('/api/portal/patients/:id/verify-cpf', async (req, res) => {
  await withPortalAuth(req.params.id, req.body.token, async (patient) => {
    // patient já validado, contexto patientId setado no banco
    const cleanCpf = patient.cpf.replace(/\D/g, '');
    if (req.body.cpfSuffix !== cleanCpf.slice(-3)) return res.status(401)...;
    res.json({ valid: true });
  });
});

// Admin routes
deps.app.get('/api/admin/nutritionists', deps.authenticate, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  await withAdminRLS(async () => {
    const data = await service.listAll();
    res.json(data);
  });
});
```

---

## Compatibilidade com criptografia existente

O middleware de criptografia (`prisma-encrypt.ts`) usa `$use` e é herdado pelo transaction client `tx`. **Sem impacto** — criptografia continua funcionando normalmente dentro das transactions RLS.

---

## Casos especiais

- **`account.service.ts` (delete de conta):** Envolver em `withNutritionistRLS(uid, ...)` — o delete toca a tabela `nutritionists` que tem FORCE RLS.
- **`asaas.service.ts` (webhooks):** Webhooks chegam sem contexto de nutricionista. Usar `withAdminRLS` para operações de subscription/payment no webhook handler.
- **`email.service.ts`:** Não faz queries ao banco — envia emails via SMTP. Sem alteração necessária.
- **`nutrition.service.ts`:** Usa Gemini API para cálculos nutricionais. Se consultar `nutritionists` para contexto, precisa de `getDb()`. Verificar durante implementação.
- **`google-calendar.service.ts`:** Já migrado para Prisma — trocar `prisma.X` por `getDb().X`. O `handleCallback` e `createCalendarEvent` serão chamados dentro de `withNutritionistRLS` via route handler.

---

## Verificação end-to-end

1. `npm run lint` — zero erros
2. `npm run test` — 175+ testes passando
3. Cadastrar nutricionista A e B → tentar acessar pacientes de A como B → resposta vazia (RLS bloqueando)
4. Acessar portal do paciente → dados corretos visíveis
5. Admin: `GET /api/admin/nutritionists` → todos os nutricionistas visíveis
6. Conectar diretamente ao Neon SQL Editor (sem `set_config`) → `SELECT * FROM patients` → zero linhas
