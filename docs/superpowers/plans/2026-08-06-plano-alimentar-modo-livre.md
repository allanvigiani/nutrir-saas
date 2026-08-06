# Plano Alimentar — Modo Livre (texto colado) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the nutritionist choose, when creating a meal plan, between the existing block-based structure ("Por Refeição") and a new "Livre" mode where they paste a ready-made diet as free text — and make PDF export/view reflect both modes correctly.

**Architecture:** Add `type: 'blocks' | 'free'` + `freeTextContent?: string` to `MealPlan` (Prisma + types). Extend `CopyMealPlanModal` with two creation-type buttons. Add a new, small `FreeTextMealPlanEditor.tsx` component that `MealPlanEdit.tsx` renders instead of `MealPlanEditor.tsx` when `type === 'free'`. Consolidate the duplicated jsPDF generator (`PatientProfile.tsx` inline copy → import from `src/lib/meal-plan-pdf.ts`) and branch it by `type`. Branch the "Visualizar" modal in `PatientProfile.tsx` by `type` too.

**Tech Stack:** React + TypeScript, React Router 7 (route state for cross-page data), Prisma/PostgreSQL, Express, jsPDF + jspdf-autotable, Vitest, shadcn/ui (`Dialog`, `Textarea`, `Input`, `Button`), Tailwind.

## Global Constraints

- Business domain variables in Portuguese (`peso`, `paciente`), technical variables in English (`req`, `data`), comments in Portuguese, UI text in PT-BR (per `CLAUDE.md`).
- Factory functions for backend services/controllers (`createXService`) — already followed by `meal-plans.service.ts`, no new service needed here.
- Strict TypeScript — every new prop/interface typed explicitly.
- `npm run lint` (tsc --noEmit) and `npm run test` must pass before each commit that touches source.
- Existing plans must be unaffected: `type` defaults to `'blocks'` at the DB level, no data migration/backfill script needed beyond the column default.
- Migration file naming: `prisma/migrations/YYYYMMDDHHMMSS_description/migration.sql`, written by hand (project convention — no `prisma migrate dev` in this repo's workflow based on existing migrations).

---

### Task 1: Prisma schema — add `type` and `freeTextContent` to `MealPlan`

**Files:**
- Modify: `prisma/schema.prisma:121-143` (`MealPlan` model)
- Create: `prisma/migrations/20260806120000_add_meal_plan_type/migration.sql`

**Interfaces:**
- Produces: `MealPlan.type` (Prisma field, `String @default("blocks")`), `MealPlan.freeTextContent` (Prisma field, `String?`). Every later task that touches `MealPlan` reads/writes these two fields by these exact names.

- [ ] **Step 1: Add the two fields to the Prisma schema**

Edit `prisma/schema.prisma`, inside `model MealPlan` (currently lines 121-143), add `type` right after `name` and `freeTextContent` right after `waterIntake`:

```prisma
model MealPlan {
  id                  String   @id @default(cuid())
  patientId           String
  patient             Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)
  consultationId      String?
  calculationId       String?
  nutritionistId      String
  name                String
  type                String   @default("blocks")
  generalInstructions String?
  waterIntake         String?
  freeTextContent     String?
  mealObservations    Json?
  customMeals         Json?
  status              String   @default("active")
  accessToken         String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  deletedAt           DateTime?

  items        MealPlanItem[]
  recipeLinks  MealPlanRecipe[]

  @@map("meal_plans")
}
```

- [ ] **Step 2: Write the migration SQL by hand**

Create `prisma/migrations/20260806120000_add_meal_plan_type/migration.sql`:

```sql
-- AlterTable: adiciona type para diferenciar plano estruturado (blocks) de texto livre (free)
-- DEFAULT garante retrocompatibilidade — planos existentes ficam com type = 'blocks'
ALTER TABLE "meal_plans" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'blocks';

-- AlterTable: campo de texto livre, usado apenas quando type = 'free'
ALTER TABLE "meal_plans" ADD COLUMN "freeTextContent" TEXT;
```

- [ ] **Step 3: Apply the migration locally and regenerate the Prisma client**

Run: `npx prisma migrate deploy && npx prisma generate`
Expected: `1 migration found... Applied` and `Generated Prisma Client` with no errors.

- [ ] **Step 4: Verify with a type check**

Run: `npm run lint`
Expected: no new TypeScript errors (this task only touches the schema; the generated client now exposes `type`/`freeTextContent` on `MealPlan`).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260806120000_add_meal_plan_type
git commit -m "feat: adiciona type e freeTextContent ao MealPlan"
```

---

### Task 2: `types.ts` — mirror the new fields on the frontend `MealPlan` interface

**Files:**
- Modify: `src/types.ts:86-101`

**Interfaces:**
- Consumes: nothing new.
- Produces: `MealPlan.type: 'blocks' | 'free'`, `MealPlan.freeTextContent?: string` on the frontend type. All frontend tasks (3, 5, 6, 7, 8) import `MealPlan` from here and rely on these two fields.

- [ ] **Step 1: Update the `MealPlan` interface**

```typescript
export interface MealPlan {
  id: string;
  patient_id: string;
  consultation_id?: string;
  calculation_id?: string;
  nutritionist_id: string;
  name: string;
  type: 'blocks' | 'free';
  generalInstructions?: string;
  waterIntake?: string;
  freeTextContent?: string;
  mealObservations?: Record<string, string>;
  customMeals?: { id: string; label: string; time?: string; icon?: string }[];
  access_token?: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Run the type checker**

Run: `npm run lint`
Expected: TypeScript errors appear wherever `MealPlan` objects are constructed without a `type` field (e.g. test fixtures, mock objects) — note every file that errors, they'll be fixed in the tasks that touch those files. If a file outside this plan's scope errors, add `type: 'blocks'` to its fixture inline right now (this is scaffolding, not a design change).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: adiciona type e freeTextContent à interface MealPlan"
```

---

### Task 3: Backend service — validate `type`, pass through `freeTextContent`, propagate both through plan history

**Files:**
- Modify: `src/server/services/meal-plans.service.ts:49-61` (`HistoricoPlanoAlimentar` interface), `:118-151` (`create`, `update`), `:269-281` (`getHistory` result mapping)
- Test: `src/tests/services/meal-plans.service.test.ts`

**Interfaces:**
- Consumes: `getDb().mealPlan.create` / `.update` / `.findMany` (Prisma client from Task 1, now exposing `type`/`freeTextContent`).
- Produces:
  - `create(nutritionistId, patientId, data, isPremium)` and `update(nutritionistId, id, data)` throw `Error('Tipo de plano inválido')` when `data.type` is present and not `'blocks'`/`'free'`. Otherwise unchanged signatures — `type`/`freeTextContent` flow through the existing `...rest` spread untouched.
  - `getHistory(...)` results now include `mealPlan.type: string` and `mealPlan.freeTextContent: string | null` on every entry. Task 4 (`MealPlanHistoryEntry` in the frontend) and Task 5 (`onCopyPlan` handler) consume exactly these two field names from the JSON response.

- [ ] **Step 1: Write the failing tests**

Add to `src/tests/services/meal-plans.service.test.ts`, inside a new `describe` block appended at the end of the file (after the closing of `meal-plans.service — position / reordenação`, i.e. after line 281):

```typescript
describe('meal-plans.service — type (blocks | free)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create() rejeita type inválido', async () => {
    await expect(
      service.create('nutri-1', 'pac-1', { name: 'Plano A', type: 'invalido' }, true)
    ).rejects.toThrow('Tipo de plano inválido');
    expect(mealPlan.create).not.toHaveBeenCalled();
  });

  it('create() aceita type "free" e persiste freeTextContent', async () => {
    mealPlan.create.mockResolvedValue({ id: 'mp-new' });
    await service.create(
      'nutri-1',
      'pac-1',
      { name: 'Plano Livre', type: 'free', freeTextContent: 'Café: pão + ovo' },
      true
    );
    expect(mealPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'free', freeTextContent: 'Café: pão + ovo' }),
      }),
    );
  });

  it('update() rejeita type inválido', async () => {
    mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1', deletedAt: null });
    await expect(
      service.update('nutri-1', 'mp-1', { type: 'invalido' })
    ).rejects.toThrow('Tipo de plano inválido');
    expect(mealPlan.update).not.toHaveBeenCalled();
  });

  it('update() aceita type "blocks" sem alterar comportamento existente', async () => {
    mealPlan.findFirst.mockResolvedValue({ id: 'mp-1', nutritionistId: 'nutri-1', deletedAt: null });
    mealPlan.update.mockResolvedValue({});
    await service.update('nutri-1', 'mp-1', { type: 'blocks', name: 'Renomeado' });
    expect(mealPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'blocks', name: 'Renomeado' }) }),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/services/meal-plans.service.test.ts`
Expected: the two "rejeita type inválido" tests FAIL (no validation exists yet — `create`/`update` would resolve instead of throwing).

- [ ] **Step 3: Add validation to the service**

In `src/server/services/meal-plans.service.ts`, add a helper near the top (after the `itemToSnakeCase`/`toSnakeCase` functions, before `createMealPlansService`, i.e. after line 98):

```typescript
const VALID_MEAL_PLAN_TYPES = new Set(['blocks', 'free']);

