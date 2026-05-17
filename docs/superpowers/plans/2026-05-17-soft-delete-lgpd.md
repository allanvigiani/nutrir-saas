# Soft Delete LGPD — Todas as Entidades

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir hard delete por soft delete em todas as entidades do sistema, preservando dados para auditoria LGPD.

**Architecture:** Adicionar `deletedAt DateTime?` a 7 modelos Prisma via uma única migration (`patients` já tem a coluna no banco). Cada `remove()` passa a fazer `update({ data: { deletedAt: new Date() } })`. Todas as queries de listagem e contagem filtram `deletedAt: null`. `meal_plan_items` usa hard delete intencional (DELETE direto). O `replaceItems` de meal-plans e o `removeItem` mantêm hard delete. A exclusão total de conta via `DELETE /api/account` continua sendo hard delete intencional.

**Tech Stack:** Prisma ORM, PostgreSQL, Vitest (testes com vi.mock)

---

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | Adicionar `deletedAt DateTime?` a 7 modelos (patients já tem) |
| `prisma/migrations/<timestamp>_soft_delete_lgpd/migration.sql` | Gerado automaticamente |
| `src/server/services/consultations.service.ts` | Soft delete + filtros |
| `src/server/services/lab-exams.service.ts` | Soft delete + filtros |
| `src/server/services/meal-plans.service.ts` | Soft delete + filtros (meal_plan_items mantém hard delete) |
| `src/server/services/appointments.service.ts` | Soft delete + filtros |
| `src/server/services/payments.service.ts` | Soft delete + filtros |
| `src/server/services/nutrition-calculations.service.ts` | Soft delete + filtros |
| `src/server/services/custom-foods.service.ts` | Soft delete + filtros |
| `src/tests/services/consultations.service.test.ts` | Criar |
| `src/tests/services/lab-exams.service.test.ts` | Criar |
| `src/tests/services/meal-plans.service.test.ts` | Criar |
| `src/tests/services/appointments.service.test.ts` | Criar |
| `src/tests/services/payments.service.test.ts` | Criar |
| `src/tests/services/nutrition-calculations.service.test.ts` | Criar |
| `src/tests/services/custom-foods.service.test.ts` | Criar |

**Estado atual do banco (verificado em 2026-05-17):**
| Tabela | `deletedAt` no banco |
|--------|---------------------|
| patients | ✅ já existe |
| consultations | ❌ precisa adicionar |
| meal_plans | ❌ precisa adicionar |
| lab_exams | ❌ precisa adicionar |
| appointments | ❌ precisa adicionar |
| payments | ❌ precisa adicionar |
| nutrition_calculations | ❌ precisa adicionar |
| custom_foods | ❌ precisa adicionar |
| meal_plan_items | 🚫 hard delete intencional (sem `deletedAt`) |

---

## Task 1: Migration do Schema Prisma

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar `deletedAt` aos 7 modelos no schema**

`patients` já tem a coluna no banco — não alterar. `meal_plan_items` usa hard delete intencional — não adicionar.

Em `prisma/schema.prisma`, adicionar `deletedAt DateTime?` logo antes do `@@map` de cada model:

```prisma
model Consultation {
  // ... campos existentes ...
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?   // <-- adicionar

  calculations NutritionCalculation[]

  @@map("consultations")
}

model MealPlan {
  // ... campos existentes ...
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  deletedAt           DateTime?   // <-- adicionar

  items MealPlanItem[]

  @@map("meal_plans")
}

// MealPlanItem — NÃO adicionar deletedAt (hard delete intencional)

model LabExam {
  // ... campos existentes ...
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?   // <-- adicionar

  @@map("lab_exams")
}

model Appointment {
  // ... campos existentes ...
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  deletedAt      DateTime?    // <-- adicionar

  @@map("appointments")
}

model Payment {
  // ... campos existentes ...
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?   // <-- adicionar

  @@map("payments")
}

model NutritionCalculation {
  // ... campos existentes ...
  createdAt      DateTime      @default(now())
  deletedAt      DateTime?     // <-- adicionar

  @@map("nutrition_calculations")
}

model CustomFood {
  // ... campos existentes ...
  serving        Json?
  deletedAt      DateTime?   // <-- adicionar

  @@map("custom_foods")
}
```

