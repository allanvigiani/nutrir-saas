# Grace Period + Somente Leitura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Sem commits** — o usuário não quer commits neste ciclo.

**Goal:** Quando um nutricionista que tinha premium faz downgrade para free e tem mais de 2 pacientes, recebe 30 dias de grace period com acesso total; após esse prazo, pacientes excedentes ficam em somente leitura até que o usuário faça upgrade.

**Architecture:** Um campo `gracePeriodEndAt` no Nutritionist armazena o prazo. O middleware `authenticate` lê esse campo e expõe `req.user.gracePeriodEndAt`. Os services computam `gracePeriodOver` e enriquecem a lista de pacientes com `isReadOnly: boolean` (os 2 criados mais recentemente ficam acessíveis, o restante vira somente leitura). O frontend lê o campo `isReadOnly` e exibe banner de grace period + badge + desabilita ações de escrita.

**Tech Stack:** Express, Prisma (PostgreSQL), React, shadcn/ui, Vitest

---

## File Map

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Adicionar `gracePeriodEndAt DateTime?` ao model Nutritionist |
| `prisma/migrations/...` | Migration gerada por `prisma migrate dev` |
| `src/server/services/subscription.service.ts` | Setar gracePeriodEndAt no downgrade; limpar no upgrade |
| `src/server/middlewares/auth.ts` | Adicionar `gracePeriodEndAt` ao select e ao `req.user` |
| `src/server/services/patients.service.ts` | `list()` enriquece pacientes com `isReadOnly`; writes bloqueiam se read-only |
| `src/server/services/consultations.service.ts` | Verificar `isReadOnly` antes de criar consulta |
| `src/server/services/meal-plans.service.ts` | Verificar `isReadOnly` antes de criar plano alimentar |
| `src/server/services/lab-exams.service.ts` | Verificar `isReadOnly` antes de criar exame |
| `src/server/routes/patients.routes.ts` | Passar `gracePeriodOver` ao service |
| `src/server/routes/consultations.routes.ts` | Passar `gracePeriodOver` ao service |
| `src/server/routes/meal-plans.routes.ts` | Passar `gracePeriodOver` ao service |
| `src/server/routes/lab-exams.routes.ts` | Passar `gracePeriodOver` ao service |
| `src/types.ts` | Adicionar `gracePeriodEndAt?` ao Nutritionist; `isReadOnly?` ao Patient |
| `src/pages/Patients.tsx` | Banner de grace period com countdown + badge somente leitura |
| `src/pages/PatientProfile.tsx` | Banner + desabilitar writes para pacientes somente leitura |
| `src/tests/services/patients.service.test.ts` | Testes de gracePeriodOver e isReadOnly |

---

## Task 1: Migration — campo `gracePeriodEndAt`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via `prisma migrate dev`

- [ ] **Step 1: Adicionar campo ao schema**

Em `prisma/schema.prisma`, dentro de `model Nutritionist { ... }`, após `planOverridedByAdmin`:

```prisma
gracePeriodEndAt        DateTime?
```

- [ ] **Step 2: Rodar migration**

```bash
cd /home/allan/nutrir-saas && npx prisma migrate dev --name add_grace_period_end 2>&1 | tail -8
```

Expected: migration criada e aplicada.

- [ ] **Step 3: Verificar lint**

```bash
npm run lint 2>&1 | tail -5
```

---

## Task 2: `subscription.service.ts` — setar gracePeriodEndAt no downgrade

**Files:**
- Modify: `src/server/services/subscription.service.ts`

Quando o plano muda de `premium` → `free`, seta `gracePeriodEndAt = agora + 30 dias` no Nutritionist (apenas se ainda não tiver um gracePeriodEndAt definido). Quando muda de volta para `premium`, limpa o campo.

- [ ] **Step 1: Ler o arquivo atual**

```bash
cat /home/allan/nutrir-saas/src/server/services/subscription.service.ts
```

