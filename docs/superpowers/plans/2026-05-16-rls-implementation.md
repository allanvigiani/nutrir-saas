# Row Level Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar Row Level Security no PostgreSQL/Neon para que credenciais vazadas ou bugs de código nunca exponham dados de um nutricionista a outro.

**Architecture:** AsyncLocalStorage armazena o transaction client (`tx`) por requisição. `getDb()` retorna `tx` dentro de contexto RLS ou `prisma` global fora. Todos os route handlers autenticados chamam `withNutritionistRLS(uid, fn)` que abre uma `$transaction`, seta `SET LOCAL app.current_nutritionist_id` e executa `fn` com `txStorage.run(tx, fn)`.

**Tech Stack:** Node.js, Prisma ORM, PostgreSQL (Neon), AsyncLocalStorage (Node built-in), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-16-rls-design.md`

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/server/lib/rls-context.ts` | Criar |
| `src/tests/lib/rls-context.test.ts` | Criar |
| `prisma/migrations/20260516_add_rls/migration.sql` | Criar |
| `src/server/services/patients.service.ts` | Modificar — getDb() |
| `src/server/services/consultations.service.ts` | Modificar — getDb() |
| `src/server/services/lab-exams.service.ts` | Modificar — getDb() |
| `src/server/services/meal-plans.service.ts` | Modificar — getDb() |
| `src/server/services/appointments.service.ts` | Modificar — getDb() |
| `src/server/services/nutrition-calculations.service.ts` | Modificar — getDb() |
| `src/server/services/custom-foods.service.ts` | Modificar — getDb() |
| `src/server/services/payments.service.ts` | Modificar — getDb() |
| `src/server/services/nutritionists.service.ts` | Modificar — getDb() |
| `src/server/services/account-export.service.ts` | Modificar — getDb() |
| `src/server/services/retention.service.ts` | Modificar — getDb() |
| `src/server/services/google-calendar.service.ts` | Modificar — getDb() |
| `src/server/services/subscription.service.ts` | Modificar — getDb() |
| `src/server/services/account.service.ts` | Modificar — getDb() |
| `src/server/services/dashboard.service.ts` | Modificar — recebe getDb() via DI |
| `src/server/routes/patients.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/consultations.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/lab-exams.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/meal-plans.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/appointments.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/nutrition-calculations.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/custom-foods.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/payments.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/nutritionists.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/settings.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/account-export.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/account.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/dashboard.routes.ts` | Modificar — withNutritionistRLS + passa getDb() |
| `src/server/routes/subscription.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/google.routes.ts` | Modificar — withNutritionistRLS |
| `src/server/routes/patient-portal.routes.ts` | Modificar — withPortalAuth |
| `src/server/routes/admin.routes.ts` | Modificar — withAdminRLS |
| `src/server/routes/asaas.routes.ts` | Modificar — withAdminRLS no webhook |
| `src/server/routes/auth.routes.ts` | Modificar — withNutritionistRLS |

---

## Task 1: rls-context.ts — AsyncLocalStorage + helpers

**Files:**
- Create: `src/server/lib/rls-context.ts`
- Create: `src/tests/lib/rls-context.test.ts`

- [ ] **Step 1: Escrever o teste**

```typescript
// src/tests/lib/rls-context.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../server/lib/prisma.ts', () => ({
  prisma: {
    $transaction: vi.fn(async (fn: any) => fn({ _isMockTx: true })),
    patient: { findMany: vi.fn() },
  },
}));

import { getDb, withNutritionistRLS, withPatientRLS, withAdminRLS } from '../../server/lib/rls-context.ts';
import { prisma } from '../../server/lib/prisma.ts';

describe('getDb', () => {
  it('retorna prisma global fora de contexto RLS', () => {
    const db = getDb();
    expect(db).toBe(prisma);
  });

  it('retorna tx dentro de withNutritionistRLS', async () => {
    let capturedDb: any;
    await withNutritionistRLS('uid-1', async () => {
      capturedDb = getDb();
    });
    expect(capturedDb).toMatchObject({ _isMockTx: true });
  });

  it('retorna tx dentro de withPatientRLS', async () => {
    let capturedDb: any;
    await withPatientRLS('patient-1', async () => {
      capturedDb = getDb();
    });
    expect(capturedDb).toMatchObject({ _isMockTx: true });
  });

  it('retorna tx dentro de withAdminRLS', async () => {
    let capturedDb: any;
    await withAdminRLS(async () => {
      capturedDb = getDb();
    });
    expect(capturedDb).toMatchObject({ _isMockTx: true });
  });
});
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
cd /home/allan/nutrir-saas && npm run test -- src/tests/lib/rls-context.test.ts
```
Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Criar `src/server/lib/rls-context.ts`**

