# Contrato de API: Corrigir Login com Google

**Data:** 2026-06-21

## Mudança de comportamento

### PATCH /api/me

**Auth:** Bearer token (Firebase ID Token) — Sim
**Premium:** Não

**Comportamento anterior:** Retornava 500 quando o nutricionista não existia no PostgreSQL (Prisma lançava exceção genérica de registro não encontrado).

**Comportamento corrigido:** Retorna 404 quando o nutricionista não existe, permitindo que o frontend redirecione para `/register`.

**Request body:**
```typescript
Record<string, unknown> // campos parciais do perfil do nutricionista
```

**Response (200):**
```typescript
// Objeto Nutritionist atualizado (retorno do Prisma)
```

**Erros:**
| Código | Mensagem | Quando |
|--------|----------|--------|
| 401 | "Não autorizado" | token inválido ou ausente |
| 404 | "Nutricionista não encontrado" | uid do Firebase não possui registro no PostgreSQL |
| 500 | "Erro interno" | falha inesperada no banco ou outra exceção |

## Arquivos modificados

- `src/server/services/nutritionists.service.ts` — `updateMe` verifica existência com `findUnique` antes do `update`; lança `Error('Nutricionista não encontrado')` se não existe
- `src/server/routes/nutritionists.routes.ts` — handler do `PATCH /api/me` captura a mensagem "Nutricionista não encontrado" e retorna 404 em vez de 500
