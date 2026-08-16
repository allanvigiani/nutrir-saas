# Melhorias no Painel Admin — métricas, gráficos, exportação e alertas

## Contexto

O painel admin (`src/pages/AdminDashboard.tsx`) hoje tem 6 abas (Visão Geral,
Gráficos, Nutricionistas, Configurações do Plano, Auditoria, Operacional),
9 KPIs, 5 gráficos de série mensal (`MonthlyStatChart`, recharts `BarChart`)
e 1 `PieChart` de distribuição de plano. O objetivo deste trabalho é
aumentar a densidade de informação do painel em 4 frentes independentes,
entregues em fases separadas: métricas de negócio novas, gráficos novos,
exportação de planilha e uma aba de alertas operacionais.

## Fora de escopo

- **Receita real de assinatura via Asaas.** A tabela `Payment` do schema
  (`patientId`, `nutritionistId`, `amount`, `method`, `status`) é o
  faturamento que cada nutricionista registra dos **próprios pacientes**
  (feature "Financeiro", `Financial.tsx`) — é isso que o gráfico "Receita
  Mensal" já existente (`getRevenueByMonth`) soma entre todos os
  nutricionistas, ou seja, GMV da plataforma, não MRR da assinatura Nutrir.
  A receita real de assinatura só existe no Asaas (consultada via API,
  `asaas.service.ts`), sem tabela local de histórico de pagamentos Asaas.
  Criar essa tabela (populada pelo webhook) é trabalho à parte, que exige
  consultar a skill `asaas-integration` e não entra nesta spec.
- Nenhuma lib de gráfico nova — heatmap de atividade e grid de cohort são
  componentes custom (`<div>`s coloridos por intensidade), não uma
  dependência tipo `nivo`.
- Exportação de planilha só na tabela de Nutricionistas (Fase 3). Export de
  séries mensais dos gráficos, do log de auditoria, ou relatório PDF
  consolidado ficam fora desta rodada.
- Nenhuma alteração no webhook do Asaas (`asaas.routes.ts`/`asaas.service.ts`).

## Fase 1 — Fundação (métricas de negócio)

Todos os novos campos/endpoints seguem o padrão já usado em
`admin-stats.service.ts`: query dentro de `withAdminRLS`, agrupamento
manual em memória via `Map` (não introduzir SQL raw/`groupBy` novo).

### 1.1 Estimativa de MRR mais precisa

Hoje `estimatedRevenue` em `admin.service.ts:55` conta todo
`plan === 'premium'` × `PREMIUM_PRICE` fixo, incluindo nutricionistas
inadimplentes/em cancelamento. Trocar o filtro de `getStats()` para contar
só assinaturas com `Subscription.asaasStatus` em um estado "pagante"
(`CONFIRMED`, `RECEIVED`, `ACTIVE` — ver mapeamento de eventos em
`asaas.service.ts:27-139`), excluindo `OVERDUE`, `PENDING`,
`AWAITING_RISK_ANALYSIS`, `DELETED`, `REFUNDED`, `INACTIVE`. Continua sendo
estimativa (preço fixo × contagem), só que mais fiel a "quem está pagando
agora". Campo renomeado de `estimatedRevenue` para `payingPremiumRevenue`
no retorno de `getStats()`/`getExpandedStats()` (propagar rename para
`AdminDashboard.tsx:74/112/283`).

### 1.2 Ticket médio por forma de pagamento

**Atenção de nomenclatura na UI:** isso mede o faturamento que os
nutricionistas registram dos próprios pacientes (mesma fonte do GMV do
1.1), não a assinatura Nutrir — o card/gráfico deve deixar isso explícito
(ex.: "Ticket médio dos pagamentos registrados pelos nutricionistas").

Novo endpoint `GET /api/admin/stats/payment-methods` (mesmo range
`from`/`to` dos demais, `statsDateRangeSchema`). Novo método em
`admin-stats.service.ts`: busca `Payment` com `status: 'paid'`,
`deletedAt: null`, `date` no range; agrupa por `method`, retorna
`{ method, total, count, average }[]`.

### 1.3 Funil de conversão (cadastro → ativo → premium)

Novo endpoint `GET /api/admin/stats/conversion-funnel` (mesmo range).
Novo método: para nutricionistas com `createdAt` no range, conta 3
estágios — `signedUp` (total), `activated` (tem ao menos 1
`patients.some({ status: 'active', deletedAt: null })`, mesmo filtro já
usado em `listNutritionists`/`atLimit`), `premium` (`plan === 'premium'`).
Retorna `{ signedUp, activated, premium }`.

### 1.4 Churn rate mensal

Novo endpoint `GET /api/admin/stats/churn-rate` (mesmo range, retorna
`MonthlyPoint[]` com `value` em % arredondado). Novo método: para cada mês
do range, numerador = `Subscription` com `cancelAtPeriodEnd: true` e
`currentPeriodEnd` dentro do mês (ou seja, assinantes que efetivamente
perdem acesso naquele mês); denominador = contagem atual de
`plan === 'premium'` (snapshot no momento da consulta).

**Limitação assumida:** não existe histórico de contagem de assinantes
premium por mês passado (só o snapshot atual), então o denominador é
sempre "premium hoje", não "premium no início daquele mês". Isso é uma
aproximação — documentar como tal na descrição do card/gráfico
("aproximado", com tooltip explicando), não apresentar como número exato.

### 1.5 Cohort de retenção

