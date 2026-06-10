---
target: patients
total_score: 22
p0_count: 0
p1_count: 3
timestamp: 2026-06-09T19-14-04Z
slug: src-pages-patients-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading skeleton sólido; falta contador "X pacientes" no header |
| 2 | Match System / Real World | 3 | Linguagem médica correta; "período de transição" um pouco técnico |
| 3 | User Control and Freedom | 2 | Sem undo após exclusão, sem ações em lote, sem atalhos de teclado |
| 4 | Consistency and Standards | 2 | Avatares rainbow vs. bg-primary/10 do Dashboard; cn local reimplementado |
| 5 | Error Prevention | 3 | Validação CPF/email duplicado; confirmação de exclusão com contexto LGPD |
| 6 | Recognition Rather Than Recall | 2 | Ação de deletar escondida em hover; sem filtro por status apesar do icon importado |
| 7 | Flexibility and Efficiency | 2 | Sem filtro de status, sem busca avançada, sem ações em lote |
| 8 | Aesthetic and Minimalist Design | 2 | Rainbow avatars + alert banners off-system + grade de cards idênticos |
| 9 | Error Recovery | 2 | Toasts de erro genéricos; sem guidance de recuperação |
| 10 | Help and Documentation | 1 | Sem dicas contextuais, sem empty state orientado à ação |
| **Total** | | **22/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: Grade de cards idênticos (3 colunas, mesma estrutura avatar+nome+contato+botões). Sistema de 7 cores de avatar off-system (confetti avatar pattern). Detector retornou [] — sem side-stripes, gradient text, ou padrões banidos.

## Priority Issues

### [P1] Avatares rainbow off-system
- Dashboard usa bg-primary/10 text-primary; Patients usa 7 cores (emerald, blue, violet, amber, pink, cyan, orange)
- Fix: ramp do token primário em 3-4 tons

### [P1] Botão deletar opacity-0 sem group-focus-within
- Trap de teclado — mesmo bug que foi corrigido no Dashboard no polish
- Fix: group-focus-within:opacity-100 + aria-label

### [P1] Campo medications ausente do formulário
- Schema Zod tem medications; reset() inicializa com o valor; nenhum input registrado
- Dado clínico crítico inacessível para criação e edição

### [P2] Banners de alerta com cores off-system
- amber-50/amber-200/amber-700 e red-50/red-200/red-600 fora do sistema OKLCH
- Fix: accent/destructive tokens

### [P2] Grade de cards idênticos sem hierarquia
- 20+ pacientes em grid uniforme sem filtro de status, sem sinal de recência

## Persona Red Flags

**Alex (Power User)**: sem filtro de status, sem ações em lote, botão deletar invisível no teclado.
**Sam (Accessibility)**: opacity-0 em botão crítico, title= ao invés de aria-label, text-[10px] provavelmente falha contraste.
**Dr. Ana (nutricionista 42a, tablet)**: 11 campos obrigatórios no form, h-8 touch targets (32px), scroll longo sem filtro.

## Minor Observations

- Dead imports: Filter, MoreVertical, buttonVariants
- Dead code: OperationType, FirestoreErrorInfo, handleFirestoreError, generateAccessToken, shareAccessLink, isGeneratingToken
- cn reimplementado localmente (linha 696) sem twMerge
- text-[10px] no badge "Somente leitura"
- AlertCircle no empty state (ícone de erro para lista vazia)
- Subtitle marketing genérico
- Form sem mode: 'onBlur'
