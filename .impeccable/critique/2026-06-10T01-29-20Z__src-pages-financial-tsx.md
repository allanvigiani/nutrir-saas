---
target: src/pages/Financial.tsx
total_score: 36
p0_count: 0
p1_count: 4
timestamp: 2026-06-10T01-29-20Z
slug: src-pages-financial-tsx
---
# Critique: src/pages/Financial.tsx

## Summary
Financial/payments page: summary cards, payment-method breakdown, transaction table with
filters/pagination, receipt PDF generator, and create/status-update dialogs. 888 lines.
detect.mjs returned `[]`.

## Findings
- **P1 — Hardcoded `text-white`.** 3 occurrences on `bg-primary hover:bg-primary/90` buttons
  ("Novo Pagamento", "Atualizar Status", "Registrar Pagamento") replaced with
  `text-primary-foreground`.
- **P1 — Malformed double-opacity Tailwind classes (real bug).** `bg-muted/30/50` (table header
  row) and `hover:bg-muted/30/50` (table row hover) — invalid Tailwind syntax, fixed to
  `bg-muted/50` and `hover:bg-muted/50`.
- **P1 — Off-system status colors.** Transaction status badges used raw `bg-amber-100
  text-amber-700` (pending) and `bg-red-100 text-red-700` (cancelled) — replaced with
  `bg-accent text-accent-foreground` and `bg-destructive/10 text-destructive`, matching the
  `statusColor` mapping already established in `Dashboard.tsx` (`pending: 'bg-accent
  text-accent-foreground'`, `cancelled: 'bg-destructive/10 text-destructive'`). The "paid"
  badge already used `bg-primary/15 text-primary`, consistent with the "realized" status
  convention in PatientProfile.tsx — left unchanged.
- **P1 — Off-system hover colors.** Row-action buttons: "Editar Status" `hover:text-amber-600
  hover:bg-amber-50` → `hover:text-accent-foreground hover:bg-accent/30`; "Excluir"
  `hover:text-red-600 hover:bg-red-50` → `hover:text-destructive hover:bg-destructive/10`.
- **Judged exception (no change):** The 4 summary cards (Total Recebido, Total Pendente,
  Lançamentos, Taxa de Recebimento) use a categorical `iconBg`/`iconColor` pair per metric
  (emerald/amber/blue/conditional-emerald) — this is a decorative per-metric color-coding
  pattern, similar to the bento-card icon colors in Landing.tsx. Converting only the amber
  "Total Pendente" card to accent tokens would break the visual rhythm of the row, since
  emerald (received) and blue (lançamentos) have no token equivalent. Left as-is.
- **Judged exception (no change):** `methodMeta` defines a 5-color categorical legend
  (`bg-emerald-500`/`bg-blue-500`/`bg-violet-500`/`bg-amber-500`/`bg-cyan-500`) for the payment
  method breakdown chart — a deliberate multi-color legend with no design-token equivalent for
  5 distinct categories. Left as-is.
- jsPDF receipt generator uses raw RGB values (`doc.setFillColor`/`doc.setTextColor`) — required
  by the canvas-based PDF API, consistent with PatientAccess.tsx's report generator. Not a
  design-system violation.
- `border-4 border-primary/20 border-t-primary rounded-full animate-spin` (loading-row spinner)
  is a primary-token-based ring spinner, distinct from but consistent with the standard
  `border-b-2 border-primary` spinner used elsewhere. No change needed.

## Verdict
4 P1 categories fixed (hardcoded white text, malformed double-opacity classes, status-badge and
row-action hover colors converted to design tokens). Two categorical/decorative color systems
(summary card icons, payment-method legend) left unchanged as judged exceptions.

## Score: 36/40