Novo endpoint `GET /api/admin/stats/retention-cohort`. Cohorts = mês de
`Nutritionist.createdAt`. "Retido" no mês M+N não usa `lastLogin` (é só o
snapshot do último login, não diz se o nutricionista esteve ativo em cada
mês passado) — usa como proxy de atividade **ter criado ao menos uma
`Consultation` ou `MealPlan`** naquele mês civil (mesmas tabelas/campos já
usados por `getConsultationsByMonth`/`getMealPlansByMonth`). Retorna, por
cohort:
```
{ cohortMonth: 'YYYY-MM', cohortSize: number, retention: { offset: number; pct: number }[] }
```
`offset` de 0 a 3 (mês de cadastro, +1, +2, +3). Cohorts cujo offset ainda
não completou (cadastrado há menos de N meses) não incluem esse offset no
array.

## Fase 2 — Insights (gráficos novos)

- **MRR**: o `MonthlyStatChart` de "Receita Mensal" existente já é
  GMV real (Fase 1 não mexe nele); nenhum gráfico novo aqui, só o card de
  KPI (1.1) muda de número.
- **Funil de conversão**: novo componente `AdminFunnelChart.tsx`, usa
  `FunnelChart`/`Funnel` do recharts (disponível na v3.8 já instalada),
  consome `/api/admin/stats/conversion-funnel`.
- **Churn rate**: reaproveita `MonthlyStatChart` genérico apontando pro
  endpoint `/api/admin/stats/churn-rate` (já é `MonthlyPoint[]`, mesmo
  contrato dos outros 5 gráficos existentes — sem componente novo).
- **Cohort de retenção**: novo componente `AdminCohortGrid.tsx` — grid
  custom (linhas = cohort, colunas = offset 0-3), células `<div>`
  coloridas por intensidade de `pct` (não é um chart recharts).
- **Heatmap de atividade** (dia da semana × hora, a partir de
  `Consultation.date`/`Appointment.date`): novo endpoint
  `GET /api/admin/stats/activity-heatmap` (sem período — últimos 90 dias
  fixos) retornando `{ day: 0-6, hour: 0-23, count: number }[]`; novo
  componente `AdminHeatmapGrid.tsx`, mesmo padrão de grid custom do cohort
  (reaproveitar como um único componente `AdminIntensityGrid.tsx`
  parametrizável por linhas/colunas/valor, usado nos dois casos).
- **Adesão a exames laboratoriais**: novo endpoint
  `GET /api/admin/stats/lab-exam-adherence` (mesmo range) — `LabExam`
  criados por mês, mesmo padrão de `getConsultationsByMonth`; usa
  `MonthlyStatChart` genérico, sem componente novo.

## Fase 3 — Exportação (tabela de nutricionistas)

- Nova dependência de produção: `papaparse` (+ `@types/papaparse` em dev).
- Novo endpoint `GET /api/admin/nutritionists/export` — mesmo filtro
  server-side de `listNutritionists` (`filter=atLimit|churnRisk`), mas sem
  paginação, `take` limitado a um teto de segurança (ex. 5000) para não
  estourar memória. Busca/plano/cargo (`searchTerm`/`planFilter`/
  `roleFilter`) hoje são **filtros só client-side**, aplicados só sobre a
  página atual de 20 (`AdminDashboard.tsx:184-190`) — não fazem parte da
  query do backend. Para o export refletir o que a tela mostra sem
  duplicar essa lógica de filtro no backend: o botão busca a lista
  completa (respeitando só o `engagementFilter` ativo) via este endpoint
  novo, aplica no client as mesmas funções `matchesSearch`/`matchesPlan`/
  `matchesRole` já existentes sobre o payload completo (em vez da página
  de 20), e só então gera o CSV.
- Botão "Exportar CSV" na aba Nutricionistas (`AdminDashboard.tsx`), gera
  CSV no client via `papaparse.unparse` sobre o resultado acima e dispara
  download (`Blob` + `<a download>`).

## Fase 4 — Alertas (nova aba)

- Nova `TabsTrigger`/`TabsContent value="alerts"` em
  `AdminDashboard.tsx`, ao lado das 6 abas existentes.
- Novo componente `AdminAlertsTab.tsx`.
- Novo endpoint `GET /api/admin/alerts`, novo método em
  `admin.service.ts` que junta, em uma query cada:
  - `churnRisk`: mesmo filtro de `listNutritionists`
    (`plan: 'premium', lastLogin: { lt: 30 dias atrás }`)
  - `atLimit`: mesmo filtro existente (`plan: 'free'` com paciente ativo)
  - `graceperiodEnding`: `gracePeriodEndAt` entre agora e +7 dias
  - `paymentIssue`: `Subscription.asaasStatus` em `['OVERDUE', 'PENDING']`
- Resposta: `{ type: 'churnRisk'|'atLimit'|'graceperiodEnding'|'paymentIssue', nutritionistId, name, email, detail }[]`,
  agrupado por `type` no componente. Cada item linka para
  `AdminNutritionistDetail.tsx` (`/admin/nutritionists/:id`).

## Testes

Cada novo método de service ganha teste em `src/tests/services/` (padrão
`describe`/`it`, fixtures via helper), cobrindo: cálculo correto com dados
de exemplo, mês/range sem dados (retorna zeros, não erro), e — nos casos
que dependem de `asaasStatus`/`cancelAtPeriodEnd` — os valores reais que o
webhook grava (`CONFIRMED`/`RECEIVED`/`OVERDUE`/etc., não valores
inventados). Componentes de gráfico/grid novos seguem o padrão de
loading/erro/vazio do `MonthlyStatChart.tsx`. Fase 3 (export) e Fase 4
(alertas) são testadas manualmente no navegador (dev server) além dos
testes de service, por serem fluxo de UI (download de arquivo, navegação).