function assertValidType(data: Record<string, unknown>) {
  if (data.type !== undefined && !VALID_MEAL_PLAN_TYPES.has(data.type as string)) {
    throw new Error('Tipo de plano inválido');
  }
}
```

Then call it at the top of `create` (line 118) and `update` (line 139):

```typescript
  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>, isPremium: boolean) {
    assertValidType(data);
    if (!isPremium) {
```

```typescript
  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    assertValidType(data);
    const existing = await getDb().mealPlan.findFirst({ where: { id, nutritionistId, deletedAt: null } });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/tests/services/meal-plans.service.test.ts`
Expected: all tests PASS, including the 4 new ones.

- [ ] **Step 5: Write a failing test for `getHistory` propagating `type`/`freeTextContent`**

`src/tests/services/meal-plans-history.service.test.ts` already tests `getHistory` using its own `criarPlanoDb()`/`criarConsultaDb()` fixture helpers (lines 23-47) and its own `mealPlan`/`consultation` mocks (lines 4-5). Add this test inside the existing `describe('happy path', ...)` block (after the test at line 60-71 or nearby):

```typescript
    it('inclui type e freeTextContent do plano no resultado', async () => {
      mealPlan.findMany.mockResolvedValue([
        criarPlanoDb({ type: 'free', freeTextContent: 'Café: pão + ovo' }),
      ]);
      consultation.findMany.mockResolvedValue([criarConsultaDb()]);

      const resultado = await service.getHistory('nutri-1', 'pac-1');

      expect(resultado[0].mealPlan.type).toBe('free');
      expect(resultado[0].mealPlan.freeTextContent).toBe('Café: pão + ovo');
    });
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/tests/services/meal-plans-history.service.test.ts`
Expected: FAILS — `result[0].mealPlan.type` is `undefined` (not yet mapped in `getHistory`).

- [ ] **Step 7: Add `type`/`freeTextContent` to `HistoricoPlanoAlimentar` and `getHistory`'s mapping**

Update the `HistoricoPlanoAlimentar` interface (lines 49-61):

```typescript
interface HistoricoPlanoAlimentar {
  consultationId: string;
  consultationDate: string;
  mealPlan: {
    id: string;
    name: string;
    type: string;
    generalInstructions: string | null;
    waterIntake: string | null;
    freeTextContent: string | null;
    mealObservations: Record<string, string> | null;
    customMeals: string[] | null;
    items: ReturnType<typeof itemToSnakeCase>[];
  };
}
```

Update the `resultado.push({...})` block inside `getHistory` (around line 269-281) to include the two new fields in `mealPlan`:

```typescript
      resultado.push({
        consultationId: consultaId,
        consultationDate: dataConsulta,
        mealPlan: {
          id: plano.id,
          name: plano.name,
          type: plano.type,
          generalInstructions: plano.generalInstructions ?? null,
          waterIntake: plano.waterIntake ?? null,
          freeTextContent: plano.freeTextContent ?? null,
          mealObservations: (plano.mealObservations as Record<string, string> | null) ?? null,
          customMeals: (plano.customMeals as string[] | null) ?? null,
          items: plano.items.map(itemToSnakeCase),
        },
      });
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run src/tests/services/meal-plans-history.service.test.ts`
Expected: PASS.

- [ ] **Step 9: Run the full test suite**

Run: `npm run test`
Expected: all suites pass (467+ tests).

- [ ] **Step 10: Commit**

```bash
git add src/server/services/meal-plans.service.ts src/tests/services/meal-plans.service.test.ts src/tests/services/meal-plans-history.service.test.ts
git commit -m "feat: valida type do plano alimentar e propaga type/freeTextContent no historico"
```

---

### Task 4: `CopyMealPlanModal` — replace the single "Criar do zero" button with "Por Refeição" / "Livre", carry `type`/`freeTextContent` through the copy-history payload

**Files:**
- Modify: `src/components/CopyMealPlanModal.tsx:18-67` (`MealPlanItemHistory`/`MealPlanHistoryEntry` types, props), `:253-261` (footer button)

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces:
  - `CopyMealPlanModalProps.onCreateFromScratch` changes signature from `() => void` to `(type: 'blocks' | 'free') => void`. Task 5 (the `PatientProfile.tsx` call sites) must update its `onCreateFromScratch` callback to accept this new `type` argument — this is the single call site.
  - `MealPlanHistoryEntry.mealPlan` gains `type: 'blocks' | 'free'` and `freeTextContent: string | null`. Task 5's `onCopyPlan` handler and Task 3's backend `getHistory()` response must produce these two fields with these exact names for this type to be satisfied.

- [ ] **Step 1: Extend `MealPlanHistoryEntry` with the new fields**

In `src/components/CopyMealPlanModal.tsx`, update the `MealPlanHistoryEntry` interface (lines 41-53):

```typescript
export interface MealPlanHistoryEntry {
  consultationId: string;
  consultationDate: string; // ISO 8601
  mealPlan: {
    id: string;
    name: string;
    type: 'blocks' | 'free';
    generalInstructions: string | null;
    waterIntake: string | null;
    freeTextContent: string | null;
    mealObservations: Record<string, string> | null;
    customMeals: string[] | null;
    items: MealPlanItemHistory[];
  };
}
```

- [ ] **Step 2: Update the prop type**

In `src/components/CopyMealPlanModal.tsx`, change line 64:

```typescript
  /** Chamado quando o usuário quer criar do zero — recebe o tipo escolhido */
  onCreateFromScratch: (type: 'blocks' | 'free') => void;
```

- [ ] **Step 3: Replace the footer button with two buttons**

Replace lines 253-261 (the single "Criar do zero" button):

```tsx
          {/* Criar do zero — sempre visíveis, dois tipos */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => onCreateFromScratch('blocks')}
            >
              <FilePlus className="w-4 h-4" />
              Por Refeição
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => onCreateFromScratch('free')}
            >
              <FilePlus className="w-4 h-4" />
              Livre
            </Button>
          </div>
```

- [ ] **Step 4: Type-check**

Run: `npm run lint`
Expected: a TypeScript error at the `PatientProfile.tsx` call site (`onCreateFromScratch={() => {...}}` — arity mismatch is allowed in TS for fewer params, so this likely does NOT error; confirm by reading the diagnostic output). Errors are also expected wherever `MealPlanHistoryEntry.mealPlan` object literals are constructed without `type`/`freeTextContent` (none currently exist outside this component and its consumer, which Task 5 updates). Task 5 will update the `PatientProfile.tsx` call site to consume the new argument and fields.

- [ ] **Step 5: Commit**

```bash
git add src/components/CopyMealPlanModal.tsx
git commit -m "feat: CopyMealPlanModal oferece Por Refeicao e Livre, propaga type/freeTextContent no historico"
```

---

### Task 5: `PatientProfile.tsx` — always open the modal for plan creation, wire the new `type` argument, forward the choice via route state

**Files:**
- Modify: `src/pages/PatientProfile.tsx:1576-1600` ("Criar Plano" button `onClick`), `:3358-3415` (`CopyMealPlanModal` render + handlers)

**Interfaces:**
- Consumes: `CopyMealPlanModal.onCreateFromScratch(type)` and `MealPlanHistoryEntry.mealPlan.{type,freeTextContent}` from Task 4.
- Produces: `navigate(..., { state: { mealPlanType: 'blocks' | 'free', copiedMealPlan: { ..., type, freeTextContent }, ... } })` — Task 7 (`MealPlanEdit.tsx`) reads `location.state?.mealPlanType` and `location.state?.copiedMealPlan.{type,freeTextContent}`.

- [ ] **Step 1: Read the current "Criar Plano" button handler and modal render block**

(Already read — lines 1576-1600 and 3358-3415. No test file exists for this page per project convention — `PatientProfile.tsx` has no `.test.tsx`; this task is verified manually per Step 6 below, consistent with how the rest of this page is handled.)

- [ ] **Step 2: Always open the modal — remove the "no history → skip modal" shortcut**

Replace lines 1576-1600 (the `onClick` handler of the "Criar Plano" button):

```tsx
                                              onClick={() => {
                                                if (planDaConsulta) {
                                                  navigate(`/patients/${id}/meal-plan/${planDaConsulta.id}`);
                                                } else {
                                                  setPendingConsultationForPlan({
                                                    consultationId: consultation.id,
                                                    calcDaConsulta,
                                                  });
                                                  setIsCopyMealPlanModalOpen(true);
                                                }
                                              }}
```

(This removes the `planosAnteriores.length > 0` branch that used to `navigate` straight to `/meal-plan/new` — the modal now always opens, and `CopyMealPlanModal` itself already handles the "no history" case gracefully per its existing `historico.length === 0` branch at line 232-236.)

- [ ] **Step 3: Update `onCreateFromScratch` to accept and forward the type**

Find the `CopyMealPlanModal` render (lines 3358-3415) and read its full current handlers — `onCreateFromScratch` (lines 3367-3377) and `onCopyPlan` (lines 3378-3413, full body already read: it builds a `copiedMealPlan` object with `generalInstructions`, `waterIntake`, `mealObservations`, `customMeals`, `items`).

Change the `onCreateFromScratch` callback to accept `type` and add it to the navigation state:

```tsx
          onCreateFromScratch={(type: 'blocks' | 'free') => {
            setIsCopyMealPlanModalOpen(false);
            const pending = pendingConsultationForPlan;
            setPendingConsultationForPlan(null);
            navigate(`/patients/${id}/meal-plan/new`, {
              state: {
                consultationId: pending.consultationId,
                mealPlanType: type,
                ...(pending.calcDaConsulta ? { calculation: pending.calcDaConsulta } : {}),
              },
            });
          }}
```

- [ ] **Step 4: Add `type`/`freeTextContent` to the `copiedMealPlan` object built in `onCopyPlan`**

Replace the `copiedMealPlan: { ... }` object (lines 3386-3410) — add `type` and `freeTextContent`, keep everything else identical:

```tsx
                copiedMealPlan: {
                  type: entrada.mealPlan.type,
                  freeTextContent: entrada.mealPlan.freeTextContent ?? '',
                  generalInstructions: entrada.mealPlan.generalInstructions ?? '',
                  waterIntake: entrada.mealPlan.waterIntake ?? '',
                  mealObservations: entrada.mealPlan.mealObservations ?? {},
                  customMeals: entrada.mealPlan.customMeals ?? [],
                  items: entrada.mealPlan.items.map(item => ({
                    meal: item.meal,
                    food: item.food,
                    quantity: item.quantity,
                    unit: item.unit,
                    weight_in_grams: item.weight_in_grams,
                    kcal: item.kcal,
                    protein: item.protein,
                    carbs: item.carbs,
                    fat: item.fat,
                    base_kcal: item.base_kcal,
                    base_protein: item.base_protein,
                    base_carbs: item.base_carbs,
                    base_fat: item.base_fat,
                    base_quantity: item.base_quantity,
                    serving_name: item.serving_name,
                    serving_weight: item.serving_weight,
                    position: item.position,
                  })),
                },
```

- [ ] **Step 5: Type-check**

Run: `npm run lint`
Expected: no errors — `MealPlanHistoryEntry` (Task 4) now requires `type`/`freeTextContent`, and this step's edit supplies both.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open a patient with at least one prior consultation but no meal plan on the current consultation, click "Criar Plano". Confirm: the modal opens (previously it might have skipped straight to the editor if the current consultation had no other plans — verify by testing both a patient with zero prior plans and one with prior plans); confirm both cases now show the "Por Refeição" / "Livre" buttons. Also copy an existing plan from the list and confirm the resulting `copiedMealPlan` state (inspect via React DevTools or a temporary `console.log` in `MealPlanEdit.tsx`) includes `type` and `freeTextContent`.
Expected: modal always opens; clicking "Por Refeição" navigates to `/meal-plan/new` (existing behavior); clicking "Livre" also navigates to `/meal-plan/new` (Task 7 will make this render the free-text editor); copying a plan carries `type`/`freeTextContent` in the route state.

- [ ] **Step 7: Commit**

```bash
git add src/pages/PatientProfile.tsx
git commit -m "feat: modal de criacao de plano sempre pergunta Por Refeicao ou Livre, propaga type/freeTextContent ao copiar"
```

---

### Task 6: `FreeTextMealPlanEditor.tsx` — new component for the free-text editing UI

**Files:**
- Create: `src/components/FreeTextMealPlanEditor.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (self-contained component using shadcn `Dialog`/`Input`/`Textarea`/`Button` from `./ui/*`, same as `MealPlanEditor.tsx`).
- Produces:
  ```typescript
  export interface FreeTextMealPlanEditorProps {
    initialName?: string;
    initialWaterIntake?: string;
    initialGeneralInstructions?: string;
    initialFreeTextContent?: string;
    isNew?: boolean;
    onSave: (data: {
      name: string;
      waterIntake: string;
      generalInstructions: string;
      freeTextContent: string;
    }) => Promise<boolean>;
    onPrint?: () => Promise<void>;
    onClose: () => void;
  }
  export function FreeTextMealPlanEditor(props: FreeTextMealPlanEditorProps): JSX.Element
  ```
  Task 7 (`MealPlanEdit.tsx`) imports `FreeTextMealPlanEditor` and its `onSave` data shape by these exact field names.

- [ ] **Step 1: Create the component**

```tsx
import React, { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, Droplets, Loader2, MessageSquare, Printer, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export interface FreeTextMealPlanEditorProps {
  initialName?: string;
  initialWaterIntake?: string;
  initialGeneralInstructions?: string;
  initialFreeTextContent?: string;
  isNew?: boolean;
  onSave: (data: {
    name: string;
    waterIntake: string;
    generalInstructions: string;
    freeTextContent: string;
  }) => Promise<boolean>;
  onPrint?: () => Promise<void>;
  onClose: () => void;
}

export function FreeTextMealPlanEditor({
  initialName = '',
  initialWaterIntake = '',
  initialGeneralInstructions = '',
  initialFreeTextContent = '',
  isNew = false,
  onSave,
  onPrint,
  onClose,
}: FreeTextMealPlanEditorProps) {
  const [name, setName] = useState(initialName);
  const [waterIntake, setWaterIntake] = useState(initialWaterIntake);
  const [generalInstructions, setGeneralInstructions] = useState(initialGeneralInstructions);
  const [freeTextContent, setFreeTextContent] = useState(initialFreeTextContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const hasUnsavedChanges = useMemo(() => {
    return (
      name !== initialName ||
      waterIntake !== initialWaterIntake ||
      generalInstructions !== initialGeneralInstructions ||
      freeTextContent !== initialFreeTextContent
    );
  }, [name, waterIntake, generalInstructions, freeTextContent, initialName, initialWaterIntake, initialGeneralInstructions, initialFreeTextContent]);

  const handleRequestClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowLeaveConfirm(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  const handleSaveClick = useCallback(async () => {
    if (!freeTextContent.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave({ name, waterIntake, generalInstructions, freeTextContent });
    } finally {
      setIsSaving(false);
    }
  }, [onSave, name, waterIntake, generalInstructions, freeTextContent]);

  return (
    <div className="h-screen flex flex-col bg-muted/30">
      <div className="sticky top-0 z-50 bg-card border-b border-border px-3 py-2 md:px-4 xl:px-6 xl:py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-5">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRequestClose}
              className="rounded-lg border-border hover:bg-muted/30 transition-all h-8 w-8 shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </Button>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span>Plano Alimentar</span>
              <span className="text-primary font-semibold">· Livre</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onPrint && (
              <Button
                variant="outline"
                size="icon"
                onClick={async () => {
                  setIsPrinting(true);
                  try { await onPrint(); } finally { setIsPrinting(false); }
                }}
                disabled={hasUnsavedChanges || isPrinting}
                title={hasUnsavedChanges ? 'Salve as alterações antes de imprimir' : 'Baixar PDF'}
                className="rounded-lg border-border hover:bg-muted/30 transition-all h-8 w-8 shrink-0"
              >
                {isPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 text-muted-foreground" />}
              </Button>
            )}
            <Button
              onClick={handleSaveClick}
              disabled={isSaving || !freeTextContent.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-8 px-4 font-medium text-xs gap-2 transition-all active:scale-95"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isNew ? 'Criar Plano' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto p-4 xl:p-6 space-y-4">
          <div className="bg-card rounded-xl p-4 border border-border space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground ml-1">Nome do Plano</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-sm font-medium border border-border bg-card h-9 rounded-lg px-3"
                  placeholder="Ex: Estratégia de Cutting..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground ml-1">Ingestão de Água</Label>
                <div className="relative">
                  <Droplets className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={waterIntake}
                    onChange={(e) => setWaterIntake(e.target.value)}
                    className="pl-9 border border-border bg-card h-9 rounded-lg"
                    placeholder="Ex: 2,5L"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border">
              <div className="flex items-center gap-2 mb-2 px-1">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs font-medium text-muted-foreground">Orientações Gerais</Label>
              </div>
              <Textarea
                placeholder="Quais as orientações principais para este plano?"
                className="min-h-[72px] rounded-lg border border-border bg-card resize-none text-sm leading-relaxed p-3"
                value={generalInstructions}
                onChange={(e) => setGeneralInstructions(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border space-y-2">
            <Label className="text-xs font-medium text-muted-foreground ml-1">Plano Alimentar (cole aqui)</Label>
            <Textarea
              placeholder="Cole aqui o plano alimentar completo..."
              className="min-h-[420px] rounded-lg border border-border bg-card resize-y text-sm leading-relaxed p-3 font-mono"
              value={freeTextContent}
              onChange={(e) => setFreeTextContent(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sair sem salvar?</DialogTitle>
            <DialogDescription>
              Você tem alterações não salvas neste plano alimentar. Se sair agora, elas serão perdidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setShowLeaveConfirm(false)}>
              Continuar editando
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowLeaveConfirm(false);
                onClose();
              }}
            >
              Sair sem salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual smoke check**

This component isn't wired up yet (Task 7 does that) — skip runtime verification here, just confirm `npm run build` succeeds (catches JSX/import errors standalone).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/FreeTextMealPlanEditor.tsx
git commit -m "feat: adiciona FreeTextMealPlanEditor para o modo Livre"
```

---

### Task 7: `MealPlanEdit.tsx` — render the right editor by `type`, save free-text plans, initialize new free plans

**Files:**
- Modify: `src/pages/MealPlanEdit.tsx` (whole file — imports, `handleSave`, render)

**Interfaces:**
- Consumes: `FreeTextMealPlanEditor` + `FreeTextMealPlanEditorProps` (Task 6); `location.state?.mealPlanType` and `location.state?.copiedMealPlan.{type,freeTextContent}` (Task 5); `MealPlan.type`/`freeTextContent` (Task 2).
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Add the import, read `mealPlanType` from route state, extend the `copiedMealPlan` shape**

At the top of `src/pages/MealPlanEdit.tsx`, add the import (after line 5, the `MealPlanEditor` import):

```typescript
import { FreeTextMealPlanEditor } from '../components/FreeTextMealPlanEditor';
```

Replace the `copiedMealPlan` block (lines 29-36) to add `type`/`freeTextContent`, and add `stateMealPlanType` right after it:

```typescript
  // Plano copiado de consulta anterior (deep clone enviado por PatientProfile)
  const copiedMealPlan = location.state?.copiedMealPlan as {
    type: 'blocks' | 'free';
    freeTextContent: string;
    generalInstructions: string;
    waterIntake: string;
    mealObservations: Record<string, string>;
    customMeals: MealType[];
    items: MealPlanItem[];
  } | undefined;

  // Tipo escolhido no modal ao criar do zero (apenas relevante para plano novo sem cópia)
  const stateMealPlanType = location.state?.mealPlanType as 'blocks' | 'free' | undefined;
```

- [ ] **Step 2: Determine the effective type**

`effectiveType` must account for three sources, in priority order: an existing plan's saved `type` (editing), a copied plan's `type` (creating via "copiar"), then the modal's choice (creating via "criar do zero"), defaulting to `'blocks'`. Add this as a plain `const` in the component body, right before the `return (` statement (originally around line 209 — the same spot as `safeCustomMeals`/`safeMealObservations`, so it can be computed once per render alongside them):

```typescript
  // Tipo efetivo: plano existente > plano copiado > escolha do modal > default 'blocks'
  const effectiveType: 'blocks' | 'free' = mealPlan?.type ?? copiedMealPlan?.type ?? stateMealPlanType ?? 'blocks';
```

`handleSave` (Step 3, defined earlier in the file) closes over this same `effectiveType` — since `handleSave` is only invoked later, from a click after the full component body (including this line) has already run once, the closure sees the correctly computed value on every render. No duplicate computation needed inside `handleSave`.

- [ ] **Step 3: Branch `handleSave` for the free-text path**

Replace the `handleSave` function (lines 91-156):

```typescript
  const handleSave = async (data: {
    name: string;
    items: any[];
    generalInstructions: string;
    waterIntake: string;
    mealObservations: Record<string, string>;
    customMeals: any[];
  } | {
    name: string;
    waterIntake: string;
    generalInstructions: string;
    freeTextContent: string;
  }): Promise<boolean> => {
    if (!user || !patientId) return false;

    try {
      const isFree = effectiveType === 'free';
      const planPayload = isFree
        ? {
            type: 'free',
            name: data.name || '',
            generalInstructions: (data as any).generalInstructions || '',
            waterIntake: (data as any).waterIntake || '',
            freeTextContent: (data as any).freeTextContent || '',
            mealObservations: {},
            customMeals: [],
            consultation_id: stateCalculation?.consultation_id || location.state?.consultationId || mealPlan?.consultation_id || null,
            calculation_id: stateCalculation?.id || mealPlan?.calculation_id || null,
          }
        : {
            type: 'blocks',
            name: data.name || '',
            generalInstructions: (data as any).generalInstructions || '',
            waterIntake: (data as any).waterIntake || '',
            mealObservations: (data as any).mealObservations || {},
            customMeals: (data as any).customMeals.map((m: any) => ({
              id: m.id,
              label: m.label || '',
              time: m.time || null
            })),
            consultation_id: stateCalculation?.consultation_id || location.state?.consultationId || mealPlan?.consultation_id || null,
            calculation_id: stateCalculation?.id || mealPlan?.calculation_id || null,
          };

      let currentPlanId: string | undefined = planId;

      if (planId && planId !== 'new') {
        await apiRequest(`/api/meal-plans/${planId}`, 'PATCH', planPayload);
        if (!isFree) {
          const mealPositionCounters: Record<string, number> = {};
          const cleanItems = (data as any).items.map(({ id: _id, position: _pos, ...item }: any) => {
            const mealId = item.meal as string;
            if (mealPositionCounters[mealId] === undefined) mealPositionCounters[mealId] = 0;
            const position = mealPositionCounters[mealId]++;
            const clean: Record<string, any> = {};
            Object.entries(item).forEach(([k, v]) => { clean[k] = v === undefined ? null : v; });
            clean.position = position;
            return clean;
          });
          await apiRequest(`/api/meal-plans/${planId}/items`, 'PUT', cleanItems);
        }
      } else {
        const created = await apiRequest<{ id: string }>(`/api/patients/${patientId}/meal-plans`, 'POST', planPayload);
        currentPlanId = created?.id;
        if (currentPlanId && !isFree) {
          const mealPositionCounters: Record<string, number> = {};
          const cleanItems = (data as any).items.map(({ id: _id, position: _pos, ...item }: any) => {
            const mealId = item.meal as string;
            if (mealPositionCounters[mealId] === undefined) mealPositionCounters[mealId] = 0;
            const position = mealPositionCounters[mealId]++;
            const clean: Record<string, any> = {};
            Object.entries(item).forEach(([k, v]) => { clean[k] = v === undefined ? null : v; });
            clean.position = position;
            return clean;
          });
          await apiRequest(`/api/meal-plans/${currentPlanId}/items`, 'PUT', cleanItems);
        }
      }

      void logEvent(planId && planId !== 'new' ? 'plano_alimentar_atualizado' : 'novo_plano_alimentar');
      toast.success(planId && planId !== 'new' ? "Plano alimentar atualizado!" : "Plano alimentar criado!");
      setMealPlan(prev => ({ ...(prev as MealPlan), ...planPayload }) as MealPlan);
      if (!isFree) setMealItems((data as any).items);
      if ((!planId || planId === 'new') && currentPlanId) {
        navigate(`/patients/${patientId}/meal-plan/${currentPlanId}`, { replace: true });
      }
      return true;
    } catch (error) {
      console.error("Error saving meal plan:", error);
      toast.error("Não foi possível salvar o plano alimentar. Verifique sua conexão e tente novamente.");
      return false;
    }
  };
```

- [ ] **Step 4: Branch the JSX by `effectiveType`**

`effectiveType` was already added in Step 2, right before the `return (` statement — this step only replaces the final `return (...)` block itself (originally lines 209-235) with a branch. Note `initialFreeTextContent` reads from `copiedMealPlan` first (copy flow), falling back to the loaded plan (edit flow) — a brand-new plan created via "Livre" (no copy) starts with an empty string, same pattern as every other `initial*` prop here:

```tsx
  if (effectiveType === 'free') {
    return (
      <FreeTextMealPlanEditor
        initialName={copiedMealPlan ? '' : (mealPlan?.name || '')}
        initialWaterIntake={copiedMealPlan ? copiedMealPlan.waterIntake : (mealPlan?.waterIntake || '')}
        initialGeneralInstructions={copiedMealPlan ? copiedMealPlan.generalInstructions : (mealPlan?.generalInstructions || '')}
        initialFreeTextContent={copiedMealPlan ? copiedMealPlan.freeTextContent : (mealPlan?.freeTextContent || '')}
        isNew={!planId || planId === 'new'}
        onSave={handleSave as any}
        onPrint={planId && planId !== 'new' ? handlePrint : undefined}
        onClose={() => navigate(`/patients/${patientId}`)}
      />
    );
  }

  return (
    <div className="h-screen overflow-hidden">
      <MealPlanEditor
        initialName={copiedMealPlan ? '' : (mealPlan?.name || (calculation ? `Plano - ${calculation.result.getAjustado} kcal` : ''))}
        initialItems={copiedMealPlan ? copiedMealPlan.items : mealItems}
        initialGeneralInstructions={copiedMealPlan ? copiedMealPlan.generalInstructions : (mealPlan?.generalInstructions || '')}
        initialWaterIntake={copiedMealPlan ? copiedMealPlan.waterIntake : (mealPlan?.waterIntake || '')}
        initialMealObservations={copiedMealPlan ? copiedMealPlan.mealObservations : safeMealObservations}
        initialCustomMeals={copiedMealPlan ? copiedMealPlan.customMeals : safeCustomMeals}
        selectedCalculation={calculation}
        foodDataSource="Todas"
        isNew={!planId || planId === 'new'}
        draftKey={draftKey}
        onSave={handleSave as any}
        onPrint={planId && planId !== 'new' ? handlePrint : undefined}
        onClose={() => navigate(`/patients/${patientId}`)}
      >
        {planId && planId !== 'new' && (
          <ReceitasVinculadasPanel
            planId={planId}
            mealTypes={mealTypesForPanel}
          />
        )}
      </MealPlanEditor>
    </div>
  );
```

Note: `draftKey` computation (lines 202-207) stays but is now only used by the `blocks` branch — leave it in place, unused-variable lint doesn't trigger since it's still referenced in the second branch.

- [ ] **Step 5: Type-check**

Run: `npm run lint`
Expected: no errors. (`handleSave as any` sidesteps the union-type mismatch between the two editors' differently-shaped `onSave` payloads — acceptable here since `MealPlanEditor`/`FreeTextMealPlanEditor` each call it with their own fixed shape and `handleSave` narrows internally via `type`.)

- [ ] **Step 6: Manual verification**

Run: `npm run dev`. From a patient page, click "Criar Plano" → "Livre". Confirm the free-text editor renders (name, water, general instructions, big textarea). Type some text, click "Criar Plano". Confirm it saves, navigates to the edit URL, and reloading the page still shows the free-text editor with the saved content. Then create a second plan via "Por Refeição" and confirm the existing block editor still works unchanged. Finally, from a new consultation on the same patient, click "Criar Plano" → copy the free-text plan created above — confirm it opens `FreeTextMealPlanEditor` pre-filled with the same pasted text.
Expected: both flows work; a free plan reloaded from the DB renders via `FreeTextMealPlanEditor`, a blocks plan renders via `MealPlanEditor`; copying a free plan opens the free-text editor pre-filled, not the block editor.

- [ ] **Step 7: Commit**

```bash
git add src/pages/MealPlanEdit.tsx
git commit -m "feat: MealPlanEdit renderiza FreeTextMealPlanEditor para planos type=free"
```

---

### Task 8: Consolidate PDF generation — `PatientProfile.tsx` imports from `src/lib/meal-plan-pdf.ts`

**Files:**
- Modify: `src/pages/PatientProfile.tsx:270-618` (delete inline `generateMealPlanPDF`), `:620-694` (`handleExportPDF`, `sendMealPlanByEmail`, `exportMealPlanPDF`), imports section (`:69-70`)
- Modify: `src/lib/meal-plan-pdf.ts` (export signature already matches — no signature change needed in this task, only in Task 9)

**Interfaces:**
- Consumes: `generateMealPlanPDF` from `src/lib/meal-plan-pdf.ts` (existing export, signature: `(plan: MealPlan, items: MealPlanItem[], patientName: string, nutritionist: Nutritionist | null, receitasVinculadas?: ReceitaVinculada[]) => jsPDF`).
- Produces: `handleExportPDF(plan, items, receitasVinculadas)` in `PatientProfile.tsx` keeps its current signature (patient name is read from the `patient` var already in scope) — no other file calls `handleExportPDF` directly, so no downstream interface change.

- [ ] **Step 1: Add the import**

In `src/pages/PatientProfile.tsx`, near the other local imports (find the line importing `CopyMealPlanModal`, around line 68), add:

```typescript
import { generateMealPlanPDF } from '../lib/meal-plan-pdf';
```

- [ ] **Step 2: Delete the inline duplicate**

Delete the entire inline `generateMealPlanPDF` function, from its `const generateMealPlanPDF = (plan: MealPlan, items: MealPlanItem[], receitasVinculadas?: ...) => {` declaration (line 270) through its closing `};` (line 618) — the full jsPDF-building body shown in the earlier read (header, patient info, meal loop, general instructions, household measures table, receitas, signature, footer).

- [ ] **Step 3: Update `handleExportPDF` to call the imported function with the extra `patientName`/`nutritionist` args**

Replace lines 620-623:

```typescript
  const handleExportPDF = (plan: MealPlan, items: MealPlanItem[], receitasVinculadas?: Array<{ meal: string; recipe: { name: string; ingredients: Array<{ name: string; quantity: string; unit: string }>; prepMode?: string } }>) => {
    const doc = generateMealPlanPDF(plan, items, patient?.name || '', nutritionist, receitasVinculadas);
    doc.save(`Plano_Alimentar_${patient?.name.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`);
  };
```

- [ ] **Step 4: Update `sendMealPlanByEmail`'s call site**

Change line 642 from `const doc = generateMealPlanPDF(plan, items, receitasEmail);` to:

```typescript
      const doc = generateMealPlanPDF(plan, items, patient.name, nutritionist, receitasEmail);
```

(`patient` and `nutritionist` are already in scope in this function — `patient` is checked non-null at line 626, `nutritionist` comes from the component's `useAuth()`.)

- [ ] **Step 5: `exportMealPlanPDF` needs no change**

It already calls `handleExportPDF(plan, items, receitasVinculadas)` (line 687), whose signature is unchanged — no edit needed here.

- [ ] **Step 6: Remove now-unused `jsPDF`/`autoTable`/`format` imports if no longer referenced**

Run: `grep -n "jsPDF\|autoTable\|format(" src/pages/PatientProfile.tsx | head -20` to check whether `jsPDF`, `autoTable` (lines 69-70) or `format` are still used elsewhere in the file (e.g. `format` is very likely still used for date formatting outside the PDF function — keep it if so). Remove only the imports that are now fully unused. `jsPDF` and `autoTable` (lines 69-70) were used exclusively by the deleted function — remove both import lines:

```typescript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
```

- [ ] **Step 7: Type-check**

Run: `npm run lint`
Expected: no errors, no unused-import warnings.

- [ ] **Step 8: Manual verification**

Run: `npm run dev`. On the "Planos Alimentares" tab, for an existing blocks-type plan, click each of: export/download PDF, "Enviar por E-mail" (check it doesn't throw — email sending itself may fail locally without SMTP config, but PDF generation must not throw before that point), and open from the consultation "Imprimir PDF" button. Compare the resulting PDF visually against a PDF generated before this change (structure should be byte-for-byte equivalent in layout, since the function body moved unchanged).
Expected: PDF content/layout identical to pre-change behavior for `type: 'blocks'` plans (this task is a pure move, no behavior change yet — Task 9 adds the free-mode branch).

- [ ] **Step 9: Run full test suite**

Run: `npm run test`
Expected: all tests pass (no test exercises this PDF code directly per current project convention, so this should be a no-op on test results — confirms nothing else broke).

- [ ] **Step 10: Commit**

```bash
git add src/pages/PatientProfile.tsx
git commit -m "refactor: PatientProfile usa generateMealPlanPDF de src/lib/meal-plan-pdf, remove duplicata"
```

---

### Task 9: `src/lib/meal-plan-pdf.ts` — branch PDF rendering for `type: 'free'`

**Files:**
- Modify: `src/lib/meal-plan-pdf.ts:82-224` (meal loop + household measures table)

**Interfaces:**
- Consumes: `MealPlan.type`, `MealPlan.freeTextContent` (Task 2).
- Produces: `generateMealPlanPDF` signature unchanged — same 5 params, same `jsPDF` return type. No other file needs new names from this task.

- [ ] **Step 1: Locate the branch point**

The function already computes `currentY` up through the water-intake block (lines 73-80, ending with `currentY = 95` or `102`). Immediately after that (currently line 82, `// Group items by meal`), insert the type branch. Everything from line 82 (`const mealsToDisplay = ...`) through line 223 (`currentY = (doc as any).lastAutoTable.finalY + 15;`, end of the household-measures table) is the "blocks" rendering — wrap it in an `if (plan.type !== 'free') { ... }` and add the `else` branch for free text.

- [ ] **Step 2: Wrap the existing blocks-rendering code**

Change line 82 from:

```typescript
  // Group items by meal
  const mealsToDisplay = plan.customMeals && plan.customMeals.length > 0 ? plan.customMeals : [];

  mealsToDisplay.forEach((meal) => {
```

to:

```typescript
  if (plan.type === 'free') {
    // Modo Livre: renderiza o texto colado como texto corrido, sem tabelas por bloco
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PLANO ALIMENTAR', 14, currentY);
    doc.line(14, currentY + 2, pageWidth - 14, currentY + 2);
    currentY += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const splitFreeText = doc.splitTextToSize(plan.freeTextContent || '', pageWidth - 28);
    for (const linha of splitFreeText) {
      if (currentY > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        currentY = 20;
      }
      doc.text(linha, 14, currentY);
      currentY += 5;
    }
    currentY += 10;
  } else {
    // Group items by meal
    const mealsToDisplay = plan.customMeals && plan.customMeals.length > 0 ? plan.customMeals : [];

    mealsToDisplay.forEach((meal) => {
```

- [ ] **Step 3: Close the `else` block after the household measures table, skip it and receitas entirely for free mode**

The household-measures table (lines ~185-223) and the meal-loop closing `});` both need adjusting. After the meal-loop's closing `});` (originally line 163), the code continues straight into "General Instructions" (line 166) — that part stays shared (both modes show `generalInstructions` per the design). Close the `else` block right after the meal loop's `});`:

```typescript
    });
  }
```

Then, the household-measures table (originally lines 185-223) and the "Receitas vinculadas" section (originally lines 225-325) must only render for `type !== 'free'`. Wrap both in a single condition. Find:

```typescript
  // Household Measurements Table
  if (currentY > doc.internal.pageSize.getHeight() - 80) {
```

and its matching end (the `currentY = (doc as any).lastAutoTable.finalY + 15;` right before `// Receitas vinculadas`), plus the entire `if (receitasVinculadas && receitasVinculadas.length > 0) { ... }` block — wrap the whole span from the household-measures comment through the end of the receitas block in:

```typescript
  if (plan.type !== 'free') {
    // Household Measurements Table
    if (currentY > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('EQUIVALÊNCIA DE MEDIDAS CASEIRAS', 14, currentY);
    currentY += 5;

    const householdMeasures = [
      ['1 copo americano', '200 ml'],
      ['1 xícara de chá', '200 ml'],
      ['1 copo de requeijão', '250 ml'],
      ['1 concha média', '100 g / 150 ml'],
      ['1 colher de sopa', '15 g / 15 ml'],
      ['1 colher de sobremesa', '10 g / 10 ml'],
      ['1 colher de chá', '5 g / 5 ml'],
      ['1 colher de café', '2.5 g / 2.5 ml'],
      ['1 escumadeira média', '60 g']
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Medida Caseira', 'Equivalência Aproximada']],
      body: householdMeasures,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { cellWidth: 60, halign: 'center' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Receitas vinculadas
    if (receitasVinculadas && receitasVinculadas.length > 0) {
      /* ... corpo inalterado ... */
    }
  }
```

(Keep the receitas block's internal body exactly as-is — only the wrapping `if (plan.type !== 'free') { ... }` is new. Since `receitasVinculadas` is never populated for `type: 'free'` plans per the design's "fora de escopo" decision, this condition is technically redundant with an empty array, but it's kept explicit per the spec and avoids rendering the (always-empty-for-free) household measures table, which doesn't apply to a free-text plan.)

- [ ] **Step 4: Type-check**

Run: `npm run lint`
Expected: no errors. Watch for the classic jsPDF gotcha already noted in comments in this file (`setFillColor`/`setDrawColor` must be called immediately before `rect`/`line` since `autoTable`/`addPage` reset color state) — the new free-text branch doesn't use `rect`/`line` with custom colors, so this isn't a concern here.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Create a free-text plan with some pasted content (multi-paragraph, to test page-break wrapping), save it, then export/download the PDF from the editor's print button. Confirm: header, patient/nutritionist info, water intake (if set) all render as before; the free text appears as wrapped paragraphs; no meal-block tables, no household-measures table, no receitas section appear. Then re-export a `blocks`-type plan's PDF and confirm it's unchanged from Task 8's baseline.
Expected: free-mode PDF shows header + patient info + water + free text + general instructions + signature/footer only; blocks-mode PDF unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/lib/meal-plan-pdf.ts
git commit -m "feat: generateMealPlanPDF renderiza freeTextContent para planos type=free"
```

---

### Task 10: "Visualizar" modal in `PatientProfile.tsx` — branch by `type`

**Files:**
- Modify: `src/pages/PatientProfile.tsx:2063-2206` (the non-`print:`-prefixed, screen-visible portion of the "Visualizar" modal — Nutritional Summary through Meal Sections)

**Interfaces:**
- Consumes: `MealPlan.type`, `MealPlan.freeTextContent` (Task 2); `selectedMealPlan` state (existing).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Locate the insertion point**

The screen-visible block to branch is lines 2063-2206 (from the `{/* Nutritional Summary */}` comment through the closing of the `{/* Meal Sections */}` `<div className="space-y-8">`). The `print:`-prefixed blocks above and below this range (lines 1896-2061, and the hidden print container starting at 2258) are dead code per the spec addendum — leave them untouched.

- [ ] **Step 2: Wrap the screen-visible content in a type branch**

Replace the opening of this section — find:

```tsx
                {/* Nutritional Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
```

Change the whole span (lines 2063 through 2206, ending at the Meal Sections closing `</div>`) to be conditional. Wrap it:

```tsx
                {selectedMealPlan?.type === 'free' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-none shadow-sm bg-card overflow-hidden p-6 space-y-4 h-full">
                        <div className="flex items-center gap-3 text-primary mb-2">
                          <div className="p-2 rounded-xl bg-primary/10">
                            <Droplets className="w-5 h-5" />
                          </div>
                          <h4 className="font-medium text-xs">Meta de Água</h4>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Quantidade Diária</p>
                          <p className="text-lg font-bold text-foreground">{selectedMealPlan?.waterIntake || 'Não informada'}</p>
                        </div>
                      </Card>
                      <Card className="border-none shadow-sm bg-card overflow-hidden p-6 space-y-4 h-full">
                        <div className="flex items-center gap-3 text-primary mb-2">
                          <div className="p-2 rounded-xl bg-primary/10">
                            <Activity className="w-5 h-5" />
                          </div>
                          <h4 className="font-medium text-xs">Orientações Gerais</h4>
                        </div>
                        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {selectedMealPlan?.generalInstructions || 'Nenhuma orientação cadastrada.'}
                        </div>
                      </Card>
                    </div>
                    <Card className="border-none shadow-sm bg-card overflow-hidden p-6 space-y-3">
                      <h4 className="font-medium text-xs text-primary">Plano Alimentar</h4>
                      <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-mono">
                        {(selectedMealPlan as any)?.freeTextContent || 'Nenhum conteúdo cadastrado.'}
                      </div>
                    </Card>
                  </div>
                ) : (
                  <>
                    {/* Nutritional Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
                      <SummaryCard label="Calorias" value={viewMealTotals.kcal} unit="kcal" icon={Activity} color="bg-primary/10 text-primary" progressColor="bg-primary" />
                      <SummaryCard label="Proteínas" value={viewMealTotals.protein} unit="g" icon={Dna} color="bg-primary/10 text-primary" progressColor="bg-primary" />
                      <SummaryCard label="Carboidratos" value={viewMealTotals.carbs} unit="g" icon={Zap} color="bg-primary/10 text-primary" progressColor="bg-primary" />
                      <SummaryCard label="Gorduras" value={viewMealTotals.fat} unit="g" icon={Droplets} color="bg-muted text-muted-foreground" progressColor="bg-muted-foreground" />
                    </div>

                    {/* Water Intake & General Instructions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
                      <div>
                        <Card className="border-none shadow-sm bg-card overflow-hidden p-6 space-y-4 h-full">
                          <div className="flex items-center gap-3 text-primary mb-2">
                            <div className="p-2 rounded-xl bg-primary/10">
                              <Droplets className="w-5 h-5" />
                            </div>
                            <h4 className="font-medium text-xs">Meta de Água</h4>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Quantidade Diária</p>
                            <p className="text-lg font-bold text-foreground">{selectedMealPlan?.waterIntake || 'Não informada'}</p>
                          </div>
                        </Card>
                      </div>
                      <div>
                        <Card className="border-none shadow-sm bg-card overflow-hidden p-6 space-y-4 h-full">
                          <div className="flex items-center gap-3 text-primary mb-2">
                            <div className="p-2 rounded-xl bg-primary/10">
                              <Activity className="w-5 h-5" />
                            </div>
                            <h4 className="font-medium text-xs">Orientações Gerais</h4>
                          </div>
                          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {selectedMealPlan?.generalInstructions || 'Nenhuma orientação cadastrada.'}
                          </div>
                        </Card>
                      </div>
                    </div>

                    {/* Meal Sections */}
                    <div className="space-y-8">
                      {(selectedMealPlan?.customMeals && selectedMealPlan.customMeals.length > 0
                        ? selectedMealPlan.customMeals
                        : defaultMealTypes).map((meal) => {
                          /* ... corpo inalterado (linhas originais 2110-2204) ... */
                        })}
                    </div>
                  </>
                )}
```

(The `/* ... corpo inalterado ... */` placeholder marks the untouched `.map((meal) => {...})` body from the original file — copy it verbatim from the current source, no changes inside it.)

- [ ] **Step 3: Type-check**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Open "Visualizar" on a free-text plan from the "Planos Alimentares" tab. Confirm it shows water intake + orientações gerais + the pasted free text (no meal cards, no macro summary cards). Then open "Visualizar" on a blocks-type plan and confirm it's unchanged (macro summary, water/instructions cards, meal cards all still render).
Expected: free plan shows the 3-card layout described; blocks plan renders exactly as before.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PatientProfile.tsx
git commit -m "feat: modal Visualizar exibe freeTextContent para planos type=free"
```

---

### Task 11: End-to-end verification pass

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Full type check**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `npm run test`
Expected: all suites pass, including the 4 new tests from Task 3.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Full manual walkthrough**

Run: `npm run dev`, and in the browser:
1. Open a patient with no meal-plan history → "Criar Plano" → confirm modal opens (not skipped) → choose "Livre" → fill fields → save → confirm redirect to edit URL with content persisted on reload.
2. Same patient, new consultation → "Criar Plano" → now with history → confirm modal shows copy list AND both type buttons → choose "Por Refeição" → confirm existing block editor behavior fully intact (add meals, add items, save, print).
3. Copy an existing free-text plan via the modal's copy flow → confirm the new plan opens as free-text with the same content.
4. For the free-text plan: export PDF, send by email (verify no exception even if SMTP isn't configured locally — the PDF generation step itself must not throw), open "Visualizar".
5. For a blocks plan: repeat export/email/Visualizar and confirm pixel-equivalent output to pre-change behavior.

Expected: all flows work; no console errors; PDFs open correctly in a PDF viewer.

- [ ] **Step 5: Final commit (only if Step 4 surfaced fixes)**

If manual verification required any fixes, commit them individually per the fix (not batched) following the same message conventions as above.
