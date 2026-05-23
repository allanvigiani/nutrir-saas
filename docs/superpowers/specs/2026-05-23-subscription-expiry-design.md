# Spec: Subscription Expiry Middleware

**Data:** 2026-05-23  
**Status:** Aprovado

## Problema

O sistema depende exclusivamente de webhooks do Asaas para rebaixar o plano de `premium` para `free`. Se um webhook não for entregue (falha de rede, downtime, etc.), o usuário mantém acesso premium indefinidamente após o `currentPeriodEnd` expirar.

Cenários afetados:
1. **Cancelamento expirado** — `cancelAtPeriodEnd = true` + `currentPeriodEnd < now`
2. **Renovação em atraso** — `asaasStatus = 'overdue'` + `currentPeriodEnd < now`
3. **Expiração genérica** — qualquer premium com `currentPeriodEnd < now` sem nova renovação registrada

## Solução

Middleware Express separado (`subscription-expiry.ts`) que roda após `authenticate` em toda request autenticada. Verifica se o `currentPeriodEnd` do usuário premium expirou e, se sim, rebaixa o plano imediatamente na request atual e dispara a atualização no banco de forma assíncrona.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/server/middlewares/subscription-expiry.ts` |
| Criar | `src/tests/middlewares/subscription-expiry.middleware.test.ts` |
| Editar | `server.ts` — compor middleware com `authenticate` |

## Lógica do Middleware

```
request chega
  └─ req.user.isAdmin? → next() (sem query)
  └─ req.user.dbPlan !== 'premium'? → next() (sem query)
  └─ query: subscription.findUnique({ nutritionistId: uid, select: currentPeriodEnd })
      └─ currentPeriodEnd ausente ou no futuro? → next()
      └─ currentPeriodEnd < now?
          ├─ req.user.dbPlan = 'free'        (síncrono — request atual correta)
          ├─ req.user.isPremium = false       (síncrono)
          └─ subscriptionService.upsert(...)  (fire-and-forget, não bloqueia)
  └─ erro na query → logger.error + next()   (nunca bloqueia a request)
```

### Payload do upsert no downgrade

```typescript
subscriptionService.upsert(userId, {
  plan: 'free',
  asaasStatus: 'cancelled',
  cancelAtPeriodEnd: false,
})
```

O `subscription.service.ts` já aplica a lógica de grace period (30 dias em `gracePeriodEndAt`) quando `plan` vai de `premium` → `free`, desde que `planOverridedByAdmin = false`. Nenhuma mudança necessária no serviço.

## Wiring em `server.ts`

Rotas aplicam `authenticate` individualmente. Para evitar tocar todos os arquivos de rota, o novo middleware é **composto** com `authenticate` no `server.ts`:

```typescript
const rawAuthenticate = createAuthenticateMiddleware({ admin });
const checkExpiry = createSubscriptionExpiryMiddleware();

function authenticate(req: any, res: any, next: any) {
  rawAuthenticate(req, res, (err?: any) => {
    if (err) return next(err);
    checkExpiry(req, res, next);
  });
}
```

O `authenticate` composto substitui o atual nas deps passadas a `registerApiRoutes`. Zero mudanças nos arquivos de rota.

## Testes

Arquivo: `src/tests/middlewares/subscription-expiry.middleware.test.ts`

| Caso | Comportamento esperado |
|------|------------------------|
| `dbPlan = 'free'` | `next()` sem query ao banco |
| `isAdmin = true` | `next()` sem query ao banco |
| Premium, `currentPeriodEnd` no futuro | `next()` sem downgrade |
| Premium, `currentPeriodEnd = null` | `next()` sem downgrade |
| Premium, `currentPeriodEnd` no passado | `req.user.isPremium = false`, `upsert` chamado com `plan: 'free'` |
| Erro na query | `next()` chamado, request não bloqueada |

## Não está no escopo

- Envio de email de notificação de expiração
- Cron job periódico (pode ser adicionado depois se necessário)
- Alteração na lógica de webhooks do Asaas
- Mudança no `subscription.service.ts`
