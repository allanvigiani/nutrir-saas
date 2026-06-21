# Spec: Corrigir Login com Google

**Data:** 2026-06-21
**Status:** Aguardando aprovação

## Objetivo

Fazer o fluxo de login com Google (`signInWithPopup`) funcionar de ponta a ponta: autenticar via Firebase Auth, verificar existência do perfil no PostgreSQL e redirecionar corretamente para o dashboard ou para o cadastro.

## Diagnóstico (estado atual)

O código já existe e está estruturalmente correto. Os pontos de falha mais prováveis são de **configuração**, não de lógica de código:

### Frontend (`src/pages/Login.tsx` + `src/pages/Register.tsx`)
- `signInWithPopup(auth, googleProvider)` está implementado em ambas as páginas.
- Após o popup, `Login.tsx` faz `PATCH /api/me` com `{ lastLogin }`. Se o registro 404, redireciona para `/register`. **Problema**: `PATCH /api/me` retorna 500 se o nutricionista não existe no DB, pois `updateMe` não é um upsert — isso pode impedir o redirecionamento correto para novos usuários do Google.
- `Register.tsx` chama `GET /api/me` para checar se o usuário já existe; se existe, redireciona para `/`. **Problema**: redireciona para `/` (root), mas o usuário autenticado deveria ir para `/dashboard`.

### Backend
- `GET /api/me` → busca nutricionista no PostgreSQL. Retorna 404 se não existir (correto).
- `PATCH /api/me` → chama `service.updateMe()` — se o nutricionista não existe no DB ainda, lança erro (Prisma não encontra o registro) → retorna 500, não 404.
- `POST /api/auth/register-profile` → faz upsert corretamente ao final do formulário de cadastro.
- `/api/auth/google` no backend é apenas o **Google Calendar OAuth** — não há endpoint de autenticação Google dedicado para login. O login é 100% client-side via Firebase Auth (correto por design).

### Configuração Firebase (causa mais comum de falha em produção)
- `firebase-applet-config.json` aponta para o projeto `ai-studio-applet-webapp-667b6`.
- O provedor Google precisa estar **habilitado** em Firebase Console → Authentication → Sign-in method → Google.
- O domínio atual (`localhost:3000` em dev, domínio da Vercel em prod) precisa estar em **Authorized domains** no Firebase Console.
- Erros mapeados no código: `auth/unauthorized-domain`, `auth/operation-not-allowed`, `auth/configuration-not-found`.

## User Stories

- Como nutricionista, quero clicar em "Entrar com Google" na página de login e ser redirecionado para o dashboard sem erros.
- Como nutricionista novo, quero clicar em "Cadastrar com Google" e ter meus dados (nome, email) pré-preenchidos no formulário de cadastro.
- Como nutricionista já cadastrado que acessa `/register` com Google, quero ser redirecionado para `/dashboard` (não `/`).

## Critérios de Aceite

- [ ] Clicar em "Entrar com Google" abre o popup do Google sem erros de domínio ou configuração.
- [ ] Após autenticação Google bem-sucedida em Login, o usuário já cadastrado no DB é redirecionado para `/dashboard`.
- [ ] Após autenticação Google bem-sucedida em Login, usuário **não cadastrado** no DB é redirecionado para `/register` com email/nome pré-preenchidos.
- [ ] O `PATCH /api/me` com `lastLogin` não retorna 500 quando o nutricionista não existe no DB (deve retornar 404 ou ser chamado apenas após confirmar existência).
- [ ] Em `Register.tsx`, se o usuário já existe no DB, o redirect vai para `/dashboard`, não `/`.
- [ ] Erros de popup bloqueado, domínio não autorizado e provedor desabilitado mostram toast com mensagem clara.
- [ ] Não há regressão no login por e-mail/senha.

## Fora de Escopo

- Implementar login Social com outros provedores (GitHub, Apple, etc.).
- Alterar o fluxo de cadastro via formulário manual (sem Google).
- Integração com Google Calendar (já existe separadamente via `google.routes.ts`).

## Dependências e Pré-requisitos

