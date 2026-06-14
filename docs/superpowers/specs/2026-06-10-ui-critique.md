# Critique de UI — Nutrir (todas as telas)

> Critique gerado a partir de `docs/superpowers/specs/2026-06-10-ui-inventory.md`, cobrindo as 18
> páginas e ~20 modais do sistema. Baseado em (A) revisão de design por arquivo (3 agentes em
> paralelo, cobrindo páginas públicas, núcleo do sistema e admin/financeiro/globais) e (B) scan
> determinístico (`detect.mjs`) sobre `src/pages` e `src/components`. Sem inspeção em browser
> (nenhum dev server ativo na sessão) — achados são baseados em código.

## Status do Polish (2026-06-14)

Seguindo a priorização da seção 7 do inventário, todas as 5 ondas foram concluídas, uma tela/
componente por vez, com critique-verificação + polish + commit individual:

1. **`PatientProfile.tsx`** (commit `359aeb2`) — removidas eyebrows uppercase e estilos
   off-system do bloco de impressão do plano alimentar; tooltip do gráfico de evolução
   reescrito com componente customizado (`EvolutionTooltip`) em vez de `contentStyle` inválido.
2. **`Patients.tsx`** — já totalmente resolvido pelo commit anterior `bbd1bc7` (avatares
   rainbow → tokens, acessibilidade do botão de exclusão, campo `medications`). Nenhuma
   mudança adicional necessária.
3. **`Schedule.tsx`** — já totalmente resolvido pelo commit anterior `ee941e2` (classes de
   opacidade dupla, `text-white` → `text-primary-foreground`, cores de erro off-system,
   `tracking-tight` no `<h1>`).
4. **Páginas públicas** (`Landing`, `Login`, `Register`, `PatientAccess`, `ForgotPassword`) —
   `Landing`/`ForgotPassword`/`PatientAccess` (parte) já resolvidos por commits anteriores
   (`094a094`, `bddcaf4`, `513a901`). Nesta rodada: removido glassmorphism (`backdrop-blur-sm`,
   5 ocorrências) e badge uppercase do painel de marca em `Login.tsx`/`Register.tsx`
   (commits `b9c93fd`, `3aaebda`); `PatientAccess.tsx` (commit `cff8047`) removeu o
   `backdrop-blur-sm` do ícone "Acesso Restrito" e corrigiu o branding do PDF gerado
   (`NutriCare Pro` → `Nutrir`). `Register.tsx` já tinha o código morto Firestore removido
   (commit `3a7002d`).
5. **Modais globais** (`UpgradeModal`, `TutorialModal`, `InactivityWarningModal`,
   `CustomFoodDialog`) — sem critique prévio, feito críquite + polish completo nesta rodada:
   `InactivityWarningModal.tsx` (commit `badccc4`, ícone de aviso `amber-*` → `accent`/
   `accent-foreground`), `UpgradeModal.tsx` (commit `e9bd45e`, `text-white` →
   `text-primary-foreground`), `CustomFoodDialog.tsx` (commit `e335603`, 6x `text-red-500` →
   `text-destructive` + `text-white` → `text-primary-foreground`). `TutorialModal.tsx` já
   estava alinhado, sem mudanças.
6. **Páginas institucionais** (`Privacidade`, `Termos`, `Cookies`, `Contato`) — todas já
   totalmente resolvidas por commits anteriores (`b76fbbf`, `1657d5d`, `aa8109f`, `2cc39ec`).

### O que ficou de fora (decisões de escopo maior, não "polish por tela")

Os itens abaixo do critique original continuam abertos porque exigem uma decisão de design
system (novos tokens, componente compartilhado) em vez de um ajuste pontual por tela — ver
seção "Perguntas para Considerar" abaixo:

- **Sistema de badges em uppercase fora do token** (`Financial.tsx`, `Settings.tsx`,
  `AdminDashboard.tsx`, `FoodAutocomplete.tsx`, `NutritionalCalculator.tsx`,
  `PatientAccess.tsx:545-660`) — precisa de um componente `Badge` único com variantes
  semânticas antes de substituir as ~14 ocorrências.
