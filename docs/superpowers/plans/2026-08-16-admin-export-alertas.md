# Painel Admin — Fases 3 e 4: Exportação e Alertas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV export to the admin "Nutricionistas" table (Fase 3) and a new "Alertas" tab surfacing 4 categories of at-risk nutritionists (Fase 4).

**Architecture:** Fase 3 is 2 tasks: a backend export endpoint that reuses `listNutritionists`' existing filter logic (extracted into a shared helper) without pagination, and a frontend "Exportar CSV" button that fetches the full filtered list, applies the same client-side search/plan/role filters the table already uses, and generates a CSV client-side via `papaparse`. Fase 4 is 3 tasks: a backend `/api/admin/alerts` endpoint aggregating 4 existing risk signals (some already computed elsewhere in the admin backend, some new), a new self-contained `AdminAlertsTab.tsx` component, and wiring a new "Alertas" tab into `AdminDashboard.tsx`. Both phases only touch `src/server/services/admin.service.ts`, `src/server/routes/admin.routes.ts`, `src/pages/AdminDashboard.tsx`, and their respective test files — no other file in the codebase changes.

**Tech Stack:** Express, Prisma, Vitest (backend only — see Global Constraints), React, `papaparse` (new dependency, Fase 3 only), `date-fns`.

**Spec:** `docs/superpowers/specs/2026-08-16-melhorias-painel-admin-design.md` (sections "Fase 3 — Exportação" and "Fase 4 — Alertas")

## Global Constraints

