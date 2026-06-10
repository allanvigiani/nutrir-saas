# Critique: src/pages/PatientProfile.tsx
**Date:** 2026-06-09T19:32:03Z  
**Score: 16/40**  
**Target:** 5 abas — personal, consultations, mealplans, exams, evolution

---

## Scores por dimensão

| Dimensão | Score | Nota |
|---|---|---|
| Hierarquia visual | 4/8 | Tabs funcionam; KPI grid idêntico em Evolution é anti-pattern |
| Aderência ao design system | 2/8 | Off-system colors massivos em todas as 5 abas |
| Anti-patterns banidos | 1/8 | Side-stripes + eyebrow epidemic (20+ instâncias) |
| Qualidade de código | 3/8 | Dead code, Tailwind inválido, marca errada |
| Persona fit | 6/8 | Fluxo correto para nutricionista; dados bem estruturados |

---

## P1 — Bloqueadores críticos

### 1. Side-stripe borders em Evolution KPI cards (L2613) — BANNED
```tsx
// Cada card tem border-l-4 com cor off-system diferente
className={cn('rounded-xl p-4 border border-border border-l-4 shadow-sm', card.accent, ...)}
// card.accent: 'border-emerald-500' | 'border-blue-500' | 'border-amber-500' | 'border-violet-500' | 'border-pink-500' | 'border-cyan-500'
```
`border-l-4` como acento colorido em cards é o padrão explicitamente banido. Substituir por: fundo neutro + valor colorido com token do sistema, ou ícone como âncora visual.

### 2. SummaryCard off-system colors (L1815–1818) — BANNED
```tsx
<SummaryCard color="bg-orange-50 text-orange-600" progressColor="bg-orange-500" />
<SummaryCard color="bg-blue-50 text-blue-600" progressColor="bg-blue-500" />
<SummaryCard color="bg-purple-50 text-purple-600" progressColor="bg-purple-500" />
```
Cores hardcoded fora do sistema OKLCH. A 4ª card usa `bg-primary/10 text-primary` corretamente — padronizar as outras da mesma forma ou mapear para papéis semânticos.

### 3. Off-system colors em Evolution KPI values (L2562–2604)
```tsx
valueColor: 'text-emerald-600 dark:text-emerald-400'
valueColor: 'text-blue-600 dark:text-blue-400'
valueColor: 'text-amber-600 dark:text-amber-400'
valueColor: 'text-violet-600 dark:text-violet-400'
valueColor: 'text-pink-600 dark:text-pink-400'
valueColor: 'text-cyan-600 dark:text-cyan-400'
```
6 cores diferentes sem relação com o sistema de tokens. Usar `text-primary` para positivos, `text-destructive` para negativos/alertas, `text-foreground` para neutros.

### 4. Banner read-only com cores off-system (L1053)
```tsx
className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4"
```
Usar tokens do sistema: `bg-accent/30 border-accent-foreground/20` (já aplicado em Patients.tsx — inconsistência entre páginas).

### 5. Hardcoded hex nos charts (L2729, 2744, 2759, 2770–2773)
```tsx
stroke="#10b981"  // Peso
stroke="#f59e0b"  // Gordura
stroke="#3b82f6"  // IMC
stroke="#6366f1" "#ec4899" "#8b5cf6" "#06b6d4"  // Medidas
```
Ler via `getComputedStyle` como feito no Dashboard, ou usar OKLCH literals semanticamente coerentes com o design system. `#10b981` ≈ `oklch(0.68 0.17 163)` (verde do sistema), usar isso como âncora.

### 6. Calculation alert com amber off-system (L1630)
```tsx
className="bg-amber-50 p-2 rounded-lg border border-amber-100 mt-2"
// text: text-amber-800, text-amber-700
```
Substituir por `bg-accent/20 border-accent-foreground/20 text-accent-foreground`.

---

## P2 — Problemas notáveis