- **Paletas de cor hardcoded paralelas** em `MealPlanEditor.tsx` (macros azul/laranja/roxo) e
  `SupportWidget.tsx` (paleta `green-*/gray-*/slate-*`) — precisam de tokens semânticos novos
  (`--macro-protein`, etc.) definidos no DESIGN.md antes de aplicar.
- **`z-[9999]` em `FoodAutocomplete.tsx:120`** — precisa de uma escala semântica de z-index
  (`z-dropdown`/`z-modal`/`z-toast`) definida no Tailwind config; usado em todo o
  `MealPlanEditor`, alto impacto.
- **3 formatos de modal de exclusão + 2 formulários de paciente duplicados** — requer extrair
  `ConfirmDeleteDialog` e `PatientFormDialog` compartilhados (`Patients.tsx`/`PatientProfile.tsx`).
- **`Landing.tsx:456,460`** (`border-l-2` no mockup de evento do Google Calendar) — mantido
  como exceção julgada (representação fiel da UI real do Google Calendar, que usa borda
  esquerda colorida em eventos); revisitado nesta rodada e a decisão original foi confirmada.
- **`Contato.tsx`** — formulário simula envio sem chamada real à API (`/api/contact`); é
  trabalho de feature (`craft`/`harden`), não de polish visual.

Todos os 4 grupos de mudanças desta rodada (PatientProfile, páginas públicas, modais globais)
passaram por `npx tsc --noEmit -p .` limpo e pela suíte de 235 testes via lint-staged em cada
commit.

## Design Health Score

| # | Heurística | Nota | Principal achado |
|---|---|---|---|
| 1 | Visibilidade do status do sistema | 3 | Skeletons e toasts presentes na maioria dos fluxos (Patients, Dashboard, Financial, Login). Modal de exame laboratorial (PatientProfile) não indica progresso ao salvar N marcadores. |
| 2 | Correspondência com o mundo real | 3 | PT-BR consistente, domínio nutricional bem nomeado. Buzzwords de marketing ("transformar/transformando") repetidas 3x na Landing/Footer. |
| 3 | Controle e liberdade do usuário | 3 | Cancelar/fechar presentes na maioria dos modais. `MealPlanEditor` avisa sobre alterações não salvas (ótimo). Modais que não usam `Dialog` (AdminDashboard cleanup, InactivityWarningModal) podem não ter ESC/click-outside consistente. |
| 4 | Consistência e padrões | **2** | Maior fraqueza do sistema: 3 "formatos" diferentes de modal de exclusão, 2 implementações paralelas de formulário de paciente, 4+ paletas de cor paralelas (macros, status de agenda, badges admin, cores hardcoded de aviso), badges em uppercase em 5+ telas. |
| 5 | Prevenção de erros | 3 | Confirmações de exclusão em todo lugar, Zod no Register, checagem de duplicidade de CPF/CNPJ/CRN, aviso de alterações não salvas. |
| 6 | Reconhecimento em vez de memorização | 3 | Ícones com label na maioria dos lugares, autocomplete de alimentos, tooltips em itens bloqueados ("Em Breve"). |
| 7 | Flexibilidade e eficiência de uso | 2 | Sem atalhos de teclado, sem ações em lote (ex.: excluir vários pacientes/agendamentos de uma vez), botão de excluir paciente só aparece no hover (problema em touch). |
| 8 | Design estético e minimalista | 2 | Vários elementos de "AI slop" pontuais: gradientes decorativos (`PremiumBanner`, header de assinatura em Settings), blobs com blur, glassmorphism em Login/Register/PatientAccess, side-stripe borders (Landing, plano alimentar). `MealPlanEditor` é uma "ilha visual" com sombras pesadas e paleta própria. |
| 9 | Recuperação de erros | 2 | Login/Register mapeiam erros do Firebase para PT-BR específico (ótimo). Mas o modal "Editar Paciente" em PatientProfile usa apenas `toast.error` genérico, sem erro inline por campo — diferente de Patients.tsx que tem erro inline. |
| 10 | Ajuda e documentação | 3 | `SupportWidget` (FAQ + contato) presente em todo o app autenticado, `TutorialModal` para onboarding, tooltips em itens premium/bloqueados. |
| **Total** | | **26/40** | **Aceitável — melhorias significativas necessárias antes que o sistema pareça "produto único", mas a fundação funcional é sólida.** |

