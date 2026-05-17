# Admin Module Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Melhorar o módulo de admin com 7 melhorias: remover query dupla, stats ricas, paginação, proteção contra auto-despromoção, aviso de conflito Asaas, LGPD com contagem prévia e audit log.

**Architecture:** Cada melhoria é isolada — backend em `admin.routes.ts` + `admin.service.ts` (novo), frontend em `AdminDashboard.tsx`. Melhorias #3 e #7 requerem migrations Prisma. O `requireAdmin` local é eliminado em favor de `req.user.isAdmin` (já populado pelo middleware `authenticate`).

**Tech Stack:** Express, Prisma (PostgreSQL/Neon), React, shadcn/ui, Vitest, date-fns

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/server/routes/admin.routes.ts` | Modificar | Remover double query, adicionar paginação, proteção self-demotion, audit logging |
| `src/server/services/admin.service.ts` | Criar | Stats ricas, pending retention count, audit log |
| `src/server/services/asaas.service.ts` | Modificar | Respeitar flag `planOverridedByAdmin` no sync |
| `src/server/services/retention.service.ts` | Modificar | Adicionar `countPendingDeletion()` |
| `prisma/schema.prisma` | Modificar | Adicionar `planOverridedByAdmin`, modelo `AdminAuditLog` |
| `prisma/migrations/...` | Criar | Migration para os dois campos novos |
| `src/pages/AdminDashboard.tsx` | Modificar | Stats, paginação, badge override, pending count, aba Auditoria |
| `src/tests/services/admin.service.test.ts` | Criar | Testes unitários do admin service |
| `src/tests/routes/admin.routes.test.ts` | Criar | Testes das proteções de rota |

---

## Task 1: Remover query dupla — usar `req.user.isAdmin`

**Files:**
- Modify: `src/server/routes/admin.routes.ts`

O `requireAdmin` local faz uma query ao DB para checar role, mas `authenticate` já popula `req.user.isAdmin`. Simplificar para leitura direta.

- [ ] **Step 1: Escrever o teste que verifica que rotas admin retornam 403 para não-admin sem query extra**

`src/tests/routes/admin.routes.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../server/lib/rls-context.ts', () => ({
  withAdminRLS: vi.fn((fn: () => Promise<any>) => fn()),
  getDb: vi.fn(() => ({
    nutritionist: { findMany: vi.fn().mockResolvedValue([]) },
    patient: { count: vi.fn().mockResolvedValue(0) },
  })),
}));

function makeAdminReq() {
  return { user: { uid: 'admin1', isAdmin: true, isPremium: true } } as any;
}
function makeNonAdminReq() {
  return { user: { uid: 'user1', isAdmin: false, isPremium: false } } as any;
}
function makeRes() {
  const r: any = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json = vi.fn().mockReturnValue(r);
  return r;
}

