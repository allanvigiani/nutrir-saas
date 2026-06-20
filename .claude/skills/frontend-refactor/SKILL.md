---
name: frontend-refactor
description: Refatora, reescreve ou reestrutura páginas e componentes do frontend do Nutrir (src/pages, src/components) usando a skill impeccable, mantendo total conformidade com DESIGN.md e CLAUDE.md. Use SEMPRE que o usuário pedir para "refatorar", "reescrever", "modernizar", "dar uma geral", "deixar mais bonito/profissional/limpo", "melhorar a UI/UX", "padronizar" ou "fazer o polish" de uma tela ou componente — mesmo que ele não mencione "impeccable", "design system" ou "DESIGN.md" explicitamente. Também use quando o usuário disser que uma tela está "fora do padrão", "feia", "com cores erradas" ou "diferente do resto do sistema".
---

# Frontend Refactor (Nutrir)

Este skill é o playbook do projeto para trabalhos de refatoração/reescrita/reestruturação visual em `src/pages/` e `src/components/`. Ele combina o workflow genérico da skill **impeccable** com as regras concretas do `DESIGN.md` e `CLAUDE.md` deste repositório, e com os padrões de "drift" (desvio de design) já identificados e corrigidos em telas anteriores (MealPlanEditor, NutritionalCalculator, FoodAutocomplete, várias páginas de auth/legal).

A ideia central: **impeccable sabe COMO fazer um polish de qualidade; este skill diz O QUE é "certo" especificamente no Nutrir**, para que o resultado nunca crie um "dialeto" visual novo (uma paleta própria, um vocabulário de sombra próprio, etc.) — o pecado mais recorrente encontrado nas críticas anteriores deste projeto.

## Passo 1 — Carregar o contexto do projeto

Antes de tocar em qualquer arquivo:

1. Leia (ou releia, se já não estiver fresco na conversa) `DESIGN.md` na raiz do projeto — é a fonte da verdade para cores OKLCH, tipografia, elevação/sombra, badges, z-index e os "Do's and Don'ts".
2. Releia as convenções de `CLAUDE.md` — mistura de idiomas (PT-BR para domínio/UI, EN para técnico), `date-fns` com `ptBR`, Tailwind + `cn`, shadcn/ui, premium gating, listeners do Firestore.
3. Leia `references/design-drift-catalog.md` deste skill — é um catálogo de classes/padrões "fora do sistema" já encontrados em telas reais do Nutrir, com a correção exata aplicada. A maioria dos refactors reduz a uma busca-e-substitui guiada por esse catálogo.

Se `src/components/PatientProfile.tsx` estiver no escopo, trate com cuidado extra (arquivo de ~2.900 linhas, é o core do app) — prefira edições cirúrgicas e teste exaustivamente.

## Passo 2 — Invocar a skill impeccable com o comando certo

Use a `Skill` tool para invocar `impeccable` com o comando que melhor descreve o tipo de trabalho pedido. Não tente reimplementar a lógica do impeccable aqui — ele já sabe fazer Design System Discovery, Pre-Polish Assessment (puxa críticas anteriores via `critique-storage.mjs`) e o processo sistemático de polish.

Guia de escolha (mapeie a intenção do usuário para o comando):

| Pedido do usuário | Comando impeccable |
|---|---|
| "Dá uma geral", "deixa mais bonito e profissional", "melhora sem fugir do padrão" — o caso mais comum | `polish <arquivo(s)>` |
| "Avalia essa tela", "o que está errado aqui", "faz uma crítica" | `critique <arquivo(s)>` |
| Reescrita grande / nova estrutura de página, possivelmente com novo fluxo de UX | `craft <feature>` ou `shape <feature>` (planejar antes de construir) |
| "As cores estão sem graça", "falta destaque visual" | `colorize <arquivo>` |
| "A tipografia está confusa/inconsistente" | `typeset <arquivo>` |
| "O espaçamento está estranho", "elementos desalinhados" | `layout <arquivo>` |
| "Não funciona bem no celular/tablet" | `adapt <arquivo>` |
| "Está lento", "trava ao digitar/scrollar" | `optimize <arquivo>` |
| "Os textos/erros estão confusos" | `clarify <arquivo>` |
| Checagem técnica (a11y, performance, responsividade) sem mudar visual | `audit <arquivo>` |

Na dúvida entre `polish` e `critique`, prefira rodar `critique` primeiro quando o usuário não deu instruções específicas — isso gera um diagnóstico que orienta o `polish` subsequente e fica salvo como snapshot (via `critique-storage.mjs`) para reuso futuro.

## Passo 3 — Aplicar o catálogo de drift do Nutrir

Independente do comando impeccable escolhido, ao editar qualquer arquivo de `src/pages/` ou `src/components/`, varra (grep) o arquivo pelos padrões listados em `references/design-drift-catalog.md` e corrija-os como parte do mesmo passe — mesmo que o pedido original não mencione esses itens especificamente. Esses são desvios já catalogados como recorrentes neste projeto, e corrigi-los junto evita que o "polish" de uma tela deixe outra ainda mais isolada visualmente.

