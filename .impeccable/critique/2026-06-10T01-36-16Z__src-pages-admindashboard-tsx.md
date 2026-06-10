---
target: src/pages/AdminDashboard.tsx
total_score: 37
p0_count: 0
p1_count: 1
timestamp: 2026-06-10T01-36-16Z
slug: src-pages-admindashboard-tsx
---
# Critique: src/pages/AdminDashboard.tsx

## Summary
Super-admin panel: global stats, nutritionist management table, plan-config and audit
tabs, operational health checks. 716 lines. detect.mjs flagged 7x `border-b-2`
(`border-accent-on-rounded`).

## Findings
- **P1 — Off-system warning color.** Multiple amber (`text-amber-500`/`text-amber-600`)
  warning indicators converted to `text-accent-foreground`, matching the
  pending/warning convention established in Settings.tsx/Financial.tsx:
  - "Cancelamentos Pendentes" stat: conditional icon and value color
    (`adminStats?.pendingChurn ? "text-amber-500/600" : ...`).
  - "Manual" badge next to plan (manually overridden by admin, won't be overwritten
    by Asaas sync).
  - "(inativo Xd)" warning when a nutritionist hasn't logged in for >60 days.
  - Operational tab summary cards: "Sem CPF/CNPJ" and "Sem Pacientes" warning icons.
- **P2 — Missing `tracking-tight`** on `<h1>Painel Administrativo</h1>` — added,
  matching the page-h1 convention used across Schedule.tsx/Settings.tsx.
- **Detector flags (false positives, no change):** 7x `border-b-2` — full-page and
  table-loading spinners (`animate-spin rounded-full border-b-2 border-primary`) and
  the 5-tab underlined TabsTrigger pattern (Visão Geral, Nutricionistas, Configurações
  do Plano, Auditoria, Operacional), identical to the established convention in
  Schedule.tsx/Settings.tsx.
- **Judged exception (no change):** Role badges use `bg-purple-100 text-purple-700`
  (Admin) vs `bg-blue-100 text-blue-700` (Nutricionista) — a 2-value categorical badge
  with no direct design-token equivalent for "admin" semantics. Converting only one
  side would break the pair's visual contrast. Left as-is, same judgment as the
  payment-method legend in Financial.tsx.
- No malformed double-opacity classes or hardcoded `text-white`/`bg-white` found.

## Verdict
1 P1 category fixed (6 amber warning-color occurrences converted to
`text-accent-foreground`), plus a heading consistency fix. Role badges left as a
documented categorical exception.

## Score: 37/40
