---
target: src/pages/Contato.tsx
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-06-10T01-00-20Z
slug: src-pages-contato-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Toast de sucesso ao enviar; estado "Enviando..." no botão |
| 2 | Match System / Real World | 4 | Linguagem clara, labels diretos |
| 3 | User Control and Freedom | 3 | n/a |
| 4 | Consistency and Standards | 2 | `text-red-500`, `<textarea>` reimplementado, `text-white`/`bg-primary` hardcoded no Button |
| 5 | Error Prevention | 3 | Validação Zod por campo, mensagens inline |
| 6 | Recognition Rather Than Recall | 4 | Cards de info (e-mail, horário) visíveis antes do form |
| 7 | Flexibility and Efficiency | 3 | n/a |
| 8 | Aesthetic and Minimalist Design | 3 | Layout 1/3 + 2/3 claro, sem clutter |
| 9 | Error Recovery | 3 | Mensagens de erro por campo, não bloqueia o form |
| 10 | Help and Documentation | 4 | Cards de e-mail e horário cobrem dúvidas comuns |
| **Total** | | **32/40** | **Good** |

## Anti-Patterns Verdict

**LLM assessment**: Estrutura de página sólida (cards de info + form), mas com vários desvios pontuais do design system: cor de erro `text-red-500` (deveria ser `text-destructive`), `<textarea>` reimplementado em vez do componente `Textarea` compartilhado, e `Button` com `bg-primary hover:bg-primary/90 text-white` hardcoded sobrescrevendo a variante `default` (que já é `bg-primary text-primary-foreground`).
**Deterministic scan**: `detect.mjs` retornou `[]`.

## Priority Issues

### [P2] Cores e componentes off-system
- `text-red-500` → `text-destructive` (3 ocorrências, mensagens de erro de validação)
- `<textarea>` com classes duplicadas do Input → componente `Textarea` compartilhado (`src/components/ui/textarea.tsx`)
- `Button` com `bg-primary hover:bg-primary/90 text-white` → removido; a variante `default` já cobre isso com os tokens corretos (`text-primary-foreground`)

### [P3] h1 sem `tracking-tight`/`text-balance`
- Corrigido para alinhar com as demais páginas.

## Functional Note (fora do escopo desta passada)

O formulário simula o envio (`setTimeout` + `console.info` + toast de sucesso) sem chamada real à API. O projeto já tem SMTP/Brevo configurado para e-mails transacionais (ver CLAUDE.md), então uma rota `/api/contact` faria sentido — mas isso é trabalho de feature (`craft`/`harden`), não de polish visual. Sinalizado para acompanhamento futuro.

## Minor Observations

- Cards de "E-mail" e "Horário de Atendimento" têm alturas distintas (a primeira tem link extra) — visualmente aceitável, não é grade de cards idênticos.
