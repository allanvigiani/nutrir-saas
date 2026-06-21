# Frontend Notes — Corrigir Login com Google

**Ciclo:** 2026-06-21-corrigir-login-google  
**Data:** 2026-06-21

## Alterações realizadas

### `src/pages/Register.tsx` — linha 72

- **Fix:** `navigate('/')` → `navigate('/dashboard')`
- **Motivo:** Quando o usuário Google já existe no DB (GET /api/me retorna 200), o redirect deve ir para o dashboard, não para a raiz.

### `src/pages/Login.tsx` — sem alterações necessárias

- O tratamento de 404 no `handleGoogleLogin` já estava correto.
- O bloco `catch` verifica `err.message?.includes('404') || err.message?.includes('não encontrado')` e redireciona para `/register` com os dados do Google via `location.state`.
- Compatível com o novo contrato da API (PATCH /api/me retorna 404 quando nutricionista não existe no PostgreSQL).

## Contrato de API verificado

| Endpoint | Status | Comportamento |
|----------|--------|---------------|
| `GET /api/me` | 200 | Usuário existe → redireciona para `/dashboard` |
| `PATCH /api/me` | 200 | Atualiza last login → prossegue para `/dashboard` |
| `PATCH /api/me` | 404 | Usuário não cadastrado → redireciona para `/register` |
| `PATCH /api/me` | 500 | Erro inesperado → logado, não bloqueia fluxo |