- [ ] **Step 2: Gerar migration**

```bash
npx prisma migrate dev --name soft_delete_lgpd
```

Expected: migration SQL gerado em `prisma/migrations/<timestamp>_soft_delete_lgpd/migration.sql` com ALTER TABLE adicionando coluna `deleted_at` nullable em 8 tabelas.

- [ ] **Step 3: Verificar migration SQL gerada**

O arquivo SQL deve conter algo como:
```sql
ALTER TABLE "consultations" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "meal_plans" ADD COLUMN "deletedAt" TIMESTAMP(3);
-- ... etc para as 8 tabelas
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add deletedAt to 8 models for LGPD soft delete"
```

---

## Task 2: consultations.service.ts

**Files:**
- Modify: `src/server/services/consultations.service.ts`
- Create: `src/tests/services/consultations.service.test.ts`

- [ ] **Step 1: Escrever testes falhando**

Criar `src/tests/services/consultations.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockFindFirst, mockUpdate, mockCreate, mockDelete, mockCount } = vi.hoisted(() => ({
  mockFindMany:  vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate:    vi.fn(),
  mockCreate:    vi.fn(),
  mockDelete:    vi.fn(),
  mockCount:     vi.fn(),
}));

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({
    consultation: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      update:    mockUpdate,
      create:    mockCreate,
      delete:    mockDelete,
      count:     mockCount,
    },
  }),
}));

vi.mock('../../lib/planLimits.ts', () => ({
  FREE_PLAN_LIMITS: { maxConsultationsPerMonth: 4, maxConsultationsPerPatientPerMonth: 1 },
}));

import { createConsultationsService } from '../../server/services/consultations.service.ts';

const service = createConsultationsService();

describe('consultations.service — soft delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() filtra consultas com deletedAt preenchido', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('nutri-1', 'pac-1');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('remove() faz soft delete em vez de deletar', async () => {
    mockFindFirst.mockResolvedValue({ id: 'c-1', nutritionistId: 'nutri-1', deletedAt: null });
    mockUpdate.mockResolvedValue({});
    await service.remove('nutri-1', 'c-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('remove() lança erro se consulta não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('nutri-1', 'c-outro')).rejects.toThrow('Não autorizado');
  });

  it('count de plano free exclui consultas soft-deleted', async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: 'c-new' });
    await service.create('nutri-1', 'pac-1', { date: '2026-05-17', status: 'realizada' }, false);
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npx vitest run src/tests/services/consultations.service.test.ts
```

Expected: FAIL (service ainda usa hard delete)

- [ ] **Step 3: Atualizar `consultations.service.ts`**