- Backend tasks (1, 3) follow the codebase's existing conventions: routes wrapped in `withAdminRLS`, gated by `assertAdmin`; no Zod schema needed for the export route's `filter` param — mirror the inline validation already used by `GET /api/admin/nutritionists` (`['atLimit', 'churnRisk'].includes(req.query.filter as string) ? ... : undefined`), not a new Zod schema.
- Frontend tasks (2, 4, 5) are **not** covered by CLAUDE.md's Vitest scope (`src/server/**/*.ts` only) — verify manually in the browser, don't add new `.test.tsx` files, matching Fases 1-2's precedent. **Known limitation from Fases 1-2**: subagent implementers in this environment have had no admin credentials available to actually log in and click through the UI — expect `DONE_WITH_CONCERNS` on the frontend/wiring tasks' browser-verification step, and budget a final-review pass (or a manual check by the user) to catch anything a static diff read can't.
- Task 2's export button must **not** duplicate `listNutritionists`' search/plan/role filtering logic server-side — those are, and remain, client-only filters (`AdminDashboard.tsx`'s `filteredNutritionists` local computation). The export flow re-applies the exact same 3 predicates client-side against the full unpaginated response, it does not invent a new server-side text-search feature.
- Task 1's refactor (extracting `buildNutritionistFilterWhere`) must not change `listNutritionists`' existing behavior — the existing test suite for `listNutritionists` (already in `admin.service.test.ts`) must keep passing unmodified as a regression check.
- CSV export fields are limited to what the admin table already displays or closely related metadata (name, email, CRN, plan, role, patient count, signup date, last login, manual-override flag) — **do not include `cpf`/`cnpj`** in the export; those are more sensitive PII than what a downloadable file should carry, and they aren't shown in the existing table either.
- New route placement: `GET /api/admin/nutritionists/export` goes right after the existing `GET /api/admin/nutritionists/:id` handler (before `/api/admin/stats`) in `admin.routes.ts`; `GET /api/admin/alerts` goes right after `GET /api/admin/operational`.

---

## Fase 3 — Exportação CSV

### Task 1: Backend — endpoint de exportação (`listNutritionistsForExport`)

**Files:**
- Modify: `src/server/services/admin.service.ts`
- Modify: `src/server/routes/admin.routes.ts`
- Modify: `src/tests/services/admin.service.test.ts`
- Modify: `src/tests/routes/admin.routes.test.ts`

**Interfaces:**
- Produces: `buildNutritionistFilterWhere(filter?: 'atLimit' | 'churnRisk'): any` (internal helper, not exported from the module — used by both `listNutritionists` and the new function), `listNutritionistsForExport({ filter }: { filter?: 'atLimit' | 'churnRisk' }): Promise<ExportRow[]>` where `ExportRow` has `{ id, name, email, crn, plan, role, createdAt, lastLogin, planOverridedByAdmin, _count: { patients: number } }`. Endpoint: `GET /api/admin/nutritionists/export?filter=atLimit|churnRisk` (filter optional) → `{ data: ExportRow[] }`.

- [ ] **Step 1: Write the failing tests**

Add to `src/tests/services/admin.service.test.ts`, after the existing `describe('AdminService.listNutritionists', ...)` block:

```ts
describe('AdminService.listNutritionistsForExport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem filtro, usa where vazio e busca todos os nutricionistas', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    await service.listNutritionistsForExport({});

    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('com filter=atLimit, aplica o mesmo where de listNutritionists', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([
      {
        id: '1',
        name: 'A',
        email: 'a@test.com',
        crn: '123',
        plan: 'free',
        role: 'nutritionist',
        createdAt: new Date(),
        lastLogin: null,
        planOverridedByAdmin: false,
        _count: { patients: 3 },
      },
    ]);

    const service = createAdminService();
    const result = await service.listNutritionistsForExport({ filter: 'atLimit' });

    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { plan: 'free', patients: { some: { status: 'active', deletedAt: null } } },
      })
    );
    expect(result).toHaveLength(1);
  });

  it('com filter=churnRisk, aplica plan premium e lastLogin antigo', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    await service.listNutritionistsForExport({ filter: 'churnRisk' });

    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { plan: 'premium', lastLogin: { lt: expect.any(Date) } },
      })
    );
  });

  it('não pagina — não passa skip, e limita a 5000 registros via take', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    await service.listNutritionistsForExport({});

    const callArgs = mockDb.nutritionist.findMany.mock.calls[0][0];
    expect(callArgs.skip).toBeUndefined();
    expect(callArgs.take).toBe(5000);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- admin.service.test.ts`
Expected: FAIL with `service.listNutritionistsForExport is not a function`

- [ ] **Step 3: Extract `buildNutritionistFilterWhere` and implement `listNutritionistsForExport`**

In `src/server/services/admin.service.ts`, replace the `where`-building lines inside `listNutritionists` (currently):

```ts
    let where: any = {};
    if (filter === 'churnRisk') {
      where = { plan: 'premium', lastLogin: { lt: thirtyDaysAgo } };
    } else if (filter === 'atLimit') {
      where = {
        plan: 'free',
        patients: { some: { status: 'active', deletedAt: null } },
      };
    }
```

Extract this into a module-level helper (defined right before `createAdminService()`), then call it from `listNutritionists`:

```ts
// Extraído de listNutritionists pra ser reaproveitado por listNutritionistsForExport —
// mesmos dois filtros de engajamento, sem duplicar a lógica.
function buildNutritionistFilterWhere(filter?: 'atLimit' | 'churnRisk'): any {
  if (filter === 'churnRisk') {
    return { plan: 'premium', lastLogin: { lt: subDays(new Date(), 30) } };
  }
  if (filter === 'atLimit') {
    return { plan: 'free', patients: { some: { status: 'active', deletedAt: null } } };
  }
  return {};
}
```

Inside `listNutritionists`, replace the extracted block with:

```ts
    const where = buildNutritionistFilterWhere(filter);
```

(Remove the now-unused local `thirtyDaysAgo` variable inside `listNutritionists` if it's no longer referenced elsewhere in that function — check before deleting; `skip`/pagination logic still needs `page`/`limit`, unrelated to `thirtyDaysAgo`.)

Add the constant and new function right after `listNutritionists` (before `getNutritionistById`):

```ts
  const MAX_EXPORT_ROWS = 5000;

  async function listNutritionistsForExport({ filter }: { filter?: 'atLimit' | 'churnRisk' }) {
    const where = buildNutritionistFilterWhere(filter);
    return getDb().nutritionist.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true,
        name: true,
        email: true,
        crn: true,
        plan: true,
        role: true,
        createdAt: true,
        lastLogin: true,
        planOverridedByAdmin: true,
        _count: { select: { patients: true } },
      },
    });
  }
```

Add `listNutritionistsForExport,` to the object returned at the bottom of `createAdminService()`.

- [ ] **Step 4: Run the test to verify it passes, and confirm the refactor didn't break `listNutritionists`**

Run: `npm run test -- admin.service.test.ts`
Expected: PASS — including the pre-existing `describe('AdminService.listNutritionists', ...)` tests, unmodified, still green (this is the regression check for the `buildNutritionistFilterWhere` extraction).

- [ ] **Step 5: Register the route**

In `src/server/routes/admin.routes.ts`, add right after the `GET /api/admin/nutritionists/:id` handler (its closing `});`), before the `GET /api/admin/stats` handler:

```ts
  // Exporta a lista completa de nutricionistas (sem paginação) pro botão "Exportar CSV" do
  // client — mesmos dois filtros de engajamento de /api/admin/nutritionists (busca/plano/
  // cargo são só client-side hoje, não fazem parte desta query; ver AdminDashboard.tsx).
  deps.app.get('/api/admin/nutritionists/export', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      const filter = ['atLimit', 'churnRisk'].includes(req.query.filter as string)
        ? (req.query.filter as 'atLimit' | 'churnRisk')
        : undefined;
      await withAdminRLS(async () => {
        const data = await adminService.listNutritionistsForExport({ filter });
        res.json({ data });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
```

- [ ] **Step 6: Wire into the route test**

In `src/tests/routes/admin.routes.test.ts`:
1. Add `listNutritionistsForExport: vi.fn().mockResolvedValue([]),` to the mocked `createAdminService` return object.
2. Add a new `describe` block near the existing `describe('GET /api/admin/nutritionists', ...)` block:

```ts
  describe('GET /api/admin/nutritionists/export', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).get('/api/admin/nutritionists/export');
      expect(res.status).toBe(403);
    });

    it('retorna 200 com { data } para admin, sem filtro', async () => {
      const app = buildApp(true);
      const serviceInstance = lastServiceInstance(createAdminService);
      (serviceInstance.listNutritionistsForExport as any).mockResolvedValueOnce([{ id: '1', name: 'A' }]);

      const res = await request(app).get('/api/admin/nutritionists/export');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [{ id: '1', name: 'A' }] });
      expect(serviceInstance.listNutritionistsForExport).toHaveBeenCalledWith({ filter: undefined });
    });

    it('repassa filter=atLimit ao service', async () => {
      const app = buildApp(true);
      const serviceInstance = lastServiceInstance(createAdminService);

      await request(app).get('/api/admin/nutritionists/export?filter=atLimit');

      expect(serviceInstance.listNutritionistsForExport).toHaveBeenCalledWith({ filter: 'atLimit' });
    });

    it('ignora valores de filter fora do enum permitido', async () => {
      const app = buildApp(true);
      const serviceInstance = lastServiceInstance(createAdminService);

      await request(app).get('/api/admin/nutritionists/export?filter=algo-invalido');

      expect(serviceInstance.listNutritionistsForExport).toHaveBeenCalledWith({ filter: undefined });
    });
  });
```

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/server/services/admin.service.ts src/server/routes/admin.routes.ts src/tests/services/admin.service.test.ts src/tests/routes/admin.routes.test.ts
git commit -m "feat: adiciona endpoint de exportação de nutricionistas ao painel admin"
```

---

### Task 2: Frontend — botão "Exportar CSV"

**Files:**
- Modify: `package.json` (new dependency)
- Modify: `src/pages/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/nutritionists/export` (Task 1), the existing local state `searchTerm`/`planFilter`/`roleFilter`/`engagementFilter` and the existing `filteredNutritionists`-style predicate logic (already defined inline in the component for the on-screen table — this task duplicates that exact predicate against the export payload, it doesn't refactor the existing one).

- [ ] **Step 1: Add the `papaparse` dependency**

```bash
npm install papaparse
npm install -D @types/papaparse
```

- [ ] **Step 2: Add imports**

In `src/pages/AdminDashboard.tsx`, add right after the `apiRequest` import (line 2):

```tsx
import { apiRequest } from '../hooks/useApi';
import Papa from 'papaparse';
```

Add `Download` to the `lucide-react` import block (currently ending `Eye,\n  FlaskConical\n} from 'lucide-react';`):

```tsx
import {
  Users,
  ShieldCheck,
  CreditCard,
  Search,
  Activity,
  Settings as SettingsIcon,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ClipboardList,
  UtensilsCrossed,
  ScrollText,
  Wrench,
  BarChart3,
  UserPlus,
  Pencil,
  Eye,
  FlaskConical,
  Download
} from 'lucide-react';
```

- [ ] **Step 3: Add export state and handler**

Near the other state declarations (e.g. after `const [isRunningCleanup, setIsRunningCleanup] = useState(false);`), add:

```tsx
  const [isExportingCsv, setIsExportingCsv] = useState(false);
```

Add a handler function near `handleRetentionCleanup`:

```tsx
  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      const filterParam = engagementFilter !== 'all' ? `?filter=${engagementFilter}` : '';
      const res = await apiRequest<{ data: any[] }>(`/api/admin/nutritionists/export${filterParam}`, 'GET');
      const rows = (res?.data ?? []).filter((n) => {
        const matchesSearch = n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (n.crn ?? '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPlan = planFilter === 'all' || n.plan === planFilter;
        const matchesRole = roleFilter === 'all' || n.role === roleFilter;
        return matchesSearch && matchesPlan && matchesRole;
      });

      const csv = Papa.unparse(rows.map((n) => ({
        Nome: n.name,
        Email: n.email,
        CRN: n.crn ?? '',
        Plano: n.plan === 'premium' ? 'Premium' : 'Gratuito',
        Cargo: n.role === 'admin' ? 'Admin' : 'Nutricionista',
        Pacientes: n._count?.patients ?? 0,
        'Cadastrado em': n.createdAt,
        'Último login': n.lastLogin ?? '',
        'Plano manual': n.planOverridedByAdmin ? 'Sim' : 'Não',
      })));

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nutricionistas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error('Erro ao exportar CSV: ' + error.message);
    } finally {
      setIsExportingCsv(false);
    }
  };
