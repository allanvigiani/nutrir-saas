# Squad de Agentes IA — Nutrir SaaS

**Data:** 2026-06-20
**Status:** Aprovado

## Objetivo

Criar um sistema de 5 skills no Claude Code que simula uma squad de desenvolvimento com 4 profissionais sênior (PM, Backend, Frontend, QA) orquestrados por um agente central. O usuário atua como cliente: descreve o que quer, aprova entregas, e o pipeline cuida do resto.

## Fluxo Principal

```
Usuário → /squad "descrição" → PM (elicita + spec) → [aprovação] →
Backend (implementa + contrato de API) → [aprovação] →
Frontend (implementa + notas) → [aprovação] →
QA (code review + testes) → Resumo final
```

Gates de aprovação obrigatórios após PM, Backend e Frontend. O QA não tem gate — é a etapa final.

Retomada de sessão: `/squad --retomar YYYY-MM-DD-<slug>` lê os artefatos já criados e continua da fase onde parou.

## Estrutura de Arquivos

### Skills

```
.claude/skills/
  squad/SKILL.md           — orchestrator
  pm-agent/SKILL.md        — product manager sênior
  backend-agent/SKILL.md   — engenheiro backend sênior
  frontend-agent/SKILL.md  — engenheiro frontend sênior
  qa-agent/SKILL.md        — QA sênior + code reviewer
```

### Artefatos (persistência entre sessões)

```
docs/squad/
  tasks/            — specs escritas pelo PM
  api-contracts/    — contratos de API escritos pelo Backend
  frontend-notes/   — notas de implementação do Frontend
  qa-reports/       — reviews e planos de teste do QA
```

**Convenção de nomes:** `YYYY-MM-DD-<feature-slug>-<tipo>.md`

Exemplo:
```
docs/squad/tasks/2026-06-20-export-pdf-spec.md
docs/squad/api-contracts/2026-06-20-export-pdf-api.md
docs/squad/frontend-notes/2026-06-20-export-pdf-frontend.md
docs/squad/qa-reports/2026-06-20-export-pdf-qa.md
```

## Agentes

### Orchestrator (`/squad`)

Skill de entrada. Aceita descrição livre ou flag `--retomar <slug>`.

Responsabilidades:
- Spawnar subagentes em sequência via Agent tool
- Passar contexto acumulado (spec + contrato + notas) para cada agente
- Apresentar gates de aprovação ao usuário (`"Aprovado? (s/n)"`)
- Em retomada: detectar quais artefatos já existem e pular fases concluídas
- Exibir resumo final com links para todos os artefatos gerados

### PM Agent (`/pm-agent`)

**Persona:** Product Manager sênior com 10+ anos em SaaS de saúde. Faz perguntas cirúrgicas, uma de cada vez. Não assume nada.

**Contexto obrigatório que recebe:**
- Descrição da feature (do usuário)
- `CLAUDE.md` (convenções do projeto)
- `docs/squad/tasks/` (specs anteriores, para evitar contradições)

**Processo:**
1. Elicita requisitos com o usuário — pergunta sobre fluxo, edge cases, critérios de aceite
2. Lê tarefas anteriores para garantir consistência
3. Escreve spec estruturada

**Output (`docs/squad/tasks/YYYY-MM-DD-<slug>-spec.md`):**
- Objetivo da feature
- User stories
- Critérios de aceite
- Fora de escopo
- Dependências e pré-requisitos
- Notas para Backend e Frontend

### Backend Agent (`/backend-agent`)

**Persona:** Engenheiro backend sênior especialista em Express + TypeScript + Prisma + Firebase Auth. Conhece a arquitetura Routes→Controllers→Services do projeto e usa factory functions sem exceção.

**Contexto obrigatório que recebe:**
- Spec do PM
- `CLAUDE.md`
- Estrutura de `src/server/` (routes, controllers, services existentes)

**Processo:**
1. Analisa a spec e identifica endpoints necessários
2. Verifica rotas e services existentes para reaproveitar
3. Implementa seguindo o padrão: route → controller → service (factory functions)
4. Define tipos TypeScript explícitos para todos os payloads
5. Garante auth middleware e premium gating onde necessário
6. Documenta o contrato de API