- [ ] **Step 2: Substituir o bloco de sincronização do plano no `upsert()`**

Localize o bloco:
```ts
    // Keep Nutritionist.plan in sync if plan changed — mas não sobrescreve plano definido manualmente pelo admin
    if (data.plan) {
      const nutritionistData = await getDb().nutritionist.findUnique({
        where: { id: nutritionistId },
        select: { planOverridedByAdmin: true },
      });
      if (!nutritionistData?.planOverridedByAdmin) {
        await getDb().nutritionist.update({
          where: { id: nutritionistId },
          data: { plan: data.plan },
        });
      }
    }
```

Substitua por:

```ts
    // Keep Nutritionist.plan in sync if plan changed
    if (data.plan) {
      const nutritionistData = await getDb().nutritionist.findUnique({
        where: { id: nutritionistId },
        select: { plan: true, planOverridedByAdmin: true, gracePeriodEndAt: true },
      });

      if (!nutritionistData?.planOverridedByAdmin) {
        const updateData: any = { plan: data.plan };

        if (data.plan === 'free' && nutritionistData?.plan === 'premium') {
          // Downgrade: setar grace period apenas se não houver um em andamento
          if (!nutritionistData.gracePeriodEndAt) {
            const gracePeriodEnd = new Date();
            gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);
            updateData.gracePeriodEndAt = gracePeriodEnd;
          }
        } else if (data.plan === 'premium') {
          // Upgrade: limpar grace period
          updateData.gracePeriodEndAt = null;
        }

        await getDb().nutritionist.update({
          where: { id: nutritionistId },
          data: updateData,
        });
      }
    }
```

- [ ] **Step 3: Lint**

```bash
npm run lint 2>&1 | tail -5
```

---

## Task 3: `authenticate` middleware — expor `gracePeriodEndAt`

**Files:**
- Modify: `src/server/middlewares/auth.ts`

Adicionar `gracePeriodEndAt` ao select do Nutritionist e ao `req.user`.

- [ ] **Step 1: Ler o arquivo**

```bash
cat /home/allan/nutrir-saas/src/server/middlewares/auth.ts
```

- [ ] **Step 2: Atualizar o select e os campos de `req.user`**

Localize:
```ts
      const nutritionist = await withAdminRLS(() =>
        getDb().nutritionist.findUnique({
          where: { id: decodedToken.uid },
          select: { role: true, plan: true },
        })
      );

      req.user.dbRole = nutritionist?.role ?? "nutritionist";
      req.user.dbPlan = nutritionist?.plan ?? "free";
      req.user.isAdmin = req.user.dbRole === "admin";
      req.user.isPremium = req.user.isAdmin || req.user.dbPlan === "premium";
```

Substitua por:

```ts
      const nutritionist = await withAdminRLS(() =>
        getDb().nutritionist.findUnique({
          where: { id: decodedToken.uid },
          select: { role: true, plan: true, gracePeriodEndAt: true },
        })
      );

      req.user.dbRole = nutritionist?.role ?? "nutritionist";
      req.user.dbPlan = nutritionist?.plan ?? "free";
      req.user.isAdmin = req.user.dbRole === "admin";
      req.user.isPremium = req.user.isAdmin || req.user.dbPlan === "premium";
      req.user.gracePeriodEndAt = nutritionist?.gracePeriodEndAt ?? null;
```

- [ ] **Step 3: Lint**

```bash
npm run lint 2>&1 | tail -5
```

---

## Task 4: `patients.service.ts` — isReadOnly e bloqueio de escrita

**Files:**
- Modify: `src/server/services/patients.service.ts`
- Modify: `src/tests/services/patients.service.test.ts` (se existir) ou criar

A função `list()` recebe `gracePeriodOver: boolean` e enriquece cada paciente com `isReadOnly`. Uma função auxiliar `checkPatientReadOnly()` é usada pelas operações de escrita.

- [ ] **Step 1: Escrever testes**

