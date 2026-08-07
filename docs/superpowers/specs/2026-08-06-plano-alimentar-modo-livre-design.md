# Plano Alimentar — Modo Livre (texto colado)

**Data:** 2026-08-06
**Status:** Aprovado pelo usuário

---

## Objetivo

Permitir que o nutricionista escolha, ao criar um plano alimentar, entre o modo estruturado atual ("Por Refeição", com blocos de refeição e itens) e um novo modo "Livre", onde ele cola um plano alimentar já pronto (feito em outro lugar) em um campo de texto único. A exportação de PDF precisa refletir corretamente os dois modos.

---

## Contexto técnico

- **Criação de plano:** `PatientProfile.tsx` — botão "Criar Plano" navega direto para `/patients/:id/meal-plan/new` quando não há planos anteriores, ou abre `CopyMealPlanModal` (linhas ~1581–1598) quando há planos anteriores, oferecendo "copiar plano anterior" ou "criar do zero".
- **Editor:** `src/pages/MealPlanEdit.tsx` (rota `/patients/:patientId/meal-plan/:planId`) carrega/salva o plano e renderiza `src/components/MealPlanEditor.tsx` (1463 linhas) — editor estruturado com blocos de refeição (`customMeals[]`), itens (`items[]`), observações por refeição (`mealObservations`), meta de água (`waterIntake`) e orientações gerais (`generalInstructions`).
- **Modelo de dados:** `MealPlan` (`src/types.ts:86-101`, `prisma/schema.prisma:121-143`) — `name, generalInstructions?, waterIntake?, mealObservations Json?, customMeals Json?, status`. `MealPlanItem` é uma linha flat de alimento, referenciando o bloco via `meal: string`. `MealPlanRecipe` vincula uma `Recipe` a um bloco específico (`meal`) dentro do plano.
- **PDF:** implementado com `jsPDF` + `jspdf-autotable`, hoje **duplicado** em `src/lib/meal-plan-pdf.ts` (usado por `MealPlanEdit.tsx`) e inline em `PatientProfile.tsx` (linhas 270–620, usado por Visualizar/Enviar e-mail/Exportar na lista de planos).
- **Modal de escolha:** `src/components/CopyMealPlanModal.tsx` já segue o padrão de dialog (shadcn `Dialog`) com cards de opção e botões de ação — referência visual para a extensão descrita abaixo.

---

## Modelo de dados

`MealPlan` ganha dois campos novos:

- `type: 'blocks' | 'free'` — default `'blocks'`. Migration do Prisma adiciona a coluna com esse default, então todos os planos existentes continuam sendo tratados como `'blocks'` sem nenhuma mudança de comportamento.
- `freeTextContent?: string` — nullable, usado apenas quando `type === 'free'`.

Quando `type === 'free'`:
- `customMeals`, `items` e `mealObservations` ficam vazios/não usados.
- Não há vínculo de receitas (`MealPlanRecipe`) — fora de escopo para esta primeira versão.
- `waterIntake` e `generalInstructions` continuam disponíveis e são preenchíveis normalmente (são complementares ao texto da dieta, não fazem parte da estrutura de blocos).

`types.ts` espelha os mesmos campos na interface `MealPlan`.

O `type` é definido na criação do plano e **não pode ser alterado depois** — se o nutricionista escolher o modo errado, ele cria um novo plano. Isso evita perda de dados ao tentar converter entre uma estrutura de blocos/itens e um texto livre, que são incompatíveis.

---

## Fluxo de criação

Como a escolha do tipo passa a ser obrigatória, o botão "Criar Plano" em `PatientProfile.tsx` **sempre abre `CopyMealPlanModal`** agora — hoje ele pula direto para o editor quando não há plano anterior; esse atalho deixa de existir.

`CopyMealPlanModal` é estendido:

- **Quando há histórico de planos:** mantém a seção de cópia (lista de planos anteriores + botão "Copiar plano selecionado"), como hoje. No lugar do botão único "Criar do zero", dois botões: **"Por Refeição"** e **"Livre"**.
- **Quando não há histórico:** o modal mostra só os dois botões de tipo (sem seção de cópia).
- Clicar em **"Por Refeição"** → navega para o editor no modo atual, sem mudanças de comportamento.
- Clicar em **"Livre"** → navega para o editor já inicializando `type: 'free'`.
- **Copiar um plano existente:** herda o `type` do plano copiado automaticamente. Copiar um plano Livre gera outro plano Livre com o mesmo `freeTextContent`; copiar um plano Por Refeição funciona exatamente como hoje. Não há decisão nova aqui.

---

## Editor