Pontos-chave do catálogo (resumo — detalhes e exemplos no arquivo de referência):

- **Paleta de macros nutricionais** (Energia/Proteína/Carboidrato/Gordura): sempre usar os tokens `chart-1`..`chart-5` do `index.css`, nunca `blue-*`/`orange-*`/`purple-*` hardcoded. Mapeamento já estabelecido: Energia → `chart-3`, Proteínas → `chart-4`, Carboidratos → `primary`, Gorduras → `chart-2`.
- **Sombra como exceção**: remova `shadow-sm/md/lg/xl/2xl/inner` e qualquer `shadow-[...]` arbitrário de elementos em repouso (cards, inputs, botões, badges). Sombra só em overlays (Dialog/Popover/DropdownMenu/Tooltip), usando o valor de overlay do DESIGN.md. Em repouso, use `border border-border` ou `ring-1 ring-foreground/10`.
- **`text-white` / `bg-white`** sobre superfícies coloridas → `text-primary-foreground` / `bg-primary-foreground` (ou par `-foreground` correspondente), para funcionar em dark mode.
- **Estados destrutivos hardcoded** (`text-red-500`, `bg-rose-500`, `hover:bg-red-50`) → `text-destructive`, `bg-destructive`, `hover:bg-destructive/10 hover:text-destructive`.
- **`font-black` / `tracking-tighter`** (fora da escala tipográfica do DESIGN.md) → `font-bold` / `tracking-tight`.
- **Uppercase em badges/labels/cabeçalhos** (`uppercase`, geralmente com `tracking-wider`) → remover; o texto deve já estar em Sentence/Title Case.
- **`z-[9999]` ou qualquer z-index arbitrário > 50** → usar a escala semântica existente (z-10/20/40/50 para sticky/bottom-nav/modais).
- **Side-stripe borders** (`border-l-4`/`border-r-4` coloridos como destaque) — proibido pelo DESIGN.md → substituir por borda completa, tint de fundo ou ícone.
- **Glassmorphism decorativo** (`backdrop-blur` em cards comuns) → remover, salvo overlays reais.

## Passo 4 — Editar arquivo por arquivo, com checagem de tipos e commit individual

Este projeto usa lint-staged (lint + testes Vitest relacionados) em cada commit. Para refactors em múltiplos arquivos, siga este ciclo por arquivo — ele já foi validado em refactors anteriores e evita commits gigantes difíceis de revisar ou reverter:

1. Edite o arquivo (aplicando o que o impeccable recomendou + o catálogo de drift do Passo 3).
2. Rode o type check do projeto (usa mais memória que o padrão do Node):
   ```bash
   NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit -p .
   ```
3. `git add <arquivo>` e crie um commit descrevendo o que mudou e por quê (ex.: "fix: padroniza tokens de cor e elevação em X.tsx"). O hook de lint-staged vai rodar lint + Vitest relacionado automaticamente — se falhar, corrija e crie um **novo** commit (nunca `--amend` após falha de hook).
4. Passe para o próximo arquivo.

Se o pedido envolver muitos arquivos pequenos (ex.: várias páginas com o mesmo desvio, como o uppercase em badges), pode agrupar arquivos relacionados num único commit — mas mantenha o type check entre cada edição para detectar erros cedo.

## Passo 5 — Verificação final

- Garanta que `npm run test` (ou os testes relacionados via lint-staged) passem.
- Se o dev server estiver rodando (`npm run dev`, `http://localhost:3000`), navegue até a tela alterada e exercite o fluxo principal e os estados de borda (vazio, erro, hover/focus, dark mode se aplicável) antes de reportar como concluído. Se não houver browser/screenshot disponível, deixe isso explícito no resumo final em vez de afirmar que a UI foi testada.
- Confira pontos do CLAUDE.md frequentemente esquecidos:
  - Premium gating: qualquer recurso premium novo/alterado deve checar `isPremium` ou usar `PremiumFeature`.
  - Listeners do Firestore (`onSnapshot`) devem retornar a função `unsubscribe` no `useEffect`.
  - Texto de UI em PT-BR; variáveis de domínio em português, técnicas em inglês; comentários em português (e, por padrão deste skill, mantenha comentários ao mínimo — só quando o "porquê" não for óbvio).
  - Datas com `date-fns` + locale `ptBR`.

## Quando NÃO usar este skill

- Mudanças puramente de backend/lógica de negócio sem impacto visual — vá direto ao código, sem invocar impeccable.
- Pedidos para criar uma página/feature totalmente nova do zero — ainda use `impeccable craft`/`shape`, mas avalie se este catálogo de drift se aplica (geralmente sim, já que qualquer UI nova deve nascer alinhada ao DESIGN.md).