Leia `src/tests/services/patients.service.test.ts` (se existir). Adicione ao final:

```ts
// Se o arquivo não existir, criar com:
// import { describe, it, expect, vi, beforeEach } from 'vitest';
// ... (seguir padrão dos outros arquivos de test de service)

describe('PatientsService — grace period e isReadOnly', () => {
  // mock do getDb padrão do projeto já deve estar configurado no arquivo

  it('list() sem gracePeriodOver retorna pacientes sem isReadOnly', async () => {
    // Assumindo mock de getDb que retorna 3 pacientes
    const mockPatients = [
      { id: 'p1', createdAt: new Date('2026-01-03') },
      { id: 'p2', createdAt: new Date('2026-01-02') },
      { id: 'p3', createdAt: new Date('2026-01-01') },
    ];
    // setup mock findMany → mockPatients
    // ...
    const service = createPatientsService();
    const result = await service.list('n1', false);
    expect(result.every((p: any) => !p.isReadOnly)).toBe(true);
  });

  it('list() com gracePeriodOver marca os pacientes excedentes como isReadOnly', async () => {
    const mockPatients = [
      { id: 'p1', createdAt: new Date('2026-01-03') }, // mais recente — ativo
      { id: 'p2', createdAt: new Date('2026-01-02') }, // segundo mais recente — ativo
      { id: 'p3', createdAt: new Date('2026-01-01') }, // mais antigo — read-only
    ];
    // setup mock findMany → mockPatients (já ordenados por createdAt desc)
    // ...
    const service = createPatientsService();
    const result = await service.list('n1', true);
    expect(result[0].isReadOnly).toBe(false); // p1
    expect(result[1].isReadOnly).toBe(false); // p2
    expect(result[2].isReadOnly).toBe(true);  // p3
  });
});
```

**Nota:** Adapte o mock ao padrão de `vi.mock` já usado nos outros testes de service do projeto (`src/tests/services/admin.service.test.ts` como referência).

- [ ] **Step 2: Rodar para confirmar FAIL**

```bash
npm run test -- src/tests/services/patients.service.test.ts --reporter=verbose 2>&1 | tail -10
```

- [ ] **Step 3: Atualizar `patients.service.ts`**

Substitua o arquivo inteiro por:

```ts
import { getDb } from '../lib/rls-context.ts';
import { FREE_PLAN_LIMITS } from '../../lib/planLimits.ts';

export function createPatientsService() {
  async function list(nutritionistId: string, gracePeriodOver: boolean) {
    const patients = await getDb().patient.findMany({
      where: { nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!gracePeriodOver) return patients;

    return patients.map((p, index) => ({
      ...p,
      isReadOnly: index >= FREE_PLAN_LIMITS.maxPatients,
    }));
  }

  async function getOne(nutritionistId: string, id: string) {
    const patient = await getDb().patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!patient) throw new Error('Paciente não encontrado');
    return patient;
  }

  async function isPatientReadOnly(nutritionistId: string, patientId: string, gracePeriodOver: boolean): Promise<boolean> {
    if (!gracePeriodOver) return false;
    const activePatients = await getDb().patient.findMany({
      where: { nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
      take: FREE_PLAN_LIMITS.maxPatients,
    });
    return !activePatients.some(p => p.id === patientId);
  }

  async function create(nutritionistId: string, data: Record<string, unknown>, isPremium: boolean) {
    if (!isPremium) {
      const count = await getDb().patient.count({
        where: { nutritionistId, deletedAt: null },
      });
      if (count >= FREE_PLAN_LIMITS.maxPatients) {
        throw new Error(`Limite de ${FREE_PLAN_LIMITS.maxPatients} pacientes atingido no plano gratuito.`);
      }
    }
    return getDb().patient.create({ data: { ...(data as any), nutritionistId } });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>, _isPremium: boolean) {
    const existing = await getDb().patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().patient.update({ where: { id }, data: data as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().patient.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, getOne, create, update, remove, isPatientReadOnly };
}
```

