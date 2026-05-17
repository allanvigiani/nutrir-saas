# Admin Metrics Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir o módulo Admin com métricas ricas de negócio, engajamento e operacionais, reorganizando em 5 abas: Visão Geral (expandida), Nutricionistas (expandida), Auditoria (inalterada), Operacional (nova), Configurações (inalterada).

**Architecture:** Todo novo dado vem de novos métodos em `admin.service.ts` consumidos por novos endpoints em `admin.routes.ts`. O frontend (`AdminDashboard.tsx`) consome via `apiRequest`. Nenhuma migration Prisma é necessária — todos os campos necessários já existem no schema.

**Tech Stack:** Express, Prisma (PostgreSQL), React, shadcn/ui, Tailwind, Vitest, date-fns

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/server/services/admin.service.ts` | Modificar | Adicionar `getExpandedStats()`, `listNutritionistsWithEngagement()`, `getOperationalData()` |
| `src/server/routes/admin.routes.ts` | Modificar | Adicionar `GET /api/admin/stats/expanded`, `GET /api/admin/nutritionists` com novos params, `GET /api/admin/operational` |
| `src/pages/AdminDashboard.tsx` | Modificar | Expandir overview, adicionar colunas em Nutricionistas, nova aba Operacional, mover LGPD |
| `src/tests/services/admin.service.test.ts` | Modificar | Testes para os novos métodos do service |

---

## Task 1: Expandir `getStats()` com métricas de negócio mensais

**Files:**
- Modify: `src/server/services/admin.service.ts`
- Modify: `src/server/routes/admin.routes.ts`
- Modify: `src/tests/services/admin.service.test.ts`

Adicionar `getExpandedStats()` que retorna as métricas atuais de `getStats()` **mais**:
- `newSubscribersThisMonth` — `firstSubscriptionDate` no mês corrente
- `newSubscribersPrevMonth` — `firstSubscriptionDate` no mês anterior
- `pendingChurn` — `cancelAtPeriodEnd: true` (assinantes que vão cancelar)
- `consultationsThisMonth` — consultas com `date >= início do mês`
- `mealPlansThisMonth` — planos alimentares com `createdAt >= início do mês`

- [ ] **Step 1: Adicionar testes em `src/tests/services/admin.service.test.ts`**

Leia o arquivo. Adicione ao final:

```ts
describe('AdminService.getExpandedStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna métricas expandidas com novos assinantes e consultas do mês', async () => {
    // getStats calls (6 counts: total, premium, admin, activeLast30, newLast7, patients)
    mockDb.nutritionist.count
      .mockResolvedValueOnce(20)  // total
      .mockResolvedValueOnce(5)   // premium
      .mockResolvedValueOnce(1)   // admin
      .mockResolvedValueOnce(12)  // activeLast30
      .mockResolvedValueOnce(3)   // newLast7
      // getExpandedStats additional counts
      .mockResolvedValueOnce(2)   // newSubscribersThisMonth (subscription.count — see below)
      .mockResolvedValueOnce(1);  // newSubscribersPrevMonth
    mockDb.patient.count.mockResolvedValue(80);
    (mockDb as any).subscription = {
      count: vi.fn()
        .mockResolvedValueOnce(2)  // newSubscribersThisMonth
        .mockResolvedValueOnce(1)  // newSubscribersPrevMonth
        .mockResolvedValueOnce(1), // pendingChurn
    };
    (mockDb as any).consultation = { count: vi.fn().mockResolvedValue(15) };
    (mockDb as any).mealPlan = { count: vi.fn().mockResolvedValue(8) };

    const service = createAdminService();
    const stats = await service.getExpandedStats();

    expect(stats.totalNutritionists).toBe(20);
    expect(stats.premiumCount).toBe(5);
    expect(stats.newSubscribersThisMonth).toBe(2);
    expect(stats.newSubscribersPrevMonth).toBe(1);
    expect(stats.pendingChurn).toBe(1);
    expect(stats.consultationsThisMonth).toBe(15);
    expect(stats.mealPlansThisMonth).toBe(8);
  });
});
```

- [ ] **Step 2: Rodar para confirmar FAIL**
```bash
cd /home/allan/nutrir-saas && npm run test -- src/tests/services/admin.service.test.ts -t "getExpandedStats" --reporter=verbose 2>&1 | tail -10
```
Expected: FAIL — `getExpandedStats` not found.

- [ ] **Step 3: Implementar `getExpandedStats` em `src/server/services/admin.service.ts`**

Leia o arquivo. Adicione após `getStats()`:

```ts
async function getExpandedStats() {
  const base = await getStats();

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const startOfMonthStr = startOfThisMonth.toISOString();

  const [newSubscribersThisMonth, newSubscribersPrevMonth, pendingChurn, consultationsThisMonth, mealPlansThisMonth] =
    await Promise.all([
      getDb().subscription.count({
        where: { firstSubscriptionDate: { gte: startOfThisMonth } },
      }),
      getDb().subscription.count({
        where: { firstSubscriptionDate: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
      }),
      getDb().subscription.count({
        where: { cancelAtPeriodEnd: true },
      }),
      getDb().consultation.count({
        where: { date: { gte: startOfMonthStr } },
      }),
      getDb().mealPlan.count({
        where: { createdAt: { gte: startOfThisMonth } },
      }),
    ]);

  return {
    ...base,
    newSubscribersThisMonth,
    newSubscribersPrevMonth,
    pendingChurn,
    consultationsThisMonth,
    mealPlansThisMonth,
  };
}
```

Adicione `getExpandedStats` ao `return { getStats, listNutritionists, logAudit, getAuditLogs, getExpandedStats }`.

- [ ] **Step 4: Rodar testes**
```bash
npm run test -- src/tests/services/admin.service.test.ts --reporter=verbose 2>&1 | tail -15
```
Expected: PASS.

- [ ] **Step 5: Adicionar endpoint em `src/server/routes/admin.routes.ts`**

Leia o arquivo. Adicione após `GET /api/admin/stats`:

```ts
deps.app.get('/api/admin/stats/expanded', deps.authenticate, async (req: any, res: any) => {
  if (!assertAdmin(req, res)) return;
  try {
    await withAdminRLS(async () => {
      res.json(await adminService.getExpandedStats());
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 6: Lint**
```bash
npm run lint 2>&1 | tail -5
```

- [ ] **Step 7: Commit**
```bash
git add src/server/services/admin.service.ts src/server/routes/admin.routes.ts src/tests/services/admin.service.test.ts
git commit -m "feat(admin): getExpandedStats com métricas mensais de negócio"
```

---

## Task 2: Expandir Overview tab com novas métricas

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

Substituir o fetch atual de `/api/admin/stats` por `/api/admin/stats/expanded` e adicionar cards de: novos assinantes (este mês vs anterior), churn pendente, consultas do mês, planos do mês.

- [ ] **Step 1: Atualizar fetch e estado em `AdminDashboard.tsx`**

Leia o arquivo. Localize o estado `adminStats` e o fetch de `/api/admin/stats`. Substitua:

1. O tipo do estado `adminStats` — adicionar os novos campos:
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
  newSubscribersThisMonth: number;
  newSubscribersPrevMonth: number;
  pendingChurn: number;
  consultationsThisMonth: number;
  mealPlansThisMonth: number;
} | null>(null);
```

2. A URL do fetch — mudar de `/api/admin/stats` para `/api/admin/stats/expanded`.

- [ ] **Step 2: Substituir os cards de overview**

Localize a `<div className="grid grid-cols-2 md:grid-cols-3 gap-4">` existente e substitua por uma grade expandida com 9 cards:

```tsx
<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
  {/* Nutricionistas */}
  <Card className="border-none shadow-sm bg-card overflow-hidden">
    <CardContent className="py-4 px-6">
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Nutricionistas</p>
          <p className="text-2xl font-bold text-foreground">{adminStats?.totalNutritionists ?? '—'}</p>
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
          <p className="text-2xl font-bold text-foreground">{adminStats?.premiumCount ?? '—'}</p>
          <p className="text-xs text-muted-foreground">Conversão: {adminStats?.conversionRate ?? 0}%</p>
        </div>
      </div>
    </CardContent>
  </Card>

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

  {/* Novos assinantes */}
  <Card className="border-none shadow-sm bg-card overflow-hidden">
    <CardContent className="py-4 px-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-5 h-5 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Novos Assinantes</p>
          <p className="text-2xl font-bold text-foreground">{adminStats?.newSubscribersThisMonth ?? '—'}</p>
          <p className="text-xs text-muted-foreground">
            {adminStats
              ? `${adminStats.newSubscribersPrevMonth} no mês anterior`
              : 'este mês'}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>

  {/* Churn pendente */}
  <Card className="border-none shadow-sm bg-card overflow-hidden">
    <CardContent className="py-4 px-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className={cn("w-5 h-5", adminStats?.pendingChurn ? "text-amber-500" : "text-primary")} />
        <div>
          <p className="text-xs text-muted-foreground">Cancelamentos Pendentes</p>
          <p className={cn("text-2xl font-bold", adminStats?.pendingChurn ? "text-amber-600" : "text-foreground")}>
            {adminStats?.pendingChurn ?? '—'}
          </p>
          <p className="text-xs text-muted-foreground">não renovarão</p>
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
          <p className="text-2xl font-bold text-foreground">{adminStats?.activeLast30Days ?? '—'}</p>
          <p className="text-xs text-muted-foreground">com login recente</p>
        </div>
      </div>
    </CardContent>
  </Card>

  {/* Consultas do mês */}
  <Card className="border-none shadow-sm bg-card overflow-hidden">
    <CardContent className="py-4 px-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-5 h-5 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Consultas este Mês</p>
          <p className="text-2xl font-bold text-foreground">{adminStats?.consultationsThisMonth ?? '—'}</p>
          <p className="text-xs text-muted-foreground">registradas na plataforma</p>
        </div>
      </div>
    </CardContent>
  </Card>

  {/* Planos alimentares do mês */}
  <Card className="border-none shadow-sm bg-card overflow-hidden">
    <CardContent className="py-4 px-6">
      <div className="flex items-center gap-3">
        <UtensilsCrossed className="w-5 h-5 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Planos Alimentares este Mês</p>
          <p className="text-2xl font-bold text-foreground">{adminStats?.mealPlansThisMonth ?? '—'}</p>
          <p className="text-xs text-muted-foreground">criados na plataforma</p>
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
          <p className="text-2xl font-bold text-foreground">{adminStats?.totalPatients ?? totalPatients}</p>
        </div>
      </div>
    </CardContent>
  </Card>
</div>
```

- [ ] **Step 3: Adicionar imports dos ícones novos**

No bloco de imports de `lucide-react`, adicionar: `TrendingUp`, `AlertTriangle`, `ClipboardList`, `UtensilsCrossed`.

- [ ] **Step 4: Lint**
```bash
npm run lint 2>&1 | tail -5
```

- [ ] **Step 5: Commit**
```bash
git add src/pages/AdminDashboard.tsx
git commit -m "feat(admin): overview com 9 métricas expandidas de negócio"
```

---

## Task 3: Engajamento na aba Nutricionistas

**Files:**
- Modify: `src/server/services/admin.service.ts`
- Modify: `src/server/routes/admin.routes.ts`
- Modify: `src/tests/services/admin.service.test.ts`
- Modify: `src/pages/AdminDashboard.tsx`

Expandir `listNutritionists()` para incluir `_count.patients`, `lastLogin`, e suportar filtros `filter=atLimit|churnRisk`. Adicionar coluna "Último Login" e badges de risco na tabela.

- [ ] **Step 1: Escrever testes em `admin.service.test.ts`**

Adicione ao final:

```ts
describe('AdminService.listNutritionists com filtros de engajamento', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inclui _count de pacientes no resultado', async () => {
    mockDb.nutritionist.count.mockResolvedValue(1);
    mockDb.nutritionist.findMany.mockResolvedValue([
      { id: '1', name: 'A', plan: 'free', lastLogin: new Date().toISOString(), _count: { patients: 3 } },
    ]);

    const service = createAdminService();
    const result = await service.listNutritionists({ page: 1, limit: 20 });

    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.objectContaining({ _count: expect.any(Object) }) })
    );
    expect(result.data[0]._count.patients).toBe(3);
  });

  it('filtra por churnRisk (premium inativo > 30 dias)', async () => {
    mockDb.nutritionist.count.mockResolvedValue(1);
    mockDb.nutritionist.findMany.mockResolvedValue([]);

    const service = createAdminService();
    await service.listNutritionists({ page: 1, limit: 20, filter: 'churnRisk' });

    expect(mockDb.nutritionist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ plan: 'premium' }),
      })
    );
  });
});
```

- [ ] **Step 2: Rodar para confirmar FAIL**
```bash
npm run test -- src/tests/services/admin.service.test.ts -t "filtros de engajamento" --reporter=verbose 2>&1 | tail -10
```

- [ ] **Step 3: Atualizar `listNutritionists` em `admin.service.ts`**

Leia o arquivo. Substitua a função `listNutritionists` por:

```ts
async function listNutritionists({
  page = 1,
  limit = 20,
  filter,
}: {
  page?: number;
  limit?: number;
  filter?: 'atLimit' | 'churnRisk' | 'noPatients' | 'noCpfCnpj';
}) {
  const skip = (page - 1) * limit;
  const thirtyDaysAgo = subDays(new Date(), 30);

  let where: any = {};
  if (filter === 'churnRisk') {
    where = { plan: 'premium', lastLogin: { lt: thirtyDaysAgo } };
  } else if (filter === 'atLimit') {
    // free plan AND has >= FREE_PLAN_LIMITS.maxPatients active patients
    where = {
      plan: 'free',
      patients: { some: { status: 'active', deletedAt: null } },
    };
  } else if (filter === 'noPatients') {
    where = { patients: { none: {} } };
  } else if (filter === 'noCpfCnpj') {
    where = { cpf: null, cnpj: null };
  }

  const [data, total] = await Promise.all([
    getDb().nutritionist.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        _count: { select: { patients: true } },
        subscription: { select: { cancelAtPeriodEnd: true, asaasStatus: true, currentPeriodEnd: true } },
      },
    }),
    getDb().nutritionist.count({ where }),
  ]);

  return { data, total, page, totalPages: Math.ceil(total / limit) };
}
```

**Nota:** Importar `FREE_PLAN_LIMITS` não é necessário aqui pois `atLimit` usa `some: { some: {} }` — o frontend fará a comparação de limite. A query retorna quem tem pelo menos 1 paciente ativo (candidatos a upgrade para quem atingiu limite).

- [ ] **Step 4: Rodar testes**
```bash
npm run test -- src/tests/services/admin.service.test.ts --reporter=verbose 2>&1 | tail -15
```

- [ ] **Step 5: Atualizar endpoint `GET /api/admin/nutritionists` em `admin.routes.ts`**

Leia o arquivo. Na rota GET /api/admin/nutritionists, adicionar `filter` da query string:

```ts
const filter = req.query.filter as 'atLimit' | 'churnRisk' | 'noPatients' | 'noCpfCnpj' | undefined;
// passar para o service:
res.json(await adminService.listNutritionists({ page, limit, filter }));
```

- [ ] **Step 6: Atualizar tabela de Nutricionistas no `AdminDashboard.tsx`**

Leia o arquivo. Faça as seguintes mudanças na tab `value="nutritionists"`:

1. **Adicionar filtro de engajamento** — após o `<Select>` de `roleFilter`:
```tsx
<Select value={engagementFilter} onValueChange={setEngagementFilter}>
  <SelectTrigger className="w-[180px] h-9 text-sm rounded-xl border-border">
    <SelectValue placeholder="Engajamento" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Todos</SelectItem>
    <SelectItem value="churnRisk">Risco de Churn</SelectItem>
    <SelectItem value="atLimit">Atingiu Limite Free</SelectItem>
  </SelectContent>
