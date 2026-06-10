---
name: Nutrir
description: Plataforma de gestão para nutricionistas — atendimento de pacientes, agenda, financeiro e planos alimentares.
colors:
  primary: "oklch(0.52 0.10 163)"
  primary-light: "oklch(0.72 0.10 163)"
  primary-subtle: "oklch(0.93 0.025 163)"
  accent-amber: "oklch(0.93 0.030 80)"
  background: "oklch(0.985 0 0)"
  background-dark: "oklch(0.155 0.020 170)"
  surface: "oklch(1 0 0)"
  surface-dark: "oklch(0.195 0.018 168)"
  foreground: "oklch(0.145 0 0)"
  foreground-dark: "oklch(0.965 0 0)"
  muted: "oklch(0.962 0 0)"
  muted-foreground: "oklch(0.50 0 0)"
  sidebar: "oklch(0.972 0.012 163)"
  destructive: "oklch(0.577 0.245 27.325)"
  border: "oklch(0.900 0.004 163)"
typography:
  heading:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Geist Variable', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Geist Variable', sans-serif"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "0em"
rounded:
  sm: "3px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "oklch(0.47 0.10 163)"
    textColor: "{colors.background}"
    rounded: "{rounded.lg}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
  button-destructive:
    backgroundColor: "oklch(0.577 0.245 27.325 / 10%)"
    textColor: "{colors.destructive}"
    rounded: "{rounded.lg}"
    height: "32px"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "36px"
    padding: "0 12px"
  card-default:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "16px"
---

# Design System: Nutrir

## 1. Overview

**Creative North Star: "O Consultório Moderno"**

Nutrir projeta o ambiente de um consultório bem projetado: acolhedor sem ser decorativo, profissional sem ser intimidador. O nutricionista abre o sistema entre uma consulta e outra — o contexto é operacional, o ritmo é rápido — e a interface precisa sair do caminho. Cada pixel que não serve a uma tarefa é um pixel que atrapalha.

O sistema equilibra dois eixos que costumam se contradizer: densidade e respiro. Há informação suficiente por tela para que o profissional não precise navegar sem motivo, mas a hierarquia é clara o bastante para que o olho encontre o que precisa sem varredura. A paleta é restrained: o verde aparece como sinal, não como cenário. O fundo é neutro; o verde e o âmbar reservam-se para ação e estado.

Este sistema rejeita explicitamente três estéticas saturadas: (1) o software hospitalar pesado, com suas interfaces cinzas e tipografia legacy dos anos 2000; (2) o app de wellness superficial, com paleta pastel e fotografias de smoothie; (3) o SaaS corporativo frio, dominado por azul escuro e tabelas sem respiro. Nutrir é uma ferramenta séria feita para profissionais que cuidam de pessoas — a interface deve transmitir ambas as coisas ao mesmo tempo.

**Key Characteristics:**
- Verde como sinal de ação, não como decoração de fundo
- Tipografia de dois níveis: Plus Jakarta Sans para títulos (humanista, acolhedor), Geist Variable para dados e interface (geométrico, preciso)
- Profundidade tonal, não sombras dramáticas — cards se distinguem do fundo via valor, não via elevação
- Dark mode first-class: o fundo escuro tinta levemente para o verde da marca, não é preto puro
- Estado semântico completo: hover, focus, active, disabled, error, success em todos os componentes interativos

## 2. Colors

Paleta restrained de dois eixos: verde clínico controlado para ação e estrutura, âmbar quente como acento secundário de energia.

### Primary

- **Verde Clínico Controlado** (`oklch(0.52 0.10 163)`): O verde de ação, não de marca ambiente. Aparece em botões primários, itens de navegação ativos, indicadores de status positivo, focus rings. Ao valor `0.52` tem contraste suficiente sobre branco (WCAG AA) sem chegar ao verde-hospital saturado. Em dark mode sobe para `oklch(0.72 0.10 163)` para manter contraste.
- **Verde Sutil** (`oklch(0.93 0.025 163)`): Backgrounds de estados secundários, hover em chips de filtro, tag de status "ativo". Quase branco, apenas tinto o suficiente para diferenciar.