```typescript
import { AsyncLocalStorage } from 'async_hooks';
import { PrismaClient } from '@prisma/client';
import { prisma } from './prisma.ts';

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

const txStorage = new AsyncLocalStorage<TxClient>();

export function getDb(): PrismaClient | TxClient {
  return txStorage.getStore() ?? prisma;
}

async function applyConfig(tx: any, opts: {
  nutritionistId?: string;
  patientId?: string;
  bypass?: boolean;
}): Promise<void> {
  await tx.$executeRaw`
    SELECT
      set_config('app.current_nutritionist_id', ${opts.nutritionistId ?? ''}, true),
      set_config('app.current_patient_id',      ${opts.patientId ?? ''},      true),
      set_config('app.rls_bypass',              ${opts.bypass ? 'true' : ''}, true)
  `;
}

export async function withNutritionistRLS<T>(
  nutritionistId: string,
  fn: () => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await applyConfig(tx, { nutritionistId });
    return txStorage.run(tx as TxClient, fn);
  });
}

export async function withPatientRLS<T>(
  patientId: string,
  fn: () => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await applyConfig(tx, { patientId });
    return txStorage.run(tx as TxClient, fn);
  });
}

export async function withAdminRLS<T>(fn: () => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await applyConfig(tx, { bypass: true });
    return txStorage.run(tx as TxClient, fn);
  });
}

export async function withPortalAuth<T>(
  patientId: string,
  accessToken: string,
  fn: (patient: any) => Promise<T>
): Promise<T> {
  const patient = await withAdminRLS(() =>
    (getDb() as any).patient.findFirst({
      where: { id: patientId, accessToken },
    })
  );
  if (!patient) throw Object.assign(new Error('Acesso negado'), { status: 401 });
  return withPatientRLS(patient.id, () => fn(patient));
}
```

- [ ] **Step 4: Rodar testes**

```bash
npm run test -- src/tests/lib/rls-context.test.ts
```
Esperado: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/lib/rls-context.ts src/tests/lib/rls-context.test.ts
git commit -m "feat: add RLS context helpers with AsyncLocalStorage"
```

---

## Task 2: Migration SQL — RLS policies

**Files:**
- Create: `prisma/migrations/20260516_add_rls/migration.sql`

> **Nota:** Esta migration é aplicada DEPOIS de todas as mudanças de código (Task 3–6). Aplicar antes quebraria o app.

- [ ] **Step 1: Criar a pasta e o arquivo SQL**

```bash
mkdir -p /home/allan/nutrir-saas/prisma/migrations/20260516_add_rls
```

- [ ] **Step 2: Criar `prisma/migrations/20260516_add_rls/migration.sql`**

```sql
-- ============================================================
-- ROW LEVEL SECURITY — Nutrir SaaS
-- Aplicar APÓS as mudanças de código (getDb + withRLS helpers)
-- ============================================================

-- PATIENTS
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

-- CONSULTATIONS
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations FORCE ROW LEVEL SECURITY;

CREATE POLICY consultations_nutritionist ON consultations FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY consultations_patient ON consultations FOR SELECT
  USING ("patientId" = current_setting('app.current_patient_id', true));

CREATE POLICY consultations_admin ON consultations FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- LAB_EXAMS (sem nutritionistId direto — JOIN via patients)
ALTER TABLE lab_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_exams FORCE ROW LEVEL SECURITY;