```

- [ ] **Step 4: Add the button to the Nutricionistas tab header**

In the `TabsContent value="nutritionists"` block, inside the `<div className="flex items-center gap-2">` that wraps the plan/role/engagement `Select`s, add a `Button` as the last child:

```tsx
                <div className="flex items-center gap-2">
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    {/* ... unchanged ... */}
                  </Select>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    {/* ... unchanged ... */}
                  </Select>
                  <Select value={engagementFilter} onValueChange={(v) => { setEngagementFilter(v); }}>
                    {/* ... unchanged ... */}
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCsv}
                    disabled={isExportingCsv}
                    className="gap-2 h-9 rounded-xl"
                  >
                    <Download className="w-4 h-4" />
                    {isExportingCsv ? 'Exportando...' : 'Exportar CSV'}
                  </Button>
                </div>
```

(Only the new `Button` is an actual change — the three `Select`s above it are unchanged, shown here only so the insertion point is unambiguous.)

- [ ] **Step 5: Verify manually in the browser**

Run `npm run dev`, log in as an admin, open "Painel Administrativo" → "Nutricionistas". Confirm:
- "Exportar CSV" button is visible next to the filters, with a download icon.
- Clicking it (with no filters active) downloads a `.csv` file named `nutricionistas_YYYY-MM-DD.csv` containing all nutritionists, with headers in Portuguese (Nome, Email, CRN, Plano, Cargo, Pacientes, Cadastrado em, Último login, Plano manual).
- Type something into the search box, or change the Plano/Cargo filter, then export again — the downloaded CSV only contains rows matching those filters (confirm by opening the file and comparing row count to what's visible on screen, accounting for the on-screen table only showing the current page of 20 while export covers the full filtered set).
- Set "Engajamento" to "Risco de Churn" or "Atingiu Limite Free", export — confirm the CSV only contains nutritionists matching that server-side filter.
- Button shows "Exportando..." and is disabled while the request is in flight.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/pages/AdminDashboard.tsx
git commit -m "feat: adiciona exportação CSV da tabela de nutricionistas"
```