## Veredito de Anti-Padrões

### Avaliação manual (LLM)

O sistema **não** parece "feito por IA" no sentido de genérico/vazio — tem personalidade, copy em PT-BR cuidada, fluxos completos (LGPD, retenção de 30 dias, aviso de inatividade, tutorial). O problema não é falta de substância, é **drift acumulado entre telas construídas em momentos diferentes**:

- Quatro telas (`AdminDashboard`, `SubscriptionSuccess`, `Financial`, `Settings`) passaram por uma padronização recente (commits `c69b0b5`/`ec20825`/`bcc2147`/`c7f478d`/`0210cfe`), e ficaram **consistentes entre si**, mas adotaram um padrão de badge (`uppercase tracking-wider text-[10px] font-bold rounded-full`) que **conflita com o DESIGN.md atual** ("badges nunca uppercase, h-5/text-xs"). Ou seja: a padronização recente já está desalinhada da spec mais nova.
- As páginas de autenticação (`Login`, `Register`, `ForgotPassword`, `PatientAccess`, `SubscriptionSuccess`) usam uma escala de componente diferente (`h-11`/`h-12`/`h-14`, `rounded-xl`/`rounded-2xl`/`rounded-3xl`, `shadow-xl`) da especificada para botões/cards (`h-8`, `rounded-lg`/`rounded-xl`, sem sombra) — parecem ter sido construídas com um design system anterior.
- `MealPlanEditor.tsx` — provavelmente a tela mais usada no dia a dia — tem sua própria paleta (azul/laranja/roxo para macros) e seu próprio vocabulário de sombra (`shadow-[0_20px_50px_rgba(0,0,0,0.03)]`, `shadow-lg shadow-primary/20`), destoando de tudo ao redor.
- Padrões pontuais clássicos de "AI slop" aparecem isolados: side-stripe borders (Landing, plano alimentar), glassmorphism (`backdrop-blur-sm` em 5 lugares no fluxo de auth), gradiente decorativo cobrindo banner inteiro (`PremiumBanner`), blobs decorativos com blur.

### Scan determinístico (`detect.mjs` em `src/pages` + `src/components`)

29 ocorrências brutas, das quais **25 são falsos positivos** (regra `border-accent-on-rounded` disparando em `border-b-2` de `TabsTrigger` ativo e em spinners `animate-spin border-b-2` — ambos são padrões legítimos e consistentes em todo o app, não side-stripes).

**4 achados reais**:

| Antipadrão | Arquivo | Severidade |
|---|---|---|
| `side-tab` (border-left colorido) | `src/pages/Landing.tsx:456,460` | warning → confirmado como side-stripe real (mockup de evento de calendário) |
| `gray-on-color` | `src/components/SupportWidget.tsx:375` | warning → contraste OK na prática, mas paleta fora de tokens (ver abaixo) |
| `bounce-easing` | `src/components/SupportWidget.tsx:242` | warning → indicador de "digitando" de chat, uso convencional, baixo risco |

O detector **não pegou** o achado mais grave de side-stripe (`PatientProfile.tsx:1757`, `border-l-2`/`w-1.5` colorido por refeição no modal de plano alimentar) nem o `z-[9999]` em `FoodAutocomplete.tsx:120` — ambos identificados na revisão manual. Vale revisar as regras do detector para cobrir esses casos.

### Visualização em browser

Não realizada nesta rodada (nenhum dev server ativo). Recomenda-se rodar `/impeccable critique` com `npm run dev` ativo para validar visualmente os achados antes do polish, especialmente os de cor/contraste.

## Impressão Geral

O Nutrir tem uma base de produto madura — fluxos completos de LGPD, retenção, tutorial, autenticação robusta, portal do paciente funcional. O problema central não é "design ruim", é **fragmentação**: o sistema parece ter sido construído por equipes/momentos diferentes sem um design system vivo sendo seguido por todos. A maior oportunidade não é redesenhar nada, é **consolidar o vocabulário visual** (badges, botões, modais de exclusão, paleta de cores de status) em componentes compartilhados e aplicá-los de forma consistente — isso resolveria a maioria dos achados P1/P2 de uma vez.

