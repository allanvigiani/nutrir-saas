# Painel Admin — Fase 2: Gráficos e Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 visual insights to the admin "Gráficos" tab, consuming the business metrics Fase 1 already shipped (`payment-methods` is not charted per spec — see Fora de escopo) plus two brand-new endpoints (lab-exam adherence, activity heatmap): a churn-rate line, a lab-exam-adherence bar chart, a conversion funnel, a cohort-retention grid, and a day×hour activity heatmap.

**Architecture:** Two new backend read endpoints follow the exact pattern already used by the 7 existing `/api/admin/stats/*` endpoints in `src/server/routes/admin.routes.ts` and `src/server/services/admin-stats.service.ts` (Fase 1 shipped `payment-methods`, `conversion-funnel`, `churn-rate`, `retention-cohort` on top of the original 5). Four new frontend components live in `src/components/admin/`: one pure presentational grid (`AdminIntensityGrid`, no data fetching) reused by two self-fetching wrapper components (`AdminCohortGrid`, `AdminHeatmapGrid`) that follow `MonthlyStatChart.tsx`'s exact Card/loading/error/empty structure, plus one new chart component (`AdminFunnelChart`, using recharts' `FunnelChart`). Two existing metrics (churn-rate, lab-exam-adherence) need no new component — they're wired straight into the already-generic `MonthlyStatChart`. All 5 new visuals are added to the existing "Gráficos" `TabsContent` in `src/pages/AdminDashboard.tsx`.

**Tech Stack:** Express, Prisma, Zod, Vitest (backend only — see Global Constraints), React, recharts 3.8 (already installed, includes `FunnelChart`/`Funnel`), `date-fns`, Tailwind CSS with `color-mix()` for the grid's intensity coloring.

**Spec:** `docs/superpowers/specs/2026-08-16-melhorias-painel-admin-design.md` (section "Fase 2 — Insights (gráficos novos)")

## Global Constraints

- Backend tasks (1-2) follow Fase 1's exact conventions: `validateQuery(statsDateRangeSchema, ...)` (when the endpoint takes a period) → `withAdminRLS` → service call → `res.json({ data })`; month-grouping reuses `monthKey`/`buildMonthRange`/`endOfRangeExclusive`; every query inside `withAdminRLS`.
- Frontend tasks (3-6) are **not** covered by CLAUDE.md's Vitest scope (`src/server/**/*.ts` only) and Fase 1's sibling components (`MonthlyStatChart.tsx`, `PlanDistributionChart.tsx`) have no test files — verify these manually in the browser (`npm run dev`), matching the precedent already set in `docs/superpowers/plans/2026-08-11-importar-ultima-consulta.md`. Do not add new `.test.tsx` files for this phase.
- `/api/admin/stats/payment-methods` (shipped in Fase 1) is intentionally **not** charted in this phase — the spec scoped it as a metric only, not a Fase 2 visual. Don't add a chart for it here.
- The "Receita Mensal" `MonthlyStatChart` already on the page (endpoint `/api/admin/stats/revenue`) is GMV from `Payment` (patient→nutritionist billing), not Nutrir subscription revenue — this phase does not touch it.
- `getChurnRateByMonth`'s response is a documented approximation (see the comment above it in `admin-stats.service.ts`) — the new chart's UI copy must say "aproximado", not present it as exact historical churn.
- New route placement: insert both Task 1 and Task 2's routes after the existing `/api/admin/stats/retention-cohort` handler (`admin.routes.ts`), before the `plan-distribution` comment block.

---

### Task 1: Backend — Adesão a exames laboratoriais (`getLabExamAdherenceByMonth`)

**Files:**
- Modify: `src/server/services/admin-stats.service.ts`
- Modify: `src/server/routes/admin.routes.ts`
- Modify: `src/tests/services/admin-stats.service.test.ts`
- Modify: `src/tests/routes/admin.routes.test.ts`

**Interfaces:**
- Produces: `getLabExamAdherenceByMonth(from: Date, to: Date): Promise<MonthlyPoint[]>` (reuses the existing `MonthlyPoint` type). Endpoint: `GET /api/admin/stats/lab-exam-adherence?from=...&to=...` → `{ data: MonthlyPoint[] }`.