```typescript
import { getDb } from '../lib/rls-context.ts';
import { FREE_PLAN_LIMITS } from '../../lib/planLimits.ts';

export function createConsultationsService() {
  async function list(nutritionistId: string, patientId: string) {
    return getDb().consultation.findMany({
      where: { patientId, nutritionistId, deletedAt: null },
      orderBy: { date: 'desc' },
    });
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>, isPremium: boolean) {
    if (!isPremium) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      const [totalThisMonth, patientThisMonth] = await Promise.all([
        getDb().consultation.count({
          where: { nutritionistId, deletedAt: null, date: { gte: startOfMonth, lte: endOfMonth } },
        }),
        getDb().consultation.count({
          where: { nutritionistId, patientId, deletedAt: null, date: { gte: startOfMonth, lte: endOfMonth } },
        }),
      ]);

      if (totalThisMonth >= FREE_PLAN_LIMITS.maxConsultationsPerMonth) {
        throw new Error(`Limite de ${FREE_PLAN_LIMITS.maxConsultationsPerMonth} consultas mensais atingido no plano gratuito.`);
      }
      if (patientThisMonth >= FREE_PLAN_LIMITS.maxConsultationsPerPatientPerMonth) {
        throw new Error(`Limite de ${FREE_PLAN_LIMITS.maxConsultationsPerPatientPerMonth} consulta por paciente por mês atingido no plano gratuito.`);
      }
    }
    return getDb().consultation.create({
      data: { ...(data as any), patientId, nutritionistId },
    });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await getDb().consultation.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().consultation.update({ where: { id }, data: data as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().consultation.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().consultation.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, create, update, remove };
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npx vitest run src/tests/services/consultations.service.test.ts
```

Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add src/server/services/consultations.service.ts src/tests/services/consultations.service.test.ts
git commit -m "feat: soft delete em consultations (LGPD)"
```

---

## Task 3: lab-exams.service.ts

**Files:**
- Modify: `src/server/services/lab-exams.service.ts`
- Create: `src/tests/services/lab-exams.service.test.ts`

- [ ] **Step 1: Escrever testes falhando**

Criar `src/tests/services/lab-exams.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockFindFirst, mockUpdate, mockCreate, mockDelete, mockCount } = vi.hoisted(() => ({
  mockFindMany:  vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate:    vi.fn(),
  mockCreate:    vi.fn(),
  mockDelete:    vi.fn(),
  mockCount:     vi.fn(),
}));

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({
    labExam: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      update:    mockUpdate,
      create:    mockCreate,
      delete:    mockDelete,
      count:     mockCount,
    },
  }),
}));

vi.mock('../../lib/planLimits.ts', () => ({
  FREE_PLAN_LIMITS: { maxExams: 2 },
}));

import { createLabExamsService } from '../../server/services/lab-exams.service.ts';

const service = createLabExamsService();

describe('lab-exams.service — soft delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() filtra exames com deletedAt preenchido', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('nutri-1', 'pac-1');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('remove() faz soft delete em vez de deletar', async () => {
    mockFindFirst.mockResolvedValue({ id: 'e-1', nutritionistId: 'nutri-1', deletedAt: null });
    mockUpdate.mockResolvedValue({});
    await service.remove('nutri-1', 'e-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('remove() lança erro se exame não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('nutri-1', 'e-outro')).rejects.toThrow('Não autorizado');
  });

  it('count de plano free exclui exames soft-deleted', async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: 'e-new' });
    await service.create('nutri-1', 'pac-1', { date: '2026-05-17', title: 'Hemograma', markers: [] }, false);
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npx vitest run src/tests/services/lab-exams.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Atualizar `lab-exams.service.ts`**

```typescript
import { getDb } from '../lib/rls-context.ts';
import { FREE_PLAN_LIMITS } from '../../lib/planLimits.ts';

export function createLabExamsService() {
  async function list(nutritionistId: string, patientId: string) {
    return getDb().labExam.findMany({
      where: { patientId, nutritionistId, deletedAt: null },
      orderBy: { date: 'desc' },
    });
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>, isPremium: boolean) {
    if (!isPremium) {
      const examCount = await getDb().labExam.count({ where: { patientId, nutritionistId, deletedAt: null } });
      if (examCount >= FREE_PLAN_LIMITS.maxExams) {
        throw new Error(`Limite de ${FREE_PLAN_LIMITS.maxExams} exame por paciente atingido no plano gratuito.`);
      }
    }
    return getDb().labExam.create({
      data: { ...(data as any), patientId, nutritionistId },
    });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await getDb().labExam.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().labExam.update({ where: { id }, data: data as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().labExam.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().labExam.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, create, update, remove };
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npx vitest run src/tests/services/lab-exams.service.test.ts
```

Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add src/server/services/lab-exams.service.ts src/tests/services/lab-exams.service.test.ts
git commit -m "feat: soft delete em lab-exams (LGPD)"
```

---

## Task 4: meal-plans.service.ts

**Files:**
- Modify: `src/server/services/meal-plans.service.ts`
- Create: `src/tests/services/meal-plans.service.test.ts`

> **Nota:** `meal_plan_items` usa hard delete intencional — sem `deletedAt` na tabela. `replaceItems` e `removeItem` continuam com `.delete()` / `.deleteMany()`. Apenas `MealPlan` (o plano em si) ganha soft delete.

- [ ] **Step 1: Escrever testes falhando**

Criar `src/tests/services/meal-plans.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mealPlan = { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() };
const mealPlanItem = { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() };

