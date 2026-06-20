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

## Vercel Deploy

> Use a skill `/vercel-deploy` para validação completa. Esta seção é um resumo.

O deploy na Vercel usa uma arquitetura de **pré-compilação com esbuild** — necessária porque `"type": "module"` no `package.json` é incompatível com o `@vercel/node` runtime.

### Pipeline de build (`vercel-build`)
```
1. npx prisma generate          → Prisma Client em node_modules/.prisma/
2. npx esbuild server-vercel.ts → Bundle do backend em api/server.mjs
3. vite build                   → Frontend React em dist/
```

### Arquivos de deploy — não modificar sem consultar a skill
- **`api/index.js`** — entry point da função (`.js`, não `.ts`). Contém apenas: `export { default } from './server.mjs'`
- **`api/server.mjs`** — bundle gerado pelo esbuild. Está no `.gitignore`. **Não commitar.**
- **`server-vercel.ts`** — código fonte do backend. Entry point do esbuild.
- **`vercel.json`** — rewrites: `/api/*` → `api/index`, `/*` → `index.html`. `includeFiles` inclui Prisma Client.

### Regras críticas
- `pino-pretty` **não pode ser usado em produção** — usa worker threads incompatíveis com Lambda. O `logger.ts` já condiciona pelo `NODE_ENV`.
- `JSON.parse()` em nível de módulo (sem try/catch) crasha toda a função serverless. Firebase service account já está protegido.
- Logs de startup (`[startup] ...`) aparecem no painel **Vercel → Functions → Logs** para diagnóstico.

### Env vars obrigatórias na Vercel
`FIREBASE_SERVICE_ACCOUNT` (JSON minificado via `cat sa.json | jq -c .`), `FIREBASE_PROJECT_ID`, `DATABASE_URL`, `ENCRYPTION_KEY`.

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
