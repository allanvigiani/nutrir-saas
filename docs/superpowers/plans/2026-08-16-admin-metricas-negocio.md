# Painel Admin — Fase 1: Métricas de Negócio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five new business metrics to the admin backend (more precise paying-premium revenue estimate, average ticket by payment method, signup→premium conversion funnel, monthly churn rate, and cohort retention), each exposed as a new/changed `/api/admin/stats/*` endpoint, ready for Fase 2 to chart.

**Architecture:** Backend-only phase (except task 1, which also touches the existing "Receita Estimada" KPI card since it renames a field already rendered). New read-only endpoints follow the exact pattern already used by the 5 existing `/api/admin/stats/*` series endpoints in `src/server/routes/admin.routes.ts`: `validateQuery(statsDateRangeSchema, ...)` → `withAdminRLS` → service call → `res.json({ data })`. New service methods live in `src/server/services/admin-stats.service.ts` (in-memory `Map` grouping, same convention as the existing methods there — no raw SQL/`groupBy`).

**Tech Stack:** Express, Prisma, Zod, Vitest, `date-fns`.

**Spec:** `docs/superpowers/specs/2026-08-16-melhorias-painel-admin-design.md` (sections "Fase 1 — Fundação")

## Global Constraints

- `Payment` = faturamento paciente→nutricionista (feature Financeiro), **não** é receita de assinatura Nutrir. Nenhuma métrica desta fase deve ser rotulada como "receita da Nutrir" quando vier de `Payment`.
- Nenhuma chamada ao Asaas API em tempo de request — só leitura do campo já sincronizado `Subscription.asaasStatus`.
- Todo agrupamento por mês usa `monthKey`/`buildMonthRange`/`endOfRangeExclusive` já existentes em `admin-stats.service.ts` (getters UTC, nunca locais).
- Toda query nova roda dentro de `withAdminRLS` (já garantido pelos route handlers existentes — não remover esse wrapper).
- Toda rota nova exige `assertAdmin` e usa `statsDateRangeSchema` (`from`/`to`, máx. 24 meses) — mesmo padrão das 5 rotas de série já existentes.
- Estados "pagantes" do Asaas usados nesta fase: `CONFIRMED`, `RECEIVED`, `ACTIVE` (ver `asaas.service.ts:27-139` e a skill `asaas-integration`).

---

### Task 1: Estimativa de receita paga mais precisa (`payingPremiumRevenue`)

**Files:**
- Modify: `src/server/services/admin.service.ts:34-60` (`getStats`)
- Modify: `src/tests/services/admin.service.test.ts:22-55`
- Modify: `src/pages/AdminDashboard.tsx:74`, `:112`, `:281-286`

