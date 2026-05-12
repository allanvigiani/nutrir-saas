# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start Express + Vite dev server at http://localhost:3000
npm run build            # Production frontend build (Vite)
npm run lint             # TypeScript type check (noEmit) — this is the linter
npm run test             # Run tests once (Vitest)
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with V8 coverage
npm run security-check   # Security audit with 0-100 score
```

## Architecture

Full-stack monorepo: React SPA (frontend) + Express API (backend) sharing one TypeScript codebase. Both run from `server.ts` in development.

**Backend** (`src/server/`): Layered architecture using factory functions for dependency injection.

```
Routes → Controllers → Services
```

- **Routes** — register Express endpoints, wire up dependencies
- **Controllers** — handle Request/Response lifecycle, validate input, delegate to services
- **Services** — pure business logic, designed to be testable without complex mocks

Always create services and controllers as factory functions:

```typescript
export function createMyService() { ... }
export function createMyController({ myService }: { myService: ReturnType<typeof createMyService> }) { ... }
```

**Frontend** (`src/pages/`, `src/components/`): React SPA with React Router 7. State lives in Firebase Firestore (real-time via `onSnapshot`) and React Context (`AuthContext`, `SettingsContext`). Forms use React Hook Form + Zod.

## Key Conventions

**Language mixing** — intentional, follow this pattern:
- Business domain variables: Portuguese (`peso`, `altura`, `paciente`, `nutricionista`)
- Technical variables: English (`req`, `res`, `loading`, `data`, `error`)
- Comments: Portuguese
- UI-facing text: Portuguese (PT-BR)

**Dates**: Always use `date-fns` with the `ptBR` locale.

**Styling**: Tailwind CSS only. Use the `cn` utility from `src/lib/utils.ts` for conditional classes. Prefer shadcn/ui components from `src/components/ui/`. Icons from `lucide-react`.

**Firestore listeners**: Always return the `unsubscribe` function from `useEffect` to prevent memory leaks:
```typescript
useEffect(() => {
  const unsubscribe = onSnapshot(ref, (snap) => { ... });
  return unsubscribe;
}, []);
```

**TypeScript**: Strict mode. Define interfaces for all payloads and return types. Path alias `@/*` maps to `./src/*`.

## Critical Notes

- **`src/pages/PatientProfile.tsx`** is the core of the application (~2,900 lines). Edit with extra caution — test changes thoroughly.
- **Premium gating**: Always check `isPremium` or use the `PremiumFeature` component before exposing premium features. Nutritionists have `free` or `premium` plan roles.
- **Auth**: The backend auth middleware validates Firebase ID tokens. Protected API routes require `Authorization: Bearer <token>`. Super-admin access is controlled by the `SUPER_ADMIN_EMAILS` env var.
- **Firebase config**: `firebase-applet-config.json` must be valid for the target Firebase project. Google sign-in popup flow is configured in Firebase Console, not via env vars.

## Testing

Tests live in `src/tests/`. Coverage targets `src/server/**/*.ts` (business logic services/controllers). The `src/tests/setup.ts` file configures the test environment. Write tests with `describe` + `it`; use helper functions to generate base input fixtures.

## Environment Setup

Copy `.env.example` to `.env`. Required variables for full functionality:
- `GEMINI_API_KEY` — Google Gemini AI
- `ASAAS_API_KEY`, `ASAAS_API_URL`, `ASAAS_WEBHOOK_TOKEN` — Payment processing
- `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` — Calendar OAuth
- `SMTP_HOST/PORT/USER/PASS/FROM` — Transactional email via Brevo
- `SUPER_ADMIN_EMAILS` — Comma-separated admin emails
- `APP_URL` — Frontend base URL (e.g. `http://localhost:3000`)