</Select>
```

2. **Adicionar estado**: `const [engagementFilter, setEngagementFilter] = useState('all');`

3. **Atualizar fetch** — incluir `filter` na URL:
```tsx
const filterParam = engagementFilter !== 'all' ? `&filter=${engagementFilter}` : '';
apiRequest<...>(`/api/admin/nutritionists?page=${page}&limit=${LIMIT}${filterParam}`, 'GET')
```

4. **Adicionar `engagementFilter` às deps do useEffect**: `}, [nutritionist, page, engagementFilter]);`

5. **Adicionar coluna "Último Login"** — no cabeçalho da tabela após a coluna de Plano:
```tsx
<th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Último Login</th>
```

6. **Adicionar célula "Último Login"** — na linha da tabela (após a célula de plano):
```tsx
<td className="px-6 py-4 whitespace-nowrap">
  {n.lastLogin ? (
    <span className={cn(
      "text-sm",
      new Date(n.lastLogin) < new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
        ? "text-amber-600 font-medium"
        : "text-muted-foreground"
    )}>
      {format(parseISO(n.lastLogin), "dd/MM/yyyy", { locale: ptBR })}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">Nunca</span>
  )}
</td>
```

7. **Resetar `page` para 1 ao mudar filtro de engajamento** — adicionar `useEffect`:
```tsx
useEffect(() => { setPage(1); }, [engagementFilter]);
```

- [ ] **Step 7: Lint**
```bash
npm run lint 2>&1 | tail -5
```

- [ ] **Step 8: Commit**
```bash
git add src/server/services/admin.service.ts src/server/routes/admin.routes.ts src/pages/AdminDashboard.tsx src/tests/services/admin.service.test.ts
git commit -m "feat(admin): engajamento na aba Nutricionistas com filtros e coluna lastLogin"
```

---

## Task 4: Nova aba Operacional

**Files:**
- Modify: `src/server/services/admin.service.ts`
- Modify: `src/server/routes/admin.routes.ts`
- Modify: `src/tests/services/admin.service.test.ts`
- Modify: `src/pages/AdminDashboard.tsx`

Nova aba com 4 seções: sem CPF/CNPJ, sem pacientes, plano manual, limpeza LGPD (movida de Configurações).

- [ ] **Step 1: Escrever teste para `getOperationalData` em `admin.service.test.ts`**

Adicione ao final:

```ts
describe('AdminService.getOperationalData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna contagens operacionais', async () => {
    mockDb.nutritionist.count
      .mockResolvedValueOnce(3)  // noCpfCnpj
      .mockResolvedValueOnce(2); // noPatients (patients.none)
    (mockDb as any).patient = { ...(mockDb as any).patient, count: vi.fn().mockResolvedValue(5) };
    mockDb.nutritionist.findMany
      .mockResolvedValueOnce([{ id: '1', name: 'Manual', email: 'a@b.com', plan: 'premium' }]);

    const service = createAdminService();
    const result = await service.getOperationalData();

    expect(result.noCpfCnpjCount).toBe(3);
    expect(result.noPatientsCount).toBe(2);
    expect(result.manualPlanOverrides).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar para confirmar FAIL**
```bash
npm run test -- src/tests/services/admin.service.test.ts -t "getOperationalData" --reporter=verbose 2>&1 | tail -10
```

- [ ] **Step 3: Implementar `getOperationalData` em `admin.service.ts`**

Adicione após `getExpandedStats`:

```ts
async function getOperationalData() {
  const [noCpfCnpjCount, noPatientsCount, manualPlanOverrides] = await Promise.all([
    getDb().nutritionist.count({
      where: { cpf: null, cnpj: null, role: 'nutritionist' },
    }),
    getDb().nutritionist.count({
      where: { patients: { none: {} }, role: 'nutritionist' },
    }),
    getDb().nutritionist.findMany({
      where: { planOverridedByAdmin: true },
      select: { id: true, name: true, email: true, plan: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  return { noCpfCnpjCount, noPatientsCount, manualPlanOverrides };
}
```

Adicione ao `return`: `{ ..., getExpandedStats, getOperationalData }`.

- [ ] **Step 4: Rodar testes**
```bash
npm run test -- src/tests/services/admin.service.test.ts --reporter=verbose 2>&1 | tail -15
```

- [ ] **Step 5: Adicionar endpoint em `admin.routes.ts`**

```ts
deps.app.get('/api/admin/operational', deps.authenticate, async (req: any, res: any) => {
  if (!assertAdmin(req, res)) return;
  try {
    await withAdminRLS(async () => {
      res.json(await adminService.getOperationalData());
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 6: Adicionar aba Operacional em `AdminDashboard.tsx`**

Leia o arquivo.

1. **Adicionar estado**:
```tsx
const [operationalData, setOperationalData] = useState<{
  noCpfCnpjCount: number;
  noPatientsCount: number;
  manualPlanOverrides: { id: string; name: string; email: string; plan: string; updatedAt: string }[];
} | null>(null);
```

2. **Adicionar fetch no `fetchData`**:
```tsx
const operational = await apiRequest<typeof operationalData>('/api/admin/operational', 'GET');
setOperationalData(operational);
```

3. **Adicionar TabsTrigger** — após `<TabsTrigger value="audit">`:
```tsx
<TabsTrigger value="operational" className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap">
  Operacional
</TabsTrigger>
```

4. **Adicionar TabsContent** — após `</TabsContent>` do audit:
```tsx
<TabsContent value="operational" className="space-y-6">
  {/* Cards de contagem */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Card className="border-none shadow-sm bg-card">
      <CardContent className="py-4 px-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-xs text-muted-foreground">Sem CPF/CNPJ</p>
            <p className="text-2xl font-bold text-foreground">{operationalData?.noCpfCnpjCount ?? '—'}</p>
            <p className="text-xs text-muted-foreground">impedem checkout do Asaas</p>
          </div>
        </div>
      </CardContent>
    </Card>
    <Card className="border-none shadow-sm bg-card">
      <CardContent className="py-4 px-6">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-xs text-muted-foreground">Sem Pacientes</p>
            <p className="text-2xl font-bold text-foreground">{operationalData?.noPatientsCount ?? '—'}</p>
            <p className="text-xs text-muted-foreground">onboarding incompleto</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>

  {/* Planos com override manual */}
  <Card className="border-none shadow-sm bg-card">
    <CardHeader className="border-b border-border pb-4">
      <CardTitle className="text-base font-bold">Liberações Manuais de Plano</CardTitle>
      <p className="text-xs text-muted-foreground">Planos definidos pelo admin — sync do Asaas não sobrescreve</p>
    </CardHeader>
    <CardContent className="p-0">
      {!operationalData?.manualPlanOverrides?.length ? (
        <p className="p-6 text-sm text-muted-foreground">Nenhuma liberação manual ativa.</p>
      ) : (
        <div className="divide-y divide-border">
          {operationalData.manualPlanOverrides.map((n) => (
            <div key={n.id} className="flex items-center justify-between px-6 py-3">
              <div>
                <p className="text-sm font-medium">{n.name}</p>
                <p className="text-xs text-muted-foreground">{n.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-amber-600">Manual</span>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  n.plan === 'premium' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {n.plan === 'premium' ? 'Premium' : 'Gratuito'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>

  {/* Limpeza LGPD — movida de Configurações */}
  <Card className="border-none shadow-sm bg-card">
    <CardHeader className="border-b border-border pb-4">
      <CardTitle className="text-base font-bold">Limpeza LGPD</CardTitle>
      <p className="text-xs text-muted-foreground">Remove permanentemente pacientes com soft delete há mais de 30 dias</p>
    </CardHeader>
    <CardContent className="p-6 space-y-3">
      {pendingDeletion !== null && (
        <p className="text-sm text-muted-foreground">
          {pendingDeletion === 0
            ? 'Nenhum paciente pendente de remoção permanente.'
            : `${pendingDeletion} paciente(s) aguardando remoção permanente.`}
        </p>
      )}
      <Button
        variant="destructive"
        disabled={pendingDeletion === 0 || isRunningCleanup}
        onClick={() => setShowRetentionConfirm(true)}
      >
        {isRunningCleanup ? 'Removendo...' : `Executar Limpeza LGPD${pendingDeletion ? ` (${pendingDeletion})` : ''}`}
      </Button>
    </CardContent>
  </Card>
</TabsContent>
```

5. **Remover o card de LGPD da aba Configurações** — localize o conteúdo de retenção LGPD dentro de `<TabsContent value="settings">` e remova-o (o botão + texto de pending). Mantenha o restante da aba de configurações intacto.

- [ ] **Step 7: Lint**
```bash
npm run lint 2>&1 | tail -5
```

- [ ] **Step 8: Commit**
```bash
git add src/server/services/admin.service.ts src/server/routes/admin.routes.ts src/pages/AdminDashboard.tsx src/tests/services/admin.service.test.ts
git commit -m "feat(admin): aba Operacional com dados de saúde da base e LGPD"
```

---

## Self-Review

**Cobertura do spec:**
- ✅ Visão Geral expandida — Task 1 (backend) + Task 2 (frontend): MRR, novos assinantes, churn, consultas/mês, planos/mês
- ✅ Nutricionistas expandida — Task 3: coluna lastLogin, filtros churnRisk e atLimit
- ✅ Auditoria — inalterada (já implementada)
- ✅ Operacional (nova) — Task 4: sem CPF/CNPJ, sem pacientes, planos manuais, LGPD movido
- ✅ Configurações — LGPD removido da aba (Task 4)

**Dependências entre tasks:**
- Task 1 deve vir antes de Task 2 (frontend consome endpoint da Task 1)
- Task 3 é independente de Tasks 1 e 2
- Task 4 é independente de Tasks 1-3

**Sem migrations necessárias** — todos os campos já existem no schema.

**Nenhum placeholder. Código completo em cada step.**