**Interfaces:**
- Produces: `getStats()` now returns `payingPremiumRevenue: number` instead of `estimatedRevenue: number` (all other fields unchanged). `getExpandedStats()` inherits this automatically (it spreads `getStats()`'s result).

- [ ] **Step 1: Update the existing `getStats` test to expect the new field and the new query**

In `src/tests/services/admin.service.test.ts`, replace the `describe('AdminService.getStats', ...)` block (lines 22-55) with:

```ts
describe('AdminService.getStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calcula conversão e receita paga corretamente', async () => {
    mockDb.nutritionist.count
      .mockResolvedValueOnce(10)   // total
      .mockResolvedValueOnce(3)    // premium
      .mockResolvedValueOnce(2)    // payingPremium (asaasStatus pagante)
      .mockResolvedValueOnce(1)    // admin
      .mockResolvedValueOnce(7)    // active last 30 days
      .mockResolvedValueOnce(2);   // new last 7 days
    mockDb.patient.count.mockResolvedValue(50);

    const service = createAdminService();
    const stats = await service.getStats();

    expect(stats.totalNutritionists).toBe(10);
    expect(stats.premiumCount).toBe(3);
    expect(stats.freeCount).toBe(6); // 10 - 3 - 1 = 6
    expect(stats.conversionRate).toBe(30); // 3/10 * 100
    expect(stats.payingPremiumRevenue).toBeCloseTo(79.80); // 2 * 39.90
    expect(stats.totalPatients).toBe(50);
  });

  it('conta payingPremiumRevenue só com assinaturas em status pagante do Asaas', async () => {
    mockDb.nutritionist.count.mockResolvedValue(0);
    mockDb.patient.count.mockResolvedValue(0);

    const service = createAdminService();
    await service.getStats();

    expect(mockDb.nutritionist.count).toHaveBeenNthCalledWith(3, {
      where: { plan: 'premium', subscription: { asaasStatus: { in: ['CONFIRMED', 'RECEIVED', 'ACTIVE'] } } },
    });
  });

  it('retorna conversionRate 0 quando não há nutricionistas', async () => {
    mockDb.nutritionist.count.mockResolvedValue(0);
    mockDb.patient.count.mockResolvedValue(0);

    const service = createAdminService();
    const stats = await service.getStats();

    expect(stats.conversionRate).toBe(0);
    expect(stats.payingPremiumRevenue).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- admin.service.test.ts`
Expected: FAIL — `stats.payingPremiumRevenue` is `undefined` (field doesn't exist yet), and the 3rd `nutritionist.count` call assertion fails (no query with `subscription.asaasStatus` is made yet).

- [ ] **Step 3: Implement `payingPremiumRevenue` in `getStats`**

In `src/server/services/admin.service.ts`, add the paying-status constant right after `PREMIUM_PRICE` (line 4):

```ts
const PREMIUM_PRICE = 39.90;

// Estados do Asaas que representam uma assinatura efetivamente sendo paga agora —
// ver mapeamento de eventos em asaas.service.ts:27-139. Exclui OVERDUE/PENDING/
// AWAITING_RISK_ANALYSIS/DELETED/REFUNDED/INACTIVE, que plan==='premium' sozinho não filtra.
const PAYING_ASAAS_STATUSES = ['CONFIRMED', 'RECEIVED', 'ACTIVE'];
```

Replace the body of `getStats` (lines 35-60):

```ts
  async function getStats() {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30).toISOString();
    const sevenDaysAgo = subDays(now, 7).toISOString();

    const [total, premium, payingPremium, admin, activeLast30, newLast7, totalPatients] = await Promise.all([
      getDb().nutritionist.count(),
      getDb().nutritionist.count({ where: { plan: 'premium' } }),
      getDb().nutritionist.count({
        where: { plan: 'premium', subscription: { asaasStatus: { in: PAYING_ASAAS_STATUSES } } },
      }),
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
      payingPremiumRevenue: parseFloat((payingPremium * PREMIUM_PRICE).toFixed(2)),
      activeLast30Days: activeLast30,
      newLast7Days: newLast7,
      totalPatients,
    };
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- admin.service.test.ts`
Expected: PASS

- [ ] **Step 5: Propagate the field rename to `AdminDashboard.tsx`**

In `src/pages/AdminDashboard.tsx`, there are two identical inline type shapes containing `estimatedRevenue: number;` — one at line 74 (the `adminStats` state type) and one at line 112 (the `apiRequest<...>` generic for `/api/admin/stats/expanded`). In both, replace:

```ts
    estimatedRevenue: number;
```

with:

```ts
    payingPremiumRevenue: number;
```

Then update the "Receita Estimada" card (lines 276-289):

```tsx
            {/* Receita */}
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Receita Estimada</p>
                    <p className="text-2xl font-bold text-foreground">
                      {adminStats ? `R$ ${adminStats.estimatedRevenue.toFixed(2).replace('.', ',')}` : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">mensal recorrente</p>
                  </div>
                </div>
              </CardContent>
            </Card>
```

becomes:

```tsx
            {/* Receita */}
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Receita Estimada</p>
                    <p className="text-2xl font-bold text-foreground">
                      {adminStats ? `R$ ${adminStats.payingPremiumRevenue.toFixed(2).replace('.', ',')}` : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">assinantes premium com pagamento em dia</p>
                  </div>
                </div>
              </CardContent>
            </Card>
```

- [ ] **Step 6: Verify manually in the browser**

Run `npm run dev`, log in as an admin, open "Painel Administrativo" → "Visão Geral". Confirm the "Receita Estimada" card renders a value (not `—`) and the subtitle now reads "assinantes premium com pagamento em dia".

- [ ] **Step 7: Run the full test suite and commit**

Run: `npm run test`
Expected: all tests pass (this confirms nothing else referenced `estimatedRevenue`).

```bash
git add src/server/services/admin.service.ts src/tests/services/admin.service.test.ts src/pages/AdminDashboard.tsx
git commit -m "feat: estimativa de receita premium considera só assinaturas com pagamento confirmado no Asaas"
```

---

### Task 2: Ticket médio por forma de pagamento

**Files:**
- Modify: `src/server/services/admin-stats.service.ts`
- Modify: `src/server/routes/admin.routes.ts`
- Modify: `src/tests/services/admin-stats.service.test.ts`
- Modify: `src/tests/routes/admin.routes.test.ts:43-52`, `:302-308`

**Interfaces:**
- Produces: `getPaymentMethodBreakdown(from: Date, to: Date): Promise<PaymentMethodBreakdown[]>` where `PaymentMethodBreakdown = { method: string; total: number; count: number; average: number }`. Endpoint: `GET /api/admin/stats/payment-methods?from=...&to=...` → `{ data: PaymentMethodBreakdown[] }`.

- [ ] **Step 1: Write the failing service test**

In `src/tests/services/admin-stats.service.test.ts`, add after the `getMealPlansByMonth` describe block (after line 170):

```ts
describe('AdminStatsService.getPaymentMethodBreakdown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('agrupa total/quantidade/ticket médio por método, só status "paid"', async () => {
    mockDb.payment.findMany.mockResolvedValue([
      { method: 'pix', amount: 100 },
      { method: 'pix', amount: 50 },
      { method: 'credit_card', amount: 200 },
    ]);

    const service = createAdminStatsService();
    const result = await service.getPaymentMethodBreakdown(d(2026, 6, 1), d(2026, 6, 30));

    expect(mockDb.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'paid', deletedAt: null }) })
    );
    expect(result).toEqual([
      { method: 'credit_card', total: 200, count: 1, average: 200 },
      { method: 'pix', total: 150, count: 2, average: 75 },
    ]);
  });

  it('retorna array vazio quando não há pagamentos no período', async () => {
    mockDb.payment.findMany.mockResolvedValue([]);

    const service = createAdminStatsService();
    const result = await service.getPaymentMethodBreakdown(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- admin-stats.service.test.ts`
Expected: FAIL with `service.getPaymentMethodBreakdown is not a function`

- [ ] **Step 3: Implement `getPaymentMethodBreakdown`**

In `src/server/services/admin-stats.service.ts`, add near the top (after the `MonthlyPoint` interface, before `monthKey`):

```ts
export interface PaymentMethodBreakdown {
  method: string;
  total: number;
  count: number;
  average: number;
}
```

Add the method inside `createAdminStatsService()`, right after `getRevenueByMonth` (after its closing `}` around line 62):

```ts
  async function getPaymentMethodBreakdown(from: Date, to: Date): Promise<PaymentMethodBreakdown[]> {
    const payments = await getDb().payment.findMany({
      where: { status: CONFIRMED_PAYMENT_STATUS, deletedAt: null, date: { gte: from, lt: endOfRangeExclusive(to) } },
      select: { method: true, amount: true },
    });

    const totals = new Map<string, { total: number; count: number }>();
    for (const payment of payments) {
      const entry = totals.get(payment.method) ?? { total: 0, count: 0 };
      entry.total += payment.amount;
      entry.count += 1;
      totals.set(payment.method, entry);
    }

    return Array.from(totals.entries())
      .map(([method, { total, count }]) => ({
        method,
        total: parseFloat(total.toFixed(2)),
        count,
        average: parseFloat((total / count).toFixed(2)),
      }))
      .sort((a, b) => b.total - a.total);
  }
```

Add `getPaymentMethodBreakdown,` to the object returned at the bottom of `createAdminStatsService()`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- admin-stats.service.test.ts`
Expected: PASS

- [ ] **Step 5: Register the route**

In `src/server/routes/admin.routes.ts`, add right after the `/api/admin/stats/meal-plans` handler (after its closing `});`, before the "Sem período" comment block around line 319):

```ts
  deps.app.get('/api/admin/stats/payment-methods', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const query = validateQuery(statsDateRangeSchema, req, res);
    if (!query) return;
    try {
      await withAdminRLS(async () => {
        const data = await adminStatsService.getPaymentMethodBreakdown(new Date(query.from), new Date(query.to));
        res.json({ data });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
```

- [ ] **Step 6: Wire the route into the existing data-driven route test**

In `src/tests/routes/admin.routes.test.ts`:

1. Add `getPaymentMethodBreakdown: vi.fn().mockResolvedValue([]),` to the mocked `createAdminStatsService` return object (line 43-52).
2. Add a row to `seriesCases` (line 302-308):

```ts
  const seriesCases = [
    { path: '/api/admin/stats/revenue', fn: 'getRevenueByMonth' },
    { path: '/api/admin/stats/patients-growth', fn: 'getPatientsGrowthByMonth' },
    { path: '/api/admin/stats/new-subscribers', fn: 'getNewSubscribersByMonth' },
    { path: '/api/admin/stats/consultations', fn: 'getConsultationsByMonth' },
    { path: '/api/admin/stats/meal-plans', fn: 'getMealPlansByMonth' },
    { path: '/api/admin/stats/payment-methods', fn: 'getPaymentMethodBreakdown' },
  ] as const;
```

This reuses the existing generic 403/200/400×4/404 test suite for the new route (it doesn't assert on the real response shape, only that the route wires `from`/`to` into the service call and returns `{ data }`).

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: PASS (new tests + all `seriesCases`-driven tests, now 6 iterations instead of 5)

- [ ] **Step 8: Commit**

```bash
git add src/server/services/admin-stats.service.ts src/server/routes/admin.routes.ts src/tests/services/admin-stats.service.test.ts src/tests/routes/admin.routes.test.ts
git commit -m "feat: adiciona ticket médio por forma de pagamento ao painel admin"
```

---

### Task 3: Funil de conversão (cadastro → ativo → premium)

**Files:**
- Modify: `src/server/services/admin-stats.service.ts`
- Modify: `src/server/routes/admin.routes.ts`
- Modify: `src/tests/services/admin-stats.service.test.ts`
- Modify: `src/tests/routes/admin.routes.test.ts`

**Interfaces:**
- Produces: `getConversionFunnel(from: Date, to: Date): Promise<ConversionFunnel>` where `ConversionFunnel = { signedUp: number; activated: number; premium: number }`. Endpoint: `GET /api/admin/stats/conversion-funnel?from=...&to=...` → `{ data: ConversionFunnel }`.

- [ ] **Step 1: Write the failing service test**

Add to `src/tests/services/admin-stats.service.test.ts`, after the `getPaymentMethodBreakdown` describe block:

```ts
describe('AdminStatsService.getConversionFunnel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('conta cadastrados, ativados (com paciente ativo) e premium no período', async () => {
    mockDb.nutritionist.count
      .mockResolvedValueOnce(20) // signedUp
      .mockResolvedValueOnce(12) // activated
      .mockResolvedValueOnce(5); // premium

    const service = createAdminStatsService();
    const result = await service.getConversionFunnel(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual({ signedUp: 20, activated: 12, premium: 5 });
    expect(mockDb.nutritionist.count).toHaveBeenNthCalledWith(2, {
      where: {
        createdAt: expect.any(Object),
        patients: { some: { status: 'active', deletedAt: null } },
      },
    });
    expect(mockDb.nutritionist.count).toHaveBeenNthCalledWith(3, {
      where: { createdAt: expect.any(Object), plan: 'premium' },
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- admin-stats.service.test.ts`
Expected: FAIL with `service.getConversionFunnel is not a function`

- [ ] **Step 3: Implement `getConversionFunnel`**

In `src/server/services/admin-stats.service.ts`, add the interface near `PaymentMethodBreakdown`:

```ts
export interface ConversionFunnel {
  signedUp: number;
  activated: number;
  premium: number;
}
```

Add the method after `getPaymentMethodBreakdown`:

```ts
  async function getConversionFunnel(from: Date, to: Date): Promise<ConversionFunnel> {
    const createdRange = { gte: from, lt: endOfRangeExclusive(to) };

    const [signedUp, activated, premium] = await Promise.all([
      getDb().nutritionist.count({ where: { createdAt: createdRange } }),
      getDb().nutritionist.count({
        where: { createdAt: createdRange, patients: { some: { status: 'active', deletedAt: null } } },
      }),
      getDb().nutritionist.count({ where: { createdAt: createdRange, plan: 'premium' } }),
    ]);

    return { signedUp, activated, premium };
  }
```

Add `getConversionFunnel,` to the returned object.

Also add `nutritionist: { count: vi.fn() },` to the `mockDb` object at the top of `src/tests/services/admin-stats.service.test.ts` if not already present — check line 3-10 first; `nutritionist: { count: vi.fn() }` already exists there (used by `getPlanDistribution` tests), so no change needed.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- admin-stats.service.test.ts`
Expected: PASS

- [ ] **Step 5: Register the route**

In `src/server/routes/admin.routes.ts`, add right after the `payment-methods` handler from Task 2:

```ts
  deps.app.get('/api/admin/stats/conversion-funnel', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const query = validateQuery(statsDateRangeSchema, req, res);
    if (!query) return;
    try {
      await withAdminRLS(async () => {
        const data = await adminStatsService.getConversionFunnel(new Date(query.from), new Date(query.to));
        res.json({ data });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
```

- [ ] **Step 6: Wire into the route test**

In `src/tests/routes/admin.routes.test.ts`:
1. Add `getConversionFunnel: vi.fn().mockResolvedValue({}),` to the mocked `createAdminStatsService` object.
2. Add `{ path: '/api/admin/stats/conversion-funnel', fn: 'getConversionFunnel' },` to `seriesCases`.

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/server/services/admin-stats.service.ts src/server/routes/admin.routes.ts src/tests/services/admin-stats.service.test.ts src/tests/routes/admin.routes.test.ts
git commit -m "feat: adiciona funil de conversão cadastro→ativo→premium ao painel admin"
```

---

### Task 4: Churn rate mensal

**Files:**
- Modify: `src/server/services/admin-stats.service.ts`
- Modify: `src/server/routes/admin.routes.ts`
- Modify: `src/tests/services/admin-stats.service.test.ts`
- Modify: `src/tests/routes/admin.routes.test.ts`

**Interfaces:**
- Produces: `getChurnRateByMonth(from: Date, to: Date): Promise<MonthlyPoint[]>` (reuses the existing `MonthlyPoint` type — `value` is a percentage, one decimal place, e.g. `12.5`). Endpoint: `GET /api/admin/stats/churn-rate?from=...&to=...` → `{ data: MonthlyPoint[] }`.
- **Known limitation** (documented in the spec, section 1.4): the denominator is the *current* count of `plan === 'premium'` nutritionists, not a historical snapshot per month — there's no stored history of premium-count-over-time. Callers (Fase 2 chart) must label this as approximate.

- [ ] **Step 1: Write the failing service test**

Add to `src/tests/services/admin-stats.service.test.ts`, after `getConversionFunnel`:

```ts
describe('AdminStatsService.getChurnRateByMonth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calcula % de cancelamentos (currentPeriodEnd no mês, cancelAtPeriodEnd true) sobre o total premium atual', async () => {
    mockDb.subscription.findMany.mockResolvedValue([
      { currentPeriodEnd: d(2026, 6, 10) },
      { currentPeriodEnd: d(2026, 6, 20) },
      { currentPeriodEnd: d(2026, 7, 5) },
    ]);
    mockDb.nutritionist.count.mockResolvedValue(20); // premium atual

    const service = createAdminStatsService();
    const result = await service.getChurnRateByMonth(d(2026, 6, 1), d(2026, 7, 31));

    expect(mockDb.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cancelAtPeriodEnd: true }),
      })
    );
    expect(result).toEqual([
      { month: '2026-06', value: 10 }, // 2/20 * 100
      { month: '2026-07', value: 5 },  // 1/20 * 100
    ]);
  });

  it('retorna 0 em todos os meses quando não há assinantes premium', async () => {
    mockDb.subscription.findMany.mockResolvedValue([]);
    mockDb.nutritionist.count.mockResolvedValue(0);

    const service = createAdminStatsService();
    const result = await service.getChurnRateByMonth(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([{ month: '2026-06', value: 0 }]);
  });

  it('ignora assinaturas com currentPeriodEnd nulo', async () => {
    mockDb.subscription.findMany.mockResolvedValue([{ currentPeriodEnd: null }]);
    mockDb.nutritionist.count.mockResolvedValue(10);

    const service = createAdminStatsService();
    const result = await service.getChurnRateByMonth(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([{ month: '2026-06', value: 0 }]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- admin-stats.service.test.ts`
Expected: FAIL with `service.getChurnRateByMonth is not a function`

- [ ] **Step 3: Implement `getChurnRateByMonth`**

Add the method in `src/server/services/admin-stats.service.ts`, after `getMealPlansByMonth`:

```ts
  async function getChurnRateByMonth(from: Date, to: Date): Promise<MonthlyPoint[]> {
    const [cancellations, currentPremiumCount] = await Promise.all([
      getDb().subscription.findMany({
        where: { cancelAtPeriodEnd: true, currentPeriodEnd: { gte: from, lt: endOfRangeExclusive(to) } },
        select: { currentPeriodEnd: true },
      }),
      getDb().nutritionist.count({ where: { plan: 'premium' } }),
    ]);

    const counts = new Map<string, number>();
    for (const sub of cancellations) {
      if (!sub.currentPeriodEnd) continue;
      const key = monthKey(sub.currentPeriodEnd);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return buildMonthRange(from, to).map((month) => {
      const cancelled = counts.get(month) ?? 0;
      const value = currentPremiumCount > 0 ? Math.round((cancelled / currentPremiumCount) * 1000) / 10 : 0;
      return { month, value };
    });
  }
```

Add `getChurnRateByMonth,` to the returned object.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- admin-stats.service.test.ts`
Expected: PASS

- [ ] **Step 5: Register the route**

Add after the `conversion-funnel` handler in `src/server/routes/admin.routes.ts`:

```ts
  deps.app.get('/api/admin/stats/churn-rate', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const query = validateQuery(statsDateRangeSchema, req, res);
    if (!query) return;
    try {
      await withAdminRLS(async () => {
        const data = await adminStatsService.getChurnRateByMonth(new Date(query.from), new Date(query.to));
        res.json({ data });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
```

- [ ] **Step 6: Wire into the route test**

In `src/tests/routes/admin.routes.test.ts`:
1. Add `getChurnRateByMonth: vi.fn().mockResolvedValue([]),` to the mocked `createAdminStatsService` object.
2. Add `{ path: '/api/admin/stats/churn-rate', fn: 'getChurnRateByMonth' },` to `seriesCases`.

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/server/services/admin-stats.service.ts src/server/routes/admin.routes.ts src/tests/services/admin-stats.service.test.ts src/tests/routes/admin.routes.test.ts
git commit -m "feat: adiciona churn rate mensal (aproximado) ao painel admin"
```

---

### Task 5: Cohort de retenção

**Files:**
- Modify: `src/server/services/admin-stats.service.ts`
- Modify: `src/server/routes/admin.routes.ts`
- Modify: `src/tests/services/admin-stats.service.test.ts`
- Modify: `src/tests/routes/admin.routes.test.ts`

**Interfaces:**
- Produces: `getRetentionCohorts(from: Date, to: Date): Promise<CohortRetention[]>` where `CohortRetention = { cohortMonth: string; cohortSize: number; retention: { offset: number; pct: number }[] }`, `offset` 0-3. Endpoint: `GET /api/admin/stats/retention-cohort?from=...&to=...` → `{ data: CohortRetention[] }`.
- "Retido" no offset N = o nutricionista teve ao menos 1 `Consultation` (por `date`) ou `MealPlan` (por `createdAt`) naquele mês civil — proxy de atividade, não `lastLogin` (snapshot único, não histórico mensal).

- [ ] **Step 1: Write the failing service test**

Add to `src/tests/services/admin-stats.service.test.ts`, after `getChurnRateByMonth`. Note: this test needs `nutritionistId` on consultation/mealPlan fixtures and a fixed "now" — use `vi.setSystemTime`.

```ts
describe('AdminStatsService.getRetentionCohorts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(d(2026, 9, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('agrupa por mês de cadastro e marca retido se houve consulta/plano naquele mês civil', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([
      { id: 'n1', createdAt: d(2026, 6, 5) },
      { id: 'n2', createdAt: d(2026, 6, 20) },
    ]);
    mockDb.consultation.findMany.mockResolvedValue([
      { nutritionistId: 'n1', date: d(2026, 6, 6).toISOString() }, // offset 0
      { nutritionistId: 'n1', date: d(2026, 7, 1).toISOString() }, // offset 1
    ]);
    mockDb.mealPlan.findMany.mockResolvedValue([
      { nutritionistId: 'n2', createdAt: d(2026, 6, 21) }, // offset 0
    ]);

    const service = createAdminStatsService();
    const result = await service.getRetentionCohorts(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([
      {
        cohortMonth: '2026-06',
        cohortSize: 2,
        retention: [
          { offset: 0, pct: 100 },  // n1 e n2 ativos em junho
          { offset: 1, pct: 50 },   // só n1 ativo em julho
          { offset: 2, pct: 0 },    // ninguém ativo em agosto
          { offset: 3, pct: 0 },    // ninguém ativo em setembro
        ],
      },
    ]);
  });

  it('não inclui offsets cujo mês ainda não chegou (sistema em 2026-09-15, cohort de agosto)', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([{ id: 'n1', createdAt: d(2026, 8, 1) }]);
    mockDb.consultation.findMany.mockResolvedValue([]);
    mockDb.mealPlan.findMany.mockResolvedValue([]);

    const service = createAdminStatsService();
    const result = await service.getRetentionCohorts(d(2026, 8, 1), d(2026, 8, 31));

    // offset 0 = agosto (passado), offset 1 = setembro (mês corrente, já conta),
    // offset 2 = outubro (futuro, não incluído)
    expect(result[0].retention.map((r) => r.offset)).toEqual([0, 1]);
  });

  it('cohort sem nenhum nutricionista cadastrado retorna cohortSize 0 e retention vazio', async () => {
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminStatsService();
    const result = await service.getRetentionCohorts(d(2026, 6, 1), d(2026, 6, 30));

    expect(result).toEqual([{ cohortMonth: '2026-06', cohortSize: 0, retention: [] }]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- admin-stats.service.test.ts`
Expected: FAIL with `service.getRetentionCohorts is not a function`

- [ ] **Step 3: Implement `getRetentionCohorts`**

Add the interface in `src/server/services/admin-stats.service.ts`:

```ts
export interface CohortRetention {
  cohortMonth: string;
  cohortSize: number;
  retention: { offset: number; pct: number }[];
}

const MAX_COHORT_OFFSET = 3;
```

Add the method after `getRetentionCohorts`'s neighbors (after `getChurnRateByMonth`):

```ts
  async function getRetentionCohorts(from: Date, to: Date): Promise<CohortRetention[]> {
    const cohortMonths = buildMonthRange(from, to);

    const nutritionists = await getDb().nutritionist.findMany({
      where: { createdAt: { gte: from, lt: endOfRangeExclusive(to) } },
      select: { id: true, createdAt: true },
    });

    if (nutritionists.length === 0) {
      return cohortMonths.map((cohortMonth) => ({ cohortMonth, cohortSize: 0, retention: [] }));
    }

    const cohortsByMonth = new Map<string, string[]>();
    for (const n of nutritionists) {
      const key = monthKey(n.createdAt);
      const ids = cohortsByMonth.get(key) ?? [];
      ids.push(n.id);
      cohortsByMonth.set(key, ids);
    }

    const allIds = nutritionists.map((n) => n.id);
    const [consultations, mealPlans] = await Promise.all([
      getDb().consultation.findMany({
        where: { nutritionistId: { in: allIds } },
        select: { nutritionistId: true, date: true },
      }),
      getDb().mealPlan.findMany({
        where: { nutritionistId: { in: allIds } },
        select: { nutritionistId: true, createdAt: true },
      }),
    ]);

    const activeMonthsByNutritionist = new Map<string, Set<string>>();
    const markActive = (nutritionistId: string, date: Date) => {
      if (Number.isNaN(date.getTime())) return;
      const set = activeMonthsByNutritionist.get(nutritionistId) ?? new Set<string>();
      set.add(monthKey(date));
      activeMonthsByNutritionist.set(nutritionistId, set);
    };
    for (const c of consultations) {
      markActive(c.nutritionistId, new Date(c.date));
    }
    for (const m of mealPlans) {
      markActive(m.nutritionistId, m.createdAt);
    }

    const now = new Date();

    return cohortMonths.map((cohortMonth) => {
      const ids = cohortsByMonth.get(cohortMonth) ?? [];
      const [cohortYear, cohortMonthNum] = cohortMonth.split('-').map(Number);
      const retention: { offset: number; pct: number }[] = [];

      for (let offset = 0; offset <= MAX_COHORT_OFFSET; offset++) {
        const offsetDate = new Date(Date.UTC(cohortYear, cohortMonthNum - 1 + offset, 1));
        if (offsetDate > now) break;
        const offsetKey = monthKey(offsetDate);
        const retained = ids.filter((id) => activeMonthsByNutritionist.get(id)?.has(offsetKey)).length;
        const pct = ids.length > 0 ? Math.round((retained / ids.length) * 1000) / 10 : 0;
        retention.push({ offset, pct });
      }

      return { cohortMonth, cohortSize: ids.length, retention };
    });
  }
```

Add `getRetentionCohorts,` to the returned object. Also add `consultation: { findMany: vi.fn() }` and `mealPlan: { findMany: vi.fn() }` to `mockDb` in the test file if missing (they already exist — check lines 3-10 of `admin-stats.service.test.ts`; both are already declared).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- admin-stats.service.test.ts`
Expected: PASS

- [ ] **Step 5: Register the route**

Add after the `churn-rate` handler in `src/server/routes/admin.routes.ts`:

```ts
  deps.app.get('/api/admin/stats/retention-cohort', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const query = validateQuery(statsDateRangeSchema, req, res);
    if (!query) return;
    try {
      await withAdminRLS(async () => {
        const data = await adminStatsService.getRetentionCohorts(new Date(query.from), new Date(query.to));
        res.json({ data });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
```

- [ ] **Step 6: Wire into the route test**

In `src/tests/routes/admin.routes.test.ts`:
1. Add `getRetentionCohorts: vi.fn().mockResolvedValue([]),` to the mocked `createAdminStatsService` object.
2. Add `{ path: '/api/admin/stats/retention-cohort', fn: 'getRetentionCohorts' },` to `seriesCases`.

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/server/services/admin-stats.service.ts src/server/routes/admin.routes.ts src/tests/services/admin-stats.service.test.ts src/tests/routes/admin.routes.test.ts
git commit -m "feat: adiciona cohort de retenção ao painel admin"
```

---

## After this plan

Fase 2 (gráficos que consomem `payment-methods`, `conversion-funnel`, `churn-rate` e `retention-cohort`) é um plano separado: `docs/superpowers/plans/2026-08-16-admin-graficos-insights.md`.