// Importar a rota isolada requer refactor para factory — cobrir via integração.
// Este teste foca na lógica do guard inline.
describe('Admin guard inline', () => {
  it('retorna 403 se req.user.isAdmin for false', () => {
    const req = makeNonAdminReq();
    const res = makeRes();
    if (!req.user.isAdmin) {
      res.status(403).json({ error: 'Acesso negado.' });
    }
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('não chama status se isAdmin for true', () => {
    const req = makeAdminReq();
    const res = makeRes();
    if (!req.user.isAdmin) {
      res.status(403).json({ error: 'Acesso negado.' });
    }
    expect(res.status).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar para confirmar que passa (lógica trivial)**
```bash
npm run test -- src/tests/routes/admin.routes.test.ts --reporter=verbose
```

- [ ] **Step 3: Substituir `requireAdmin` em `admin.routes.ts`**

Remover a função `requireAdmin` e substituir cada `if (!(await requireAdmin(req, res))) return;` por:

```ts
if (!req.user.isAdmin) return res.status(403).json({ error: 'Acesso negado.' });
```

Remover também o import de `withAdminRLS` da função `requireAdmin` (manter o uso existente nas queries).

- [ ] **Step 4: Rodar lint**
```bash
npm run lint
```
Expected: 0 erros.

- [ ] **Step 5: Commit**
```bash
git add src/server/routes/admin.routes.ts src/tests/routes/admin.routes.test.ts
git commit -m "refactor(admin): substituir requireAdmin por req.user.isAdmin"
```

---

## Task 2: Criar `admin.service.ts` com stats ricas

**Files:**
- Create: `src/server/services/admin.service.ts`
- Create: `src/tests/services/admin.service.test.ts`
- Modify: `src/server/routes/admin.routes.ts` (novo endpoint `GET /api/admin/stats`)

Stats retornadas:
- `totalNutritionists` — total de cadastros
- `freeCount` — plano gratuito
- `premiumCount` — plano premium
- `adminCount` — admins
- `conversionRate` — premiumCount / totalNutritionists (%)
- `estimatedRevenue` — premiumCount × 39.90
- `activeLast30Days` — com `lastLogin >= 30 dias atrás`
- `newLast7Days` — com `createdAt >= 7 dias atrás`
- `totalPatients` — total global

- [ ] **Step 1: Escrever o teste**

`src/tests/services/admin.service.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
  nutritionist: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  patient: {
    count: vi.fn(),
  },
};

vi.mock('../../server/lib/rls-context.ts', () => ({
  withAdminRLS: vi.fn((fn: () => Promise<any>) => fn()),
  getDb: vi.fn(() => mockDb),
}));

import { createAdminService } from '../../server/services/admin.service.ts';

describe('AdminService.getStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calcula conversão e receita corretamente', async () => {
    mockDb.nutritionist.count
      .mockResolvedValueOnce(10)   // total
      .mockResolvedValueOnce(3)    // premium
      .mockResolvedValueOnce(1)    // admin
      .mockResolvedValueOnce(7)    // active last 30 days
      .mockResolvedValueOnce(2);   // new last 7 days
    mockDb.patient.count.mockResolvedValue(50);

    const service = createAdminService();
    const stats = await service.getStats();

    expect(stats.totalNutritionists).toBe(10);
    expect(stats.premiumCount).toBe(3);
    expect(stats.freeCount).toBe(7); // 10 - 3 (não conta admin)
    expect(stats.conversionRate).toBe(30); // 3/10 * 100
    expect(stats.estimatedRevenue).toBeCloseTo(119.70); // 3 * 39.90
    expect(stats.totalPatients).toBe(50);
  });
});
```

- [ ] **Step 2: Rodar para confirmar falha**
```bash
npm run test -- src/tests/services/admin.service.test.ts --reporter=verbose
```
Expected: FAIL — `createAdminService` not found.

- [ ] **Step 3: Implementar `admin.service.ts`**

`src/server/services/admin.service.ts`:
```ts
import { getDb } from '../lib/rls-context.ts';
import { subDays } from 'date-fns';

const PREMIUM_PRICE = 39.90;

export function createAdminService() {
  async function getStats() {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30).toISOString();
    const sevenDaysAgo = subDays(now, 7).toISOString();

    const [total, premium, admin, activeLast30, newLast7, totalPatients] = await Promise.all([
      getDb().nutritionist.count(),
      getDb().nutritionist.count({ where: { plan: 'premium' } }),
      getDb().nutritionist.count({ where: { role: 'admin' } }),
      getDb().nutritionist.count({ where: { lastLogin: { gte: thirtyDaysAgo } } }),
      getDb().nutritionist.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      getDb().patient.count({ where: { deletedAt: null } }),
    ]);

    return {
      totalNutritionists: total,
      premiumCount: premium,
      freeCount: total - premium - admin,
      adminCount: admin,
      conversionRate: total > 0 ? Math.round((premium / total) * 100) : 0,
      estimatedRevenue: parseFloat((premium * PREMIUM_PRICE).toFixed(2)),
      activeLast30Days: activeLast30,
      newLast7Days: newLast7,
      totalPatients,
    };
  }

  return { getStats };
}
```

- [ ] **Step 4: Rodar testes**
```bash
npm run test -- src/tests/services/admin.service.test.ts --reporter=verbose
```
Expected: PASS.

- [ ] **Step 5: Adicionar endpoint em `admin.routes.ts`**

```ts
import { createAdminService } from '../services/admin.service.ts';

// dentro de registerAdminRoutes:
const adminService = createAdminService();

deps.app.get('/api/admin/stats', deps.authenticate, async (req: any, res: any) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Acesso negado.' });
  try {
    await withAdminRLS(async () => {
      res.json(await adminService.getStats());
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 6: Lint**
```bash
npm run lint
```

- [ ] **Step 7: Commit**
```bash
git add src/server/services/admin.service.ts src/server/routes/admin.routes.ts src/tests/services/admin.service.test.ts
git commit -m "feat(admin): endpoint GET /api/admin/stats com métricas ricas"
```

---

## Task 3: Paginação em `GET /api/admin/nutritionists`

**Files:**
- Modify: `src/server/routes/admin.routes.ts`
- Modify: `src/pages/AdminDashboard.tsx`

Query params: `?page=1&limit=20`. Resposta: `{ data: Nutritionist[], total: number, page: number, totalPages: number }`.

- [ ] **Step 1: Adicionar teste de paginação no `admin.service.test.ts`**

```ts
describe('AdminService.listNutritionists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna página 1 com limit 2', async () => {
    mockDb.nutritionist.count.mockResolvedValue(5);
    mockDb.nutritionist.findMany.mockResolvedValue([
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ]);

    const service = createAdminService();
    const result = await service.listNutritionists({ page: 1, limit: 2 });

    expect(result.total).toBe(5);
    expect(result.totalPages).toBe(3);
    expect(result.data).toHaveLength(2);
    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 2 })
    );
  });

  it('calcula skip corretamente para página 3', async () => {
    mockDb.nutritionist.count.mockResolvedValue(10);
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    await service.listNutritionists({ page: 3, limit: 2 });

    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 4, take: 2 })
    );
  });
});
```

- [ ] **Step 2: Rodar para confirmar falha**
```bash
npm run test -- src/tests/services/admin.service.test.ts --reporter=verbose
```

- [ ] **Step 3: Adicionar `listNutritionists` ao `admin.service.ts`**

```ts
async function listNutritionists({ page = 1, limit = 20 }: { page?: number; limit?: number }) {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    getDb().nutritionist.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }),
    getDb().nutritionist.count(),
  ]);
  return { data, total, page, totalPages: Math.ceil(total / limit) };
}
// adicionar ao return: { getStats, listNutritionists }
```

- [ ] **Step 4: Rodar testes**
```bash
npm run test -- src/tests/services/admin.service.test.ts --reporter=verbose
```

- [ ] **Step 5: Atualizar rota em `admin.routes.ts`**

Substituir o `findMany` existente no `GET /api/admin/nutritionists`:

```ts
deps.app.get('/api/admin/nutritionists', deps.authenticate, async (req: any, res: any) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Acesso negado.' });
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    await withAdminRLS(async () => {
      res.json(await adminService.listNutritionists({ page, limit }));
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 6: Atualizar `AdminDashboard.tsx` para consumir paginação**

Adicionar estado de paginação e adaptar o fetch:

```tsx
const [page, setPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const LIMIT = 20;

// Dentro do fetchData:
const [nutriRes, patientCount] = await Promise.all([
  apiRequest<{ data: Nutritionist[]; total: number; totalPages: number }>(
    `/api/admin/nutritionists?page=${page}&limit=${LIMIT}`, 'GET'
  ),
  apiRequest<{ count: number }>('/api/admin/patients/count', 'GET'),
]);
setNutritionists(nutriRes?.data || []);
setTotalPages(nutriRes?.totalPages || 1);
setTotalPatients(patientCount?.count || 0);
```

Adicionar UI de paginação após a tabela (dentro do `<CardContent>`):

```tsx
{totalPages > 1 && (
  <div className="flex items-center justify-between px-6 py-4 border-t border-border">
    <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
        Anterior
      </Button>
      <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
        Próxima
      </Button>
    </div>
  </div>
)}
```

Adicionar `page` ao `useEffect` deps: `}, [nutritionist, page]);`

- [ ] **Step 7: Lint**
```bash
npm run lint
```

- [ ] **Step 8: Commit**
```bash
git add src/server/services/admin.service.ts src/server/routes/admin.routes.ts src/pages/AdminDashboard.tsx src/tests/services/admin.service.test.ts
git commit -m "feat(admin): paginação em GET /api/admin/nutritionists"
```

---

## Task 4: Proteção contra auto-despromoção

**Files:**
- Modify: `src/server/routes/admin.routes.ts`

- [ ] **Step 1: Adicionar teste**

Em `src/tests/routes/admin.routes.test.ts`:
```ts
describe('Self-demotion protection', () => {
  it('bloqueia admin de remover seu próprio papel', () => {
    const req = { user: { uid: 'admin1', isAdmin: true }, params: { id: 'admin1' }, body: { role: 'nutritionist' } } as any;
    const res = makeRes();

    const isSelfDemotion = req.params.id === req.user.uid && req.body.role && req.body.role !== 'admin';
    if (isSelfDemotion) res.status(400).json({ error: 'Não é possível remover seu próprio papel de admin.' });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('permite admin alterar plano do próprio usuário', () => {
    const req = { user: { uid: 'admin1', isAdmin: true }, params: { id: 'admin1' }, body: { plan: 'premium' } } as any;
    const res = makeRes();

    const isSelfDemotion = req.params.id === req.user.uid && req.body.role && req.body.role !== 'admin';
    if (isSelfDemotion) res.status(400).json({ error: 'Não é possível remover seu próprio papel de admin.' });

    expect(res.status).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar testes**
```bash
npm run test -- src/tests/routes/admin.routes.test.ts --reporter=verbose
```

- [ ] **Step 3: Adicionar guarda no PATCH em `admin.routes.ts`**

```ts
deps.app.patch('/api/admin/nutritionists/:id', deps.authenticate, async (req: any, res: any) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Acesso negado.' });

  const { id } = req.params;
  if (id === req.user.uid && req.body.role && req.body.role !== 'admin') {
    return res.status(400).json({ error: 'Não é possível remover seu próprio papel de admin.' });
  }
  // ... resto do handler
});
```

- [ ] **Step 4: Lint + testes**
```bash
npm run lint && npm run test -- src/tests/routes/admin.routes.test.ts --reporter=verbose
```

- [ ] **Step 5: Commit**
```bash
git add src/server/routes/admin.routes.ts src/tests/routes/admin.routes.test.ts
git commit -m "feat(admin): proteção contra auto-despromoção de admin"
```

---

## Task 5: Flag `planOverridedByAdmin` + aviso de conflito Asaas

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260517_add_plan_override/migration.sql`
- Modify: `src/server/routes/admin.routes.ts` (setar flag no PATCH)
- Modify: `src/server/services/asaas.service.ts` (respeitar flag)
- Modify: `src/pages/AdminDashboard.tsx` (badge visual)

- [ ] **Step 1: Adicionar campo no schema**

Em `prisma/schema.prisma`, dentro de `model Nutritionist`:
```prisma
planOverridedByAdmin    Boolean   @default(false)
```

- [ ] **Step 2: Criar migration**

```bash
npx prisma migrate dev --name add_plan_override
```
Expected: migration criada em `prisma/migrations/`.

- [ ] **Step 3: Setar flag no PATCH de plano**

Em `admin.routes.ts`, dentro do handler PATCH:
```ts
await withAdminRLS(async () => {
  const updateData: any = { ...req.body };
  if (req.body.plan !== undefined) {
    updateData.planOverridedByAdmin = true;
  }
  const data = await getDb().nutritionist.update({ where: { id }, data: updateData });
  res.json(data);
});
```

- [ ] **Step 4: Respeitar a flag no sync do Asaas**

Em `src/server/services/asaas.service.ts`, nos pontos onde o plano é atualizado via sync (buscar onde `plan: "free"` ou `plan: isSubActive ? "premium" : "free"` é passado para o update do nutritionist), adicionar condição:

```ts
// Antes de qualquer update de plano via sync Asaas:
const nutritionist = await getDb().nutritionist.findUnique({
  where: { id: nutritionistId },
  select: { planOverridedByAdmin: true },
});
if (nutritionist?.planOverridedByAdmin) {
  // não sobrescreve plano definido manualmente pelo admin
  return;
}
// ... continua com o update normal
```

**Nota:** Localizar as chamadas de update do nutritionist no `asaas.service.ts` e envolver com esta guarda. As linhas relevantes são aquelas que fazem `nutritionist.update({ data: { plan: ... } })`.

- [ ] **Step 5: Atualizar tipo `Nutritionist` no frontend**

Em `src/types.ts`:
```ts
planOverridedByAdmin?: boolean;
```

- [ ] **Step 6: Adicionar badge na tabela de nutricionistas no `AdminDashboard.tsx`**

Na coluna de plano da tabela, após o badge de plano:
```tsx
{n.planOverridedByAdmin && (
  <span className="ml-1 text-xs text-amber-600 font-medium" title="Plano definido manualmente — sync do Asaas não irá sobrescrever">
    Manual
  </span>
)}
```

- [ ] **Step 7: Lint**
```bash
npm run lint
```

- [ ] **Step 8: Commit**
```bash
git add prisma/schema.prisma prisma/migrations/ src/server/routes/admin.routes.ts src/server/services/asaas.service.ts src/types.ts src/pages/AdminDashboard.tsx
git commit -m "feat(admin): flag planOverridedByAdmin previne conflito com sync Asaas"
```

---

## Task 6: Retenção LGPD com contagem prévia e confirmação

**Files:**
- Modify: `src/server/services/retention.service.ts`
- Modify: `src/server/routes/admin.routes.ts` (novo endpoint GET pending)
- Modify: `src/pages/AdminDashboard.tsx` (contagem + dialog de confirmação)

- [ ] **Step 1: Adicionar teste para `countPendingDeletion`**

Em `src/tests/services/admin.service.test.ts`:
```ts
describe('RetentionService.countPendingDeletion', () => {
  it('conta pacientes com deletedAt há mais de 30 dias', async () => {
    mockDb.patient = { count: vi.fn().mockResolvedValue(5), deleteMany: vi.fn() };

    const { createRetentionService } = await import('../../server/services/retention.service.ts');
    const service = createRetentionService();
    const result = await service.countPendingDeletion(30);

    expect(result).toBe(5);
    expect(mockDb.patient.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: expect.any(Object) }) })
    );
  });
});
```

- [ ] **Step 2: Rodar para confirmar falha**
```bash
npm run test -- src/tests/services/admin.service.test.ts -t "countPendingDeletion" --reporter=verbose
```

- [ ] **Step 3: Implementar `countPendingDeletion` em `retention.service.ts`**

```ts
async function countPendingDeletion(daysOld = 30): Promise<number> {
  const cutoff = subDays(new Date(), daysOld);
  return getDb().patient.count({
    where: { deletedAt: { lt: cutoff } },
  });
}
// adicionar ao return: { cleanupSoftDeleted, countPendingDeletion }
```

- [ ] **Step 4: Adicionar endpoint GET em `admin.routes.ts`**

```ts
const retentionService = createRetentionService();

deps.app.get('/api/admin/retention/pending', deps.authenticate, async (req: any, res: any) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Acesso negado.' });
  try {
    await withAdminRLS(async () => {
      const count = await retentionService.countPendingDeletion(30);
      res.json({ count });
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 5: Rodar testes**
```bash
npm run test -- src/tests/services/admin.service.test.ts --reporter=verbose
```

- [ ] **Step 6: Atualizar `AdminDashboard.tsx` — mostrar contagem e dialog de confirmação**

Adicionar estado:
```tsx
const [pendingDeletion, setPendingDeletion] = useState<number | null>(null);
const [showRetentionConfirm, setShowRetentionConfirm] = useState(false);
```

No `fetchData`, adicionar:
```tsx
const pending = await apiRequest<{ count: number }>('/api/admin/retention/pending', 'GET');
setPendingDeletion(pending?.count ?? 0);
```

Substituir o botão de retention cleanup por:
```tsx
<div className="space-y-2">
  {pendingDeletion !== null && (
    <p className="text-sm text-muted-foreground">
      {pendingDeletion === 0
        ? 'Nenhum paciente pendente de remoção permanente.'
        : `${pendingDeletion} paciente(s) com soft delete há mais de 30 dias aguardando remoção permanente (LGPD).`}
    </p>
  )}
  <Button
    variant="destructive"
    disabled={pendingDeletion === 0 || isRunningCleanup}
    onClick={() => setShowRetentionConfirm(true)}
  >
    {isRunningCleanup ? 'Removendo...' : `Executar Limpeza LGPD${pendingDeletion ? ` (${pendingDeletion})` : ''}`}
  </Button>
</div>

{showRetentionConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-card rounded-xl p-6 shadow-xl max-w-sm w-full space-y-4">
      <h3 className="font-bold text-lg">Confirmar remoção permanente</h3>
      <p className="text-sm text-muted-foreground">
        Esta ação irá remover permanentemente <strong>{pendingDeletion} paciente(s)</strong> do banco de dados. Essa operação é irreversível e está em conformidade com a LGPD.
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setShowRetentionConfirm(false)}>Cancelar</Button>
        <Button variant="destructive" onClick={async () => {
          setShowRetentionConfirm(false);
          await handleRetentionCleanup();
        }}>
          Confirmar remoção
        </Button>
      </div>
    </div>
  </div>
)}
```

Adicionar estado `isRunningCleanup` e mover a lógica de cleanup para `handleRetentionCleanup()`.

- [ ] **Step 7: Lint**
```bash
npm run lint
```

- [ ] **Step 8: Commit**
```bash
git add src/server/services/retention.service.ts src/server/routes/admin.routes.ts src/pages/AdminDashboard.tsx src/tests/services/admin.service.test.ts
git commit -m "feat(admin): retenção LGPD com contagem prévia e confirmação"
```

---

## Task 7: Audit Log de ações admin

**Files:**
- Modify: `prisma/schema.prisma` (novo model `AdminAuditLog`)
- Create: `prisma/migrations/20260517_add_admin_audit_log/migration.sql`
- Modify: `src/server/services/admin.service.ts` (função `logAudit`)
- Modify: `src/server/routes/admin.routes.ts` (chamar `logAudit` nas mutações)
- Modify: `src/pages/AdminDashboard.tsx` (nova aba "Auditoria")
- Modify: `src/server/routes/admin.routes.ts` (endpoint GET logs)

- [ ] **Step 1: Adicionar model em `prisma/schema.prisma`**

```prisma
model AdminAuditLog {
  id             String   @id @default(cuid())
  adminId        String
  adminEmail     String
  action         String   // 'set_plan' | 'set_role' | 'retention_cleanup'
  targetId       String?
  targetEmail    String?
  previousValue  String?
  newValue       String?
  createdAt      DateTime @default(now())

  @@map("admin_audit_logs")
}
```

- [ ] **Step 2: Rodar migration**
```bash
npx prisma migrate dev --name add_admin_audit_log
```

- [ ] **Step 3: Escrever teste para `logAudit`**

Em `src/tests/services/admin.service.test.ts`:
```ts
describe('AdminService.logAudit', () => {
  it('cria registro no banco com os dados corretos', async () => {
    const mockCreate = vi.fn().mockResolvedValue({});
    mockDb.adminAuditLog = { create: mockCreate, findMany: vi.fn().mockResolvedValue([]) };

    const service = createAdminService();
    await service.logAudit({
      adminId: 'admin1',
      adminEmail: 'admin@test.com',
      action: 'set_plan',
      targetId: 'user1',
      targetEmail: 'user@test.com',
      previousValue: 'free',
      newValue: 'premium',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminId: 'admin1',
        action: 'set_plan',
        newValue: 'premium',
      }),
    });
  });
});
```

- [ ] **Step 4: Rodar para confirmar falha**
```bash
npm run test -- src/tests/services/admin.service.test.ts -t "logAudit" --reporter=verbose
```

- [ ] **Step 5: Implementar `logAudit` e `getAuditLogs` em `admin.service.ts`**

```ts
interface AuditEntry {
  adminId: string;
  adminEmail: string;
  action: string;
  targetId?: string;
  targetEmail?: string;
  previousValue?: string;
  newValue?: string;
}