---

## Fase 4 — Alertas Operacionais

### Task 3: Backend — endpoint de alertas (`getAlerts`)

**Files:**
- Modify: `src/server/services/admin.service.ts`
- Modify: `src/server/routes/admin.routes.ts`
- Modify: `src/tests/services/admin.service.test.ts`
- Modify: `src/tests/routes/admin.routes.test.ts`

**Interfaces:**
- Produces: `getAlerts(): Promise<AdminAlert[]>` where `AdminAlert = { type: 'churnRisk' | 'atLimit' | 'gracePeriodEnding' | 'paymentIssue'; nutritionistId: string; name: string; email: string; detail: string }`. Endpoint: `GET /api/admin/alerts` (no params) → `{ data: AdminAlert[] }`.

- [ ] **Step 1: Write the failing test**

Add to `src/tests/services/admin.service.test.ts`, near the end (after `describe('AdminService.getOperationalData', ...)` if present, or after the last existing describe block):

```ts
describe('AdminService.getAlerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('agrupa os 4 tipos de alerta com o detail correto', async () => {
    const now = new Date();
    const lastLogin35DaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
    const graceEndsIn3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    mockDb.nutritionist.findMany
      .mockResolvedValueOnce([
        { id: 'n1', name: 'Churn Risk', email: 'churn@test.com', lastLogin: lastLogin35DaysAgo.toISOString() },
      ]) // churnRisk
      .mockResolvedValueOnce([
        { id: 'n2', name: 'At Limit', email: 'atlimit@test.com' },
      ]) // atLimit
      .mockResolvedValueOnce([
        { id: 'n3', name: 'Grace Ending', email: 'grace@test.com', gracePeriodEndAt: graceEndsIn3Days },
      ]) // gracePeriodEnding
      .mockResolvedValueOnce([
        { id: 'n4', name: 'Payment Issue', email: 'payment@test.com', subscription: { asaasStatus: 'OVERDUE' } },
      ]); // paymentIssue

    const service = createAdminService();
    const alerts = await service.getAlerts();

    expect(alerts).toEqual([
      { type: 'churnRisk', nutritionistId: 'n1', name: 'Churn Risk', email: 'churn@test.com', detail: 'Sem login há 35 dias' },
      { type: 'atLimit', nutritionistId: 'n2', name: 'At Limit', email: 'atlimit@test.com', detail: 'Plano gratuito com paciente ativo' },
      { type: 'gracePeriodEnding', nutritionistId: 'n3', name: 'Grace Ending', email: 'grace@test.com', detail: 'Período de carência termina em 3 dia(s)' },
      { type: 'paymentIssue', nutritionistId: 'n4', name: 'Payment Issue', email: 'payment@test.com', detail: 'Status Asaas: OVERDUE' },
    ]);
  });

  it('nutricionista com lastLogin nulo recebe detail "Nunca fez login"', async () => {
    mockDb.nutritionist.findMany
      .mockResolvedValueOnce([{ id: 'n1', name: 'A', email: 'a@test.com', lastLogin: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const service = createAdminService();
    const alerts = await service.getAlerts();

    expect(alerts).toEqual([
      { type: 'churnRisk', nutritionistId: 'n1', name: 'A', email: 'a@test.com', detail: 'Nunca fez login' },
    ]);
  });

  it('retorna array vazio quando não há nenhum alerta', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    const alerts = await service.getAlerts();

    expect(alerts).toEqual([]);
  });

  it('filtra gracePeriodEnding pra janela de 7 dias e paymentIssue pra status OVERDUE/PENDING', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    await service.getAlerts();

    // 3ª chamada = gracePeriodEnding
    expect(mockDb.nutritionist.findMany).toHaveBeenNthCalledWith(3, expect.objectContaining({
      where: { gracePeriodEndAt: { gte: expect.any(Date), lte: expect.any(Date) } },
    }));
    // 4ª chamada = paymentIssue
    expect(mockDb.nutritionist.findMany).toHaveBeenNthCalledWith(4, expect.objectContaining({
      where: { subscription: { asaasStatus: { in: ['OVERDUE', 'PENDING'] } } },
    }));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- admin.service.test.ts`