Em vez de inserir condicionais ao longo dos 1463 linhas de `MealPlanEditor.tsx`, um componente novo e dedicado, `src/components/FreeTextMealPlanEditor.tsx`, cobre o modo Livre. `MealPlanEdit.tsx` escolhe qual editor renderizar com base no `type` do plano carregado/criado.

Campos do `FreeTextMealPlanEditor`:
- Nome do plano
- Meta de água (`waterIntake`)
- Orientações gerais (`generalInstructions`)
- Um `Textarea` grande — "Cole aqui o plano alimentar" — ligado a `freeTextContent`

Sem blocos de refeição, itens, reordenação ou receitas vinculadas — nada disso se aplica no modo Livre.

`handleSave` em `MealPlanEdit.tsx` ganha um branch para o modo Livre: persiste `freeTextContent` (e `waterIntake`/`generalInstructions`) via o endpoint de update do plano, sem chamar os endpoints de `items`.

---

## PDF — consolidação + adaptação

A duplicação existente é eliminada como efeito colateral desta mudança, para não escrever a lógica do modo Livre duas vezes:

- A cópia inline de `generateMealPlanPDF` em `PatientProfile.tsx` (linhas ~270–620) é removida. `handleExportPDF`, `sendMealPlanByEmail` e `exportMealPlanPDF` passam a importar `generateMealPlanPDF` de `src/lib/meal-plan-pdf.ts`, do mesmo jeito que `MealPlanEdit.tsx` já faz em `handlePrint`.
- `generateMealPlanPDF` (em `src/lib/meal-plan-pdf.ts`) ganha um branch por `plan.type`:
  - `'blocks'` (default): comportamento atual, inalterado — tabela por bloco de refeição, observações por refeição, tabela de medidas caseiras, receitas vinculadas.
  - `'free'`: pula o loop de tabelas por bloco e a tabela de medidas caseiras. Em vez disso, renderiza `freeTextContent` como texto corrido (quebra de linha via `splitTextToSize`) logo abaixo do bloco de meta de água, seguido do bloco de orientações gerais — os mesmos blocos de cabeçalho/paciente/nutricionista/água/orientações/assinatura são reaproveitados sem alteração. Sem seção de receitas.

---

## Backend

- `prisma/schema.prisma`: `MealPlan.type String @default("blocks")` + `freeTextContent String?` — nova migration.
- `src/server/services/meal-plans.service.ts`: os novos campos passam pelo mapeamento create/update já existente (camelCase ⇄ snake_case).
- Validação (Zod, no controller/rota de criação/atualização de plano): `type` restrito a `'blocks' | 'free'`.
- Endpoints de `items` (`/api/meal-plans/:mealPlanId/items`, `/api/meal-plans/:id/items`) continuam intocados — planos Livres simplesmente nunca os chamam.

---

## Compatibilidade

Todos os planos existentes recebem `type: 'blocks'` via default da migration — nenhuma mudança de comportamento, dado ou UI para eles. A única mudança de comportamento visível para planos existentes é indireta: o botão "Criar Plano" agora sempre abre o modal de escolha (mesmo sem histórico), já que o tipo precisa ser decidido em algum momento.

---

## Fora de escopo (nesta versão)

- Vínculo de receitas no modo Livre.
- Alternar o tipo de um plano já criado.
- Qualquer parsing/estruturação automática do texto colado (ex.: extrair itens automaticamente) — o texto é tratado como conteúdo opaco.

---

## Addendum — modal "Visualizar" (descoberto durante o planejamento)

Levantamento do código durante a fase de plano revelou uma terceira superfície que renderiza o conteúdo do plano além dos dois geradores de PDF: o modal "Visualizar" em `PatientProfile.tsx` (`isViewMealPlanModalOpen`, linhas ~1867–2211, acionado por `viewMealPlan`). Ele itera `selectedMealPlan.customMeals` e `selectedMealPlanItems` para montar cards de refeição na tela — para um plano `type: 'free'` isso resultaria em uma tela vazia (sem cards, já que não há `customMeals`).

Decisão: esse modal ganha o mesmo tratamento condicional por `type` que o PDF — quando `type === 'free'`, renderiza meta de água + orientações gerais + `freeTextContent` (texto corrido) no lugar da grade de cards de refeição/macros. Consistente com a decisão já tomada de manter água e orientações gerais disponíveis no modo Livre.

Não afetado: os blocos com classes `print:`/`hidden print:*` dentro desse mesmo modal (linhas ~1897–2061) e o container `print-content-wrapper` oculto (linhas ~2258+) são código morto — não há nenhum `window.print()` nem trigger ativo no código atual (o botão "Imprimir PDF" chama `exportMealPlanPDF`, que usa jsPDF). Esses blocos não são tocados nesta implementação.