CREATE POLICY lab_exams_nutritionist ON lab_exams FOR ALL
  USING (EXISTS (
    SELECT 1 FROM patients p
    WHERE p.id = lab_exams."patientId"
    AND p."nutritionistId" = current_setting('app.current_nutritionist_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM patients p
    WHERE p.id = lab_exams."patientId"
    AND p."nutritionistId" = current_setting('app.current_nutritionist_id', true)
  ));

CREATE POLICY lab_exams_patient ON lab_exams FOR SELECT
  USING ("patientId" = current_setting('app.current_patient_id', true));

CREATE POLICY lab_exams_admin ON lab_exams FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- MEAL_PLANS
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans FORCE ROW LEVEL SECURITY;

CREATE POLICY meal_plans_nutritionist ON meal_plans FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY meal_plans_patient ON meal_plans FOR SELECT
  USING ("patientId" = current_setting('app.current_patient_id', true));

CREATE POLICY meal_plans_admin ON meal_plans FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- MEAL_PLAN_ITEMS (sem nutritionistId/patientId — JOIN via meal_plans)
ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_items FORCE ROW LEVEL SECURITY;

CREATE POLICY meal_plan_items_nutritionist ON meal_plan_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM meal_plans mp
    WHERE mp.id = meal_plan_items."mealPlanId"
    AND mp."nutritionistId" = current_setting('app.current_nutritionist_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meal_plans mp
    WHERE mp.id = meal_plan_items."mealPlanId"
    AND mp."nutritionistId" = current_setting('app.current_nutritionist_id', true)
  ));

CREATE POLICY meal_plan_items_patient ON meal_plan_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM meal_plans mp
    WHERE mp.id = meal_plan_items."mealPlanId"
    AND mp."patientId" = current_setting('app.current_patient_id', true)
  ));

CREATE POLICY meal_plan_items_admin ON meal_plan_items FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- APPOINTMENTS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;

CREATE POLICY appointments_nutritionist ON appointments FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY appointments_patient ON appointments FOR SELECT
  USING ("patientId" = current_setting('app.current_patient_id', true));

CREATE POLICY appointments_admin ON appointments FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- NUTRITION_CALCULATIONS
ALTER TABLE nutrition_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_calculations FORCE ROW LEVEL SECURITY;

CREATE POLICY nutrition_calculations_nutritionist ON nutrition_calculations FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY nutrition_calculations_patient ON nutrition_calculations FOR SELECT
  USING ("patientId" = current_setting('app.current_patient_id', true));

CREATE POLICY nutrition_calculations_admin ON nutrition_calculations FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- CUSTOM_FOODS
ALTER TABLE custom_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_foods FORCE ROW LEVEL SECURITY;

CREATE POLICY custom_foods_nutritionist ON custom_foods FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY custom_foods_admin ON custom_foods FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- PAYMENTS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

CREATE POLICY payments_nutritionist ON payments FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY payments_admin ON payments FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- SUBSCRIPTIONS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_nutritionist ON subscriptions FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY subscriptions_admin ON subscriptions FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- NUTRITIONISTS
ALTER TABLE nutritionists ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutritionists FORCE ROW LEVEL SECURITY;

CREATE POLICY nutritionists_self ON nutritionists FOR ALL
  USING (id = current_setting('app.current_nutritionist_id', true))
  WITH CHECK (id = current_setting('app.current_nutritionist_id', true));

CREATE POLICY nutritionists_admin ON nutritionists FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');
```

- [ ] **Step 3: Commit (não aplicar ainda)**

```bash
git add prisma/migrations/20260516_add_rls/migration.sql
git commit -m "feat: add RLS migration SQL (apply after code changes)"
```

---

## Task 3: Atualizar services — trocar `prisma.X` por `getDb().X`

**Files:**
- Modify: todos os services listados abaixo

> Padrão: substituir `import { prisma } from '../lib/prisma.ts'` por `import { getDb } from '../lib/rls-context.ts'` e trocar `prisma.X` por `getDb().X` em cada chamada. Para `dashboard.service.ts` (usa DI), atualizar o route para passar `getDb()`.

- [ ] **Step 1: Atualizar `src/server/services/patients.service.ts`**

```typescript
import { getDb } from '../lib/rls-context.ts';

