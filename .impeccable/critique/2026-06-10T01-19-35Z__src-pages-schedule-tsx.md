---
target: src/pages/Schedule.tsx
total_score: 34
p0_count: 0
p1_count: 3
timestamp: 2026-06-10T01-19-35Z
slug: src-pages-schedule-tsx
---
# Critique: src/pages/Schedule.tsx

## Summary
Calendar/agenda page with month/week/day views, appointment dialog, and Google Meet
integration. 745 lines. Detector flagged 3x `border-b-2` (TabsTrigger underline pattern).

## Findings
- **P1 — Malformed double-opacity Tailwind classes (real bug).** Several classes had two
  opacity modifiers stacked (`bg-muted/30/50`, `bg-muted/30/30`, `bg-primary/10/30`,
  `bg-primary/100`), which is invalid Tailwind syntax — Tailwind only applies the first
  modifier it can resolve, so these likely rendered with no/incorrect background. Fixed across
  month/week/day view header cells and calendar day cells:
  - `bg-muted/30/50` → `bg-muted/50` (weekday headers, week/day view headers)
  - `bg-muted/30/30` (non-current-month cells) → `bg-muted/30`
  - `bg-primary/10/30` (today highlight) → `bg-primary/8`
  - `hover:bg-muted/30/50` → `hover:bg-muted/50`
  - `bg-primary/100 animate-pulse` (Google Meet indicator) → `bg-primary animate-pulse`
- **P1 — Hardcoded `text-white`.** 4 occurrences replaced with `text-primary-foreground`:
  "Novo Agendamento" button, and the "today" date circle in month/week/day views (3x).
- **P1 — Off-system error colors.** Delete-confirmation dialog icon used `bg-red-50` /
  `text-red-600` — replaced with `bg-destructive/10` / `text-destructive`.
- **P2 — Missing `tracking-tight`** on the page `<h1>Agenda</h1>` — added, matching the
  dominant page-heading convention.
- **Detector flag (false positive, no change):** `rounded-none border-b-2 border-transparent
  data-[state=active]:border-primary` on the view-switcher TabsTrigger (Mês/Semana/Dia, lines
  ~299-311) is the standard underlined-tabs pattern, not a card accent border. Left as-is.
- **Judged exception (no change):** Appointment status-color chips
  (`bg-blue-50 border-blue-100 text-blue-700` for "confirmed", `bg-red-50 ... text-red-700` for
  "cancelled", `bg-amber-50 ... text-amber-700` for pending, plus a `bg-primary/10` variant for
  "realized") appear 3x (month/week/day views). "Confirmed" (blue) has no equivalent token in
  the design system, and partially converting only "cancelled"/"pending" to
  destructive/accent tokens while leaving "confirmed" as raw blue would create more
  inconsistency than the current uniform raw-color scheme. Left as-is as a self-consistent
  status-legend convention unique to this page; a full status-color token system would be a
  separate, larger design decision.

## Verdict
3 P1s fixed (a real rendering bug from malformed double-opacity classes, hardcoded white text,
and off-system red), plus 1 heading consistency fix. Status-color chips intentionally left
unchanged pending a broader design-token decision.

## Score: 34/40
