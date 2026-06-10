---
target: src/pages/Settings.tsx
total_score: 35
p0_count: 0
p1_count: 3
timestamp: 2026-06-10T01-26-01Z
slug: src-pages-settings-tsx
---
# Critique: src/pages/Settings.tsx

## Summary
Settings page with 6 tabs (Perfil, Alimentos Próprios, Segurança, Assinatura, Privacidade,
Integrações). 1455 lines after cleanup. Detector flagged 7x `border-b-2` (TabsTrigger underline
pattern + spinner — both established false positives).

## Findings
- **P1 — Dead Firestore-era code.** Removed unused `enum OperationType`, `interface
  FirestoreErrorInfo`, and `function handleFirestoreError` (~50 lines), confirmed unused via
  grep. Same pattern already removed from Register.tsx in this pipeline.
- **P1 — Malformed double-opacity Tailwind classes (real bug).** `hover:bg-muted/30/50` (custom
  foods table row hover) and `bg-muted/30/30` (Google Agenda integration card) are invalid
  Tailwind syntax — fixed to `hover:bg-muted/50` and `bg-muted/30` respectively.
- **P1 — Off-system error/danger colors.** Replaced raw red with destructive tokens across:
  - "Sair do Sistema" CardTitle: removed unwarranted `text-red-600` (logout isn't a destructive
    action; now matches the plain `text-lg font-bold` convention of other card titles).
  - Custom food delete button: `hover:text-red-600 hover:bg-red-50` → `hover:text-destructive
    hover:bg-destructive/10`.
  - Free-plan limit cards (Pacientes/Planos/Histórico/Exames grid): `bg-red-50 dark:bg-red-950/20
    border-red-100 dark:border-red-900/30` / `text-red-400` (icon + label, 2x) →
    `bg-destructive/10 border-destructive/20` / `text-destructive`.
  - "Cancelar Assinatura" option button: `border-red-100 hover:bg-red-50 hover:text-red-700
    hover:border-red-200` + `text-red-500` icon → `border-destructive/20 hover:bg-destructive/10
    hover:text-destructive hover:border-destructive/30` + `text-destructive`.
  - Dev-tools reset confirmation text: `text-red-500` → `text-destructive`.
  - "Desconectar" Google Agenda button: `text-red-600 border-red-100 hover:bg-red-50` →
    `text-destructive border-destructive/20 hover:bg-destructive/10`.
- **P1 — Off-system warning color.** "Assinatura Cancelada" banner: `bg-amber-50
  dark:bg-amber-950/20 border-amber-200 dark:border-amber-800` / `text-amber-500` /
  `text-amber-700 dark:text-amber-400` / `text-amber-600 dark:text-amber-500` → `bg-accent/30
  border-accent-foreground/20` / `text-accent-foreground` (matches the warning-callout convention
  established in Patients.tsx/PatientProfile.tsx).
- **P2 — Unused imports.** Removed unused `Mail`, `Phone` icons from lucide-react and unused
  `Separator` component import.
- **P2 — Missing `tracking-tight`** on the page `<h1>Configurações</h1>` — added.
- **Detector flag (false positives, no change):** 6x `border-b-2 border-transparent
  data-[state=active]:border-primary` on the tab switcher (underlined-tabs pattern) and 1x
  `animate-spin rounded-full h-8 w-8 border-b-2` (avatar-upload spinner) — both established
  conventions. Left as-is.
- **Judged exception (no change):** The "Assinatura e Plano" header `<div>` switches between
  `bg-slate-800` (admin), `bg-gradient-to-br from-primary to-primary/80` (premium), and `bg-card`
  (free), sharing one set of text classes. The admin/premium branches use `text-white` /
  `text-white/NN` / `bg-white/NN` (~12 occurrences) — converting to `text-primary-foreground`
  would break in dark mode for the `bg-slate-800` branch, since `--primary-foreground` flips to
  near-black in dark mode while `bg-slate-800` stays dark. `text-white` is the correct
  theme-independent choice for this dual-background header, matching the same pattern used on
  Login.tsx/Register.tsx/Landing.tsx hero panels. Left as-is.
- **Judged exception (no change):** `PrivacyTab`'s consent-status legend uses `text-emerald-*`
  (active/success — consistent with Financial.tsx's success-color convention), `text-amber-*`
  (partial consent), and `text-blue-500` (analytics info icon) as a self-consistent
  status-color system with no direct design-token equivalent for "info=blue". Changing only the
  amber value would break the legend's internal consistency. Left as-is, similar to the
  Schedule.tsx status-chip judgment.

## Verdict
3 P1 categories fixed (dead code removal, 2 real malformed-opacity bugs, ~9 raw red/amber color
occurrences converted to destructive/accent tokens), plus unused imports and a heading
consistency fix. Two multi-background color systems left unchanged as documented exceptions.

## Score: 35/40
