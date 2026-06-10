---
target: src/pages/PatientAccess.tsx
total_score: 35
p0_count: 0
p1_count: 2
timestamp: 2026-06-10T01-13-36Z
slug: src-pages-patientaccess-tsx
---
# Critique: src/pages/PatientAccess.tsx

## Summary
Patient-facing portal (token-based access, CPF verification, meal plan PDF download, evolution
charts). 799 lines including a large jsPDF report generator. Detector flagged one
`border-accent-on-rounded` warning.

## Findings
- **P1 — Hardcoded `text-white` on primary surfaces.** 5 occurrences replaced with
  `text-primary-foreground`: the "Voltar para o Início" button, the "Acesso Restrito" header
  panel + lock icon, the "Acessar Meu Perfil" submit button, and the header "N" logo badge.
  Matches the token convention established in Login/Register/ForgotPassword.
- **P1 — Off-system error color.** 2 occurrences of `text-red-500` (invalid-access icon,
  CPF-mismatch error message) replaced with `text-destructive`.
- **Detector flag (false positive, no change):** `border-b-2 border-primary` on the full-page
  loading spinner (line ~439) is the standard `animate-spin rounded-full border-b-2` spinner
  pattern used identically in `PageLoader.tsx`, `Settings.tsx`, `AdminDashboard.tsx`, and
  `PatientProfile.tsx` — not a card accent border. Left as-is.
- jsPDF report generator uses raw RGB values (`doc.setFillColor`, `doc.setTextColor`) — this is
  the canvas-based PDF API, which has no access to CSS custom properties, so hardcoded colors are
  required there. Not a design-system violation.
- Recharts `stroke`/`fill` hex colors (`#10b981`, `#3b82f6`, etc.) are SVG chart props that
  Recharts needs as literal colors; consistent with chart implementations elsewhere in the app.
- `uppercase tracking-wider` on stat-card labels ("Última Consulta", "Peso Atual", etc.) matches
  the established stat-label convention in `PatientProfile.tsx` — not a button/badge/table-header,
  so it doesn't fall under the DESIGN.md uppercase ban.
- `text-2xl font-bold text-foreground` headings (no `tracking-tight`) match the equivalent card
  heading style in `PatientProfile.tsx` and `SubscriptionSuccess.tsx`.

## Verdict
2 P1s fixed (hardcoded white text → `text-primary-foreground`, raw red → `text-destructive`),
7 occurrences total. No other issues — rest of the page already follows conventions.

## Score: 35/40
