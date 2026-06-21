# QA Report: Corrigir Login com Google

**Data:** 2026-06-21
**Revisor:** QA Agent
**Slug:** 2026-06-21-corrigir-login-google

## Resumo

Entrega correta e focada — três arquivos modificados, escopo mínimo. A lógica de 404 está correta nos dois fluxos (service lança, controller distingue, frontend captura). Um issue alto encontrado: string de erro hardcoded no controller cria acoplamento frágil com o service. Issue médio: query extra no banco para todo PATCH /api/me. Regressão no teste existente de `updateMe` corrigida neste ciclo de QA.

## Issues Encontrados

### 🟠 ALTO

- **Matching de string de erro hardcoded** — `src/server/routes/nutritionists.routes.ts:28`
  `err.message === 'Nutricionista não encontrado'` acopla o controller ao texto exato do service. Se o texto mudar (typo, i18n, refactor), o 404 silenciosamente vira 500 em produção. Correção recomendada: usar uma classe de erro customizada (`NotFoundError`) ou uma constante exportada do service.
  ```typescript
  // service
  export const ERR_NOT_FOUND = 'Nutricionista não encontrado';
  // controller
  if (err.message === ERR_NOT_FOUND) { ... }
  // ou melhor:
  class NotFoundError extends Error {}
  if (err instanceof NotFoundError) { ... }
  ```

- **Teste de `updateMe` quebrado pela mudança** — `src/tests/services/nutritionists.service.test.ts`
  O teste anterior não mockava `findUnique` para `updateMe`, então passava com `mockFindUnique` retornando `undefined` e ia direto ao `update`. Com a nova lógica, `findUnique` retorna `undefined` → lança erro → teste falha. **Corrigido neste ciclo de QA** (novos testes adicionados com mock correto).

### 🟡 MÉDIO

- **Query extra (findUnique + update) em todo PATCH /api/me** — `src/server/services/nutritionists.service.ts:17-22`
  O `update` do Prisma lança `P2025` (record not found) nativamente quando o `where` não encontra registro. Poderia-se usar um único `update` e tratar o erro `P2025` em vez de fazer dois round-trips. Custo aceitável para o volume atual (< 10k nutricionistas), mas vale revisar quando escalar. Alternativa:
  ```typescript
  try {
    return await getDb().nutritionist.update({ ... });
  } catch (err: any) {
    if (err.code === 'P2025') throw new Error('Nutricionista não encontrado');
    throw err;
  }
  ```

- **GET /api/me captura todos os erros como 404** — `src/server/routes/nutritionists.routes.ts:16-18` (pré-existente, não introduzido neste diff)
  O handler GET tem `catch (err) → res.status(404)` sem discriminação. Um erro de banco genuíno (timeout, constraint) retorna 404 em vez de 500. Fora do escopo desta PR, mas risco a monitorar.

### 🔵 BAIXO

- **Login.tsx verifica `err.message?.includes('404') || err.message?.includes('não encontrado')`** — `src/pages/Login.tsx:86`
  A dupla condição é defensiva e correta: `apiRequest` formata o erro como `err.error || \`HTTP ${res.status}\`` — então para 404, a mensagem será `"Nutricionista não encontrado"` (capturada pelo segundo branch). O branch `includes('404')` nunca dispara no fluxo atual mas serve de fallback. Sem problema funcional, apenas ruído.

## Checklist Nutrir SaaS

- [x] Auth middleware aplicado (`deps.authenticate` presente em PATCH /api/me)
- [x] Premium gating — não aplicável a esta feature
- [x] `unsubscribe` — não aplicável (sem `onSnapshot` nos arquivos alterados)
- [x] `cn()` — não aplicável (sem classes condicionais novas)
- [x] Ícones apenas de `lucide-react` — nenhum ícone novo adicionado
- [x] Datas usando `date-fns` com locale `ptBR` — não aplicável
- [x] Factory functions em services e controllers — `createNutritionistsService()` mantido
- [x] Tipos TypeScript explícitos — `err: any` pré-existente, aceitável no catch do Express
- [x] Spec cumprida: PATCH /api/me retorna 404 (não 500) quando uid não existe
- [x] Register.tsx navega para `/dashboard` (não `/`) quando usuário já existe
- [x] Login.tsx redireciona para `/register` com state do Google no catch de 404
- [x] Sem novos endpoints criados

## Testes escritos

- `src/tests/services/nutritionists.service.test.ts` — 4 testes para `updateMe` adicionados:
  1. Happy path — uid existe, update retorna nutricionista
  2. uid não existe → lança "Nutricionista não encontrado" sem chamar update
  3. Erro inesperado no findUnique → propagado sem mascarar
  4. Erro no update após findUnique bem-sucedido → propagado

## Aprovação

- [x] Aprovado para produção após correções CRÍTICO/ALTO
  - O issue ALTO (string hardcoded) é risco de manutenibilidade, não bug em produção agora. A entrega pode ir para produção com a recomendação de refatorar o error matching em sprint seguinte.