vi.hoisted(() => {});

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({ mealPlan, mealPlanItem }),
}));

vi.mock('../../server/lib/prisma.ts', () => ({
  prisma: {
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
    mealPlanItem: { deleteMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('../../lib/planLimits.ts', () => ({
  FREE_PLAN_LIMITS: { maxMealPlans: 1 },
}));

import { createMealPlansService } from '../../server/services/meal-plans.service.ts';

const service = createMealPlansService();

describe('meal-plans.service — soft delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list() filtra planos com deletedAt preenchido', async () => {
    mealPlan.findMany.mockResolvedValue([]);
    await service.list('nutri-1', 'pac-1');
    expect(mealPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('getOne() filtra planos com deletedAt preenchido', async () => {
    mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1', deletedAt: null, items: [] });
    await service.getOne('nutri-1', 'mp-1');
    expect(mealPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('remove() faz soft delete do plano em vez de deletar', async () => {
    mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1', deletedAt: null });
    mealPlan.update.mockResolvedValue({});
    await service.remove('nutri-1', 'mp-1');
    expect(mealPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mealPlan.delete).not.toHaveBeenCalled();
  });

  it('count de plano free exclui planos soft-deleted', async () => {
    mealPlan.count.mockResolvedValue(0);
    mealPlan.create.mockResolvedValue({ id: 'mp-new' });
    await service.create('nutri-1', 'pac-1', { name: 'Plano A', status: 'active' }, false);
    expect(mealPlan.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npx vitest run src/tests/services/meal-plans.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Atualizar `meal-plans.service.ts`**

```typescript
import { getDb } from '../lib/rls-context.ts';
import { prisma } from '../lib/prisma.ts';
import { FREE_PLAN_LIMITS } from '../../lib/planLimits.ts';

export function createMealPlansService() {
  async function list(nutritionistId: string, patientId: string) {
    return getDb().mealPlan.findMany({
      where: { patientId, nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function getOne(nutritionistId: string, id: string) {
    const plan = await getDb().mealPlan.findFirst({
      where: { id, nutritionistId, deletedAt: null },
      include: { items: true },
    });
    if (!plan) throw new Error('Plano não encontrado');
    return plan;
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>, isPremium: boolean) {
    if (!isPremium) {
      const activeCount = await getDb().mealPlan.count({
        where: { patientId, nutritionistId, status: 'active', deletedAt: null },
      });
      if (activeCount >= FREE_PLAN_LIMITS.maxMealPlans) {
        throw new Error(`Limite de ${FREE_PLAN_LIMITS.maxMealPlans} plano alimentar ativo por paciente atingido no plano gratuito.`);
      }
    }
    return getDb().mealPlan.create({
      data: { ...(data as any), patientId, nutritionistId },
    });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await getDb().mealPlan.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    const { items, ...planData } = data as any;
    return getDb().mealPlan.update({ where: { id }, data: planData });
  }

  // Substituição atômica de itens (operação interna de update, não exclusão de usuário)
  async function replaceItems(nutritionistId: string, id: string, items: Record<string, unknown>[]) {
    const existing = await getDb().mealPlan.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.$transaction([
      prisma.mealPlanItem.deleteMany({ where: { mealPlanId: id } }),
      ...items.map(item =>
        prisma.mealPlanItem.create({
          data: { ...(item as any), mealPlanId: id, nutritionistId },
        })
      ),
    ]);
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().mealPlan.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().mealPlan.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // Items
  // Items — meal_plan_items usa hard delete intencional (sem deletedAt na tabela)
  async function listItems(nutritionistId: string, mealPlanId: string) {
    const plan = await getDb().mealPlan.findFirst({ where: { id: mealPlanId, nutritionistId, deletedAt: null } });
    if (!plan) throw new Error('Não autorizado');
    return getDb().mealPlanItem.findMany({ where: { mealPlanId } });
  }

  async function createItem(nutritionistId: string, mealPlanId: string, data: Record<string, unknown>) {
    const plan = await getDb().mealPlan.findFirst({ where: { id: mealPlanId, nutritionistId, deletedAt: null } });
    if (!plan) throw new Error('Não autorizado');
    return getDb().mealPlanItem.create({ data: { ...(data as any), mealPlanId, nutritionistId } });
  }

  async function updateItem(nutritionistId: string, itemId: string, data: Record<string, unknown>) {
    const existing = await getDb().mealPlanItem.findFirst({ where: { id: itemId, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().mealPlanItem.update({ where: { id: itemId }, data: data as any });
  }

  async function removeItem(nutritionistId: string, itemId: string) {
    const existing = await getDb().mealPlanItem.findFirst({ where: { id: itemId, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().mealPlanItem.delete({ where: { id: itemId } });
  }

  return { list, getOne, create, update, remove, listItems, createItem, updateItem, removeItem, replaceItems };
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npx vitest run src/tests/services/meal-plans.service.test.ts
```

Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add src/server/services/meal-plans.service.ts src/tests/services/meal-plans.service.test.ts
git commit -m "feat: soft delete em meal-plans e meal-plan-items (LGPD)"
```

---

## Task 5: appointments.service.ts

**Files:**
- Modify: `src/server/services/appointments.service.ts`
- Create: `src/tests/services/appointments.service.test.ts`

- [ ] **Step 1: Escrever testes falhando**

Criar `src/tests/services/appointments.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockFindFirst, mockUpdate, mockCreate, mockDelete } = vi.hoisted(() => ({
  mockFindMany:  vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate:    vi.fn(),
  mockCreate:    vi.fn(),
  mockDelete:    vi.fn(),
}));

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({
    appointment: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      update:    mockUpdate,
      create:    mockCreate,
      delete:    mockDelete,
    },
  }),
}));

import { createAppointmentsService } from '../../server/services/appointments.service.ts';

const service = createAppointmentsService();

describe('appointments.service — soft delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() filtra agendamentos com deletedAt preenchido', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('nutri-1');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('remove() faz soft delete em vez de deletar', async () => {
    mockFindFirst.mockResolvedValue({ id: 'ap-1', nutritionistId: 'nutri-1', deletedAt: null });
    mockUpdate.mockResolvedValue({});
    await service.remove('nutri-1', 'ap-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('remove() lança erro se agendamento não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('nutri-1', 'ap-outro')).rejects.toThrow('Não autorizado');
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npx vitest run src/tests/services/appointments.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Atualizar `appointments.service.ts`**

```typescript
import { getDb } from '../lib/rls-context.ts';

type CreateAppointmentInput = {
  patientId: string;
  date: Date;
  status: string;
  googleEventId?: string;
  meetLink?: string;
};

export function createAppointmentsService() {
  async function list(nutritionistId: string) {
    return getDb().appointment.findMany({
      where: { nutritionistId, deletedAt: null },
      orderBy: { date: 'asc' },
      include: { patient: { select: { name: true } } },
    });
  }

  async function create(nutritionistId: string, data: CreateAppointmentInput) {
    return getDb().appointment.create({ data: { ...data, nutritionistId } });
  }

  async function update(nutritionistId: string, id: string, data: Partial<CreateAppointmentInput>) {
    const existing = await getDb().appointment.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().appointment.update({ where: { id }, data });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().appointment.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().appointment.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, create, update, remove };
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npx vitest run src/tests/services/appointments.service.test.ts
```

Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/server/services/appointments.service.ts src/tests/services/appointments.service.test.ts
git commit -m "feat: soft delete em appointments (LGPD)"
```

---

## Task 6: payments.service.ts

**Files:**
- Modify: `src/server/services/payments.service.ts`
- Create: `src/tests/services/payments.service.test.ts`

- [ ] **Step 1: Escrever testes falhando**

Criar `src/tests/services/payments.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockFindFirst, mockUpdate, mockCreate, mockDelete } = vi.hoisted(() => ({
  mockFindMany:  vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate:    vi.fn(),
  mockCreate:    vi.fn(),
  mockDelete:    vi.fn(),
}));

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({
    payment: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      update:    mockUpdate,
      create:    mockCreate,
      delete:    mockDelete,
    },
  }),
}));

import { createPaymentsService } from '../../server/services/payments.service.ts';

const service = createPaymentsService();

describe('payments.service — soft delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() filtra pagamentos com deletedAt preenchido', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('nutri-1');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('remove() faz soft delete em vez de deletar', async () => {
    mockFindFirst.mockResolvedValue({ id: 'pay-1', nutritionistId: 'nutri-1', deletedAt: null });
    mockUpdate.mockResolvedValue({});
    await service.remove('nutri-1', 'pay-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('remove() lança erro se pagamento não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('nutri-1', 'pay-outro')).rejects.toThrow('Não autorizado');
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npx vitest run src/tests/services/payments.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Atualizar `payments.service.ts`**

```typescript
import { getDb } from '../lib/rls-context.ts';

type CreatePaymentInput = {
  patientId: string;
  amount: number;
  date: Date;
  method: string;
  status: string;
  description?: string;
};

export function createPaymentsService() {
  async function list(nutritionistId: string) {
    return getDb().payment.findMany({
      where: { nutritionistId, deletedAt: null },
      orderBy: { date: 'desc' },
    });
  }

  async function create(nutritionistId: string, data: CreatePaymentInput) {
    return getDb().payment.create({ data: { ...data, nutritionistId } });
  }

  async function update(nutritionistId: string, id: string, data: Partial<CreatePaymentInput>) {
    const existing = await getDb().payment.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().payment.update({ where: { id }, data });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().payment.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().payment.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, create, update, remove };
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npx vitest run src/tests/services/payments.service.test.ts
```

Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/server/services/payments.service.ts src/tests/services/payments.service.test.ts
git commit -m "feat: soft delete em payments (LGPD)"
```

---

## Task 7: nutrition-calculations.service.ts

**Files:**
- Modify: `src/server/services/nutrition-calculations.service.ts`
- Create: `src/tests/services/nutrition-calculations.service.test.ts`

- [ ] **Step 1: Escrever testes falhando**

Criar `src/tests/services/nutrition-calculations.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockFindFirst, mockUpdate, mockCreate, mockDelete } = vi.hoisted(() => ({
  mockFindMany:  vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate:    vi.fn(),
  mockCreate:    vi.fn(),
  mockDelete:    vi.fn(),
}));

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({
    nutritionCalculation: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      update:    mockUpdate,
      create:    mockCreate,
      delete:    mockDelete,
    },
  }),
}));

import { createNutritionCalculationsService } from '../../server/services/nutrition-calculations.service.ts';

const service = createNutritionCalculationsService();

describe('nutrition-calculations.service — soft delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() filtra cálculos com deletedAt preenchido', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('nutri-1', 'pac-1');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('remove() faz soft delete em vez de deletar', async () => {
    mockFindFirst.mockResolvedValue({ id: 'calc-1', nutritionistId: 'nutri-1', deletedAt: null });
    mockUpdate.mockResolvedValue({});
    await service.remove('nutri-1', 'calc-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('remove() lança erro se cálculo não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('nutri-1', 'calc-outro')).rejects.toThrow('Não autorizado');
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npx vitest run src/tests/services/nutrition-calculations.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Atualizar `nutrition-calculations.service.ts`**

```typescript
import { getDb } from '../lib/rls-context.ts';

export function createNutritionCalculationsService() {
  async function list(nutritionistId: string, patientId: string) {
    return getDb().nutritionCalculation.findMany({
      where: { patientId, nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>) {
    return getDb().nutritionCalculation.create({
      data: { ...(data as any), patientId, nutritionistId },
    });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().nutritionCalculation.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().nutritionCalculation.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, create, remove };
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npx vitest run src/tests/services/nutrition-calculations.service.test.ts
```

Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/server/services/nutrition-calculations.service.ts src/tests/services/nutrition-calculations.service.test.ts
git commit -m "feat: soft delete em nutrition-calculations (LGPD)"
```

---

## Task 8: custom-foods.service.ts

**Files:**
- Modify: `src/server/services/custom-foods.service.ts`
- Create: `src/tests/services/custom-foods.service.test.ts`

- [ ] **Step 1: Escrever testes falhando**

Criar `src/tests/services/custom-foods.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockFindFirst, mockUpdate, mockCreate, mockDelete } = vi.hoisted(() => ({
  mockFindMany:  vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate:    vi.fn(),
  mockCreate:    vi.fn(),
  mockDelete:    vi.fn(),
}));

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({
    customFood: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      update:    mockUpdate,
      create:    mockCreate,
      delete:    mockDelete,
    },
  }),
}));

import { createCustomFoodsService } from '../../server/services/custom-foods.service.ts';

const service = createCustomFoodsService();

describe('custom-foods.service — soft delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() filtra alimentos com deletedAt preenchido', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('nutri-1');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('remove() faz soft delete em vez de deletar', async () => {
    mockFindFirst.mockResolvedValue({ id: 'food-1', nutritionistId: 'nutri-1', deletedAt: null });
    mockUpdate.mockResolvedValue({});
    await service.remove('nutri-1', 'food-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('remove() lança erro se alimento não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('nutri-1', 'food-outro')).rejects.toThrow('Não autorizado');
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npx vitest run src/tests/services/custom-foods.service.test.ts
```

Expected: FAIL

- [ ] **Step 3: Atualizar `custom-foods.service.ts`**

```typescript
import { getDb } from '../lib/rls-context.ts';

type CreateFoodInput = {
  name: string; kcal: number; protein: number; carbs: number;
  fat: number; baseUnit: string; baseQuantity: number; serving?: unknown;
};

export function createCustomFoodsService() {
  async function list(nutritionistId: string) {
    return getDb().customFood.findMany({ where: { nutritionistId, deletedAt: null } });
  }

  async function create(nutritionistId: string, data: CreateFoodInput) {
    const { serving, ...rest } = data;
    return getDb().customFood.create({
      data: {
        ...rest,
        nutritionistId,
        ...(serving !== undefined ? { serving: serving as any } : {}),
      },
    });
  }

  async function update(nutritionistId: string, id: string, data: Partial<CreateFoodInput>) {
    const existing = await getDb().customFood.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    const { serving, ...rest } = data;
    return getDb().customFood.update({
      where: { id },
      data: {
        ...rest,
        ...(serving !== undefined ? { serving: serving as any } : {}),
      },
    });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().customFood.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().customFood.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, create, update, remove };
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npx vitest run src/tests/services/custom-foods.service.test.ts
```

Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/server/services/custom-foods.service.ts src/tests/services/custom-foods.service.test.ts
git commit -m "feat: soft delete em custom-foods (LGPD)"
```

---

## Task 9: Verificação Final

- [ ] **Step 1: Rodar suite completa de testes**

```bash
npx vitest run
```

Expected: todos os testes passando, sem regressões

- [ ] **Step 2: Type check**

```bash
npm run lint
```

Expected: sem erros de tipo

- [ ] **Step 3: Verificar que não há mais `.delete()` em services (exceto permitidos)**

```bash
grep -n "\.delete(" src/server/services/*.service.ts | grep -v "account.service\|retention.service\|mealPlanItem\|deleteMany"
```

Expected: nenhuma linha — apenas `account.service`, `retention.service` e operações em `mealPlanItem` (hard delete intencional) são permitidos

- [ ] **Step 4: Commit final**

```bash
git add .
git commit -m "test: verificação final — todos os testes passando com soft delete LGPD"
```