## O que está funcionando

1. **Fluxos de confiança e conformidade são excelentes**: aviso de inatividade com countdown, modal de exclusão de paciente explicando retenção de 30 dias/LGPD, aviso de alterações não salvas no editor de plano alimentar, mapeamento de erros do Firebase para PT-BR específico no Login/Register.
2. **Navegação compartilhada (`Sidebar`, `BottomNav`, `MobileHeader`, `PremiumFeature`) está perfeitamente alinhada ao design system** — item ativo em verde, itens bloqueados com opacity+cadeado (não vermelho), exatamente como especificado. É o melhor exemplo de "como deveria ser" no resto do app.
3. **Tabs com underline (`border-b-2 data-[state=active]:border-primary`)** é uma convenção bem estabelecida e aplicada de forma idêntica em Settings, AdminDashboard, PatientProfile e Schedule — um raro caso de consistência perfeita entre 4 telas diferentes.

## Problemas Prioritários

### [P1] Sistema de badges em uppercase, fora do token (`h-5`/`text-xs`/sem uppercase)
**Onde**: `Financial.tsx:605-617` (status de pagamento), `Settings.tsx:919-928` (badge de plano: literalmente `'ADMIN'/'PREMIUM'/'GRATUITO'`), `AdminDashboard.tsx:466-487` (badges de plano e cargo), `FoodAutocomplete.tsx:142,147` e `NutritionalCalculator.tsx:142,147` (badge "Próprio" e cabeçalhos), `PatientAccess.tsx:545-660` (6+ labels uppercase).
**Por que importa**: É a violação mais repetida do sistema (8+ ocorrências em 6 arquivos). Cria uma "segunda linguagem" de badge que o usuário aprende a reconhecer como diferente do resto da UI, e vai contra a regra explícita do DESIGN.md.
**Fix**: Criar/usar um único componente `Badge` com variantes semânticas (`default`/`secondary`/`destructive`/`outline`), `h-5 text-xs normal-case`, e substituir todas as ocorrências acima. Trocar `'ADMIN'/'PREMIUM'/'GRATUITO'` por `'Admin'/'Premium'/'Gratuito'`.
**Comando sugerido**: `/impeccable polish` (consolidação de componente compartilhado)

### [P1] Paletas de cor hardcoded paralelas ao token system (oklch)
**Onde**: `MealPlanEditor.tsx` (azul/laranja/roxo para macros, `blue-400/500/600`, `orange-50/500/600`, `purple-400/500/600`), `Schedule.tsx:568-571,647-651,713-716` (status de agendamento em `blue-50/700`, `red-50/700`, `amber-50/700`), `AdminDashboard.tsx:482-487` (badge de cargo `purple-100/blue-100`), `InactivityWarningModal.tsx:45-46` (`amber-100/600` em vez de `accent`), `CustomFoodDialog.tsx` (`text-red-500` em vez de `text-destructive`), `SupportWidget.tsx` (paleta inteira `green-*/gray-*/slate-*` hardcoded).
**Por que importa**: Essas cores não respondem ao dark mode nem a mudanças futuras de tema — `MealPlanEditor` (a tela mais usada) e `SupportWidget` (presente em todo o app) são as mais expostas. Também cria 4+ "dialetos" de cor para o mesmo conceito (erro, status, atenção).
**Fix**: Mapear cada uso para o token correspondente (`destructive`, `accent`, `muted`) ou, onde uma categorização por cor é genuinamente necessária (macros, status de agendamento), definir 3-4 tokens semânticos novos no DESIGN.md (ex.: `--macro-protein`, `--status-confirmed`, `--status-cancelled`) em OKLCH e usá-los consistentemente.
**Comando sugerido**: `/impeccable colorize` (definir tokens semânticos) seguido de `/impeccable polish` (aplicar)

