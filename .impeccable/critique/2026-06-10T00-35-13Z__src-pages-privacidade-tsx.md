---
target: src/pages/Privacidade.tsx
total_score: 36
p0_count: 0
p1_count: 0
timestamp: 2026-06-10T00-35-13Z
slug: src-pages-privacidade-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | n/a — página estática |
| 2 | Match System / Real World | 4 | Linguagem jurídica precisa, mas acessível; TOC ajuda navegação |
| 3 | User Control and Freedom | 4 | TOC sticky + links âncora |
| 4 | Consistency and Standards | 2 | Off-system: callouts amber-50/blue-50, table headers uppercase (banido) |
| 5 | Error Prevention | 4 | n/a |
| 6 | Recognition Rather Than Recall | 4 | Sumário lateral persistente |
| 7 | Flexibility and Efficiency | 3 | n/a |
| 8 | Aesthetic and Minimalist Design | 3 | Boa densidade para conteúdo legal; cores off-system quebram a consistência |
| 9 | Error Recovery | 4 | n/a |
| 10 | Help and Documentation | 4 | Contato do DPO, prazos de resposta claros |
| **Total** | | **36/40** | **Excellent** |

## Anti-Patterns Verdict

**LLM assessment**: Estrutura sólida (TOC + seções numeradas + tabelas), mas dois callouts usavam paletas Tailwind cruas (`amber-50/950`, `blue-50/950`) fora do token system, e os headers de tabela usavam `uppercase tracking-wide` — explicitamente banido pelo DESIGN.md ("Não usar letras maiúsculas em... cabeçalhos de tabela").
**Deterministic scan**: `detect.mjs` retornou `[]`.

## Priority Issues

### [P2] Callouts off-system (amber/blue)
- Seção 3 (dados sensíveis): `bg-amber-50 dark:bg-amber-950/30 ... text-amber-800` com emoji ⚠️
- Seção 9 (ANPD): `bg-blue-50 dark:bg-blue-950/30 ... text-blue-800` com emoji ℹ️, sem token "info" no sistema
- Fix aplicado: amber → `bg-accent/30 border-accent-foreground/20 text-accent-foreground` (mesmo padrão de `Patients.tsx`), blue → `bg-primary/10 border-primary/20 text-foreground` com ícone `Info` (verde como sinal informativo). Emojis substituídos por ícones lucide (`AlertTriangle`, `Info`).

### [P2] Table headers em uppercase (banido)
- `text-xs uppercase tracking-wide` nos `<th>` — removido; headers já estão em Title Case ("Dado", "Finalidade"...).

### [P3] h1 sem `tracking-tight`/`text-balance`
- Corrigido para alinhar com Landing/Dashboard/Patients.

## Code Quality

- `import React from 'react'` estava no meio do arquivo, após a definição de componentes auxiliares; movido para `import type { ReactNode } from 'react'` no topo, com `React.ReactNode` → `ReactNode`.

## Minor Observations

- Conteúdo jurídico extenso, mas bem organizado via TOC + seções com `scroll-mt-24`. Nenhuma ação adicional necessária.
