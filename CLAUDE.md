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

`DATABASE_URL` na Vercel deve usar a role `app_runtime` (sem `BYPASSRLS`), nunca `neondb_owner` — ver seção RLS abaixo. `vercel-build` só roda `prisma generate` (não conecta no banco), então `DIRECT_DATABASE_URL` não é necessária na Vercel.

## Security

> Baseado na auditoria de segurança de 2026-08-13 (RLS, IDOR, permissões duplicadas no backend, secrets, XSS/inputs). As correções já aplicadas viraram convenção — leia antes de tocar em rotas, auth ou dados de pacientes.

### RLS (Row Level Security)

O banco (Neon Postgres, `prisma/migrations/20260516_add_rls/`) tem RLS habilitado e forçado nas tabelas sensíveis (`patients`, `consultations`, `meal_plans`, `meal_plan_items`, `lab_exams`, `appointments`, `payments`, `subscriptions`, `nutritionists`, `custom_foods`, `nutrition_calculations`), com políticas baseadas em `current_setting('app.current_nutritionist_id'/'app.current_patient_id')`.

**Duas roles Postgres, dois propósitos:**
- `app_runtime` (`DATABASE_URL`) — role de runtime, **sem `BYPASSRLS`**. É quem a aplicação usa para todas as queries. RLS só protege de verdade porque essa role não ignora as políticas.
- `neondb_owner` (`DIRECT_DATABASE_URL`) — dona das tabelas, com privilégios de DDL. Usada **só** por `prisma migrate`/`db push` (via `prisma.config.ts`). Nunca deve ser usada em runtime — isso reintroduziria o bypass de RLS.

**Regra de código:** nunca importar `prisma` de `src/server/lib/prisma.ts` diretamente em rotas/services fora de `src/server/lib/rls-context.ts`. Sempre usar `getDb()` (pega o client da transação RLS corrente) dentro de `withNutritionistRLS`/`withPatientRLS`/`withAdminRLS`/`withPortalAuth`. Uma query que precisa enxergar múltiplos tenants (ex.: checagem de CPF/CNPJ único no cadastro) deve rodar dentro de `withAdminRLS`, não com o client bruto — ver `auth.routes.ts` e `nutritionists.routes.ts` como referência do padrão correto.

### IDOR / posse de dados

Nunca confiar em dado de identidade vindo do `req.body`/`query` para decidir **quem** uma ação afeta (e-mail de destino, nome exibido, ID de outro registro) — isso é IDOR. O padrão correto: o cliente manda só o **ID do recurso** (`patientId`, `mealPlanId`); o backend resolve nome/e-mail/dono via `service.getOne(nutritionistId, id)` (que já valida posse) ou RLS, nunca aceita esses campos como texto livre do body.

Exemplo de referência: `src/server/controllers/email.controller.ts` — `sendMealPlan`/`sendWelcomeEmail` recebem `mealPlanId`/`patientId`, resolvem `patientEmail`/`patientName`/dados do nutricionista via `patientsService`/`mealPlansService`/`getDb()`. Antes da correção (2026-08-13), esses endpoints aceitavam `patientEmail`/`nutritionistName` direto do body — qualquer nutricionista autenticado podia usar o SMTP do app para mandar e-mail a qualquer endereço.

### Validação de input (Zod no backend)

Rotas que recebem texto livre de usuário devem validar `req.body` com Zod antes de chamar o service — use o helper `validateBody(schema, req, res)` de `src/server/lib/validate.ts` (retorna `undefined` e já escreve a resposta 400 se inválido; o caller só faz `if (!body) return;`). Como um `z.object()` descarta por padrão qualquer chave não declarada no schema, isso também é a defesa contra mass assignment (`id`/`nutritionistId`/`patientId`/`accessToken` nunca devem aparecer no schema — ver `patients.routes.ts`, `meal-plans.routes.ts`, `consultations.routes.ts`, `custom-foods.routes.ts` como referência).

**Já validado** (2026-08-13): `patients`, `meal-plans` (+ items), `consultations`, `custom-foods`. **Ainda sem validação** — mesmo padrão de risco, ainda não corrigido: `appointments`, `lab-exams`, `nutrition-calculations`, `recipes`, `account`, `settings`. Não presuma que uma rota nova nessas áreas já tem essa camada.

Ao adicionar `.max()` num campo de texto livre, confira o tamanho real já armazenado antes de fixar o limite (`SELECT max(length(campo)) FROM tabela`) — um limite baseado só em "parece razoável" pode cortar dado legítimo em produção.

`freeTextContent`/`generalInstructions` (plano alimentar "modo Livre") são **texto puro**, não HTML — editados via `<Textarea>` (`FreeTextMealPlanEditor.tsx`) e renderizados só via interpolação JSX (`{...}`, auto-escapada pelo React) ou `doc.splitTextToSize()` no PDF. Não existe `dangerouslySetInnerHTML` para esses campos em lugar nenhum do app hoje — não reintroduza um sem sanitização se algum dia isso mudar.

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
