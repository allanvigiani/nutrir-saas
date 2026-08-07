---
name: vercel-deploy
description: Deploy architecture and validation checklist for Nutrir SaaS on Vercel. Use this skill whenever the user mentions "vercel", "deploy", "produção", "função serverless", "FUNCTION_INVOCATION_FAILED", "api/index", "vercel-build", or asks to check/modify deployment configuration, add new API routes, debug 500 errors in production, or change the build pipeline. Also use when the user asks "por que a API não funciona em produção?" or similar. NEVER touch the Vercel deployment files without consulting this skill first — the setup is non-obvious and easy to break.
---

# Vercel Deploy — Nutrir SaaS

## Arquitetura de deploy (como funciona hoje)

O projeto é um monorepo React SPA + Express API. Na Vercel, o frontend e o backend são deployados separadamente:

```
vercel-build script:
  1. npx prisma generate          → gera o Prisma Client em node_modules/.prisma/
  2. npx esbuild server-vercel.ts → compila o backend TypeScript em api/server.mjs
  3. vite build                   → compila o frontend React em dist/

Vercel runtime:
  api/index.js   → entry point da serverless function (re-exporta api/server.mjs)
  dist/          → arquivos estáticos do frontend
```

## Por que esse setup?

O `package.json` tem `"type": "module"` (ESM). O `@vercel/node` runtime da Vercel tem bugs documentados com ESM + TypeScript puro — ele falha ao resolver imports `.ts` no código compilado, causando `FUNCTION_INVOCATION_FAILED`.

A solução é **pré-compilar o backend com esbuild** durante o build, antes do Vercel processar a função. O esbuild:
- Resolve todos os imports `.ts` (incluindo os 21+ arquivos com extensão `.ts` nos imports)
- Empacota todo o código fonte em um único `api/server.mjs`
- Mantém `node_modules` como imports externos (`--packages=external`)

## Arquivos críticos — não modificar sem entender o impacto

| Arquivo | Papel | Risco |
|---------|-------|-------|
| `api/index.js` | Entry point da função Vercel | Deve ser `.js`, não `.ts` — Vercel não recompila |
| `api/server.mjs` | Bundle gerado pelo esbuild | Artefato de build, não commitar |
| `server-vercel.ts` | Código fonte do backend Vercel | Entry point do esbuild |
| `vercel.json` | Config de rotas e função | Rewrites mapeiam `/api/*` → `api/index.js` |
| `package.json` (vercel-build) | Pipeline de build | Ordem importa |

## Checklist de validação

Antes de fazer deploy ou ao debugar `FUNCTION_INVOCATION_FAILED`, verificar:

### 1. `api/index.js`
```js
// Deve conter APENAS isso:
export { default } from './server.mjs';
```
- Deve ser `.js`, não `.ts`
- Deve importar de `./server.mjs` (gerado pelo esbuild)

### 2. `vercel.json`
```json
{
  "cleanUrls": false,
  "trailingSlash": false,
  "functions": {
    "api/index.js": {
      "includeFiles": "node_modules/.prisma/**"
    }
  },
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
- `functions` key deve usar `api/index.js` (não `.ts`)
- `includeFiles` é obrigatório para o Prisma Client funcionar na Lambda
- Rewrites: API vai para `api/index`, resto serve o frontend

### 3. `package.json` — script `vercel-build`
```json
"vercel-build": "npx prisma generate && npx esbuild server-vercel.ts --bundle --platform=node --target=node20 --format=esm --outfile=api/server.mjs --packages=external && vite build"
```
- `prisma generate` vem **antes** do esbuild (Prisma Client precisa existir)
- `--packages=external` mantém `node_modules` como imports — Vercel's nft os inclui
- `--format=esm` compatível com `"type": "module"` no `package.json`
- `vite build` vem por **último** (só frontend)

### 4. `.gitignore`
```
api/server.mjs
```
- `api/server.mjs` é gerado no build — não deve ser commitado

### 5. `src/server/logger.ts`
```ts
// pino-pretty NÃO pode ser usado em produção — spawna worker thread incompatível com Lambda
const consoleLogger = isCloudEnv
  ? pino({ level: "info" })           // produção: JSON puro
  : pino({ transport: { target: "pino-pretty", ... } }); // dev: colorido
```
- `isCloudEnv = NODE_ENV === "production" || NODE_ENV === "homolog"`
- Vercel define `NODE_ENV=production` automaticamente

### 6. `server-vercel.ts` — Firebase init
```ts
// JSON.parse do service account DEVE estar em try/catch
// JSON malformado no env var crasharia todo o processo
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error("[startup] Firebase: service account JSON inválido", e);
  }
}
```

## Variáveis de ambiente obrigatórias na Vercel

Configurar em **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `FIREBASE_SERVICE_ACCOUNT` | **Sim** | JSON completo. Gerar via Firebase Console → Service Accounts. Cole como string minificada (sem quebras de linha reais no `private_key` — use `\n` literal) |
| `FIREBASE_PROJECT_ID` | **Sim** | ID do projeto Firebase |
| `DATABASE_URL` | **Sim** | Connection string PostgreSQL/Neon |
| `ENCRYPTION_KEY` | **Sim** | 64 chars hex — gere com `openssl rand -hex 32` |
| `ASAAS_API_KEY` | Pagamentos | Usar URL de produção |
| `ASAAS_API_URL` | Pagamentos | `https://www.asaas.com/api/v3` em produção |
| `ASAAS_WEBHOOK_TOKEN` | Pagamentos | |
| `APP_URL` | Email/OAuth | URL da produção: `https://nutrir-saas.vercel.app` |

**Atenção — `FIREBASE_SERVICE_ACCOUNT`:** Para colar o JSON, use:
```bash
cat service-account.json | jq -c .
```
Isso gera uma linha única sem quebras. Cole esse resultado no campo da Vercel.

## Diagnóstico de falhas

Quando `FUNCTION_INVOCATION_FAILED` acontecer:

1. **Vercel Dashboard → Functions → Logs** — procurar os `[startup]` console.logs:
   - `[startup] server-vercel.ts iniciando...` → módulo carregou
   - `[startup] env check: { ... }` → mostra quais env vars estão `true`/`false`
   - `[startup] Firebase Admin inicializado OK` → Firebase OK
   - `[startup] servidor pronto ✓` → tudo funcionou

2. Se nenhum `[startup]` aparecer → problema no bundle (esbuild não rodou ou import falhou)

3. Se parar no env check com `DATABASE_URL: false` → configurar env var na Vercel

4. Se Firebase falhar → verificar `FIREBASE_SERVICE_ACCOUNT` (JSON válido?)

## Adicionando novas rotas API

Novas rotas não requerem mudanças no deploy — o Express roteia tudo internamente. Apenas:
1. Criar o arquivo de rota em `src/server/routes/`
2. Registrar em `src/server/register-api-routes.ts`
3. O esbuild vai incluir automaticamente no próximo build

## O que NÃO fazer

- ❌ Não mudar `api/index.js` para `.ts` — o Vercel recompilaria com `@vercel/node` e quebraria
- ❌ Não commitar `api/server.mjs` — é artefato de build
- ❌ Não usar `pino-pretty` sem checar `isCloudEnv` — crasha em Lambda
- ❌ Não chamar `JSON.parse()` em nível de módulo sem try/catch — crash não capturado
- ❌ Não remover `--packages=external` do esbuild — quebraria pacotes com binários nativos (Prisma, Firebase)
- ❌ Não adicionar `"toolbar": false` no `vercel.json` — campo não existe no schema
