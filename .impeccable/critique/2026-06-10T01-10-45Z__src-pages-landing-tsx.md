---
target: src/pages/Landing.tsx
total_score: 38
p0_count: 0
p1_count: 0
timestamp: 2026-06-10T01-10-45Z
slug: src-pages-landing-tsx
---
# Critique: src/pages/Landing.tsx

## Summary
Large (894-line) marketing landing page: hero, social proof, features bento, Google Calendar
integration showcase, how-it-works, pricing, testimonials, FAQ, CTA. Already a strong, well-crafted
implementation — heavy use of design tokens (`bg-primary`, `text-primary-foreground`, `bg-muted`,
`border-border`), consistent `rounded-2xl` cards, and `tracking-tight` headings throughout.

## Findings
- **P2 — Unused import.** `Smartphone` icon imported from `lucide-react` but never used anywhere
  in the file. Removed.
- **P2 — Redundant breakpoint class.** Hero `<h1>` had `text-5xl sm:text-6xl lg:text-6xl` —
  `lg:text-6xl` duplicates `sm:text-6xl` with no effect. Simplified to `text-5xl sm:text-6xl`.
- **P2 — Inconsistent heading.** FAQ section `<h2>` was missing `tracking-tight`, present on every
  other section heading (`Funcionalidades`, `Como funciona`, `Preços`, `Depoimentos`, hero, CTA).
  Added for consistency.
- **Detector flag (false positive, no change):** `detect.mjs` flagged two `border-l-2` usages
  (lines ~457/461, now ~456/460) as the "side-tab accent border" anti-pattern. These are inside a
  mockup of a real Google Calendar event card — Google Calendar itself renders events with a
  colored left border, so this is an intentional, accurate skeuomorphic detail of an external
  product's UI, not a generic card accent in our own design system. Left as-is.
- Bento feature cards use raw `amber-100`/`blue-100`/`blue-500`/`amber-600` for icon-background
  color coding across different feature cards (TrendingUp/Calendar/BarChart3 etc.) — this reads as
  an intentional decorative variety pattern across a feature grid, distinct from the
  semantic "amber = warning callout" mapping fixed in the legal pages (Privacidade.tsx). Left as-is.
- `fill-amber-400 text-amber-400` star ratings are a near-universal convention for review stars
  (Google/Trustpilot-style), independent of brand accent token. Left as-is.

## Verdict
3 minor (P2) cleanups: removed dead import, removed redundant Tailwind class, fixed one heading
inconsistency. No P0/P1 design-system violations found — the page was already in strong shape.

## Score: 38/40