### 7. Uppercase eyebrow epidemic (~20+ instâncias) — BANNED
O padrão `text-[10px] font-bold uppercase tracking-wider` aparece como label de campo em **todas as 5 abas**. Exemplos:
```tsx
// L1330, 1334 — personal
<p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Objetivo</p>

// L1486–1502 — consultation expanded metrics
<p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Altura</p>

// L1510, 1518, 1528, 1540 — consultation sections
<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ...">Queixas Principais</h4>

// L1597, 1601, 1605 — macro labels
<p className="text-[10px] text-muted-foreground font-bold uppercase">Proteína</p>

// L1895 — meal section subtitle
<span className="text-[10px] uppercase font-black opacity-40 tracking-widest">...</span>

// L1912–1918 — table headers
<th className="... font-bold uppercase tracking-wider text-[10px]">Alimento</th>

// L2185 — exam marker
<span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Marcador {index + 1}</span>

// L2375–2379 — exam table headers
<th className="px-4 py-3 font-bold uppercase text-[10px]">Marcador</th>

// L2617 — evolution KPI labels
<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{card.label}</p>

// L2841 — evolution table headers
<th className="... text-[11px] font-semibold text-muted-foreground uppercase tracking-wide ...">
```
Trocar por: `text-xs text-muted-foreground font-medium` sem uppercase. Hierarquia via tamanho e peso, não caps.

### 8. `bg-muted/30/30` e `bg-muted/30/50` — Tailwind inválido (L1483, L1911, L2183, L2369)
```tsx
className="... bg-muted/30/30 ..."  // modificador duplo inválido
```
Corrigir para `bg-muted/30` ou `bg-muted/20` conforme intensidade desejada.

### 9. Status badge `text-[10px] font-bold uppercase` (L1424, L1717–1721, L2331, L2398)
```tsx
// Consultation status
"px-2 py-1 rounded-full text-[10px] font-bold uppercase"
// Meal plan status  
"px-2 py-1 rounded-full text-[10px] font-bold uppercase"
// Exam markers count
"text-[10px] font-bold uppercase tracking-wider"
// Exam marker status
"text-[10px] font-bold uppercase tracking-wider"
```
Badges e status pills não precisam de uppercase. Usar `text-xs font-medium` sem `uppercase`.

### 10. Exam marker status com off-system colors (L2400–2402)
```tsx
marker.status === 'alto'     ? "bg-red-50 text-red-600"    :
marker.status === 'baixo'    ? "bg-orange-50 text-orange-600" :
                               "bg-blue-50 text-blue-600"
```
Substituir por: `bg-destructive/10 text-destructive` (alto), `bg-accent/20 text-accent-foreground` (atenção/baixo), `bg-primary/10 text-primary` (normal).

### 11. Meal plan view — off-system water card (L1826)
```tsx
<div className="flex items-center gap-3 text-blue-600 mb-2">
  <div className="p-2 rounded-xl bg-blue-50">
    <Droplets className="w-5 h-5" />
  </div>
```
Substituir por `text-primary` + `bg-primary/10`.

### 12. Hover states off-system (L1734, L2191)
```tsx
"hover:bg-red-50"  // no botão excluir de plano e de marcador
```
Substituir por `hover:bg-destructive/10`.

### 13. "NutriCare Pro" no print header (L1790)
```tsx
<h2 className="text-2xl font-bold text-foreground leading-none">NutriCare Pro</h2>
<p className="text-xs text-muted-foreground mt-1">Gestão Nutricional de Excelência</p>
```
Nome errado (produto chama-se "Nutrir"). Tagline "Excelência" é copy genérico de IA. Corrigir para o nome real e remover tagline ou usar copy específico.

### 14. Print header uppercase on "Plano Alimentar" (L1795)
```tsx
<h3 className="text-lg font-bold text-primary uppercase tracking-wider">Plano Alimentar</h3>
```
Uppercase em heading de impressão. Remover `uppercase tracking-wider`.

