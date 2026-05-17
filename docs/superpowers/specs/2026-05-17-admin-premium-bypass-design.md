# Admin Premium Bypass

**Data:** 2026-05-17  
**Status:** aprovado

## Objetivo

Usuários com `role = 'admin'` na tabela `nutritionists` devem ter acesso irrestrito a todas as funcionalidades premium, sem ver nenhuma UI de bloqueio (cadeados, modais de upgrade, limitações de plano). A verificação deve ser eficiente — sem polling por navegação de tela.

## Contexto

- A coluna `role` (`'nutritionist' | 'admin'`) e `plan` (`'free' | 'premium'`) já existem no schema Prisma e no tipo `Nutritionist` do frontend.
- O `nutritionist` é carregado uma vez no login via `/api/me` e fica no `AuthContext` — sem re-fetch por navegação.
- O premium gating hoje é 100% frontend: `PremiumFeature.tsx`, `useFreeplanLimits.ts` e páginas checam `plan === 'premium'` diretamente.
- O backend não tem rotas bloqueadas por plano atualmente, mas terá no futuro.

## Design

### Backend — enriquecer `authenticate` com dados do DB

Após validar o token Firebase, o middleware `authenticate` faz uma query à tabela `nutritionists` por PK (`id = uid`) para buscar `{ role, plan }` e anexa no objeto `req.user`:

```ts
req.user.dbRole   // 'admin' | 'nutritionist'
req.user.dbPlan   // 'premium' | 'free'
req.user.isAdmin  // dbRole === 'admin'
req.user.isPremium // isAdmin || dbPlan === 'premium'
```

**Custo:** uma query por request autenticada, lookup por PK — O(1).  
**Benefício:** `role` e `plan` disponíveis em qualquer rota sem query adicional, prontos para validações futuras.

#### Middleware auxiliar `requirePremiumOrAdmin`

Middleware simples (sem query — lê `req.user.isPremium`), aplicado explicitamente em rotas premium:

```ts
export function requirePremiumOrAdmin(req, res, next) {
  if (!req.user?.isPremium) {
    return res.status(403).json({ error: 'Disponível apenas no plano Premium.' });
  }
  next();
}
```

Instanciado e exportado junto com `authenticate` em `src/server/middlewares/auth.ts`.  
Injetado nas deps das rotas via `register-api-routes.ts`.

### Frontend — função utilitária `isAdminOrPremium`

Adicionar em `src/lib/planLimits.ts`:

```ts
export function isAdminOrPremium(nutritionist: Nutritionist | null): boolean {
  return nutritionist?.role === 'admin' || nutritionist?.plan === 'premium';
}
```

Substituir todas as checagens diretas `nutritionist?.plan === 'premium'` por `isAdminOrPremium(nutritionist)` nos seguintes arquivos:

| Arquivo | Ocorrências |
|---|---|
| `src/components/PremiumFeature.tsx` | `isPremium` local |
| `src/hooks/useFreeplanLimits.ts` | `isPremium` local |
| `src/pages/Dashboard.tsx` | checagem direta de `plan` |
| `src/pages/Patients.tsx` | checagem direta de `plan` |
| `src/pages/Settings.tsx` | checagem direta de `plan` |
| `src/pages/PatientProfile.tsx` | checagem direta de `plan` |

**Resultado:** admin não vê cadeados, não recebe modal de upgrade, não tem limites de consulta.

## Fluxo de dados

```
Login
  → Firebase token verificado
  → /api/me retorna { role, plan, ... }
  → AuthContext.nutritionist populado (uma vez)

Navegação de tela
  → Componentes leem nutritionist do context (sem query)
  → isAdminOrPremium(nutritionist) determina visibilidade

Request API (futura rota premium)
  → authenticate: verifica token + query DB por role/plan → req.user.isPremium
  → requirePremiumOrAdmin: checa req.user.isPremium (sem query)
  → Handler executa
```

### Backend — double-check de limites do free plan nos services