### Secondary

- **Âmbar Quente** (`oklch(0.93 0.030 80)`): O acento de energia do sistema. Aparece em destaques editoriais, badges de plano premium, ícones de aviso. Não concorre com o verde — opera em outra temperatura. Usado com parcimônia: no máximo um elemento por tela.

### Neutral

- **Branco Canvas** (`oklch(0.985 0 0)`): Fundo de conteúdo em light mode. Neutro puro — não é creme, não é warm-tinted. O verde existe nos elementos, não no fundo.
- **Superfície Pura** (`oklch(1 0 0)`): Cards e popovers em light mode. Um degrau acima do background via valor, sem sombra necessária.
- **Verde-Noite** (`oklch(0.155 0.020 170)`): Fundo em dark mode. O tint verde é intencional e sutil (chroma 0.020) — vincula o fundo ao verde da marca sem esmaecer o conteúdo.
- **Superfície Noturna** (`oklch(0.195 0.018 168)`): Cards em dark mode. Degrau de valor acima do fundo — profundidade por tonal layering.
- **Tinta** (`oklch(0.145 0 0)`): Texto em light mode. Neutro puro, não cinza-médio. Contraste >12:1 sobre o background.
- **Tinta Muda** (`oklch(0.50 0 0)`): Texto secundário, metadados, descrições. Sem tint — textos de suporte não devem ter cor de marca.
- **Borda Micro-Verde** (`oklch(0.900 0.004 163)`): Divisores e bordas. Chroma 0.004 é invisível para a maioria dos usuários mas une visualmente toda a estrutura ao verde primário.

### Named Rules

**A Regra do Verde como Sinal.** O verde primário ocupa ≤15% de qualquer tela. Sua raridade relativa é o que faz o item ativo na sidebar e o botão de confirmar leitura imediata. Diluir essa raridade destrói o sinal.

**A Regra do Fundo Neutro.** O background nunca recebe tint quente. Warm-sand, creme e bege são a estética padrão de ferramentas de saúde geradas por IA — Nutrir usa fundo neutro puro e reserva temperatura para o acento âmbar quando necessário.

## 3. Typography

**Heading Font:** Plus Jakarta Sans (humanist sans, variável em peso)
**Body Font:** Geist Variable (geometric sans, variável)

**Character:** A combinação opera por contraste de personalidade, não de categoria. Plus Jakarta Sans tem contornos levemente humanistas que suavizam o cabeçalho sem perder autoridade — o nutricionista se sente expert, não em um software de RH. Geist Variable é geométrico e preciso para dados, labels e interface densa — lê-se bem em 12px e em tabelas com muitas colunas.

### Hierarchy

- **Heading/Page** (Plus Jakarta Sans, 500, 20–24px, lh 1.3): Títulos de página e seções principais. Usa `font-heading` via Tailwind. Reservado para um elemento por tela.
- **Heading/Section** (Plus Jakarta Sans, 500, 16–18px, lh 1.3): Títulos de cards, seções dentro de uma página. Classe `font-heading text-base font-medium` do CardTitle.
- **Body** (Geist Variable, 400, 14px, lh 1.5): Todo texto operacional — descrições, conteúdo de tabelas, inputs, texto de formulário. Texto corrido limitado a 65–75ch.
- **Body/Strong** (Geist Variable, 500, 14px): Dados numéricos em destaque, labels de campo, nomes de pacientes em listas.
- **Label** (Geist Variable, 500, 12px, lh 1.4): Labels de botão, badges, texto de metadata, cabeçalhos de tabela. Nunca uppercase.
- **Caption** (Geist Variable, 400, 12px): Timestamps, IDs, texto auxiliar. Muted-foreground. Nunca abaixo de 12px.

### Named Rules

**A Regra da Fonte Única em Labels.** Geist Variable é o sistema. Plus Jakarta Sans é reservado para títulos visuais — nunca para labels de botão, texto de tabela, inputs ou badges. Dois sistemas em competição em elementos pequenos criam ruído, não hierarquia.

## 4. Elevation

Nutrir usa tonal layering como sistema primário de profundidade. Não há sombras decorativas. A hierarquia visual emerge da diferença de valor entre camadas:

- **Background** (`oklch(0.985 0 0)` light / `oklch(0.155 0.020 170)` dark) — o chão
- **Surface/Card** (`oklch(1 0 0)` light / `oklch(0.195 0.018 168)` dark) — um degrau acima via ring de 1px (ring-1 ring-foreground/10), sem sombra
- **Sidebar** (`oklch(0.972 0.012 163)`) — superfície de navegação diferenciada pelo tint verde suave
- **Overlays (modal, popover, dropdown)** — única camada que usa sombra, funcional e estrutural

### Shadow Vocabulary

- **Overlay** (`0 4px 16px oklch(0 0 0 / 0.12), 0 1px 4px oklch(0 0 0 / 0.08)`): Modais, dropdowns, popovers. A única sombra do sistema. Indica que o elemento está acima de toda a superfície de conteúdo.
- **Focus ring** (`0 0 0 3px oklch(0.52 0.10 163 / 50%)`): Focus-visible em todos os interativos. Verde primário em 50% de opacidade — presente mas não agressivo.

### Named Rules

**A Regra da Sombra como Exceção.** Sombra aparece exclusivamente quando um elemento flutua sobre o conteúdo (modal, dropdown, tooltip). Cards em repouso não têm sombra — têm ring de 1px e diferença de background. Se você está tentando adicionar sombra a um card que não flutua, a solução correta é ajustar os valores de background, não adicionar shadow.

## 5. Components

### Buttons

Botões são pequenos e funcionais — a interface é densa, o espaço é escasso. Não há padding generoso "para parecer premium".

- **Shape:** Cantos suavemente arredondados (8px / `rounded-lg`). Não pill, não quadrado.
- **Primary** (`bg-primary text-primary-foreground`): Verde clínico sobre branco. Altura 32px (`h-8`), padding horizontal 10px. Translate-y-px no active para feedback físico.
- **Outline** (`border-border bg-background hover:bg-muted`): Para ações secundárias. Borda 1px borde-border; hover preenche com muted.
- **Secondary** (`bg-secondary text-secondary-foreground`): Verde suave — para confirmar sem comprometer. Menos visual que primary.
- **Ghost** (`hover:bg-muted`): Ações terciárias e de navegação. Invisível em repouso.
- **Destructive** (`bg-destructive/10 text-destructive hover:bg-destructive/20`): Vermelho suave — destrutivo mas não agressivo. Sem fill sólido; o tint comunica risco sem gritar.
- **Focus:** `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` — ring verde em todos os variantes.
- **Disabled:** `opacity-50 cursor-not-allowed pointer-events-none`. Sem state visual adicional.

### Cards / Containers

- **Corner Style:** Arredondado generoso (12px / `rounded-xl`) — mais suave que botões, reforça que o card é um container, não uma ação.
- **Background:** `bg-card` (branco puro em light, superfície escura em dark).
- **Shadow Strategy:** Sem sombra. Ring de 1px em `foreground/10` — borda de contexto, não elevação.
- **Internal Padding:** 16px (`py-4 px-4`). Small variant: 12px.
- **Card Footer:** `bg-muted/50` com `border-t` — distingue a zona de ações do conteúdo do card sem criar uma segunda superfície.

### Inputs / Fields

- **Style:** Altura 36px (`h-9`), borda 1px `border-input`, fundo transparente, cantos 8px. O fundo transparente significa que o input se integra à superfície do card — não é uma caixa dentro de uma caixa.
- **Focus:** `border-ring ring-3 ring-ring/50` — o mesmo sistema do botão. Consistência de linguagem de foco em todo o sistema.
- **Error:** `border-destructive ring-3 ring-destructive/20` — vermelho na borda e ring. A mensagem de erro fica abaixo via elemento irmão.
- **Disabled:** `bg-input/50 opacity-50 cursor-not-allowed`.
- **Placeholder:** `text-muted-foreground` — `oklch(0.50 0 0)`. Contraste ~4.6:1 sobre o background de card. Passa WCAG AA.

### Badges