- Provedor Google habilitado no Firebase Console do projeto `ai-studio-applet-webapp-667b6`.
- Domínio autorizado no Firebase Console (localhost para dev, domínio Vercel para prod).
- Banco PostgreSQL (Neon) acessível com a tabela `nutritionist` existente.

## Notas para Backend

### Fix prioritário: `PATCH /api/me` não deve 500 para usuário inexistente

Arquivo: `src/server/services/nutritionists.service.ts` → método `updateMe`.

Opção A (recomendada): Verificar existência antes do update; se não existe, retornar 404 com mensagem `'Nutricionista não encontrado'` (igual ao `GET /api/me`).

Opção B: Converter `updateMe` em upsert com campos mínimos (name, email) quando o registro não existe — mas isso pode criar registros incompletos.

**Usar Opção A.** O frontend já trata 404 corretamente no `Login.tsx` (redireciona para `/register`).

```typescript
// nutritionists.service.ts — updateMe
async function updateMe(uid: string, data: Partial<NutritionistUpdate>) {
  const exists = await prisma.nutritionist.findUnique({ where: { id: uid }, select: { id: true } });
  if (!exists) throw new NotFoundError('Nutricionista não encontrado');
  return prisma.nutritionist.update({ where: { id: uid }, data });
}
```

O controller em `nutritionists.routes.ts` (linha 27) já captura o erro e retorna 500 — precisa distinguir NotFoundError e retornar 404.

### Sem novo endpoint necessário

O fluxo de autenticação Google é 100% client-side (Firebase SDK). O backend só precisa que `PATCH /api/me` retorne 404 (não 500) quando o nutricionista não existe.

**Auth middleware**: `createAuthenticateMiddleware` em `src/server/middleware/auth.middleware.ts` — já valida Firebase ID token via Admin SDK. Nenhuma mudança necessária.

**Premium gating**: não se aplica — login é pré-auth.

## Notas para Frontend

### Fix 1: `Register.tsx` — redirect incorreto

Linha 72: `navigate('/')` → deve ser `navigate('/dashboard')`.

```typescript
// Register.tsx, handleGoogleRegister
if (meRes.ok) {
  toast.success('Você já possui uma conta. Entrando...');
  navigate('/dashboard'); // era '/'
  return;
}
```

### Fix 2: `Login.tsx` — PATCH /api/me tratamento de erro

O `PATCH /api/me` está dentro de um try/catch aninhado (linhas 80-93). O tratamento de 404 já existe e está correto: redireciona para `/register`. O problema é que com o backend retornando 500 (em vez de 404), o `catch` externo captura o erro e mostra toast de erro genérico em vez de redirecionar.

Após o fix no backend (Opção A acima), esse comportamento será corrigido automaticamente.

**Validação extra opcional**: Antes do PATCH, fazer GET /api/me para checar existência e só PATCH se existir. Mas isso adiciona uma chamada extra desnecessária se o backend for corrigido.

### Fix 3: Verificar configuração Firebase Console

Checklist obrigatório antes de deploy:
1. Firebase Console → Authentication → Sign-in method → Google → **Enabled**
2. Firebase Console → Authentication → Settings → Authorized domains → adicionar domínio de produção Vercel
3. `firebase-applet-config.json` está correto (projeto `ai-studio-applet-webapp-667b6`)

### Estados de UX

- Loading: botão mostra spinner + "Aguardando Google..." (já implementado).
- Erro de popup bloqueado: toast já implementado.
- Erro de domínio não autorizado: toast já implementado.
- Sucesso: toast + redirect (já implementado).

## Resumo das mudanças de código necessárias

| Arquivo | Linha | Mudança |
|---|---|---|
| `src/server/services/nutritionists.service.ts` | `updateMe` | Checar existência antes do update; lançar erro tipado se não existe |
| `src/server/routes/nutritionists.routes.ts` | `PATCH /api/me` handler | Capturar NotFoundError e retornar 404 (não 500) |
| `src/pages/Register.tsx` | ~72 | `navigate('/')` → `navigate('/dashboard')` |
| Firebase Console | — | Habilitar provedor Google + autorizar domínios |

## Perguntas em Aberto

- Qual é o domínio de produção na Vercel? (necessário para adicionar em Authorized domains)
- O erro relatado acontece em desenvolvimento (localhost) ou apenas em produção?