- [ ] **Step 1: Add the `labExam` mock target and write the failing service test**

In `src/tests/services/admin-stats.service.test.ts`, the top-of-file `mockDb` object needs a `labExam` entry — it doesn't have one yet. Add it:

```ts
  labExam: { findMany: vi.fn() },
```

Then add a new describe block after `describe('AdminStatsService.getMealPlansByMonth', ...)`:

```ts
describe('AdminStatsService.getLabExamAdherenceByMonth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('agrupa contagem de exames laboratoriais criados por mês, excluindo deletedAt', async () => {
    mockDb.labExam.findMany.mockResolvedValue([
      { date: d(2026, 6, 5).toISOString() },
      { date: d(2026, 6, 20).toISOString() },
      { date: d(2026, 7, 1).toISOString() },
    ]);

    const service = createAdminStatsService();
    const result = await service.getLabExamAdherenceByMonth(d(2026, 6, 1), d(2026, 7, 31));

    expect(mockDb.labExam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    );
    expect(result).toEqual([
      { month: '2026-06', value: 2 },
      { month: '2026-07', value: 1 },
    ]);
  });

  it('ignora registros com date inválida (não numérica ao fazer parse)', async () => {
    mockDb.labExam.findMany.mockResolvedValue([
      { date: 'data-invalida' },
      { date: d(2026, 6, 5).toISOString() },
    ]);

    const service = createAdminStatsService();
    const result = await service.getLabExamAdherenceByMonth(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([{ month: '2026-06', value: 1 }]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- admin-stats.service.test.ts`
Expected: FAIL with `service.getLabExamAdherenceByMonth is not a function`

- [ ] **Step 3: Implement `getLabExamAdherenceByMonth`**

