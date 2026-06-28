---
name: asaas-integration
description: Domain knowledge for the Asaas payment integration in Nutrir SaaS. Use this skill whenever working with anything related to Asaas — subscriptions, payments, webhooks, billing, refunds, checkout sessions, or customer portal. Use when debugging payment bugs, implementing billing features, writing Asaas tests, or changing plan upgrade/downgrade logic. Triggers on mentions of assinatura, cobrança, pagamento, plano premium, webhook, Asaas, cancelamento, or reembolso.
---

# Asaas Integration — Nutrir SaaS

## File map

```
src/server/integrations/asaas.client.ts   — HTTP client (wraps fetch, adds auth headers)
src/server/services/asaas.service.ts      — ALL business logic (use factory createAsaasService)
src/server/controllers/asaas.controller.ts — HTTP handlers (factory createAsaasController)
src/server/routes/asaas.routes.ts         — Route registration + dependency wiring
src/tests/services/asaas.service.test.ts  — Unit tests for service
src/tests/controllers/asaas.controller.test.ts — Unit tests for controller
```

Read these files before making changes. The service is the most sensitive — changes ripple into
plan state, Firestore, and email.

---

## Environment variables

| Variable | Purpose |
|---|---|
| `ASAAS_API_KEY` | Secret key sent as `access_token` header on every Asaas API call |
| `ASAAS_API_URL` | Base URL — sandbox: `https://sandbox.asaas.com/api/v3`, prod: `https://www.asaas.com/api/v3` |
| `ASAAS_WEBHOOK_TOKEN` | Shared secret — Asaas sends this in `asaas-access-token` header on webhook events |

---

## API endpoints (Express routes)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/asaas-webhook` | public | Health check — confirms endpoint is active |
| POST | `/api/asaas-webhook` | token header | Receives Asaas webhook events |
| POST | `/api/create-checkout-session` | Firebase auth | Creates Asaas customer + subscription |
| POST | `/api/verify-subscription` | Firebase auth | Checks current subscription/plan status |
| POST | `/api/create-portal-session` | Firebase auth | Returns invoice URL for billing portal |
| POST | `/api/cancel-subscription` | Firebase auth | Cancels subscription (+ refund if ≤7 days) |

---

## Asaas API patterns — critical gotchas

**Authentication**: every request adds header `access_token: <ASAAS_API_KEY>`. Handled in `asaas.client.ts`.

**Multiple statuses**: Asaas does NOT accept comma-separated status filters. Query each status separately:
```typescript
// WRONG — Asaas ignores the second value
asaasClient.request(`/payments?subscription=${id}&status=CONFIRMED,RECEIVED`)

// CORRECT — parallel queries
const [confirmed, received] = await Promise.all([
  asaasClient.request(`/payments?subscription=${id}&status=CONFIRMED`),
  asaasClient.request(`/payments?subscription=${id}&status=RECEIVED`),
]);
```

**Pagination**: responses wrap in `{ data: [...], totalCount, hasMore, offset, limit }`. Always access `.data`.

**externalReference**: the bridge between Asaas and Firestore. When creating a customer or subscription, pass `externalReference: userId` (the Firestore document ID in `nutritionists`). Webhooks use this to find and update the right user.

**Subscription statuses**: `ACTIVE`, `DELETED` (cancelled), `INACTIVE`
**Payment statuses**: `PENDING`, `CONFIRMED`, `RECEIVED`, `OVERDUE`, `REFUNDED`, `CHARGEBACK_REQUESTED`

---

## Business rules — know these before touching payment code

### Plan model
- Nutritionists have `plan: "free"` or `plan: "premium"` in Firestore (`nutritionists` collection)
- Premium is unlocked by a confirmed payment, not by creating a subscription
- `cancelAtPeriodEnd: true` means the subscription was deleted but the user keeps premium access until `currentPeriodEnd`

### Credit card timing (important for webhook handling)
- `PAYMENT_CONFIRMED` fires immediately when the card is charged → grant premium access here
- `PAYMENT_RECEIVED` fires ~32 days later (financial settlement) → also grant premium, but don't resend welcome email
- The flag `welcomeEmailSentAt` prevents duplicate welcome emails when RECEIVED arrives after CONFIRMED

### Refund window
- Users are eligible for a refund if the subscription was created ≤7 days ago
- `cancelSubscription()` checks `activeSub.dateCreated` against now
- If eligible: calls `POST /payments/{id}/refund` for each CONFIRMED/RECEIVED payment, then `DELETE /subscriptions/{id}`
- If not eligible: only `DELETE /subscriptions/{id}`, user keeps access until period end
- `hadRefundBefore: true` is set in Firestore after a refund to prevent abuse

### Checkout flow
1. Look up customer by email → `GET /customers?email=...`
2. If not found, create customer with `cpfCnpj` + `externalReference: userId` → `POST /customers`
3. If existing active subscription found, return its latest invoice URL (no duplicate subscription)
4. Create subscription: `billingType: "CREDIT_CARD"`, `cycle: "MONTHLY"`, `value: 39.9`, `nextDueDate: tomorrow`
5. Fetch the generated payment → `GET /payments?subscription={id}` → return `invoiceUrl`
6. User pays on the Asaas-hosted invoice page; Asaas fires webhook when paid