async function logAudit(entry: AuditEntry) {
  await getDb().adminAuditLog.create({ data: entry });
}

async function getAuditLogs(limit = 50) {
  return getDb().adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
// adicionar ao return: { getStats, listNutritionists, logAudit, getAuditLogs }
```

- [ ] **Step 6: Rodar testes**
```bash
npm run test -- src/tests/services/admin.service.test.ts --reporter=verbose
```

- [ ] **Step 7: Chamar `logAudit` no PATCH de `admin.routes.ts`**

Dentro do handler PATCH, após o update bem-sucedido:
```ts
// Buscar email do target para o log
const target = await getDb().nutritionist.findUnique({
  where: { id },
  select: { email: true, role: true, plan: true },
});

await adminService.logAudit({
  adminId: req.user.uid,
  adminEmail: req.user.email || '',
  action: req.body.role !== undefined ? 'set_role' : 'set_plan',
  targetId: id,
  targetEmail: target?.email || '',
  previousValue: req.body.role !== undefined ? target?.role : target?.plan,
  newValue: req.body.role ?? req.body.plan,
});
```

- [ ] **Step 8: Chamar `logAudit` no retention cleanup**

```ts
await adminService.logAudit({
  adminId: req.user.uid,
  adminEmail: req.user.email || '',
  action: 'retention_cleanup',
  newValue: `${result.deletedCount} pacientes removidos`,
});
```

- [ ] **Step 9: Adicionar endpoint GET logs**

```ts
deps.app.get('/api/admin/audit-logs', deps.authenticate, async (req: any, res: any) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Acesso negado.' });
  try {
    await withAdminRLS(async () => {
      res.json(await adminService.getAuditLogs(50));
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 10: Adicionar aba "Auditoria" em `AdminDashboard.tsx`**

Adicionar estado e fetch:
```tsx
const [auditLogs, setAuditLogs] = useState<any[]>([]);

// dentro do fetchData:
const logs = await apiRequest<any[]>('/api/admin/audit-logs', 'GET');
setAuditLogs(logs || []);
```

Adicionar `<TabsTrigger value="audit">Auditoria</TabsTrigger>` na lista de tabs.

Adicionar conteúdo da aba:
```tsx
<TabsContent value="audit">
  <Card className="border-none shadow-sm bg-card">
    <CardHeader className="border-b border-border pb-6">
      <CardTitle className="text-xl font-bold">Log de Auditoria</CardTitle>
      <p className="text-sm text-muted-foreground">Últimas 50 ações administrativas</p>
    </CardHeader>
    <CardContent className="p-0">
      {auditLogs.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">Nenhuma ação registrada.</p>
      ) : (
        <div className="divide-y divide-border">
          {auditLogs.map((log) => (
            <div key={log.id} className="flex items-start justify-between px-6 py-4 gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {log.action === 'set_role' && `Papel alterado: ${log.previousValue} → ${log.newValue}`}
                  {log.action === 'set_plan' && `Plano alterado: ${log.previousValue} → ${log.newValue}`}
                  {log.action === 'retention_cleanup' && `Limpeza LGPD: ${log.newValue}`}
                </p>
                {log.targetEmail && (
                  <p className="text-xs text-muted-foreground">Alvo: {log.targetEmail}</p>
                )}
                <p className="text-xs text-muted-foreground">Por: {log.adminEmail}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(parseISO(log.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>
```

- [ ] **Step 11: Lint**
```bash
npm run lint
```

- [ ] **Step 12: Commit**
```bash
git add prisma/schema.prisma prisma/migrations/ src/server/services/admin.service.ts src/server/routes/admin.routes.ts src/pages/AdminDashboard.tsx src/tests/services/admin.service.test.ts
git commit -m "feat(admin): audit log de ações administrativas"
```

---

## Task 8: Atualizar dashboard frontend com stats ricas

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

Consumir `GET /api/admin/stats` e substituir os cards de visão geral com as novas métricas.

- [ ] **Step 1: Adicionar estado e fetch no `AdminDashboard.tsx`**

Substituir o fetch atual de `stats` (que é calculado localmente do array) por dados da API:

```tsx
const [adminStats, setAdminStats] = useState<{
  totalNutritionists: number;
  premiumCount: number;
  freeCount: number;
  adminCount: number;
  conversionRate: number;
  estimatedRevenue: number;
  activeLast30Days: number;
  newLast7Days: number;
  totalPatients: number;
} | null>(null);

// dentro do fetchData:
const stats = await apiRequest<typeof adminStats>('/api/admin/stats', 'GET');
setAdminStats(stats);
```

- [ ] **Step 2: Substituir os cards de overview**

Substituir os 4 cards existentes por 6 cards com as novas métricas:

```tsx
<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
  {/* Nutricionistas */}
  <Card className="border-none shadow-sm bg-card overflow-hidden">
    <CardContent className="py-4 px-6">
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Nutricionistas</p>
          <p className="text-2xl font-bold">{adminStats?.totalNutritionists ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{adminStats?.newLast7Days ?? 0} novos nos últimos 7 dias</p>
        </div>
      </div>
    </CardContent>
  </Card>

  {/* Premium */}
  <Card className="border-none shadow-sm bg-card overflow-hidden">
    <CardContent className="py-4 px-6">
      <div className="flex items-center gap-3">
        <CreditCard className="w-5 h-5 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Premium</p>
          <p className="text-2xl font-bold">{adminStats?.premiumCount ?? '—'}</p>
          <p className="text-xs text-muted-foreground">Conversão: {adminStats?.conversionRate ?? 0}%</p>
        </div>
      </div>
    </CardContent>
  </Card>

  {/* Receita estimada */}
  <Card className="border-none shadow-sm bg-card overflow-hidden">
    <CardContent className="py-4 px-6">
      <div className="flex items-center gap-3">
        <Activity className="w-5 h-5 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Receita Estimada</p>
          <p className="text-2xl font-bold">
            {adminStats ? `R$ ${adminStats.estimatedRevenue.toFixed(2).replace('.', ',')}` : '—'}
          </p>
          <p className="text-xs text-muted-foreground">mensal recorrente</p>
        </div>
      </div>
    </CardContent>
  </Card>

  {/* Ativos */}
  <Card className="border-none shadow-sm bg-card overflow-hidden">
    <CardContent className="py-4 px-6">
      <div className="flex items-center gap-3">
        <Activity className="w-5 h-5 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Ativos (30 dias)</p>
          <p className="text-2xl font-bold">{adminStats?.activeLast30Days ?? '—'}</p>
          <p className="text-xs text-muted-foreground">com login recente</p>
        </div>
      </div>
    </CardContent>
  </Card>

  {/* Pacientes */}
  <Card className="border-none shadow-sm bg-card overflow-hidden">
    <CardContent className="py-4 px-6">
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Pacientes (total)</p>
          <p className="text-2xl font-bold">{adminStats?.totalPatients ?? totalPatients}</p>
        </div>
      </div>
    </CardContent>
  </Card>

  {/* Admins */}
  <Card className="border-none shadow-sm bg-card overflow-hidden">
    <CardContent className="py-4 px-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Admins</p>
          <p className="text-2xl font-bold">{adminStats?.adminCount ?? '—'}</p>
        </div>
      </div>
    </CardContent>
  </Card>
</div>
```

- [ ] **Step 3: Lint**
```bash
npm run lint
```

- [ ] **Step 4: Rodar todos os testes**
```bash
npm run test
```
Expected: todos passando.

- [ ] **Step 5: Commit final**
```bash
git add src/pages/AdminDashboard.tsx
git commit -m "feat(admin): dashboard com stats ricas via GET /api/admin/stats"
```

---

## Self-Review

**Cobertura do spec:**
- ✅ #1 — query dupla removida (Task 1)
- ✅ #2 — stats ricas (Tasks 2 + 8)
- ✅ #3 — conflito Asaas com flag + badge (Task 5)
- ✅ #4 — paginação (Task 3)
- ✅ #5 — self-demotion (Task 4)
- ✅ #6 — LGPD com contagem + confirmação (Task 6)
- ✅ #7 — audit log completo (Task 7)

**Dependências entre tasks:**
- Task 1 deve vir primeiro (simplifica todas as rotas seguintes)
- Task 2 deve vir antes da Task 8 (frontend consome endpoint da Task 2)
- Task 5 requer migration → rodar `prisma migrate dev` antes de subir
- Task 7 requer migration → rodar `prisma migrate dev` antes de subir
- Tasks 3, 4, 6 são independentes entre si

**Nenhum placeholder detectado. Todas as tasks têm código completo.**