- [ ] **Step 4: Rodar testes**

```bash
npm run test -- src/tests/services/patients.service.test.ts --reporter=verbose 2>&1 | tail -10
```

- [ ] **Step 5: Lint**

```bash
npm run lint 2>&1 | tail -5
```

---

## Task 5: Rotas — passar `gracePeriodOver` aos services

**Files:**
- Modify: `src/server/routes/patients.routes.ts`
- Modify: `src/server/routes/consultations.routes.ts`
- Modify: `src/server/routes/meal-plans.routes.ts`
- Modify: `src/server/routes/lab-exams.routes.ts`

Helper a usar em todas as rotas:

```ts
function computeGracePeriodOver(req: any): boolean {
  if (req.user.isPremium) return false;
  const end = req.user.gracePeriodEndAt;
  return end !== null && end < new Date();
}
```

- [ ] **Step 1: Atualizar `patients.routes.ts`**

Leia o arquivo. No handler `GET /api/patients`, passe `gracePeriodOver`:

```ts
// Adicionar helper no topo do arquivo (dentro da função registerPatientsRoutes):
function computeGracePeriodOver(req: any): boolean {
  if (req.user.isPremium) return false;
  const end = req.user.gracePeriodEndAt;
  return end !== null && end < new Date();
}

// Handler GET /api/patients:
res.json(await service.list(req.user.uid, computeGracePeriodOver(req)));
```

- [ ] **Step 2: Atualizar `consultations.routes.ts`**

No handler `POST /api/patients/:patientId/consultations`, adicionar checagem de read-only antes de criar:

```ts
// Dentro do withNutritionistRLS:
const patientsService = createPatientsService();
const gracePeriodOver = computeGracePeriodOver(req);
const readOnly = await patientsService.isPatientReadOnly(req.user.uid, req.params.patientId, gracePeriodOver);
if (readOnly) {
  return res.status(403).json({ error: 'Este paciente está em somente leitura. Faça upgrade para o plano Premium para retomar o acesso.' });
}
// ... continuar com service.create(...)
```

Adicionar import: `import { createPatientsService } from '../services/patients.service.ts';`

E o helper `computeGracePeriodOver` igual ao de `patients.routes.ts`.

- [ ] **Step 3: Atualizar `meal-plans.routes.ts`**

Mesma lógica no `POST /api/patients/:patientId/meal-plans`:

```ts
import { createPatientsService } from '../services/patients.service.ts';

// helper computeGracePeriodOver igual

// No handler POST:
const patientsService = createPatientsService();
const gracePeriodOver = computeGracePeriodOver(req);
const readOnly = await patientsService.isPatientReadOnly(req.user.uid, req.params.patientId, gracePeriodOver);
if (readOnly) {
  return res.status(403).json({ error: 'Este paciente está em somente leitura. Faça upgrade para o plano Premium para retomar o acesso.' });
}
```

- [ ] **Step 4: Atualizar `lab-exams.routes.ts`**

Mesma lógica no `POST /api/patients/:patientId/lab-exams`.

- [ ] **Step 5: Lint**

```bash
npm run lint 2>&1 | tail -5
```

---

## Task 6: `src/types.ts` — campos novos

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Adicionar `gracePeriodEndAt` ao Nutritionist e `isReadOnly` ao Patient**

Leia o arquivo. Na interface `Nutritionist`, adicionar:
```ts
gracePeriodEndAt?: string | null;
```

Na interface `Patient`, adicionar:
```ts
isReadOnly?: boolean;
```

- [ ] **Step 2: Lint**

```bash
npm run lint 2>&1 | tail -5
```

---

## Task 7: Frontend — `Patients.tsx` — banner de grace period + badge somente leitura

**Files:**
- Modify: `src/pages/Patients.tsx`

- [ ] **Step 1: Importar `differenceInDays` e `parseISO` se ainda não importados**