### [P1] Side-stripe borders (proibição absoluta) em 2 locais reais
**Onde**: `Landing.tsx:456,460` (`border-l-2` em mockup de evento de calendário) e `PatientProfile.tsx:1757` (`border-l-2 w-1.5` colorido por tipo de refeição no modal de visualização do plano alimentar).
**Por que importa**: É o "tell" mais reconhecível de UI gerada por IA, listado como proibição absoluta no skill. No caso do plano alimentar, é visível toda vez que o nutricionista abre um plano — alta frequência de exposição.
**Fix**: Landing — trocar por um dot colorido (`w-2 h-2 rounded-full`) ao lado do texto, sem borda lateral. PatientProfile — usar um ícone/dot de cor por tipo de refeição no header do card, ou um background tintado uniforme (`bg-{cor}/10`) sem borda.
**Comando sugerido**: `/impeccable polish`

### [P1] z-index arbitrário no dropdown de autocomplete de alimentos
**Onde**: `FoodAutocomplete.tsx:120` — `z-[9999]`.
**Por que importa**: Proibição absoluta explícita; também sinaliza que a escala semântica de z-index (dropdown → sticky → modal-backdrop → modal → toast → tooltip) não está definida/sendo seguida. Esse dropdown é usado dezenas de vezes por sessão dentro do `MealPlanEditor`.
**Fix**: Definir a escala semântica (ex. `z-dropdown: 50`, `z-modal: 100`, `z-toast: 200`) em tokens Tailwind e usar `z-dropdown` aqui.
**Comando sugerido**: `/impeccable polish`

### [P1] Glassmorphism decorativo no fluxo de autenticação
**Onde**: `Login.tsx:309`, `Register.tsx:309,384,419`, `PatientAccess.tsx:464` — todos `backdrop-blur-sm` sobre `bg-white/X` ou `bg-card/X`.
**Por que importa**: Proibição absoluta, 5 ocorrências concentradas no primeiro contato do usuário com o produto (login/registro) — a primeira impressão usa exatamente o padrão que o design system bane.
**Fix**: Remover `backdrop-blur-sm`, manter `bg-white/10 border border-white/15` (efeito "vidro fosco" sem blur real). No badge `Register.tsx:384`, também remover `uppercase tracking-widest`.
**Comando sugerido**: `/impeccable polish`

### [P2] Três "formatos" diferentes de modal de confirmação de exclusão + formulário de paciente duplicado
**Onde**: `Patients.tsx:625` (texto rico, menciona LGPD/30 dias) vs. `Schedule.tsx:485` (ícone circular destrutivo, footer `flex-col sm:flex-row` com botões `flex-1`) vs. `PatientProfile.tsx:1843/1858/1873` (3 modais idênticos entre si mas genéricos, sem nome do item, footer `sm:justify-end`). Além disso, o formulário de criar/editar paciente existe **duas vezes**: `Patients.tsx` (React Hook Form + Zod, erros inline) e `PatientProfile.tsx:2802` (FormData nativo + `toast.error` genérico).
**Por que importa**: Mesma ação ("excluir X", "editar paciente") tem 3 e 2 implementações diferentes respectivamente — manutenção duplicada e UX inconsistente (usuário que erra um campo no perfil do paciente não vê erro inline, só toast).
**Fix**: Extrair um `ConfirmDeleteDialog` reutilizável (título, descrição com nome do item, footer padrão) e usá-lo nos 5 lugares de exclusão do app. Para o formulário de paciente, extrair um `PatientFormDialog` compartilhado usado tanto em `Patients.tsx` quanto em `PatientProfile.tsx`.
**Comando sugerido**: `/impeccable polish` (após decisão de escopo — é a mudança de maior esforço)

## Red Flags por Persona

**Alex (Power User)**: Sem atalhos de teclado em nenhuma tela. O modal "Registrar/Editar Consulta" (`PatientProfile.tsx:995`) mistura 7 medidas antropométricas + 4 textareas longos em um único submit, sem salvar rascunho — se Alex for interrompido no meio do atendimento, perde tudo. `Patients.tsx:555` — botão de excluir paciente só aparece no hover do card, sem alternativa para quem usa teclado/touch.