Expected: FAIL with `service.getAlerts is not a function`

- [ ] **Step 3: Implement `getAlerts`**

In `src/server/services/admin.service.ts`, update the `date-fns` import at the top of the file:

```ts
import { subDays, addDays, differenceInDays } from 'date-fns';
```

Add the constants near `PREMIUM_PRICE`/`PAYING_ASAAS_STATUSES`:

```ts
const GRACE_PERIOD_ALERT_WINDOW_DAYS = 7;
const PAYMENT_ISSUE_ASAAS_STATUSES = ['OVERDUE', 'PENDING'];

export type AdminAlertType = 'churnRisk' | 'atLimit' | 'gracePeriodEnding' | 'paymentIssue';

export interface AdminAlert {
  type: AdminAlertType;
  nutritionistId: string;
  name: string;
  email: string;
  detail: string;
}
```

Add the method after `getOperationalData` (before the returned object):

```ts
  async function getAlerts(): Promise<AdminAlert[]> {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const graceWindowEnd = addDays(now, GRACE_PERIOD_ALERT_WINDOW_DAYS);

    const [churnRiskList, atLimitList, graceEndingList, paymentIssueList] = await Promise.all([
      getDb().nutritionist.findMany({
        where: { plan: 'premium', lastLogin: { lt: thirtyDaysAgo } },
        select: { id: true, name: true, email: true, lastLogin: true },
      }),
      getDb().nutritionist.findMany({
        where: { plan: 'free', patients: { some: { status: 'active', deletedAt: null } } },
        select: { id: true, name: true, email: true },
      }),
      getDb().nutritionist.findMany({
        where: { gracePeriodEndAt: { gte: now, lte: graceWindowEnd } },
        select: { id: true, name: true, email: true, gracePeriodEndAt: true },
      }),
      getDb().nutritionist.findMany({
        where: { subscription: { asaasStatus: { in: PAYMENT_ISSUE_ASAAS_STATUSES } } },
        select: { id: true, name: true, email: true, subscription: { select: { asaasStatus: true } } },
      }),
    ]);

    const alerts: AdminAlert[] = [];

    for (const n of churnRiskList) {
      const days = n.lastLogin ? differenceInDays(now, new Date(n.lastLogin)) : null;
      alerts.push({
        type: 'churnRisk',
        nutritionistId: n.id,
        name: n.name,
        email: n.email,
        detail: days !== null ? `Sem login há ${days} dias` : 'Nunca fez login',
      });
    }

    for (const n of atLimitList) {
      alerts.push({
        type: 'atLimit',
        nutritionistId: n.id,
        name: n.name,
        email: n.email,
        detail: 'Plano gratuito com paciente ativo',
      });
    }

    for (const n of graceEndingList) {
      const days = n.gracePeriodEndAt ? differenceInDays(new Date(n.gracePeriodEndAt), now) : null;
      alerts.push({
        type: 'gracePeriodEnding',
        nutritionistId: n.id,
        name: n.name,
        email: n.email,
        detail: days !== null ? `Período de carência termina em ${days} dia(s)` : 'Período de carência terminando',
      });
    }

    for (const n of paymentIssueList) {
      alerts.push({
        type: 'paymentIssue',
        nutritionistId: n.id,
        name: n.name,
        email: n.email,
        detail: `Status Asaas: ${n.subscription?.asaasStatus ?? 'desconhecido'}`,
      });
    }

    return alerts;
  }
```