Badges são totalmente arredondados (`rounded-4xl` / pill), altura 20px (`h-5`), texto 12px. Sistema de variantes: `default` (verde primary), `secondary` (verde suave), `destructive` (vermelho/10), `outline` (borda), `ghost`. Sempre maiúsculas não são usadas — os badges comunicam via cor e contexto, não via casing.

### Navigation (Sidebar)

- **Background:** `oklch(0.972 0.012 163)` — levemente mais verde que o background. Distingue a zona de navegação sem criar contraste forte.
- **Item ativo:** `bg-primary text-primary-foreground shadow-sm rounded-lg` — o verde primário como indicador de localização. Claro e imediato.
- **Item inativo:** `text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg` — hover usa o âmbar suave como temperatura de boas-vindas.
- **Collapsed mode:** Suporta sidebar colapsada com apenas ícones. Tooltips aparecem no hover para acessibilidade.
- **Items bloqueados (free plan):** `opacity-50 cursor-not-allowed` com ícone de cadeado e tooltip "Em Breve".

### Premium / Plan Gating

- Itens de plano premium usam `PremiumFeature` wrapper e `PremiumBanner` para comunicar upsell.
- O estado "bloqueado" nunca usa cor vermelha — usa opacity e cadeado. Vermelho é reservado para erro, não para restrição de plano.

## 6. Do's and Don'ts

### Do:

- **Do** usar `oklch(0.52 0.10 163)` como cor de ação primária e reservar o verde para estados funcionais (ativo, confirmado, ação principal). Cada uso dilui o sinal.
- **Do** usar Plus Jakarta Sans exclusivamente para títulos de página e seção. Geist Variable para tudo mais: labels, botões, dados, badges.
- **Do** distinguir camadas por valor (background → card → overlay) antes de tentar sombras. Ring de 1px é suficiente para 90% dos casos.
- **Do** aplicar `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` em todo elemento interativo, consistentemente.
- **Do** usar `text-muted-foreground` (`oklch(0.50 0 0)`) para texto secundário — verificar contraste ≥4.5:1 contra o background atual antes de usar.
- **Do** respeitar `@media (prefers-reduced-motion: reduce)` em toda animação — o CSS base já define `animation-duration: 0.01ms` para o sistema, mas transições adicionadas manualmente também precisam do override.
- **Do** nomear botões com verbo + objeto: "Salvar consulta", "Excluir paciente", "Adicionar alimento". Nunca "OK", "Sim" ou "Confirmar" sozinhos.

### Don't:

- **Não** usar `border-left` maior que 1px como acento colorido em cards, alertas ou list items. É proibido pelo sistema. Substitua por fundo tintado, borda completa ou ícone de contexto.
- **Não** usar `background-clip: text` com gradiente. Ênfase se faz com peso ou tamanho, não com gradiente de texto.
- **Não** adicionar tint quente ao background. O warm-sand/cream (`oklch` com hue 40–100) é a estética padrão de SaaS de saúde gerado por IA — Nutrir usa fundo neutro puro propositalmente.
- **Não** usar verde em mais de 15% da superfície de qualquer tela. Se a tela parece "muito verde", o erro provavelmente está em usar `bg-secondary` (verde suave) em containers grandes.
- **Não** fazer interface parecer software hospitalar pesado (Epic, Tasy): sem tipografia compacta em corpo 11px, sem cinzas uniformes, sem tabelas sem respiro entre colunas.
- **Não** fazer interface parecer app de wellness superficial: sem paleta pastel, sem ícones de folha, sem fotografias de estilo de vida como elementos de UI.
- **Não** usar modais como primeira resposta para coleta de input. Inline, progressive disclosure ou drawer lateral são a resposta correta na maioria dos casos.
- **Não** usar cores de estado (vermelho destructive, âmbar accent) em elementos decorativos ou inoperantes. Cor semântica que aparece sem semântica perde seu significado.
- **Não** usar letras maiúsculas em labels de botão, badges ou cabeçalhos de tabela. O sistema não usa uppercase — casing é Sentence Case ou Title Case dependendo do contexto.
- **Não** usar valores arbitrários de z-index (999, 9999). A escala semântica: dropdown → sticky → modal-backdrop → modal → toast → tooltip.