Verifique os imports de `date-fns`. Se `differenceInDays` não estiver lá, adicione.

- [ ] **Step 2: Computar estado de grace period**

Dentro do componente `Patients`, após `const isPremium = ...`:

```tsx
const gracePeriodEndAt = nutritionist?.gracePeriodEndAt
  ? new Date(nutritionist.gracePeriodEndAt)
  : null;
const now = new Date();
const isInGracePeriod = !isPremium && gracePeriodEndAt !== null && gracePeriodEndAt > now;
const isGracePeriodOver = !isPremium && gracePeriodEndAt !== null && gracePeriodEndAt <= now;
const gracePeriodDaysLeft = gracePeriodEndAt && isInGracePeriod
  ? differenceInDays(gracePeriodEndAt, now)
  : 0;
```

- [ ] **Step 3: Adicionar banner de grace period**

No JSX, logo após `<div className="space-y-8">` (início do return), adicionar antes dos outros elementos:

```tsx
{isInGracePeriod && (
  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
    <div className="text-sm">
      <p className="font-bold text-amber-800 dark:text-amber-300">Período de transição ativo</p>
      <p className="text-amber-700 dark:text-amber-400 mt-0.5">
        Você mudou para o plano gratuito. Todos os seus pacientes estão acessíveis por mais{' '}
        <strong>{gracePeriodDaysLeft} {gracePeriodDaysLeft === 1 ? 'dia' : 'dias'}</strong>.
        Após esse prazo, pacientes além do limite de {FREE_PLAN_LIMITS.maxPatients} ficarão em somente leitura.
        <a href="/settings" className="ml-1 underline font-medium">Reativar Premium</a>
      </p>
    </div>
  </div>
)}

{isGracePeriodOver && patients.length > FREE_PLAN_LIMITS.maxPatients && (
  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
    <div className="text-sm">
      <p className="font-bold text-red-800 dark:text-red-300">Limite do plano gratuito atingido</p>
      <p className="text-red-700 dark:text-red-400 mt-0.5">
        {patients.length - FREE_PLAN_LIMITS.maxPatients} paciente(s) estão em somente leitura.
        Faça <a href="/settings" className="underline font-medium">upgrade para Premium</a> para recuperar o acesso completo.
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 4: Adicionar badge "Somente leitura" no card do paciente**

No card de cada paciente, após o nome e CPF, adicionar o badge condicionalmente:

```tsx
{(patient as any).isReadOnly && (
  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
    Somente leitura
  </span>
)}
```

- [ ] **Step 5: Desabilitar botão "Ver Prontuário" com tooltip para leitura (não bloquear — prontuário é read-only mas visível)**

O botão "Ver Prontuário" deve continuar funcionando (o perfil abre mas os writes são bloqueados). Sem mudança aqui — o ProfilePage lida com isso na Task 8.

- [ ] **Step 6: Lint**

```bash
npm run lint 2>&1 | tail -5
```

---

## Task 8: Frontend — `PatientProfile.tsx` — banner + writes desabilitados para read-only

**Files:**
- Modify: `src/pages/PatientProfile.tsx`

- [ ] **Step 1: Computar `isPatientReadOnly` no componente**

Após as declarações de estado existentes, adicionar:

```tsx
const isPatientReadOnly = !!(patient as any)?.isReadOnly;
```

**Nota:** `patient` é carregado via fetch na página. O campo `isReadOnly` vem da resposta de `GET /api/patients/:id`. Verifique se o endpoint `getOne` também precisa enriquecer com `isReadOnly` — se não, o campo pode não chegar aqui. Alternativa: computar no frontend com base em `nutritionist.gracePeriodEndAt` e a posição do paciente.

Implementação alternativa mais simples (não depende do `getOne` retornar `isReadOnly`):

```tsx
const gracePeriodEndAt = nutritionist?.gracePeriodEndAt
  ? new Date(nutritionist.gracePeriodEndAt)
  : null;