Add `getAlerts,` to the object returned at the bottom of `createAdminService()`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- admin.service.test.ts`
Expected: PASS

- [ ] **Step 5: Register the route**

In `src/server/routes/admin.routes.ts`, add right after the `/api/admin/operational` handler:

```ts
  deps.app.get('/api/admin/alerts', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        res.json({ data: await adminService.getAlerts() });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
```

- [ ] **Step 6: Wire into the route test**

In `src/tests/routes/admin.routes.test.ts`:
1. Add `getAlerts: vi.fn().mockResolvedValue([]),` to the mocked `createAdminService` return object.
2. Add a new `describe` block near the existing `describe('GET /api/admin/operational', ...)` block (or near the export block from Task 1):

```ts
  describe('GET /api/admin/alerts', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).get('/api/admin/alerts');
      expect(res.status).toBe(403);
    });

    it('retorna 200 com { data } para admin', async () => {
      const app = buildApp(true);
      const serviceInstance = lastServiceInstance(createAdminService);
      (serviceInstance.getAlerts as any).mockResolvedValueOnce([
        { type: 'churnRisk', nutritionistId: '1', name: 'A', email: 'a@test.com', detail: 'Sem login há 40 dias' },
      ]);

      const res = await request(app).get('/api/admin/alerts');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: [{ type: 'churnRisk', nutritionistId: '1', name: 'A', email: 'a@test.com', detail: 'Sem login há 40 dias' }],
      });
    });
  });
