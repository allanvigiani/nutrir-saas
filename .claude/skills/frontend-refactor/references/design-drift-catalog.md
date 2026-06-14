# Catálogo de Drift Visual — Nutrir

Cada item abaixo é um padrão "fora do sistema" já encontrado em telas reais deste projeto (MealPlanEditor, NutritionalCalculator, FoodAutocomplete, AdminDashboard, Financial, Settings, SubscriptionSuccess, páginas de auth/legal), com a correção exata aplicada e o porquê. Use como referência de busca-e-substitui ao revisar qualquer arquivo de `src/pages/` ou `src/components/`.

Comandos úteis para localizar ocorrências num arquivo:

```bash
grep -n "shadow-\|font-black\|tracking-tighter\|text-white\|bg-white\|text-blue-\|text-purple-\|text-orange-\|bg-blue-\|bg-purple-\|bg-orange-\|bg-rose-\|red-50\|red-500\|uppercase\|z-\[9999\]\|border-l-4\|border-r-4\|backdrop-blur" src/components/Arquivo.tsx
```

## 1. Paleta de macros nutricionais

**Problema**: cores hardcoded (`text-blue-400/500/600`, `bg-orange-50`, `text-purple-400`, etc.) usadas para categorizar Energia/Proteína/Carboidrato/Gordura. Cada tela inventava sua própria paleta — não respondem a dark mode e criam "dialetos" de cor para o mesmo conceito.

**Correção**: usar os tokens `--chart-1`..`--chart-5` já definidos em `index.css` / `@theme inline` (mapeados para `text-chart-N` / `bg-chart-N`), que existem exatamente para diferenciação de séries multi-dado.

**Mapeamento estabelecido** (aplicado em MealPlanEditor.tsx — reutilize em qualquer tela que mostre os mesmos 4 macros):

| Macro | Antes | Depois |
|---|---|---|
| Energia / Kcal | `text-orange-600`, `bg-orange-50`, `bg-orange-500` | `text-chart-3`, `bg-chart-3/10`, `bg-chart-3` |
| Proteínas / Prot | `text-blue-400/600`, `bg-blue-50`, `bg-blue-500` | `text-chart-4`, `bg-chart-4/10`, `bg-chart-4` |
| Carboidratos / Carb | `text-primary` (já correto) | `text-primary` / `bg-primary/10` / `bg-primary` (sem mudança) |
| Gorduras / Gord | `text-purple-400/600`, `bg-purple-50`, `bg-purple-500` | `text-chart-2`, `bg-chart-2/10`, `bg-chart-2` |

Se uma tela nova introduzir uma 5ª categoria de dado (ex.: fibras, sódio), use `chart-1` ou `chart-5` antes de inventar uma cor nova.

## 2. "A Regra da Sombra como Exceção"

**Problema**: vocabulário de sombra próprio por tela — `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`, `shadow-inner`, e valores arbitrários como `shadow-[0_20px_50px_rgba(0,0,0,0.03)]` ou `shadow-lg shadow-primary/20`, aplicados em cards, inputs, botões e badges **em repouso**.

**Correção** (regra do DESIGN.md §4): sombra existe **apenas** em overlays reais (Dialog, Popover, DropdownMenu, Tooltip, menus flutuantes). Em qualquer elemento em repouso:

- Se já tem `border border-border` → não precisa de mais nada.
- Se precisa de uma diferenciação extra de camada → `ring-1 ring-foreground/10` (ou `ring-1 ring-border`).
- `shadow-inner focus:shadow-none` em inputs → remover ambos; o foco já é comunicado por `focus:ring`/`focus:border`.

Em overlays reais, a sombra correta (já no DESIGN.md) é:
```
0 4px 16px oklch(0 0 0 / 0.12), 0 1px 4px oklch(0 0 0 / 0.08)
```

## 3. `text-white` / `bg-white` sobre superfícies coloridas

**Problema**: `text-white` em cima de `bg-primary` (ou outro fundo colorido) e `bg-white/20` como overlay translúcido. Funciona em light mode mas quebra contraste/intenção em dark mode, porque "branco" não é um token semântico.

**Correção**:
- `text-white` sobre `bg-primary` → `text-primary-foreground`
- `bg-white/20` (overlay translúcido sobre `bg-primary`) → `bg-primary-foreground/20`

Regra geral: qualquer cor de texto/fundo "fixa" (`white`, `black`, `gray-900`, etc.) usada sobre um token semântico (`bg-primary`, `bg-destructive`, `bg-card`...) deve virar o par `-foreground` desse token.