**Output:**
- Código em `src/server/routes/`, `src/server/controllers/`, `src/server/services/`
- Contrato de API em `docs/squad/api-contracts/YYYY-MM-DD-<slug>-api.md`

**Contrato de API inclui:**
- Endpoints (método, path, auth requerida)
- Payload de request com tipos TypeScript
- Payload de response com tipos TypeScript
- Erros possíveis (código HTTP + mensagem)

### Frontend Agent (`/frontend-agent`)

**Persona:** Engenheiro frontend sênior especialista em React + Tailwind + shadcn/ui + React Hook Form + Zod. Conhece os componentes existentes do projeto e segue os padrões visuais estabelecidos.

**Contexto obrigatório que recebe:**
- Spec do PM
- Contrato de API do Backend
- `CLAUDE.md`
- `DESIGN.md` (se existir)
- Lista de componentes em `src/components/ui/`

**Processo:**
1. Verifica componentes shadcn/ui já disponíveis — nunca recria o que existe
2. Segue paleta de cores, tipografia e padrões visuais do projeto
3. Implementa com loading states, error states e validação Zod
4. Usa `onSnapshot` do Firestore com `unsubscribe` no `useEffect` onde necessário
5. Nomes de variáveis de domínio em português, variáveis técnicas em inglês
6. Documenta decisões de implementação

**Output:**
- Código em `src/pages/` e/ou `src/components/`
- Notas em `docs/squad/frontend-notes/YYYY-MM-DD-<slug>-frontend.md`

### QA Agent (`/qa-agent`)

**Persona:** QA sênior e code reviewer obsessivo com qualidade, segurança e consistência. Trata cada entrega como se fosse para produção amanhã.

**Contexto obrigatório que recebe:**
- Spec do PM
- Contrato de API do Backend
- Notas do Frontend
- Todo o código alterado (`git diff` desde o início da feature)
- `CLAUDE.md`

**Processo — Fase 1: Code Review:**
1. Segurança: injection, XSS, auth bypass, exposição de dados sensíveis
2. Premium gating: features premium estão protegidas com `isPremium`?
3. Auth: rotas protegidas têm middleware correto?
4. Padrões do projeto: factory functions, tipos explícitos, `cn()` para classes
5. Performance: N+1 queries, re-renders desnecessários, listeners sem cleanup
6. Consistência visual: segue DESIGN.md e padrões dos outros componentes?

**Processo — Fase 2: Testes:**
1. Escreve testes Vitest para services e controllers novos
2. Cobre happy path + edge cases + casos de erro
3. Segue padrão `describe` + `it` + helper functions do projeto

**Output:**
- Report em `docs/squad/qa-reports/YYYY-MM-DD-<slug>-qa.md`
  - Issues encontrados com severidade (CRÍTICO / ALTO / MÉDIO / BAIXO)
  - Sugestões de melhoria
- Testes em `src/tests/`

## Contexto Compartilhado (todos os agentes)

Todos os agentes recebem e respeitam:
- `CLAUDE.md` — convenções de código, arquitetura, idioma
- `DESIGN.md` — padrões visuais (se existir)
- Artefatos anteriores do mesmo ciclo (spec → contrato → notas)

## Registro de Settings

Após criação das skills, registrar no `.claude/settings.json`:

```json
{
  "customSkills": [
    { "name": "squad", "path": ".claude/skills/squad" },
    { "name": "pm-agent", "path": ".claude/skills/pm-agent" },
    { "name": "backend-agent", "path": ".claude/skills/backend-agent" },
    { "name": "frontend-agent", "path": ".claude/skills/frontend-agent" },
    { "name": "qa-agent", "path": ".claude/skills/qa-agent" }
  ]
}
```

## Critérios de Sucesso

- [ ] `/squad "feature X"` inicia o pipeline completo sem configuração adicional
- [ ] `/squad --retomar <slug>` retoma de onde parou em outra sessão
- [ ] Cada agente age como sênior que conhece o projeto — não precisa de explicações sobre padrões
- [ ] Artefatos em `docs/squad/` são legíveis por humanos e por outros agentes
- [ ] QA identifica pelo menos 1 issue real por ciclo (não é rubber stamp)