```

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/server/services/admin.service.ts src/server/routes/admin.routes.ts src/tests/services/admin.service.test.ts src/tests/routes/admin.routes.test.ts
git commit -m "feat: adiciona endpoint de alertas operacionais ao painel admin"
```

---

### Task 4: Frontend — `AdminAlertsTab`

**Files:**
- Create: `src/components/admin/AdminAlertsTab.tsx`

**Interfaces:**
- Consumes: `apiRequest` (`src/hooks/useApi.ts`), `react-router-dom`'s `Link`, endpoint `/api/admin/alerts` (Task 3).
- Produces: `AdminAlertsTab` React component (no props), consumed by `AdminDashboard.tsx` (Task 5).

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, CreditCard, TrendingDown, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

type AdminAlertType = 'churnRisk' | 'atLimit' | 'gracePeriodEnding' | 'paymentIssue';

interface AdminAlert {
  type: AdminAlertType;
  nutritionistId: string;
  name: string;
  email: string;
  detail: string;
}

const ALERT_GROUPS: { type: AdminAlertType; title: string; icon: typeof AlertTriangle }[] = [
  { type: 'gracePeriodEnding', title: 'Período de Carência Terminando', icon: Clock },
  { type: 'paymentIssue', title: 'Problemas de Pagamento', icon: CreditCard },
  { type: 'churnRisk', title: 'Risco de Churn', icon: TrendingDown },
  { type: 'atLimit', title: 'Atingiu Limite do Plano Gratuito', icon: AlertTriangle },
];