## 4. Estados destrutivos hardcoded

**Problema**: `text-red-500`, `bg-rose-500`, `hover:bg-red-50 hover:text-red-500` (às vezes até duplicado/malformado na mesma string de classes) para indicar exclusão, erro ou "acima de 100%".

**Correção**:
- `bg-rose-500` (ex.: barra de progresso acima de 100%) → `bg-destructive`
- `hover:bg-red-50 hover:text-red-500` (ex.: botão de excluir) → `hover:bg-destructive/10 hover:text-destructive`
- `text-red-500` solto → `text-destructive`

## 5. Campos com cor de foco hardcoded

**Problema**: um input específico (ex.: campo de água/hidratação) com `focus:border-blue-400 focus:ring-blue-400/10` e ícone `text-blue-400`, destoando dos campos vizinhos que usam o sistema de foco padrão.

**Correção**: `focus:border-primary focus:ring-primary/10`; ícone decorativo → `text-muted-foreground` (cor neutra, sem temperatura própria), igual aos campos irmãos.

## 6. Tipografia fora da escala

**Problema**: `font-black` e `tracking-tighter` usados para "dar destaque" em títulos, valores numéricos grandes (ex.: percentuais, kcal totais) e inputs de nome.

**Correção**: a escala do DESIGN.md vai até `font-bold` / `tracking-tight` (heading = Plus Jakarta Sans 500). `font-black`/`tracking-tighter` não existem na escala — trocar por `font-bold`/`tracking-tight` preserva a ênfase sem criar um peso "mais forte que o sistema permite".

## 7. Uppercase em badges, labels e cabeçalhos

**Problema**: `uppercase` (geralmente acompanhado de `tracking-wider`) em badges de origem de dados ("Próprio"), labels de macro em listas de busca (kcal/P/C/G/Base), badges de plano (`'ADMIN'/'PREMIUM'/'GRATUITO'`), cabeçalhos de tabela, etc.

**Correção**: remover `uppercase` (e o `tracking-wider` que normalmente o acompanha). O texto deve já estar escrito em Sentence Case ou Title Case (ex.: trocar a string `'ADMIN'` por `'Admin'`, não só remover a classe). DESIGN.md §3 e §6: "Label... Nunca uppercase" e "Não usar letras maiúsculas em labels de botão, badges ou cabeçalhos de tabela".

## 8. z-index arbitrário

**Problema**: `z-[9999]` (ou qualquer valor numérico arbitrário > 50) em dropdowns/portais, geralmente para "garantir" que fiquem acima de tudo.

**Correção**: usar a escala semântica já em uso no projeto — `z-10`/`z-20` para elementos sticky, `z-40`/`z-50` para bottom nav e modais/dropdowns. Na prática, `z-50` já é o topo da escala existente; se algo realmente precisar ficar acima de um modal (`z-50`), isso é sinal de que a escala semântica do DESIGN.md (dropdown → sticky → modal-backdrop → modal → toast → tooltip) precisa ser formalizada em tokens Tailwind antes de adicionar mais um nível ad-hoc — não resolva localmente com outro número arbitrário.

## 9. Side-stripe borders (proibido)

**Problema**: `border-l-4 border-rose-400` (ou similar) em cards/alertas/list items como "acento" colorido lateral.

**Correção**: proibido pelo DESIGN.md §6. Substituir por: borda completa (`border border-border`), tint de fundo (`bg-{token}/10`), ou ícone de contexto à esquerda do conteúdo.

## 10. Glassmorphism decorativo

**Problema**: `backdrop-blur-sm`/`backdrop-blur-md` em cards comuns (não overlays), normalmente combinado com `bg-white/X` translúcido — comum em telas de auth (Login/Register/PatientAccess) e banners promocionais.

**Correção**: remover o blur e o fundo translúcido; usar `bg-card` (ou `bg-surface`) sólido com `border border-border`. Glassmorphism só é aceitável em overlays reais e de forma pontual, nunca como padrão de card.

## Itens que NÃO são drift (não "corrigir")

- `text-primary` para Carboidratos já está correto — não remapear para `chart-*`.
- `ring-1 ring-border` / `ring-1 ring-foreground/10` em cards são a forma correta de diferenciação de camada — não são "sombra disfarçada", não remover.
- Sombra em `Dialog`/`Popover`/`DropdownMenu`/`Tooltip` (componentes de `src/components/ui/`) é a exceção prevista — não remover dali.