**Sam (Acessibilidade)**: `PatientAccess.tsx:484` usa `focus:ring-primary focus:border-primary` em vez do padrão `focus-visible:ring-3 focus-visible:ring-ring/50` no input de autenticação do paciente — foco pode ficar menos visível exatamente na tela onde o paciente (possivelmente leigo) mais precisa de clareza. O mesmo input usa `type="password"` para um código numérico de 3 dígitos — gerenciadores de senha/leitores de tela podem tentar autopreencher com senha salva, confundindo o fluxo. `AdminDashboard.tsx:690-713` e `InactivityWarningModal.tsx` implementam overlays manuais (não `Dialog`) — risco de não ter focus trap/ESC consistente.

**Casey (Mobile/Paciente)**: `MealPlanEditor.tsx:473` — sidebar com metas nutricionais é `hidden lg:flex`; em tablet (cenário descrito no PRODUCT.md como uso real durante consulta), o nutricionista perde a visão de progresso de macros. `PatientAccess.tsx` (tela que o **paciente** vê no celular) tem 6+ labels em uppercase tracking-wider — em telas pequenas, uppercase com tracking reduz ainda mais a legibilidade.

## Observações Menores

- `LandingFooter.tsx:6` — `resetConsent` importado mas nunca usado (código morto).
- `LandingFooter.tsx:32,66-68` — links "Sobre"/redes sociais com `href="#"` (placeholders mortos).
- `Contato.tsx:29` — formulário de contato não envia para lugar nenhum, só simula delay e loga no console — usuário recebe "Mensagem enviada!" falsamente.
- `PatientAccess.tsx:367` — PDF gerado para o paciente diz "Gerado por **NutriCare Pro**" em vez de "Nutrir" (branding incorreto em material entregue ao usuário final).
- `PatientProfile.tsx:1958-1974` — bloco de impressão duplicado do plano alimentar usa CRN hardcoded `"12345/P"` — risco de imprimir CRN errado se for esse bloco que efetivamente vai para `window.print()`.
- Inconsistência de números de marketing entre `Landing.tsx` (100+ nutricionistas, 2 pacientes no free), `Login.tsx`/`Register.tsx` painel direito (+15 nutricionistas, 3 pacientes no free).
- `PatientProfile.tsx:985-990` — `<span>•</span>` órfão (separador sem conteúdo após).
- `Sidebar.tsx:108` — item "Migração" bloqueado pode estar obsoleto (migração Postgres já concluída conforme histórico do projeto) — verificar com produto, não é um problema visual.
- Emojis em CTAs (`Settings.tsx:1133` "🚀 Assinar...", `Dashboard.tsx:141` "👋") destoam levemente do tom "Linear/Notion" do produto — não bloqueador, mas inconsistente entre telas (UpgradeModal não usa emoji no CTA equivalente).

## Perguntas para Considerar

- O padrão de badge `uppercase tracking-wider text-[10px] font-bold rounded-full`, usado consistentemente nas 3 telas recém-padronizadas (Financial/Settings/AdminDashboard), é mais recente que a regra "badges nunca uppercase" do DESIGN.md? Se a equipe gosta desse padrão, talvez seja a regra que precise ser atualizada, não o código.
- As páginas de autenticação (`Login`/`Register`/`ForgotPassword`/`PatientAccess`) usam uma escala de componente maior (`h-11+`, `rounded-xl/2xl/3xl`, sombras) consistente entre si — isso é uma escolha deliberada de "telas de entrada têm mais respiro" ou drift de uma versão anterior do design system?
- Vale a pena transformar o modal "Visualizar Plano Alimentar" (`PatientProfile.tsx:1627`, `max-w-6xl w-[98vw] max-h-[95vh]`, com lógica de impressão duplicada) em uma rota própria, já que funcionalmente já se comporta como uma página inteira?
- `MealPlanEditor` tem sua própria paleta de macros (azul/laranja/roxo/verde) — vale formalizar isso como tokens semânticos no DESIGN.md, já que é uma informação (composição nutricional) que provavelmente deveria ser visualmente consistente em outras telas (ex. resumo do plano em PatientProfile, calculadora nutricional) também?