export function createPatientsService() {
  async function list(nutritionistId: string) {
    return getDb().patient.findMany({
      where: { nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function getOne(nutritionistId: string, id: string) {
    const patient = await getDb().patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!patient) throw new Error('Paciente não encontrado');
    return patient;
  }

  async function create(nutritionistId: string, data: Record<string, unknown>) {
    return getDb().patient.create({ data: { ...(data as any), nutritionistId } });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await getDb().patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().patient.update({ where: { id }, data: data as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().patient.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, getOne, create, update, remove };
}
```

> **Nota:** A assinatura do factory `createPatientsService()` perdeu o parâmetro `{ prisma }` — o service agora usa `getDb()` diretamente. Atualizar o ponto de instanciação no route se necessário.

- [ ] **Step 2: Aplicar o mesmo padrão nos demais services**

Para cada service abaixo, leia o arquivo atual e substitua `prisma.X` por `getDb().X`, adicionando o import de `getDb`:

- `src/server/services/consultations.service.ts`
- `src/server/services/lab-exams.service.ts`
- `src/server/services/meal-plans.service.ts`
- `src/server/services/appointments.service.ts`
- `src/server/services/nutrition-calculations.service.ts`
- `src/server/services/custom-foods.service.ts`
- `src/server/services/payments.service.ts`
- `src/server/services/nutritionists.service.ts`
- `src/server/services/account-export.service.ts`
- `src/server/services/retention.service.ts`
- `src/server/services/google-calendar.service.ts`
- `src/server/services/subscription.service.ts`
- `src/server/services/account.service.ts`

Para cada arquivo: leia, identifique todas as ocorrências de `prisma.` e substitua por `getDb().`. Remova o import de `prisma` e adicione o import de `getDb`.

Exemplo para `consultations.service.ts`:
```typescript
// ANTES
import { prisma } from '../lib/prisma.ts';
return prisma.consultation.findMany({ ... });

// DEPOIS  
import { getDb } from '../lib/rls-context.ts';
return getDb().consultation.findMany({ ... });
```

- [ ] **Step 3: Atualizar `src/server/services/asaas.service.ts`**

O service Asaas processa webhooks sem contexto de nutricionista. Substituir `prisma.X` por `getDb().X` mas o route handler precisa usar `withAdminRLS` (Task 6). O service em si só precisa do `getDb()`.

- [ ] **Step 4: Checar TypeScript**

```bash
cd /home/allan/nutrir-saas && npm run lint
```
Esperado: zero erros.

- [ ] **Step 5: Rodar testes**

```bash
npm run test
```
Esperado: todos os testes existentes passam.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/
git commit -m "feat: replace prisma direct imports with getDb() in all services for RLS"
```

---

## Task 4: Atualizar `dashboard.service.ts` — padrão DI

**Files:**
- Modify: `src/server/services/dashboard.service.ts`
- Modify: `src/server/routes/dashboard.routes.ts`

O `dashboard.service.ts` usa dependency injection (`{ prisma }: Deps`). Não usa `prisma` direto — o route passa o client. Vamos mudar para aceitar `db` genérico que pode ser `prisma` ou `tx`.

- [ ] **Step 1: Atualizar `src/server/services/dashboard.service.ts`**

```typescript
// Trocar a type de Deps para aceitar getDb() (que pode ser tx ou prisma)
type Deps = { db: any };

export function createDashboardService({ db }: Deps) {
  async function getStats(nutritionistId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [
      activePatients,
      recentPatients,
      todayAppointments,
      monthConsultations,
      monthPayments,
      activeMealPlans,
    ] = await Promise.all([
      db.patient.count({ where: { nutritionistId, status: 'active', deletedAt: null } }),
      db.patient.findMany({
        where: { nutritionistId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, createdAt: true, status: true },
      }),
      db.appointment.findMany({
        where: { nutritionistId, date: { gte: startOfDay, lte: endOfDay } },
        include: { patient: { select: { name: true } } },
        orderBy: { date: 'asc' },
      }),
      db.consultation.findMany({
        where: { nutritionistId, createdAt: { gte: startOfMonth } },
        select: { id: true, createdAt: true },
      }),
      db.payment.findMany({
        where: { nutritionistId, status: 'paid', date: { gte: startOfMonth } },
        select: { amount: true },
      }),
      db.mealPlan.count({ where: { nutritionistId, status: 'active' } }),
    ]);

    const monthRevenue = monthPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

    return {
      activePatients,
      recentPatients,
      todayAppointments,
      monthConsultations: monthConsultations.length,
      consultationDates: monthConsultations.map((c: any) => c.createdAt),
      monthRevenue,
      activeMealPlans,
    };
  }

  return { getStats };
}
```

- [ ] **Step 2: Atualizar `src/server/routes/dashboard.routes.ts`**

Leia o arquivo atual. O route deve passar `getDb()` como `db` e envolver em `withNutritionistRLS`:

```typescript
import { getDb, withNutritionistRLS } from '../lib/rls-context.ts';
import { createDashboardService } from '../services/dashboard.service.ts';

// Dentro do handler:
deps.app.get('/api/dashboard', deps.authenticate, async (req: any, res: any) => {
  try {
    await withNutritionistRLS(req.user.uid, async () => {
      const service = createDashboardService({ db: getDb() });
      const stats = await service.getStats(req.user.uid);
      res.json(stats);
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 3: Checar TypeScript**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/server/services/dashboard.service.ts src/server/routes/dashboard.routes.ts
git commit -m "feat: update dashboard service to use db param (RLS compatible)"
```

---

## Task 5: Atualizar routes autenticadas — withNutritionistRLS

**Files:**
- Modify: `patients.routes.ts`, `consultations.routes.ts`, `lab-exams.routes.ts`, `meal-plans.routes.ts`, `appointments.routes.ts`, `nutrition-calculations.routes.ts`, `custom-foods.routes.ts`, `payments.routes.ts`, `nutritionists.routes.ts`, `settings.routes.ts`, `account-export.routes.ts`, `account.routes.ts`, `subscription.routes.ts`, `google.routes.ts`, `auth.routes.ts`

Para cada route handler que usa `deps.authenticate`, leia o arquivo e envolva o corpo do handler em `withNutritionistRLS(req.user.uid, async () => { ... })`.

- [ ] **Step 1: Adicionar import em cada route file**

```typescript
import { withNutritionistRLS } from '../lib/rls-context.ts';
```

- [ ] **Step 2: Padrão de wrap para cada handler**

```typescript
// ANTES:
deps.app.get('/api/patients', deps.authenticate, async (req: any, res: any) => {
  try {
    const patients = await service.list(req.user.uid);
    return res.json(patients);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DEPOIS:
deps.app.get('/api/patients', deps.authenticate, async (req: any, res: any) => {
  try {
    await withNutritionistRLS(req.user.uid, async () => {
      const patients = await service.list(req.user.uid);
      res.json(patients);
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

> **Importante:** O `return res.json(...)` dentro do `withNutritionistRLS` vira `res.json(...)` sem `return` (pois o `return` estaria retornando para o callback, não para o handler Express). O `return res.status(500)` no catch do handler externo permanece.

- [ ] **Step 3: Aplicar em todos os route files listados**

Leia cada arquivo, identifique todos os handlers com `deps.authenticate` e aplique o wrap. Se um handler não faz queries ao banco (ex: alguns endpoints de configuração), pode ser deixado sem wrap — mas na dúvida, envolva.

- [ ] **Step 4: Checar TypeScript**

```bash
npm run lint
```
Esperado: zero erros.

- [ ] **Step 5: Rodar testes**

```bash
npm run test
```

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/
git commit -m "feat: wrap all authenticated route handlers in withNutritionistRLS"
```

---

## Task 6: Atualizar rotas especiais — portal, admin, asaas

**Files:**
- Modify: `src/server/routes/patient-portal.routes.ts`
- Modify: `src/server/routes/admin.routes.ts`
- Modify: `src/server/routes/asaas.routes.ts`

- [ ] **Step 1: Atualizar `patient-portal.routes.ts`**

Leia o arquivo atual. Substitua a lógica de `prisma.patient.findFirst({ where: { id, accessToken } })` pelo `withPortalAuth`.

Para cada rota do portal que valida `accessToken` e depois faz queries:

```typescript
import { withPortalAuth, withPatientRLS, getDb } from '../lib/rls-context.ts';

// GET /api/portal/patients/:id
deps.app.get('/api/portal/patients/:id', async (req: any, res: any) => {
  const { id } = req.params;
  const { token } = req.query;
  if (!token) return res.status(401).json({ error: 'Token obrigatório' });
  try {
    await withPortalAuth(id, token as string, async (patient) => {
      const nutritionist = await getDb().nutritionist.findUnique({
        where: { id: patient.nutritionistId },
        select: { id: true, name: true, crn: true, email: true, photoUrl: true, phone: true },
      });
      res.json({ patient, nutritionist });
    });
  } catch (err: any) {
    if (err.status === 401) return res.status(401).json({ error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/patients/:id/verify-cpf
deps.app.post('/api/portal/patients/:id/verify-cpf', async (req: any, res: any) => {
  const { id } = req.params;
  const { token, cpfSuffix } = req.body;
  if (!token || !cpfSuffix) return res.status(400).json({ error: 'Token e sufixo obrigatórios' });
  try {
    await withPortalAuth(id, token, async (patient) => {
      const cleanCpf = patient.cpf.replace(/\D/g, '');
      if (cpfSuffix !== cleanCpf.slice(-3)) {
        return res.status(401).json({ error: 'Os 3 últimos dígitos do CPF não conferem.' });
      }
      res.json({ valid: true });
    });
  } catch (err: any) {
    if (err.status === 401) return res.status(401).json({ error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Para demais rotas do portal (/consultations, /meal-plans, /lab-exams, etc.):
// Substituir a validação manual de accessToken por withPortalAuth
deps.app.get('/api/portal/patients/:id/consultations', async (req: any, res: any) => {
  const { id } = req.params;
  const { token } = req.query;
  if (!token) return res.status(401).json({ error: 'Token obrigatório' });
  try {
    await withPortalAuth(id, token as string, async () => {
      const consultations = await getDb().consultation.findMany({
        where: { patientId: id },
        orderBy: { date: 'desc' },
      });
      res.json(consultations);
    });
  } catch (err: any) {
    if (err.status === 401) return res.status(401).json({ error: err.message });
    return res.status(500).json({ error: err.message });
  }
});
```

Aplicar o mesmo padrão para `/meal-plans`, `/lab-exams` e `/meal-plans/:planId/items`.

- [ ] **Step 2: Atualizar `admin.routes.ts`**

```typescript
import { withAdminRLS, getDb } from '../lib/rls-context.ts';

// Substituir queries diretas por getDb() e envolver em withAdminRLS:
deps.app.get('/api/admin/nutritionists', deps.authenticate, async (req: any, res: any) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    await withAdminRLS(async () => {
      const data = await getDb().nutritionist.findMany({ orderBy: { createdAt: 'desc' } });
      res.json(data);
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Mesmo padrão para os outros endpoints admin (count, patch, retention-cleanup)
```

- [ ] **Step 3: Atualizar `asaas.routes.ts` — webhook usa withAdminRLS**

Leia o arquivo. O webhook do Asaas chega sem autenticação de nutricionista. O controller precisa usar `withAdminRLS`. Localize onde o `asaasService.handleWebhookEvent` é chamado e envolva:

```typescript
import { withAdminRLS } from '../lib/rls-context.ts';

// No controller do webhook (asaas.controller.ts ou direto no route):
// Envolva a chamada ao service em withAdminRLS
await withAdminRLS(async () => {
  const result = await asaasService.handleWebhookEvent(body);
  res.json(result);
});
```

> Se o controller do Asaas está em `asaas.controller.ts`, leia-o e adicione o import + wrap lá.

- [ ] **Step 4: Checar TypeScript**

```bash
npm run lint
```

- [ ] **Step 5: Rodar testes**

```bash
npm run test
```

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/patient-portal.routes.ts src/server/routes/admin.routes.ts src/server/routes/asaas.routes.ts src/server/controllers/
git commit -m "feat: apply withPortalAuth, withAdminRLS to portal, admin and webhook routes"
```

---

## Task 7: Aplicar a migration no banco

> **Pré-requisito:** Tasks 1–6 completas e testes passando. Fazer backup no Neon Console antes.

- [ ] **Step 1: Verificar que todos os testes passam**

```bash
npm run test
```
Esperado: todos PASS.

- [ ] **Step 2: Verificar lint**

```bash
npm run lint
```
Esperado: zero erros.

- [ ] **Step 3: Aplicar a migration**

```bash
cd /home/allan/nutrir-saas && npx prisma migrate deploy
```
Esperado: `All migrations have been successfully applied.`

- [ ] **Step 4: Verificar RLS no Neon Console**

No SQL Editor do Neon, executar sem setar `set_config`:
```sql
SELECT * FROM patients LIMIT 5;
```
Esperado: **zero linhas** (RLS bloqueando — nenhum contexto setado).

- [ ] **Step 5: Verificar que app funciona**

```bash
npm run dev
```
- Login como nutricionista → listar pacientes → dados visíveis (contexto setado via `withNutritionistRLS`)
- Portal do paciente → dados do próprio paciente visíveis
- Admin → todos os dados visíveis via `withAdminRLS`

- [ ] **Step 6: Commit final**

```bash
git add .
git commit -m "feat: enable RLS on all sensitive tables — zero data visible without context"
```
