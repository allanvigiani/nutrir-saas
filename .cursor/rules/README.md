# Regras do Cursor - Nutrir SaaS

Este diretorio contem as regras ativas do Cursor para guiar o agente durante implementacoes no projeto.

## Arquivos de regra

- `nutrir-core.mdc`
  - Escopo: global (`alwaysApply: true`).
  - Objetivo: contexto de dominio, guardrails gerais, cuidado com fluxos criticos e premium.

- `nutrir-backend-architecture.mdc`
  - Escopo: `src/server/**/*.ts`.
  - Objetivo: padrao de arquitetura backend (routes/controllers/services), factories e composicao de rotas.

- `nutrir-frontend-patterns.mdc`
  - Escopo: `src/**/*.{ts,tsx}`.
  - Objetivo: convencoes de UI/React/Tailwind, uso de componentes existentes, listeners Firebase e gating premium.

- `nutrir-tests.mdc`
  - Escopo: `src/tests/**/*.test.ts`.
  - Objetivo: diretrizes para testes com Vitest, cobertura de cenarios e reducao de regressao.

## Observacoes

- Regras ativas do Cursor devem ficar em `.mdc` dentro deste diretorio.
- Arquivos `.md` aqui sao apenas documentacao para humanos.