In `src/server/services/admin-stats.service.ts`, add the method right after `getMealPlansByMonth` (mirrors `getConsultationsByMonth`'s pattern exactly — `LabExam.date` is a `String`, same as `Consultation.date`):

```ts
  async function getLabExamAdherenceByMonth(from: Date, to: Date): Promise<MonthlyPoint[]> {
    // LabExam.date é string ISO (não DateTime), mesmo padrão de getConsultationsByMonth
    // nesta service — comparação lexicográfica funciona pois o formato é sempre ISO 8601.
    const labExams = await getDb().labExam.findMany({
      where: { deletedAt: null, date: { gte: from.toISOString(), lt: endOfRangeExclusive(to).toISOString() } },
      select: { date: true },
    });

    const counts = new Map<string, number>();
    for (const labExam of labExams) {
      const parsed = new Date(labExam.date);
      if (Number.isNaN(parsed.getTime())) continue;
      const key = monthKey(parsed);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return fillMonths(buildMonthRange(from, to), counts);
  }
```

Add `getLabExamAdherenceByMonth,` to the object returned at the bottom of `createAdminStatsService()`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- admin-stats.service.test.ts`
Expected: PASS

- [ ] **Step 5: Register the route**

In `src/server/routes/admin.routes.ts`, add right after the `/api/admin/stats/retention-cohort` handler (its closing `});`), before the `plan-distribution` comment block:

```ts
  deps.app.get('/api/admin/stats/lab-exam-adherence', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const query = validateQuery(statsDateRangeSchema, req, res);
    if (!query) return;
    try {
      await withAdminRLS(async () => {
        const data = await adminStatsService.getLabExamAdherenceByMonth(new Date(query.from), new Date(query.to));
        res.json({ data });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
```

- [ ] **Step 6: Wire into the existing data-driven route test**

In `src/tests/routes/admin.routes.test.ts`:
1. Add `getLabExamAdherenceByMonth: vi.fn().mockResolvedValue([]),` to the mocked `createAdminStatsService` return object.
2. Add `{ path: '/api/admin/stats/lab-exam-adherence', fn: 'getLabExamAdherenceByMonth' },` to the `seriesCases` array (append after the `retention-cohort` row).

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/server/services/admin-stats.service.ts src/server/routes/admin.routes.ts src/tests/services/admin-stats.service.test.ts src/tests/routes/admin.routes.test.ts
git commit -m "feat: adiciona adesão a exames laboratoriais ao painel admin"
```

---

### Task 2: Backend — Heatmap de atividade (`getActivityHeatmap`)

**Files:**
- Modify: `src/server/services/admin-stats.service.ts`
- Modify: `src/server/routes/admin.routes.ts`
- Modify: `src/tests/services/admin-stats.service.test.ts`
- Modify: `src/tests/routes/admin.routes.test.ts`

**Interfaces:**
- Produces: `getActivityHeatmap(): Promise<ActivityHeatmapPoint[]>` where `ActivityHeatmapPoint = { day: number; hour: number; count: number }` (`day` 0-6 = Sunday-Saturday UTC, `hour` 0-23 UTC). Always returns exactly 168 entries (7×24, zero-filled) — no missing cells. Endpoint: `GET /api/admin/stats/activity-heatmap` (no `from`/`to` — fixed 90-day trailing window, same "sem período" shape as `/api/admin/stats/plan-distribution`) → `{ data: ActivityHeatmapPoint[] }`.

- [ ] **Step 1: Add the `appointment` mock target and write the failing service test**

In `src/tests/services/admin-stats.service.test.ts`, add `appointment: { findMany: vi.fn() },` to the top-of-file `mockDb` object (it doesn't have one yet; `labExam` was added in Task 1).

Add a new describe block after the `getLabExamAdherenceByMonth` block:

```ts
describe('AdminStatsService.getActivityHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(d(2026, 9, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna grid completo de 168 células (7x24) com contagem de consultas e agendamentos na mesma célula', async () => {
    mockDb.consultation.findMany.mockResolvedValue([
      { date: '2026-09-14T10:30:00.000Z' },
    ]);
    mockDb.appointment.findMany.mockResolvedValue([
      { date: new Date('2026-09-14T10:15:00.000Z') },
    ]);

    const service = createAdminStatsService();
    const result = await service.getActivityHeatmap();

    expect(result).toHaveLength(168);
    const expectedDay = new Date('2026-09-14T10:30:00.000Z').getUTCDay();
    const cell = result.find((p) => p.day === expectedDay && p.hour === 10);
    expect(cell?.count).toBe(2);
  });

  it('filtra deletedAt e usa uma janela de 90 dias terminando em "agora"', async () => {
    mockDb.consultation.findMany.mockResolvedValue([]);
    mockDb.appointment.findMany.mockResolvedValue([]);

    const service = createAdminStatsService();
    const result = await service.getActivityHeatmap();

    expect(mockDb.consultation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    );
    expect(mockDb.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    );
    expect(result.every((p) => p.count === 0)).toBe(true);
  });

  it('ignora registros de consulta com date inválida', async () => {
    mockDb.consultation.findMany.mockResolvedValue([{ date: 'data-invalida' }]);
    mockDb.appointment.findMany.mockResolvedValue([]);

    const service = createAdminStatsService();
    const result = await service.getActivityHeatmap();

    expect(result.every((p) => p.count === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- admin-stats.service.test.ts`
Expected: FAIL with `service.getActivityHeatmap is not a function`

- [ ] **Step 3: Implement `getActivityHeatmap`**

In `src/server/services/admin-stats.service.ts`, add the interface and constant near the top (after `CohortRetention`/`MAX_COHORT_OFFSET`):

```ts
export interface ActivityHeatmapPoint {
  day: number; // 0 (domingo) a 6 (sábado), UTC
  hour: number; // 0-23, UTC
  count: number;
}

const ACTIVITY_HEATMAP_WINDOW_DAYS = 90;
```

Add the method after `getRetentionCohorts`:

```ts
  async function getActivityHeatmap(): Promise<ActivityHeatmapPoint[]> {
    const windowStart = new Date(Date.now() - ACTIVITY_HEATMAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [consultations, appointments] = await Promise.all([
      // Consultation.date é string ISO — comparação lexicográfica, mesmo padrão do resto
      // do arquivo.
      getDb().consultation.findMany({
        where: { deletedAt: null, date: { gte: windowStart.toISOString() } },
        select: { date: true },
      }),
      getDb().appointment.findMany({
        where: { deletedAt: null, date: { gte: windowStart } },
        select: { date: true },
      }),
    ]);

    const counts = new Map<string, number>();
    const mark = (date: Date) => {
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getUTCDay()}-${date.getUTCHours()}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };
    for (const c of consultations) mark(new Date(c.date));
    for (const a of appointments) mark(a.date);

    const points: ActivityHeatmapPoint[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        points.push({ day, hour, count: counts.get(`${day}-${hour}`) ?? 0 });
      }
    }
    return points;
  }
```

Add `getActivityHeatmap,` to the object returned at the bottom of `createAdminStatsService()`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- admin-stats.service.test.ts`
Expected: PASS

- [ ] **Step 5: Register the route**

In `src/server/routes/admin.routes.ts`, add right after the `lab-exam-adherence` handler (Task 1's addition), before the `plan-distribution` comment block. This endpoint takes **no** query params — no `validateQuery` call, matching the `plan-distribution` route's shape:

```ts
  deps.app.get('/api/admin/stats/activity-heatmap', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        const data = await adminStatsService.getActivityHeatmap();
        res.json({ data });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
```

- [ ] **Step 6: Add a bespoke route test (not the `seriesCases` table — this endpoint has no `from`/`to`)**

In `src/tests/routes/admin.routes.test.ts`:
1. Add `getActivityHeatmap: vi.fn().mockResolvedValue([]),` to the mocked `createAdminStatsService` return object.
2. Add a new `describe` block near the existing `describe('GET /api/admin/stats/plan-distribution', ...)` block (same file, same "no period required" shape):

```ts
  describe('GET /api/admin/stats/activity-heatmap', () => {
    it('retorna 403 para não-admin', async () => {
      const res = await request(buildApp(false)).get('/api/admin/stats/activity-heatmap');
      expect(res.status).toBe(403);
    });

    it('retorna 200 com { data } para admin, sem exigir from/to', async () => {
      const app = buildApp(true);
      const statsServiceInstance = lastServiceInstance(createAdminStatsService);
      (statsServiceInstance.getActivityHeatmap as any).mockResolvedValueOnce([{ day: 1, hour: 10, count: 2 }]);

      const res = await request(app).get('/api/admin/stats/activity-heatmap');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [{ day: 1, hour: 10, count: 2 }] });
    });
  });
```

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/server/services/admin-stats.service.ts src/server/routes/admin.routes.ts src/tests/services/admin-stats.service.test.ts src/tests/routes/admin.routes.test.ts
git commit -m "feat: adiciona heatmap de atividade (dia x hora) ao painel admin"
```

---

### Task 3: Frontend — `AdminIntensityGrid` (grid reutilizável)

**Files:**
- Create: `src/components/admin/AdminIntensityGrid.tsx`

**Interfaces:**
- Produces: `AdminIntensityGrid` React component, props `{ rowLabels: string[]; colLabels: string[]; values: number[][]; formatValue?: (value: number) => string }` — pure presentational, no data fetching, no `Card` wrapper (the components that use it in Tasks 4 own their own `Card`/loading/error/empty states, exactly like `MonthlyStatChart.tsx` does around its `BarChart`). Consumed by `AdminCohortGrid` and `AdminHeatmapGrid` (Task 4).

- [ ] **Step 1: Create the component**

```tsx
interface AdminIntensityGridProps {
  rowLabels: string[];
  colLabels: string[];
  values: number[][]; // values[rowIndex][colIndex]
  formatValue?: (value: number) => string;
}

export function AdminIntensityGrid({
  rowLabels,
  colLabels,
  values,
  formatValue = (v) => v.toLocaleString('pt-BR'),
}: AdminIntensityGridProps) {
  const maxValue = Math.max(0, ...values.flat());

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-20" />
            {colLabels.map((label) => (
              <th key={label} className="text-[10px] font-medium text-muted-foreground px-1 whitespace-nowrap">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((rowLabel, rowIndex) => (
            <tr key={rowLabel}>
              <th className="text-[10px] font-medium text-muted-foreground text-right pr-2 whitespace-nowrap">
                {rowLabel}
              </th>
              {colLabels.map((colLabel, colIndex) => {
                const value = values[rowIndex]?.[colIndex] ?? 0;
                const intensity = maxValue > 0 ? value / maxValue : 0;
                return (
                  <td
                    key={colLabel}
                    title={`${rowLabel} · ${colLabel}: ${formatValue(value)}`}
                    className="w-6 h-6 rounded-sm"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(--primary) ${Math.round(intensity * 100)}%, var(--muted))`,
                    }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Save as `src/components/admin/AdminIntensityGrid.tsx`.

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: no new TypeScript errors (the component isn't consumed anywhere yet — this only checks the file itself is valid TS/TSX).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminIntensityGrid.tsx
git commit -m "feat: adiciona AdminIntensityGrid, grid de intensidade reutilizável"
```

---

### Task 4: Frontend — `AdminCohortGrid` e `AdminHeatmapGrid`

**Files:**
- Create: `src/components/admin/AdminCohortGrid.tsx`
- Create: `src/components/admin/AdminHeatmapGrid.tsx`

**Interfaces:**
- Consumes: `AdminIntensityGrid` (Task 3), `DateRangeFilter`/`DateRangeValue` (`src/components/admin/DateRangeFilter.tsx`, already exists), `apiRequest` (`src/hooks/useApi.ts`, already exists), endpoints `/api/admin/stats/retention-cohort` and `/api/admin/stats/activity-heatmap` (Fase 1 and Task 2 of this plan).
- Produces: `AdminCohortGrid` and `AdminHeatmapGrid` React components (no props), consumed by `AdminDashboard.tsx` (Task 6).

- [ ] **Step 1: Create `AdminCohortGrid.tsx`**

Mirrors `MonthlyStatChart.tsx`'s Card/`DateRangeFilter`/loading/error/empty structure exactly, swapping the `BarChart` body for `AdminIntensityGrid`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { format, parseISO, startOfMonth, subMonths, differenceInCalendarMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RefreshCw, Users } from 'lucide-react';
import { apiRequest } from '../../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { DateRangeFilter, type DateRangeValue } from './DateRangeFilter';
import { AdminIntensityGrid } from './AdminIntensityGrid';

interface CohortRetention {
  cohortMonth: string;
  cohortSize: number;
  retention: { offset: number; pct: number }[];
}

const OFFSET_LABELS = ['Mês 0', 'Mês +1', 'Mês +2', 'Mês +3'];

function defaultRange(): DateRangeValue {
  const to = new Date();
  const from = startOfMonth(subMonths(to, 5));
  return { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };
}

function monthLabel(month: string): string {
  try {
    return format(parseISO(`${month}-01`), 'MMM/yy', { locale: ptBR });
  } catch {
    return month;
  }
}

export function AdminCohortGrid() {
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [cohorts, setCohorts] = useState<CohortRetention[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rangeValid =
    !!range.from &&
    !!range.to &&
    range.from <= range.to &&
    differenceInCalendarMonths(new Date(`${range.to}T00:00:00`), new Date(`${range.from}T00:00:00`)) <= 24;

  const fetchData = useCallback(async () => {
    if (!rangeValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ data: CohortRetention[] }>(
        `/api/admin/stats/retention-cohort?from=${range.from}&to=${range.to}`,
        'GET'
      );
      setCohorts(res?.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, rangeValid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const cohortsWithData = (cohorts ?? []).filter((c) => c.cohortSize > 0);
  const isEmpty = !loading && !error && cohortsWithData.length === 0;

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <CardTitle className="text-base font-bold">Cohort de Retenção</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">% de nutricionistas ativos por mês desde o cadastro</p>
          </div>
        </div>
        <DateRangeFilter id="retention-cohort" value={range} onChange={setRange} disabled={loading} />
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="h-[220px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="h-[220px] flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </Button>
          </div>
        ) : !rangeValid ? (
          <div className="h-[220px] flex items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">Ajuste o período selecionado para ver os dados.</p>
          </div>
        ) : isEmpty ? (
          <div className="h-[220px] flex items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">Nenhum nutricionista cadastrado no período selecionado.</p>
          </div>
        ) : (
          <AdminIntensityGrid
            rowLabels={cohortsWithData.map((c) => `${monthLabel(c.cohortMonth)} (${c.cohortSize})`)}
            colLabels={OFFSET_LABELS}
            values={cohortsWithData.map((c) => {
              const byOffset = new Map(c.retention.map((r) => [r.offset, r.pct]));
              return OFFSET_LABELS.map((_, offset) => byOffset.get(offset) ?? 0);
            })}
            formatValue={(v) => `${v}%`}
          />
        )}
      </CardContent>
    </Card>
  );
}
```

Save as `src/components/admin/AdminCohortGrid.tsx`.

- [ ] **Step 2: Create `AdminHeatmapGrid.tsx`**

No date-range filter (the endpoint is a fixed 90-day window) — fetches once on mount:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { apiRequest } from '../../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { AdminIntensityGrid } from './AdminIntensityGrid';

interface ActivityHeatmapPoint {
  day: number;
  hour: number;
  count: number;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${h}h`);

export function AdminHeatmapGrid() {
  const [points, setPoints] = useState<ActivityHeatmapPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ data: ActivityHeatmapPoint[] }>('/api/admin/stats/activity-heatmap', 'GET');
      setPoints(res?.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const values = DAY_LABELS.map((_, day) =>
    HOUR_LABELS.map((_, hour) => points?.find((p) => p.day === day && p.hour === hour)?.count ?? 0)
  );
  const isEmpty = !loading && !error && values.flat().every((v) => v === 0);

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="flex flex-row items-start gap-3 border-b border-border pb-4">
        <Activity className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div>
          <CardTitle className="text-base font-bold">Atividade por Dia e Horário</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Consultas e agendamentos nos últimos 90 dias</p>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="h-[220px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="h-[220px] flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </Button>
          </div>
        ) : isEmpty ? (
          <div className="h-[220px] flex items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">Nenhuma atividade nos últimos 90 dias.</p>
          </div>
        ) : (
          <AdminIntensityGrid rowLabels={DAY_LABELS} colLabels={HOUR_LABELS} values={values} />
        )}
      </CardContent>
    </Card>
  );
}
```

Save as `src/components/admin/AdminHeatmapGrid.tsx`.

- [ ] **Step 3: Verify both compile**

Run: `npm run lint`
Expected: no new TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminCohortGrid.tsx src/components/admin/AdminHeatmapGrid.tsx
git commit -m "feat: adiciona AdminCohortGrid e AdminHeatmapGrid"
```

---

### Task 5: Frontend — `AdminFunnelChart`

**Files:**
- Create: `src/components/admin/AdminFunnelChart.tsx`

**Interfaces:**
- Consumes: `apiRequest`, `DateRangeFilter`/`DateRangeValue`, `ChartContainer`/`ChartTooltip`/`ChartTooltipContent`/`ChartConfig` (`src/components/ui/chart.tsx`, already used by `MonthlyStatChart`/`PlanDistributionChart`), `FunnelChart`/`Funnel`/`LabelList` from `recharts` (v3.8, already installed — confirmed exports exist at `node_modules/recharts/types/index.d.ts`), endpoint `/api/admin/stats/conversion-funnel` (Fase 1).
- Produces: `AdminFunnelChart` React component (no props), consumed by `AdminDashboard.tsx` (Task 6).

- [ ] **Step 1: Create the component**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Funnel, FunnelChart, LabelList } from 'recharts';
import { Filter, RefreshCw } from 'lucide-react';
import { format, startOfMonth, subMonths, differenceInCalendarMonths } from 'date-fns';
import { apiRequest } from '../../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../ui/chart';
import { DateRangeFilter, type DateRangeValue } from './DateRangeFilter';

interface ConversionFunnel {
  signedUp: number;
  activated: number;
  premium: number;
}

const chartConfig: ChartConfig = {
  value: { label: 'Nutricionistas', color: 'var(--chart-1)' },
};

function defaultRange(): DateRangeValue {
  const to = new Date();
  const from = startOfMonth(subMonths(to, 5));
  return { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };
}

export function AdminFunnelChart() {
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rangeValid =
    !!range.from &&
    !!range.to &&
    range.from <= range.to &&
    differenceInCalendarMonths(new Date(`${range.to}T00:00:00`), new Date(`${range.from}T00:00:00`)) <= 24;

  const fetchData = useCallback(async () => {
    if (!rangeValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ data: ConversionFunnel }>(
        `/api/admin/stats/conversion-funnel?from=${range.from}&to=${range.to}`,
        'GET'
      );
      setFunnel(res?.data ?? null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, rangeValid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const data = funnel
    ? [
        { key: 'signedUp', name: 'Cadastrados', value: funnel.signedUp, fill: 'var(--chart-1)' },
        { key: 'activated', name: 'Ativados', value: funnel.activated, fill: 'var(--chart-2)' },
        { key: 'premium', name: 'Premium', value: funnel.premium, fill: 'var(--chart-3)' },
      ]
    : [];

  const isEmpty = !loading && !error && (!funnel || funnel.signedUp === 0);

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <Filter className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <CardTitle className="text-base font-bold">Funil de Conversão</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Cadastro → paciente ativo → premium</p>
          </div>
        </div>
        <DateRangeFilter id="conversion-funnel" value={range} onChange={setRange} disabled={loading} />
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="h-[220px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="h-[220px] flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </Button>
          </div>
        ) : !rangeValid ? (
          <div className="h-[220px] flex items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">Ajuste o período selecionado para ver os dados.</p>
          </div>
        ) : isEmpty ? (
          <div className="h-[220px] flex items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">Nenhum cadastro no período selecionado.</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <FunnelChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
              <Funnel dataKey="value" data={data} nameKey="key">
                <LabelList position="right" dataKey="name" fill="var(--foreground)" stroke="none" fontSize={12} />
              </Funnel>
            </FunnelChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

Save as `src/components/admin/AdminFunnelChart.tsx`.

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: no new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminFunnelChart.tsx
git commit -m "feat: adiciona AdminFunnelChart (funil de conversão)"
```

---

### Task 6: Frontend — Conectar tudo na aba "Gráficos"

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `AdminFunnelChart` (Task 5), `AdminCohortGrid`/`AdminHeatmapGrid` (Task 4), `MonthlyStatChart` (already imported), endpoints `/api/admin/stats/churn-rate` (Fase 1), `/api/admin/stats/lab-exam-adherence` (Task 1).

- [ ] **Step 1: Add the two new icon imports**

The `lucide-react` import block starts at line 8. Add `TrendingDown` and `FlaskConical` to it (alongside the existing icons):

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
  FlaskConical
} from 'lucide-react';
```

- [ ] **Step 2: Add the 3 new component imports**

Right after the existing `PlanDistributionChart` import (line 36):

```tsx
import { MonthlyStatChart } from '../components/admin/MonthlyStatChart';
import { PlanDistributionChart } from '../components/admin/PlanDistributionChart';
import { AdminFunnelChart } from '../components/admin/AdminFunnelChart';
import { AdminCohortGrid } from '../components/admin/AdminCohortGrid';
import { AdminHeatmapGrid } from '../components/admin/AdminHeatmapGrid';
```

- [ ] **Step 3: Add the 5 new visuals to the "Gráficos" `TabsContent`**

Find the `TabsContent value="charts"` block (currently ends with `<PlanDistributionChart />` right before its closing `</div></TabsContent>`):

```tsx
        <TabsContent value="charts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MonthlyStatChart
              title="Receita Mensal"
              description="Pagamentos confirmados (status pago)"
              icon={Activity}
              endpoint="/api/admin/stats/revenue"
              valueFormatter={(v) => `R$ ${v.toFixed(2).replace('.', ',')}`}
            />
            <MonthlyStatChart
              title="Pacientes Cadastrados"
              description="Novos pacientes por mês"
              icon={Users}
              endpoint="/api/admin/stats/patients-growth"
            />
            <MonthlyStatChart
              title="Novos Assinantes"
              description="Início de assinatura premium por mês"
              icon={UserPlus}
              endpoint="/api/admin/stats/new-subscribers"
            />
            <MonthlyStatChart
              title="Consultas"
              description="Consultas registradas por mês"
              icon={ClipboardList}
              endpoint="/api/admin/stats/consultations"
            />
            <MonthlyStatChart
              title="Planos Alimentares Criados"
              description="Novos planos alimentares por mês"
              icon={UtensilsCrossed}
              endpoint="/api/admin/stats/meal-plans"
            />
            <PlanDistributionChart />
          </div>
        </TabsContent>
```

becomes:

```tsx
        <TabsContent value="charts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MonthlyStatChart
              title="Receita Mensal"
              description="Pagamentos confirmados (status pago)"
              icon={Activity}
              endpoint="/api/admin/stats/revenue"
              valueFormatter={(v) => `R$ ${v.toFixed(2).replace('.', ',')}`}
            />
            <MonthlyStatChart
              title="Pacientes Cadastrados"
              description="Novos pacientes por mês"
              icon={Users}
              endpoint="/api/admin/stats/patients-growth"
            />
            <MonthlyStatChart
              title="Novos Assinantes"
              description="Início de assinatura premium por mês"
              icon={UserPlus}
              endpoint="/api/admin/stats/new-subscribers"
            />
            <MonthlyStatChart
              title="Consultas"
              description="Consultas registradas por mês"
              icon={ClipboardList}
              endpoint="/api/admin/stats/consultations"
            />
            <MonthlyStatChart
              title="Planos Alimentares Criados"
              description="Novos planos alimentares por mês"
              icon={UtensilsCrossed}
              endpoint="/api/admin/stats/meal-plans"
            />
            <PlanDistributionChart />
            <MonthlyStatChart
              title="Churn Rate Mensal (aproximado)"
              description="Cancelamentos agendados/pendentes por mês, sobre o total premium atual"
              icon={TrendingDown}
              endpoint="/api/admin/stats/churn-rate"
              valueFormatter={(v) => `${v}%`}
            />
            <MonthlyStatChart
              title="Adesão a Exames Laboratoriais"
              description="Exames registrados por mês"
              icon={FlaskConical}
              endpoint="/api/admin/stats/lab-exam-adherence"
            />
            <AdminFunnelChart />
            <AdminCohortGrid />
            <div className="lg:col-span-2">
              <AdminHeatmapGrid />
            </div>
          </div>
        </TabsContent>
```

(`AdminHeatmapGrid` spans the full grid width — 24 hour-columns don't fit well in a half-width card next to the 2-column layout the other cards use.)

- [ ] **Step 4: Verify manually in the browser**

Run `npm run dev`, log in as an admin, open "Painel Administrativo" → "Gráficos". Confirm:
- "Churn Rate Mensal (aproximado)" and "Adesão a Exames Laboratoriais" render as bar charts with working date-range filters (same behavior as the 5 pre-existing `MonthlyStatChart`s).
- "Funil de Conversão" renders a 3-stage funnel (Cadastrados → Ativados → Premium) with a working date-range filter; hovering a stage shows a tooltip.
- "Cohort de Retenção" renders a grid (rows = signup months, columns = Mês 0/+1/+2/+3) with colored cells and a working date-range filter; hovering a cell shows the exact percentage via the native tooltip.
- "Atividade por Dia e Horário" renders a 7×24 grid spanning the full row width, with colored cells and no date-range filter (fixed 90-day window); hovering a cell shows the exact count.
- All 5 new cards show a loading spinner briefly, then data (or the empty-state message if there's genuinely no data for a given metric — verify this doesn't happen for all 5 at once, which would suggest a wiring bug).

- [ ] **Step 5: Run the full test suite (backend tests must still pass; this task doesn't add new tests)**

Run: `npm run test`
Expected: PASS (679+ tests from Fase 1 plus Tasks 1-2 of this plan, unaffected by this frontend-only task)

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminDashboard.tsx
git commit -m "feat: conecta funil, cohort, heatmap, churn rate e adesão a exames na aba Gráficos"
```
