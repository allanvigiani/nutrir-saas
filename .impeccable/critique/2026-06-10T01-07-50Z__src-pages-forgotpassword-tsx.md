---
target: src/pages/ForgotPassword.tsx
total_score: 35
p0_count: 0
p1_count: 2
timestamp: 2026-06-10T01-07-50Z
slug: src-pages-forgotpassword-tsx
---
# Critique: src/pages/ForgotPassword.tsx

## Summary
Centered-card auth layout (different pattern from Login/Register's split-screen, but shares the
`bg-muted/30` centered-card pattern with PatientAccess.tsx and SubscriptionSuccess.tsx). Detector
clean (`detect.mjs` returned `[]`).

## Findings
- **P1 — Off-system shadow color.** `shadow-xl shadow-slate-200/60` (2 occurrences) used a raw
  Tailwind slate color that doesn't adapt to dark mode and isn't used by sibling centered-card
  pages (PatientAccess, SubscriptionSuccess just use `shadow-xl`). Removed the raw color.
- **P1 — Hardcoded `text-white`.** 3 occurrences of `text-white` on `bg-primary` surfaces
  (logo mark + 2 submit buttons) replaced with the semantic `text-primary-foreground` token,
  matching Login.tsx/Register.tsx conventions.
- h1 headings (`text-2xl font-bold text-foreground`) were missing `tracking-tight`, present on
  the equivalent auth headings in Login.tsx/Register.tsx — added for consistency.
- Form structure (react-hook-form + zod), `Input`/`Label`/`Button` usage, `text-destructive`
  error styling, and PT-BR copy already follow conventions.

## Verdict
2 P1s fixed (off-system shadow color, hardcoded white text). No other issues.

## Score: 35/40