---

## Webhook events — complete map

The `event.payment.externalReference` (or `event.subscription.externalReference`) is the Firestore `userId`. If absent, the event is silently ignored.

| Event | Firestore update |
|---|---|
| `PAYMENT_CREATED` | `subscriptionStatus: "pending"` |
| `PAYMENT_CONFIRMED` | `plan: "premium"`, `subscriptionStatus: "active"`, `currentPeriodEnd`, send welcome email once |
| `PAYMENT_RECEIVED` | `plan: "premium"`, `subscriptionStatus: "active"`, `currentPeriodEnd` (no email) |
| `PAYMENT_OVERDUE` | `subscriptionStatus: "overdue"` |
| `PAYMENT_AWAITING_RISK_ANALYSIS` | `subscriptionStatus: "pending_risk_analysis"` |
| `PAYMENT_APPROVED_BY_RISK_ANALYSIS` | log only (CONFIRMED follows automatically) |
| `PAYMENT_REPROVED_BY_RISK_ANALYSIS` | `plan: "free"`, `subscriptionStatus: "payment_failed"` |
| `PAYMENT_REFUNDED` | `plan: "free"`, `subscriptionStatus: "refunded"`, `hadRefundBefore: true` |
| `PAYMENT_PARTIALLY_REFUNDED` | same as REFUNDED |
| `PAYMENT_CHARGEBACK_REQUESTED` | same as REFUNDED |
| `PAYMENT_DELETED` | `subscriptionStatus: "cancelled"` |
| `SUBSCRIPTION_CREATED` | `subscriptionId`, `subscriptionStatus: "active"` |
| `SUBSCRIPTION_DELETED` | `subscriptionStatus: "cancelled"`, `cancelAtPeriodEnd: true` |
| `SUBSCRIPTION_INACTIVATED` | same as DELETED |
| `SUBSCRIPTION_UPDATED` | `plan` based on `sub.status` (ACTIVE→premium, else free), `currentPeriodEnd` |

**Note**: `PAYMENT_CANCELLED` is NOT a valid Asaas event. The correct event is `PAYMENT_DELETED`.

---

## Webhook security

The controller validates the token before processing any event:
```typescript
const token = req.headers["asaas-access-token"];
if (!asaasWebhookToken) return res.status(503).send("Webhook token not configured");
if (token !== asaasWebhookToken) return res.status(401).send("Unauthorized");
```

If `ASAAS_WEBHOOK_TOKEN` is not set in env, the endpoint returns 503 — intentional, not a bug.

---

## Service factory pattern

All Asaas code uses factory functions for dependency injection (required by this project's convention):

```typescript
// Service takes asaasClient + FirestoreHelpers
export function createAsaasService({ asaasClient, getDocWithFallback, updateDocWithFallback, queryWithFallback }: AsaasServiceInput) { ... }

// Controller takes isSuperAdmin + asaasWebhookToken + asaasService
export function createAsaasController({ isSuperAdmin, asaasWebhookToken, asaasService }: AsaasControllerDeps) { ... }
```

This enables the unit tests to inject mocked clients without complex setup.

---

## Testing conventions

Tests use Vitest. The pattern is:

```typescript
function makeAsaasClient() {
  return { request: vi.fn() };
}

// Chain mockResolvedValueOnce for each sequential API call:
asaasClient.request
  .mockResolvedValueOnce({ data: [{ id: 'cust_1' }] }) // GET /customers
  .mockResolvedValueOnce({ data: [{ id: 'sub_1', status: 'ACTIVE' }] }) // GET /subscriptions
  .mockResolvedValueOnce({ data: [{ invoiceUrl: 'https://...' }] }); // GET /payments
```

Order matters — mock calls must match the exact order the service makes API calls.
When adding new API calls to the service, add corresponding `mockResolvedValueOnce` entries in tests.

---

## Sensitive areas — handle with care

- **Welcome email deduplication**: `welcomeEmailSentAt` check in PAYMENT_CONFIRMED handler. Do not remove or it sends duplicate emails.
- **Refund eligibility**: the 7-day window check. Do not change without product sign-off.
- **`cancelAtPeriodEnd` vs immediate cancel**: `SUBSCRIPTION_DELETED` sets `cancelAtPeriodEnd: true` — user keeps access. Do not conflate this with `plan: "free"`.
- **Firestore `hadRefundBefore`**: prevents users from getting multiple refunds. Must be set atomically with the refund.
- **verifySubscription `nextDueDate` boundary**: appends `T23:59:59` to the date string before comparing with `now` — gives users the full day. Do not remove.

---

## Asaas MCP Server

O projeto tem o MCP `asaas` configurado em `.mcp.json`. Use-o para consultas ao vivo quando a `references/asaas-api.md` não cobrir o endpoint necessário:

- Listar endpoints disponíveis
- Obter schema de request/response de qualquer endpoint
- Gerar exemplos de código
- Executar chamadas de API diretamente (autenticado via `ASAAS_API_KEY`)

Exemplos de perguntas para o MCP:
- "Quais são os parâmetros do endpoint /v3/subscriptions?"
- "Como funciona a tokenização de cartão de crédito no Asaas?"

---

## References

See `references/asaas-api.md` for Asaas REST API endpoint reference (request/response shapes).