Todos os limites que o frontend já enforça devem ser replicados nos services do backend. O `req.user.isPremium` (disponível em toda request autenticada após o `authenticate` enriquecido) é passado para os services como parâmetro. Se `isPremium === true`, nenhuma verificação de limite é executada — admin e premium passam direto.

**`FREE_PLAN_LIMITS`** (já em `src/lib/planLimits.ts`) é a única fonte de verdade — frontend e backend importam do mesmo arquivo.

#### Limites por endpoint

| Endpoint | Verificação no service (se `!isPremium`) |
|---|---|
| `POST /api/patients` | `COUNT(pacientes ativos) < maxPatients (2)` |
| `PATCH /api/patients/:id` (status → active) | `COUNT(pacientes ativos) < maxPatients (2)` |
| `POST /api/patients/:patientId/consultations` | `COUNT(consultas do mês) < maxConsultationsPerMonth (2)` E `COUNT(consultas do paciente no mês) < maxConsultationsPerPatientPerMonth (1)` |
| `POST /api/patients/:patientId/meal-plans` | `COUNT(planos alimentares ativos do paciente) < maxMealPlans (1)` |
| `POST /api/patients/:patientId/lab-exams` | `COUNT(exames do paciente) < maxExams (1)` |

#### Assinatura dos services (adição de `isPremium`)

```ts
// patients.service.ts
async create(nutritionistId: string, body: any, isPremium: boolean): Promise<Patient>
async update(nutritionistId: string, id: string, body: any, isPremium: boolean): Promise<Patient>

// consultations.service.ts
async create(nutritionistId: string, patientId: string, body: any, isPremium: boolean): Promise<Consultation>

// meal-plans.service.ts
async create(nutritionistId: string, patientId: string, body: any, isPremium: boolean): Promise<MealPlan>

// lab-exams.service.ts
async create(nutritionistId: string, patientId: string, body: any, isPremium: boolean): Promise<LabExam>
```

#### Passagem nas rotas

```ts
// Exemplo — patients.routes.ts
deps.app.post('/api/patients', deps.authenticate, async (req: any, res: any) => {
  const data = await service.create(req.user.uid, req.body, req.user.isPremium);
  res.status(201).json(data);
});
```

Services lançam `Error` com mensagem descritiva quando o limite é excedido; as rotas capturam e devolvem `403`.

## Fluxo de dados

```
Login
  → Firebase token verificado
  → /api/me retorna { role, plan, ... }
  → AuthContext.nutritionist populado (uma vez)

Navegação de tela
  → Componentes leem nutritionist do context (sem query)
  → isAdminOrPremium(nutritionist) determina visibilidade

Request API (create patient, consultation, etc.)
  → authenticate: verifica token + query DB por role/plan → req.user.isPremium
  → Route: passa isPremium para o service
  → Service: se !isPremium, verifica limites no DB; se excedido, lança Error → 403
  → Admin/premium: isPremium=true, sem verificação de limite
```

## O que NÃO muda

- A lógica do Asaas (`asaas.service.ts`) — continua gerenciando `plan` via assinatura paga normalmente.
- O middleware `requireAdmin` existente em `admin.routes.ts` — continua igual.
- A coluna `role` no schema — já existe, não precisa de migration.

## Testes

- Teste unitário do `authenticate` enriquecido: mock DB `{ role: 'admin', plan: 'free' }` → `req.user.isPremium === true`.
- Teste unitário de `requirePremiumOrAdmin`: admin passa, free bloqueia, premium passa.
- Teste de `isAdminOrPremium`: admin + plan free → true; nutritionist + plan free → false; nutritionist + plan premium → true.
- Teste de `patients.service.create` com `isPremium=false` e 2 pacientes ativos → lança erro.
- Teste de `patients.service.create` com `isPremium=true` e 2 pacientes ativos → cria normalmente.
- Teste de `consultations.service.create` com `isPremium=false` e 2 consultas no mês → lança erro.
- Teste de `meal-plans.service.create` com `isPremium=false` e 1 plano ativo → lança erro.
- Teste de `lab-exams.service.create` com `isPremium=false` e 1 exame → lança erro.