### 15. IMC badge with off-system colors (L2536–2539)
```tsx
{ label: 'Abaixo do peso', cls: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50' }
{ label: 'Normal',         cls: 'text-green-600 bg-green-50 dark:bg-green-950/50' }
{ label: 'Sobrepeso',      cls: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/50' }
{ label: 'Obesidade',      cls: 'text-red-600 bg-red-50 dark:bg-red-950/50' }
```
Mapear para tokens semânticos: Normal → `bg-primary/10 text-primary`, Sobrepeso → `bg-accent/20 text-accent-foreground`, Obesidade → `bg-destructive/10 text-destructive`.

### 16. Tooltip com hardcoded hex rgba (L2717)
```tsx
contentStyle={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
```
Usar shadow utility class do Tailwind via `wrapperClassName` ou aceitar o valor, mas ao menos alinhar com `hsl(var(--border))` para o border (já feito — somente o shadow quebra).

---

## P3 — Polish

### 17. Dead code: `generateAccessToken`, `shareAccessLink`, `generateSecureToken` (L999–1035)
UI comentada (L1097–), mas as funções permanecem. Remover como foi feito em Patients.tsx.

### 18. `buttonVariants` import (L56) — provavelmente dead
Verificar se está em uso; se não, remover.

### 19. `text-[9px]` em alert list (L1636)
```tsx
<li className="text-[9px] text-amber-700 leading-tight">• {alerta}</li>
```
9px quebra o mínimo de legibilidade (WCAG exige no mínimo 10px de rendered size). Usar `text-xs` (12px).

### 20. Empty states genéricos sem ícone
- Consultations L1665: texto simples sem ícone
- Exams L2423: texto simples sem ícone
Adicionar ícone + copy contextual (modelo da Patients.tsx).

### 21. HSL var notation no chart tick (L2704)
```tsx
tick={{ fill: 'hsl(var(--muted-foreground))' }}
```
Inconsistente com o Dashboard que usa `getComputedStyle`. Alinhar abordagem.

---

## Anti-patterns verdict

| Padrão banido | Encontrado | Instâncias |
|---|---|---|
| Side-stripe borders | ✅ SIM | Evolution KPI cards (6 cards, border-l-4) |
| Gradient text | ❌ não | — |
| Identical card grids | ✅ SIM | Evolution 6 KPIs idênticos + SummaryCard 4 idênticos |
| Uppercase eyebrow epidemic | ✅ SIM | ~20+ instâncias em todas as 5 abas |
| Hero-metric template | ✅ parcial | SummaryCard segue o template (big num + label + progress) |
| Glassmorphism | ❌ não | — |

---

## Persona red flags

- **Nutricionista em consulta no tablet**: botões de ação (Editar, Calcular, Excluir) na lista de consultas são `opacity-0 group-hover:*` — invisíveis em touch. Precisam de visibilidade permanente ou affordance alternativa em mobile.
- **Impressão de plano**: branding incorreto ("NutriCare Pro") comprometeria a credibilidade profissional em documentos impressos para pacientes.
- **Exame status visual**: cores off-system para "alto/baixo/atenção" — quando o nutricionista avalia exames rapidamente, a falta de sistema semântico consistente aumenta a carga cognitiva.
- **`text-[9px]`** nos alertas de cálculo: ilegível em condições de consultório (iluminação variada, tela pequena).

---

## Próximos passos recomendados

Este arquivo tem ~2900 linhas. Recomendo atacar em ordem de impacto:

1. **P1 primeiro**: side-stripes + SummaryCard colors + read-only banner + chart hex + amber alerts
2. **P2 eyebrow sweep**: busca-e-substitui `uppercase tracking-wider` → remover uppercase
3. **P2 status/badge cleanup**: todos os `text-[10px] font-bold uppercase` em badges/pills
4. **Dead code**: `generateAccessToken`, `shareAccessLink`, `buttonVariants`
5. **Polish**: empty states, `text-[9px]`, branding print
