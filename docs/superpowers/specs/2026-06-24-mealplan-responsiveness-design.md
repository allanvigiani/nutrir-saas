# Spec: MealPlanEditor — Responsividade Multi-Resolução

**Data:** 2026-06-24  
**Componentes afetados:** `src/components/MealPlanEditor.tsx`, `src/pages/MealPlanEdit.tsx`

---

## Contexto

A tela do plano alimentar (`MealPlanEditor`) apresenta problemas de layout em tablet landscape (768–1279px): o header estoura horizontalmente e campos/botões somem ou ficam espremidos com a sidebar visível (270px). O objetivo é estabelecer três faixas de breakpoint com densidades visuais diferentes, reduzindo tamanhos e espaçamentos onde necessário.

---

## Breakpoints

| Faixa | Largura | Sidebar | Densidade |
|---|---|---|---|
| Mobile | < 768px | oculta | espaçosa, cards empilhados |
| Tablet landscape | 768–1279px | visível (270px) | compacta |
| Desktop | ≥ 1280px | visível (270px) | atual (preservada) |

Tailwind usa `xl` = 1280px. Portanto:
- Mobile = padrão (sem prefixo)
- Tablet = `md:` (768px) até `xl:` exclusive
- Desktop = `xl:`

A sidebar troca de `hidden lg:flex` para `hidden md:flex` para aparecer já em 768px.

---

## 1. Header

### Mobile (< 768px)
- Linha única: botão `←` + breadcrumb "Edição" + botão salvar (ícone apenas, sem texto)
- Seletor de datasource removido do header — aparece como Select inline próximo ao campo de busca do alimento
- Padding: `px-3 py-2`

### Tablet (768–1279px)
- Linha única com três grupos: navegação | datasource compacto | salvar
- Datasource vira um `<Select>` compacto: "Base: Todas ▾" (um único dropdown)
- Botão salvar: ícone + texto curto "Salvar" (`h-8 px-3 text-xs`)
- Padding do header: `px-4 py-2`
- Altura total do header menor para ganhar espaço vertical

### Desktop (≥ 1280px)
- Layout atual preservado: tabs de datasource expandidas, "Salvar Alterações", `px-6 py-3`

---

## 2. Food Item Row (`MealItemRow`)

### Mobile (< 768px)
Layout em 2 linhas:
- Linha 1: input de busca (largura total, `h-8`)
- Linha 2: `flex` com quantidade + unidade | kcal | prot | carb | gord | 🗑

### Tablet (768–1279px)
Grid 12 colunas mantido, ajustes:
- Busca: 5 cols, input `h-7`, fonte `text-xs`
- Qtd + unidade: 3 cols, inputs `h-7`
- Macros: 3 cols — **labels (Kcal/Prot/Carb/Gord) somem**, só números; inputs `w-8` (Kcal `w-10`)
- Lixeira: 1 col, botão `h-7 w-7`
- Padding do card do item: `p-1.5`
- Gap interno do grid: `gap-1.5`

### Desktop (≥ 1280px)
- Layout atual preservado: labels visíveis, inputs `w-14`/`w-10`, `h-8/h-9`

---

## 3. Sidebar de Macros

### Tablet (768–1279px)
- `SummaryCard` variant sidebar: `p-2.5` (atual `p-3`)
- Ícone: `w-7 h-7` (atual `w-8 h-8`)
- Valor numérico: `text-lg` (atual `text-xl`)
- Barra de progresso: `h-1.5` (atual `h-2`)
- Gap entre cards: `gap-2` (atual `gap-3`)

### Desktop (≥ 1280px)
- Preservado como está

---

## 4. Cabeçalho de Refeição (meal header)

### Tablet (768–1279px)
- Botões de ação (cor, renomear, lixeira da refeição): `h-7 px-2 text-xs`
- Título da refeição: `text-base` (atual `text-lg/text-xl`)
- Pill de total de itens: menor, `text-[10px]`

### Desktop (≥ 1280px)
- Preservado como está

---

## 5. Barra de macros mobile

- Mantida como está (já existente em `lg:hidden`)
- Ajuste: troca `lg:hidden` → `md:hidden` para consistência com a sidebar
- Garantir que não quebre em 360px (sem flex-wrap)

---

## Arquivos a modificar

1. **`src/components/MealPlanEditor.tsx`** — todos os itens acima
2. Nenhum outro arquivo necessário

---

## O que NÃO muda

- Lógica de negócio, estado, callbacks
- Layout e comportamento em desktop (≥ 1280px)
- `ReceitasVinculadasPanel` (children do editor)
- Animações Framer Motion existentes