const gracePeriodOver = !isPremium && gracePeriodEndAt !== null && gracePeriodEndAt <= new Date();
// isReadOnly é passado via state de navegação ou calculado com base na posição do paciente
// Usar o valor que veio do patients list se disponível via location.state,
// ou verificar se o patient está entre os 2 mais recentes via API separada.
// Abordagem simples: usar o campo vindo do GET /api/patients/:id (enriquecer getOne no backend)
const isPatientReadOnly = !!(patient as any)?.isReadOnly;
```

**Ação adicional necessária no backend** (ainda nesta task): em `patients.routes.ts`, no `GET /api/patients/:id`, enriquecer o resultado com `isReadOnly`:

```ts
deps.app.get('/api/patients/:id', deps.authenticate, async (req: any, res: any) => {
  try {
    await withNutritionistRLS(req.user.uid, async () => {
      const patient = await service.getOne(req.user.uid, req.params.id);
      const gracePeriodOver = computeGracePeriodOver(req);
      const readOnly = await service.isPatientReadOnly(req.user.uid, req.params.id, gracePeriodOver);
      res.json({ ...patient, isReadOnly: readOnly });
    });
  } catch (err: any) {
    return res.status(404).json({ error: err.message });
  }
});
```

- [ ] **Step 2: Adicionar banner de somente leitura no topo do perfil**

Logo após `<div className="space-y-8">` no return do PatientProfile:

```tsx
{isPatientReadOnly && (
  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
    <div className="text-sm">
      <p className="font-bold text-amber-800 dark:text-amber-300">Paciente em somente leitura</p>
      <p className="text-amber-700 dark:text-amber-400 mt-0.5">
        Este paciente excede o limite do plano gratuito. Você pode visualizar o histórico, mas novas consultas, planos e exames estão bloqueados.{' '}
        <a href="/settings" className="underline font-medium">Fazer upgrade</a>
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 3: Desabilitar botão "Nova Consulta" quando isReadOnly**

Localize o botão de "Nova Consulta" e adicione `|| isPatientReadOnly` na condição `disabled`:

```tsx
disabled={isPatientReadOnly || (!isPremium && (limitsLoading || !canAddConsultation || patientAlreadyHasConsultationThisMonth))}
```

- [ ] **Step 4: Desabilitar botões de criar plano alimentar e exame**

Localize os botões de "Novo Plano" e "Novo Exame" e adicione `disabled={isPatientReadOnly}` em cada um.

- [ ] **Step 5: Lint**

```bash
npm run lint 2>&1 | tail -5
```

---

## Task 9: Verificação final

- [ ] **Step 1: Rodar todos os testes**

```bash
npm run test 2>&1 | tail -15
```

Expected: todos passando.

- [ ] **Step 2: Lint final**

```bash
npm run lint 2>&1 | tail -5
```

---

## Self-Review

**Cobertura do spec:**
- ✅ Campo `gracePeriodEndAt` no DB (Task 1)
- ✅ Setado no downgrade premium → free (Task 2)
- ✅ Limpo no upgrade free → premium (Task 2)
- ✅ Exposto via `req.user` (Task 3)
- ✅ Pacientes enriquecidos com `isReadOnly` (Task 4)
- ✅ Writes bloqueados no backend (Task 5)
- ✅ Types atualizados (Task 6)
- ✅ Banner de grace period com countdown (Task 7)
- ✅ Badge "Somente leitura" nos cards (Task 7)
- ✅ Banner + writes desabilitados no perfil (Task 8)
- ✅ `GET /api/patients/:id` enriquece com `isReadOnly` (Task 8)

**Regra de read-only:** os `FREE_PLAN_LIMITS.maxPatients` (2) pacientes com `createdAt` mais recente ficam acessíveis; os demais ficam somente leitura. Isso é determinístico, sem necessidade de escolha manual do usuário nesta versão.

**Sem commits** — conforme instrução do usuário.
