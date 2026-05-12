# Asaas REST API Reference

Base URL: `https://www.asaas.com/api/v3` (prod) / `https://sandbox.asaas.com/api/v3` (sandbox)

Auth header on every request: `access_token: <ASAAS_API_KEY>`

---

## Customers

### POST /customers
Create a new customer.

```json
{
  "name": "string (required)",
  "cpfCnpj": "string (required) — CPF (11 digits) or CNPJ (14 digits)",
  "email": "string",
  "phone": "string",
  "mobilePhone": "string",
  "address": "string",
  "addressNumber": "string",
  "complement": "string",
  "province": "string",
  "postalCode": "string",
  "externalReference": "string — YOUR internal ID (userId)"
}
```

Response: `{ id: "cus_xxx", name, email, cpfCnpj, externalReference, ... }`

### GET /customers?email={email}
Find customer by email. Response: `{ data: [Customer], totalCount, hasMore }`

### GET /customers/{id}
Get single customer.

---

## Subscriptions

### POST /subscriptions
Create a recurring subscription.

```json
{
  "customer": "cus_xxx (required)",
  "billingType": "CREDIT_CARD | BOLETO | PIX | UNDEFINED (required)",
  "value": 39.9,
  "nextDueDate": "2026-05-12 (YYYY-MM-DD, required)",
  "cycle": "MONTHLY | WEEKLY | BIWEEKLY | QUARTERLY | SEMIANNUALLY | YEARLY",
  "description": "string",
  "externalReference": "string — userId"
}
```

Response: `{ id: "sub_xxx", status: "ACTIVE", ... }`

After creating, fetch payments to get the first invoice URL:
`GET /payments?subscription={sub.id}` → `data[0].invoiceUrl`

### GET /subscriptions?customer={customerId}
List subscriptions for a customer. Supports: `offset`, `limit` (max 100).

### GET /subscriptions/{id}
Get single subscription.

### PUT /subscriptions/{id}
Update subscription (value, cycle, nextDueDate, etc.).

### DELETE /subscriptions/{id}
Cancel/delete subscription. Sets status to `DELETED`.

Fields in response: `id`, `status` (ACTIVE|INACTIVE|DELETED), `nextDueDate`, `dateCreated`, `cycle`, `value`, `deleted: boolean`

---

## Payments (Cobranças)

### POST /payments
Create a one-time charge.

```json
{
  "customer": "cus_xxx (required)",
  "billingType": "CREDIT_CARD | BOLETO | PIX | UNDEFINED",
  "value": 39.9,
  "dueDate": "2026-05-12 (YYYY-MM-DD, required)",
  "description": "string",
  "externalReference": "string"
}
```

### GET /payments?subscription={subscriptionId}&status={STATUS}
List payments for a subscription. Filter by status (one at a time — no comma-separated values).

Available status values: `PENDING`, `CONFIRMED`, `RECEIVED`, `OVERDUE`, `REFUNDED`, `CHARGEBACK_REQUESTED`, `CHARGEBACK_DISPUTE`, `AWAITING_CHARGEBACK_REVERSAL`, `DUNNING_REQUESTED`, `DUNNING_RECEIVED`, `AWAITING_RISK_ANALYSIS`

Supports: `offset`, `limit`, `order` (asc|desc).

### GET /payments/{id}
Get single payment. Includes `invoiceUrl` for the hosted payment page.

### POST /payments/{id}/refund
Refund a payment.

```json
{
  "value": 39.9,
  "description": "Motivo do estorno"
}
```

Response: `{ id, status: "REFUNDED", ... }`

---

## Webhook events payload shape

```json
{
  "event": "PAYMENT_CONFIRMED",
  "payment": {
    "id": "pay_xxx",
    "customer": "cus_xxx",
    "subscription": "sub_xxx",
    "value": 39.9,
    "status": "CONFIRMED",
    "dueDate": "2026-05-12",
    "externalReference": "userId_from_firestore"
  },
  "subscription": {
    "id": "sub_xxx",
    "status": "ACTIVE",
    "nextDueDate": "2026-06-12",
    "externalReference": "userId_from_firestore"
  }
}
```

`externalReference` is the user's Firestore document ID. This is how webhook events are linked to users.

Not all events include both `payment` and `subscription`. Always use:
```typescript
const userId = payment?.externalReference || event.subscription?.externalReference;
```

---

## HTTP error codes

| Code | Meaning |
|---|---|
| 400 | Validation error (missing required field, invalid CPF/CNPJ, etc.) |
| 401 | Invalid or missing `access_token` |
| 404 | Resource not found |
| 409 | Conflict (e.g., customer already exists with same CPF) |
| 429 | Rate limited |
| 500 | Asaas server error |

Error response body: `{ errors: [{ code: "...", description: "..." }] }`

---

## Sandbox

- URL: `https://sandbox.asaas.com/api/v3`
- Create a sandbox account at `https://sandbox.asaas.com`
- Sandbox API key starts with `$aact_` (same as prod but different environment)
- Use test CPFs (e.g., `12345678901`) — no real validation in sandbox
- Webhooks in sandbox: configure the URL in the Asaas dashboard → Configurações → Integrações → Webhooks