export function AdminAlertsTab() {
  const [alerts, setAlerts] = useState<AdminAlert[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ data: AdminAlert[] }>('/api/admin/alerts', 'GET');
      setAlerts(res?.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar alertas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-40 flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchAlerts} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ALERT_GROUPS.map(({ type, title, icon: Icon }) => {
        const items = (alerts ?? []).filter((a) => a.type === type);
        return (
          <Card key={type} className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center gap-3 border-b border-border pb-4">
              <Icon className="w-5 h-5 text-accent-foreground shrink-0" />
              <div>
                <CardTitle className="text-base font-bold">{title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{items.length} nutricionista(s)</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhum alerta nesta categoria.</p>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((a) => (
                    <Link
                      key={a.nutritionistId}
                      to={`/admin/nutritionists/${a.nutritionistId}`}
                      className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.email}</p>
                      </div>
                      <span className="text-xs text-accent-foreground font-medium">{a.detail}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

Save as `src/components/admin/AdminAlertsTab.tsx`.

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: no new TypeScript errors (not consumed anywhere yet).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminAlertsTab.tsx
git commit -m "feat: adiciona AdminAlertsTab"
```

---

### Task 5: Frontend — nova aba "Alertas"

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `AdminAlertsTab` (Task 4).

- [ ] **Step 1: Add the `Bell` icon and `AdminAlertsTab` imports**

Add `Bell` to the `lucide-react` import block. By the time this task runs, Task 2 (Fase 3) has already added `Download` to this same block, so it should read:

```tsx
import {
  Users,
  ShieldCheck,
  CreditCard,
  Search,
  Activity,
  Settings as SettingsIcon,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ClipboardList,
  UtensilsCrossed,
  ScrollText,
  Wrench,
  BarChart3,
  UserPlus,
  Pencil,
  Eye,
  FlaskConical,
  Download,
  Bell
} from 'lucide-react';
```

(If Task 2 hasn't run yet for some reason — e.g. this plan's two phases are being executed out of order — add `Bell` to whatever the current icon list is; the exact final list isn't load-bearing, only that `Bell` is present and nothing existing is removed.)

Add near the other admin component imports (after `AdminHeatmapGrid`):

```tsx
import { AdminAlertsTab } from '../components/admin/AdminAlertsTab';
```

- [ ] **Step 2: Add the "Alertas" tab trigger**

In the `TabsList`, add a new `TabsTrigger` — placing it right after "Visão Geral" (so it's prominent, near the top) and before "Nutricionistas":

```tsx
          <TabsTrigger 
            value="overview" 
            className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <LayoutDashboard className="w-4 h-4" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger
            value="alerts"
            className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <Bell className="w-4 h-4" /> Alertas
          </TabsTrigger>
          <TabsTrigger
            value="nutritionists"
            className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <Users className="w-4 h-4" /> Nutricionistas
          </TabsTrigger>
```

(Only the new `alerts` `TabsTrigger` is an actual addition — the "Visão Geral" and "Nutricionistas" triggers around it are shown unchanged, only so the insertion point is unambiguous.)

- [ ] **Step 3: Add the "Alertas" tab content**

Right after the `TabsContent value="overview"` block's closing `</TabsContent>` (before `TabsContent value="charts"`), add:

```tsx
        <TabsContent value="alerts">
          <AdminAlertsTab />
        </TabsContent>
```

- [ ] **Step 4: Verify manually in the browser**

Run `npm run dev`, log in as an admin, open "Painel Administrativo". Confirm:
- A new "Alertas" tab appears between "Visão Geral" and "Nutricionistas", with a bell icon.
- Opening it shows 4 grouped cards (Período de Carência Terminando, Problemas de Pagamento, Risco de Churn, Atingiu Limite do Plano Gratuito), each with a count and either a list of nutritionists or "Nenhum alerta nesta categoria."
- Clicking a nutritionist row in any group navigates to `/admin/nutritionists/:id` (the existing detail page).

- [ ] **Step 5: Run the full test suite (backend tests must still pass; this task doesn't add new tests)**

Run: `npm run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminDashboard.tsx
git commit -m "feat: adiciona aba Alertas ao painel admin"
```
