# LGPD Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar conformidade LGPD completa: criptografia AES-256-GCM via Prisma middleware, soft delete, portabilidade de dados, validação CPF server-side, unicidade CPF/CNPJ, e correção do account.service.ts ainda em Firestore.

**Architecture:** Prisma middleware global intercepta todas as operações de escrita/leitura e aplica `encrypt`/`decrypt` automaticamente nos campos configurados. Serviços existentes não precisam saber da criptografia. CPF/CNPJ ganham campo hash SHA-256 separado para checar unicidade sem expor o valor. Dados são migrados via script one-shot após deploy.

**Tech Stack:** Node.js, Express, Prisma ORM, PostgreSQL (Neon), AES-256-GCM (módulo `crypto` nativo do Node), Vitest, React, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-16-lgpd-compliance-design.md`

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/server/lib/crypto.ts` | Criar |
| `src/server/lib/prisma-encrypt.ts` | Criar |
| `src/server/lib/prisma.ts` | Modificar — registrar middleware |
| `src/server/services/account.service.ts` | Corrigir — remover Firestore |
| `src/server/services/account-export.service.ts` | Criar |
| `src/server/services/retention.service.ts` | Criar |
| `src/server/services/patients.service.ts` | Modificar — soft delete |
| `src/server/routes/auth.routes.ts` | Modificar — cpfHash/cnpjHash |
| `src/server/routes/patient-portal.routes.ts` | Modificar — CPF server-side |
| `src/server/routes/account-export.routes.ts` | Criar |
| `src/server/routes/admin.routes.ts` | Modificar — endpoint cleanup |
| `src/server/register-api-routes.ts` | Modificar — registrar nova rota |
| `src/server/scripts/migrate-encryption.ts` | Criar |
| `prisma/schema.prisma` | Modificar — deletedAt, cpfHash, cnpjHash |
| `src/pages/PatientAccess.tsx` | Modificar — remover CPF client-side |
| `src/pages/Settings.tsx` | Modificar — botão export |
| `src/pages/Privacidade.tsx` | Modificar — seção Art. 33 |
| `.env.example` | Modificar — ENCRYPTION_KEY |
| `src/tests/lib/crypto.test.ts` | Criar |
| `src/tests/services/patients.service.test.ts` | Criar |
| `src/tests/services/retention.service.test.ts` | Criar |
| `src/tests/services/account-export.service.test.ts` | Criar |

---

## Task 1: crypto.ts — utilitário de criptografia e hash

**Files:**
- Create: `src/server/lib/crypto.ts`
- Create: `src/tests/lib/crypto.test.ts`

- [ ] **Step 1: Escrever o teste**

```typescript
// src/tests/lib/crypto.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes em hex
});

import { encrypt, decrypt, hashField } from '../../server/lib/crypto.ts';

describe('encrypt/decrypt', () => {
  it('round-trip retorna o texto original', () => {
    const original = '12345678901';
    expect(decrypt(encrypt(original))).toBe(original);
  });

  it('mesma entrada gera ciphertexts diferentes (IV aleatório)', () => {
    const a = encrypt('teste');
    const b = encrypt('teste');
    expect(a).not.toBe(b);
  });

  it('ciphertext tem formato iv:tag:encrypted', () => {
    const c = encrypt('x');
    const parts = c.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24); // 12 bytes → 24 hex chars
  });

  it('decrypt lança erro com ciphertext inválido', () => {
    expect(() => decrypt('invalido')).toThrow();
  });
});

describe('hashField', () => {
  it('é determinístico', () => {
    expect(hashField('123.456.789-00')).toBe(hashField('12345678900'));
  });

  it('normaliza maiúsculas/minúsculas e pontuação', () => {
    expect(hashField('ABC')).toBe(hashField('abc'));
  });

  it('retorna string de 64 chars (SHA-256 hex)', () => {
    expect(hashField('qualquer').length).toBe(64);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar falha**

```bash
npm run test -- src/tests/lib/crypto.test.ts
```
Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Criar `src/server/lib/crypto.ts`**

```typescript
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY deve ser uma string hex de 64 caracteres (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Formato de ciphertext inválido');
  const [ivHex, tagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// SHA-256 do texto normalizado — determinístico, para unicidade no banco
export function hashField(text: string): string {
  const normalized = text.toLowerCase().replace(/\D/g, '');
  return createHash('sha256').update(normalized).digest('hex');
}
```

- [ ] **Step 4: Rodar o teste para confirmar aprovação**

```bash
npm run test -- src/tests/lib/crypto.test.ts
```
Esperado: todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/lib/crypto.ts src/tests/lib/crypto.test.ts
git commit -m "feat: add AES-256-GCM crypto utility with SHA-256 hash for field uniqueness"
```

---

## Task 2: Schema Prisma — deletedAt, cpfHash, cnpjHash

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar campos e relações em cascata ao schema**

Em `model Nutritionist`, adicionar após `cnpj String?`:
```prisma
cpfHash  String? @unique
cnpjHash String? @unique
```

Em `model Patient`, adicionar `deletedAt` após `updatedAt` e adicionar `onDelete: Cascade` na relação com Nutritionist:
```prisma
// Alterar a linha da relação de:
nutritionist   Nutritionist @relation(fields: [nutritionistId], references: [id])
// Para:
nutritionist   Nutritionist @relation(fields: [nutritionistId], references: [id], onDelete: Cascade)

// Adicionar ao final do modelo:
deletedAt DateTime?
```

Fazer o mesmo (`onDelete: Cascade`) em **todos** os modelos que referenciam `Nutritionist` diretamente — verificar `Appointment`, `Payment`, `CustomFood`. Exemplo para Appointment:
```prisma
// Alterar:
nutritionist   Nutritionist @relation(fields: [nutritionistId], references: [id])
// Para:
nutritionist   Nutritionist @relation(fields: [nutritionistId], references: [id], onDelete: Cascade)
```

- [ ] **Step 2: Gerar e aplicar a migration**

```bash
npx prisma migrate dev --name add_lgpd_fields
```
Esperado: migration criada em `prisma/migrations/` e banco atualizado. Confirmar saída: `Your database is now in sync with your schema.`

- [ ] **Step 3: Verificar tipos gerados**

```bash
npx prisma generate
```
Esperado: sem erros. `Nutritionist` agora tem `cpfHash`, `cnpjHash`. `Patient` tem `deletedAt`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add cpfHash, cnpjHash (uniqueness) and deletedAt (soft delete) to schema"
```

---

## Task 3: prisma-encrypt.ts + registrar middleware

**Files:**
- Create: `src/server/lib/prisma-encrypt.ts`
- Modify: `src/server/lib/prisma.ts`

- [ ] **Step 1: Criar `src/server/lib/prisma-encrypt.ts`**

```typescript
import { encrypt, decrypt } from './crypto.ts';

type FieldConfig = {
  fields: string[];
  jsonFields?: string[];
};

const ENCRYPTED_MODELS: Record<string, FieldConfig> = {
  Patient:      { fields: ['cpf', 'diseases', 'medications', 'allergies'] },
  Nutritionist: { fields: ['cpf', 'cnpj'] },
  Consultation: { fields: ['anamnesis', 'complaints'] },
  LabExam:      { fields: ['observations'], jsonFields: ['markers'] },
};

// Mapeia chaves de relação Prisma → nome do modelo para decrypt recursivo
const RELATION_TO_MODEL: Record<string, string> = {
  consultations: 'Consultation',
  labExams:      'LabExam',
  patients:      'Patient',
};

function encryptData(model: string, data: Record<string, any>): void {
  const config = ENCRYPTED_MODELS[model];
  if (!config || !data || typeof data !== 'object') return;

  for (const field of config.fields) {
    if (data[field] != null) {
      data[field] = encrypt(String(data[field]));
    }
  }
  for (const field of config.jsonFields ?? []) {
    if (data[field] != null) {
      data[field] = encrypt(JSON.stringify(data[field]));
    }
  }
}

function decryptRecord(model: string, record: any): void {
  if (!record || typeof record !== 'object') return;

  const config = ENCRYPTED_MODELS[model];
  if (config) {
    for (const field of config.fields) {
      if (record[field]) {
        try { record[field] = decrypt(record[field]); } catch { /* plaintext ainda não migrado */ }
      }
    }
    for (const field of config.jsonFields ?? []) {
      if (record[field]) {
        try { record[field] = JSON.parse(decrypt(record[field])); } catch { /* plaintext ainda não migrado */ }
      }
    }
  }

  // Decrypt relações incluídas (ex: patient com consultations)
  for (const [key, value] of Object.entries(record)) {
    const nestedModel = RELATION_TO_MODEL[key];
    if (!nestedModel) continue;
    if (Array.isArray(value)) {
      for (const item of value) decryptRecord(nestedModel, item);
    } else if (value && typeof value === 'object') {
      decryptRecord(nestedModel, value);
    }
  }
}

function decryptResult(model: string, result: any): void {
  if (Array.isArray(result)) {
    for (const item of result) decryptRecord(model, item);
  } else {
    decryptRecord(model, result);
  }
}

const WRITE_ACTIONS = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany']);
const READ_ACTIONS  = new Set(['findUnique', 'findFirst', 'findMany', 'findUniqueOrThrow', 'findFirstOrThrow']);

export function applyEncryptionMiddleware(prisma: any): void {
  prisma.$use(async (params: any, next: any) => {
    if (params.model && WRITE_ACTIONS.has(params.action)) {
      const data = params.args?.data;
      if (data) encryptData(params.model, data);
    }

    const result = await next(params);

    if (params.model && READ_ACTIONS.has(params.action) && result) {
      decryptResult(params.model, result);
    }

    return result;
  });
}
```

- [ ] **Step 2: Registrar o middleware em `src/server/lib/prisma.ts`**

Localizar a função `getClient()` e adicionar a chamada ao middleware logo após instanciar o client:

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { applyEncryptionMiddleware } from './prisma-encrypt.ts';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    globalForPrisma.prisma = new PrismaClient({ adapter });
    applyEncryptionMiddleware(globalForPrisma.prisma);
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy<PrismaClient>({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
```

- [ ] **Step 3: Verificar que o TypeScript compila**

```bash
npm run lint
```
Esperado: sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add src/server/lib/prisma-encrypt.ts src/server/lib/prisma.ts
git commit -m "feat: add Prisma encryption middleware for health data and PII fields"
```

---

## Task 4: Corrigir account.service.ts — remover código Firestore

**Files:**
- Modify: `src/server/services/account.service.ts`

O serviço atual usa `fsQuery`, `fsBatchDelete`, `adminDb` do Firestore. Com o schema Prisma tendo `onDelete: Cascade` em `Patient`, a deleção em cascata é automática.

- [ ] **Step 1: Reescrever `account.service.ts`**

```typescript
import { logger } from "../logger.ts";
import { createAsaasClient } from "../integrations/asaas.client.ts";
import { prisma } from "../lib/prisma.ts";

interface AccountServiceDeps {
  admin: any;
  asaasApiUrl: string;
  asaasApiKey: string;
}

export function createAccountService({ admin, asaasApiUrl, asaasApiKey }: AccountServiceDeps) {
  const asaasClient = createAsaasClient({ apiUrl: asaasApiUrl, apiKey: asaasApiKey });

  async function cancelAsaasSubscription(uid: string): Promise<void> {
    const nutritionist = await prisma.nutritionist.findUnique({
      where: { id: uid },
      include: { subscription: true },
    });
    const subscriptionId = nutritionist?.subscription?.asaasSubscriptionId;
    const plan = nutritionist?.plan;

    if (!subscriptionId || plan !== 'premium') return;

    logger.info('Cancelando assinatura Asaas antes de excluir conta', { uid, subscriptionId });
    try {
      await asaasClient.request(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
      logger.info('Assinatura Asaas cancelada com sucesso', { uid, subscriptionId });
    } catch (err: any) {
      logger.error('Falha ao cancelar assinatura Asaas', { uid, err: err.message });
      throw new Error(
        'Não foi possível cancelar sua assinatura premium. ' +
        'Tente novamente ou contate suporte@nutrir.app antes de excluir a conta.',
      );
    }
  }

  async function deleteAccount(uid: string): Promise<{ deleted: Record<string, number> }> {
    logger.info('Iniciando exclusão de conta (LGPD Art. 18)', { uid });

    // 1. Cancelar assinatura Asaas se premium
    await cancelAsaasSubscription(uid);

    // 2. Deletar nutricionista — cascata elimina patients e todos os relacionamentos
    await prisma.nutritionist.delete({ where: { id: uid } });
    logger.info('Nutricionista e dados em cascata deletados via Prisma', { uid });

    // 3. Deletar usuário do Firebase Auth
    await admin.auth().deleteUser(uid);
    logger.info('Conta excluída com sucesso (LGPD Art. 18)', { uid });

    return { deleted: { nutritionists: 1 } };
  }

  return { deleteAccount };
}
```

- [ ] **Step 2: Verificar onde `createAccountService` é instanciado e ajustar deps e assinatura**

```bash
grep -rn 'createAccountService\|deleteAccount' src/server/
```

Em `account.routes.ts` (ou onde o serviço for instanciado):
- Remover das deps: `adminDb`, `firestoreProjectId`, `firestoreDatabaseId`
- Manter: `admin`, `asaasApiUrl`, `asaasApiKey`

Se a rota chamar `service.deleteAccount(uid, idToken)`, atualizar para `service.deleteAccount(uid)` — `idToken` não é mais necessário pois não há mais chamadas ao Firestore REST API.

- [ ] **Step 3: Checar TypeScript**

```bash
npm run lint
```
Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/server/services/account.service.ts
git commit -m "fix: replace Firestore cascade delete with Prisma in account.service.ts"
```

---

## Task 5: patients.service.ts — soft delete

**Files:**
- Modify: `src/server/services/patients.service.ts`
- Create: `src/tests/services/patients.service.test.ts`

- [ ] **Step 1: Escrever os testes**

```typescript
// src/tests/services/patients.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockFindFirst, mockUpdate, mockCreate, mockDelete } = vi.hoisted(() => ({
  mockFindMany:  vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate:    vi.fn(),
  mockCreate:    vi.fn(),
  mockDelete:    vi.fn(),
}));

vi.mock('../../server/lib/prisma.ts', () => ({
  prisma: {
    patient: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      update:    mockUpdate,
      create:    mockCreate,
      delete:    mockDelete,
    },
  },
}));

import { createPatientsService } from '../../server/services/patients.service.ts';

const service = createPatientsService({ prisma: {} as any });

describe('patients.service — soft delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() filtra pacientes com deletedAt preenchido', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list('nutri-1');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('getOne() filtra pacientes com deletedAt preenchido', async () => {
    mockFindFirst.mockResolvedValue({ id: 'p-1', nutritionistId: 'nutri-1', deletedAt: null });
    await service.getOne('nutri-1', 'p-1');
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('remove() faz soft delete (seta deletedAt) em vez de deletar', async () => {
    mockFindFirst.mockResolvedValue({ id: 'p-1', nutritionistId: 'nutri-1', deletedAt: null });
    mockUpdate.mockResolvedValue({});
    await service.remove('nutri-1', 'p-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('remove() lança erro se paciente não pertence ao nutricionista', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.remove('nutri-1', 'p-outro')).rejects.toThrow('Não autorizado');
  });
});
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm run test -- src/tests/services/patients.service.test.ts
```
Esperado: FAIL.

- [ ] **Step 3: Atualizar `src/server/services/patients.service.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

type Deps = { prisma: PrismaClient };

export function createPatientsService({ prisma }: Deps) {
  async function list(nutritionistId: string) {
    return prisma.patient.findMany({
      where: { nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function getOne(nutritionistId: string, id: string) {
    const patient = await prisma.patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!patient) throw new Error('Paciente não encontrado');
    return patient;
  }

  async function create(nutritionistId: string, data: Record<string, unknown>) {
    return prisma.patient.create({ data: { ...(data as any), nutritionistId } });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await prisma.patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.patient.update({ where: { id }, data: data as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await prisma.patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.patient.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, getOne, create, update, remove };
}
```

- [ ] **Step 4: Rodar testes**

```bash
npm run test -- src/tests/services/patients.service.test.ts
```
Esperado: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/patients.service.ts src/tests/services/patients.service.test.ts
git commit -m "feat: implement soft delete on patients.service for LGPD data retention"
```

---

## Task 6: auth.routes.ts — unicidade CPF/CNPJ com hash

**Files:**
- Modify: `src/server/routes/auth.routes.ts`

- [ ] **Step 1: Atualizar `src/server/routes/auth.routes.ts`**

```typescript
import type { BaseRouteDeps } from "../types.ts";
import { prisma } from "../lib/prisma.ts";
import { hashField } from "../lib/crypto.ts";

export function registerAuthRoutes(deps: BaseRouteDeps) {
  deps.app.post("/api/auth/register-profile", deps.authenticate, async (req: any, res: any) => {
    const uid: string = req.user.uid;
    const { name, crn, cpf, cnpj, email, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    try {
      // Checar unicidade de CPF (excluindo o próprio nutricionista)
      if (cpf) {
        const cpfHash = hashField(cpf);
        const duplicate = await prisma.nutritionist.findFirst({
          where: { cpfHash, NOT: { id: uid } },
        });
        if (duplicate) return res.status(409).json({ error: "CPF já cadastrado para outro nutricionista." });
      }

      // Checar unicidade de CNPJ
      if (cnpj) {
        const cnpjHash = hashField(cnpj);
        const duplicate = await prisma.nutritionist.findFirst({
          where: { cnpjHash, NOT: { id: uid } },
        });
        if (duplicate) return res.status(409).json({ error: "CNPJ já cadastrado para outro nutricionista." });
      }

      await prisma.nutritionist.upsert({
        where: { id: uid },
        update: {
          name,
          crn: crn || null,
          cpf: cpf || null,
          cpfHash: cpf ? hashField(cpf) : null,
          cnpj: cnpj || null,
          cnpjHash: cnpj ? hashField(cnpj) : null,
          email,
          phone: phone || null,
          updatedAt: new Date(),
        },
        create: {
          id: uid,
          name,
          crn: crn || null,
          cpf: cpf || null,
          cpfHash: cpf ? hashField(cpf) : null,
          cnpj: cnpj || null,
          cnpjHash: cnpj ? hashField(cnpj) : null,
          email,
          phone: phone || null,
          role: "nutritionist",
          plan: "free",
        },
      });

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Erro ao criar perfil." });
    }
  });
}
```

> **Nota:** O middleware Prisma criptografará `cpf` e `cnpj` automaticamente no `upsert`. O `cpfHash` e `cnpjHash` são calculados do valor em texto claro antes do middleware agir, então o hash é sempre do CPF original.

- [ ] **Step 2: Checar TypeScript**

```bash
npm run lint
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/server/routes/auth.routes.ts
git commit -m "feat: add CPF/CNPJ uniqueness validation via SHA-256 hash in register-profile"
```

---

## Task 7: patient-portal.routes.ts — validação CPF server-side

**Files:**
- Modify: `src/server/routes/patient-portal.routes.ts`

- [ ] **Step 1: Remover CPF do select em `GET /api/portal/patients/:id`**

Localizar o `select` que inclui `cpf: true` e remover esse campo:

```typescript
// ANTES:
select: {
  id: true, name: true, email: true, phone: true,
  cpf: true,  // ← REMOVER
  birthDate: true, nutritionistId: true,
},

// DEPOIS:
select: {
  id: true, name: true, email: true, phone: true,
  birthDate: true, nutritionistId: true,
},
```

- [ ] **Step 2: Adicionar rota `POST /api/portal/patients/:id/verify-cpf`**

Inserir antes do fechamento da função `registerPatientPortalRoutes`:

```typescript
deps.app.post('/api/portal/patients/:id/verify-cpf', async (req: any, res: any) => {
  const { id } = req.params;
  const { token, cpfSuffix } = req.body;

  if (!token || !cpfSuffix) {
    return res.status(400).json({ error: 'Token e sufixo do CPF são obrigatórios.' });
  }

  try {
    const patient = await prisma.patient.findFirst({
      where: { id, accessToken: token as string },
      select: { cpf: true },
    });

    if (!patient) return res.status(401).json({ error: 'Acesso negado.' });

    // middleware já descriptografou patient.cpf
    const cleanCpf = patient.cpf.replace(/\D/g, '');
    const lastThree = cleanCpf.slice(-3);

    if (cpfSuffix !== lastThree) {
      return res.status(401).json({ error: 'Os 3 últimos dígitos do CPF não conferem.' });
    }

    return res.json({ valid: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 3: Checar TypeScript**

```bash
npm run lint
```
Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/server/routes/patient-portal.routes.ts
git commit -m "feat: move CPF verification to server-side endpoint, remove CPF from portal API response"
```

---

## Task 8: PatientAccess.tsx — remover comparação CPF client-side

**Files:**
- Modify: `src/pages/PatientAccess.tsx`

- [ ] **Step 1: Localizar a função de verificação de CPF**

```bash
grep -n 'cpfSuffix\|lastThree\|cleanCpf\|verify-cpf\|handleVerif' src/pages/PatientAccess.tsx
```

- [ ] **Step 2: Substituir a lógica de comparação local pela chamada à API**

Localizar o bloco em torno da linha 107 (comparação `cpfSuffix === lastThree`) e substituir pela chamada ao endpoint:

```typescript
// REMOVER esse bloco:
const cleanCpf = patient.cpf.replace(/\D/g, '');
const lastThree = cleanCpf.slice(-3);
if (cpfSuffix === lastThree) {
  // ... libera acesso
}

// SUBSTITUIR por:
const response = await fetch(`/api/portal/patients/${patient.id}/verify-cpf`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: accessToken, cpfSuffix }),
});

if (response.ok) {
  // ... libera acesso (mesmo bloco que existia antes)
} else {
  setAuthError('Os 3 últimos dígitos do CPF não conferem.');
}
```

> **Nota:** Preservar toda a lógica de estado ao redor (`setAuthenticated`, `setAuthError`, etc.) — apenas a comparação muda.

- [ ] **Step 3: Checar TypeScript**

```bash
npm run lint
```
Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PatientAccess.tsx
git commit -m "feat: move CPF verification from client to server for portal access"
```

---

## Task 9: account-export — serviço e rota

**Files:**
- Create: `src/server/services/account-export.service.ts`
- Create: `src/server/routes/account-export.routes.ts`
- Create: `src/tests/services/account-export.service.test.ts`

- [ ] **Step 1: Escrever o teste**

```typescript
// src/tests/services/account-export.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockNutritionistFindUnique, mockPatientFindMany, mockSubscriptionFindMany } = vi.hoisted(() => ({
  mockNutritionistFindUnique: vi.fn(),
  mockPatientFindMany:        vi.fn(),
  mockSubscriptionFindMany:   vi.fn(),
}));

vi.mock('../../server/lib/prisma.ts', () => ({
  prisma: {
    nutritionist: { findUnique: mockNutritionistFindUnique },
    patient:      { findMany: mockPatientFindMany },
    subscription: { findMany: mockSubscriptionFindMany },
  },
}));

import { createAccountExportService } from '../../server/services/account-export.service.ts';

const service = createAccountExportService({ prisma: {} as any });

describe('AccountExportService.exportData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNutritionistFindUnique.mockResolvedValue({ id: 'nutri-1', name: 'Ana' });
    mockPatientFindMany.mockResolvedValue([{ id: 'p-1', name: 'João' }]);
    mockSubscriptionFindMany.mockResolvedValue([]);
  });

  it('retorna exportedAt como ISO string', async () => {
    const result = await service.exportData('nutri-1');
    expect(typeof result.exportedAt).toBe('string');
    expect(new Date(result.exportedAt).toISOString()).toBe(result.exportedAt);
  });

  it('inclui nutritionist, patients e subscriptions', async () => {
    const result = await service.exportData('nutri-1');
    expect(result.nutritionist).toEqual({ id: 'nutri-1', name: 'Ana' });
    expect(result.patients).toHaveLength(1);
    expect(result.subscriptions).toHaveLength(0);
  });

  it('busca patients com include completo', async () => {
    await service.exportData('nutri-1');
    expect(mockPatientFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          consultations: true,
          labExams: true,
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm run test -- src/tests/services/account-export.service.test.ts
```
Esperado: FAIL.

- [ ] **Step 3: Criar `src/server/services/account-export.service.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

type Deps = { prisma: PrismaClient };

export function createAccountExportService({ prisma }: Deps) {
  async function exportData(nutritionistId: string) {
    const [nutritionist, patients, subscriptions] = await Promise.all([
      prisma.nutritionist.findUnique({ where: { id: nutritionistId } }),
      prisma.patient.findMany({
        where: { nutritionistId },
        include: {
          consultations: true,
          labExams: true,
          mealPlans: { include: { items: true } },
          appointments: true,
          calculations: true,
        },
      }),
      prisma.subscription.findMany({ where: { nutritionistId } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      nutritionist,
      patients,
      subscriptions,
    };
  }

  return { exportData };
}
```

- [ ] **Step 4: Criar `src/server/routes/account-export.routes.ts`**

```typescript
import type { BaseRouteDeps } from '../types.ts';
import { createAccountExportService } from '../services/account-export.service.ts';
import { prisma } from '../lib/prisma.ts';

export function registerAccountExportRoutes(deps: BaseRouteDeps) {
  const service = createAccountExportService({ prisma });

  deps.app.get('/api/account/export', deps.authenticate, async (req: any, res: any) => {
    try {
      const data = await service.exportData(req.user.uid);
      const json = JSON.stringify(data, null, 2);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="meus-dados-nutrir.json"');
      return res.send(json);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
```

- [ ] **Step 5: Rodar testes**

```bash
npm run test -- src/tests/services/account-export.service.test.ts
```
Esperado: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/account-export.service.ts src/server/routes/account-export.routes.ts src/tests/services/account-export.service.test.ts
git commit -m "feat: add data export endpoint for LGPD Art. 20 portability"
```

---

## Task 10: retention.service.ts + admin.routes.ts — cleanup de soft deletes

**Files:**
- Create: `src/server/services/retention.service.ts`
- Modify: `src/server/routes/admin.routes.ts`
- Create: `src/tests/services/retention.service.test.ts`

- [ ] **Step 1: Escrever os testes**

```typescript
// src/tests/services/retention.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDeleteMany } = vi.hoisted(() => ({
  mockDeleteMany: vi.fn(),
}));

vi.mock('../../server/lib/prisma.ts', () => ({
  prisma: {
    patient: { deleteMany: mockDeleteMany },
  },
}));

import { createRetentionService } from '../../server/services/retention.service.ts';

const service = createRetentionService({ prisma: {} as any });

describe('RetentionService.cleanupSoftDeleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMany.mockResolvedValue({ count: 3 });
  });

  it('deleta somente pacientes com deletedAt antes da data de corte', async () => {
    await service.cleanupSoftDeleted(30);
    const call = mockDeleteMany.mock.calls[0][0];
    expect(call.where.deletedAt.lt).toBeInstanceOf(Date);
  });

  it('retorna o número de registros deletados', async () => {
    const result = await service.cleanupSoftDeleted(30);
    expect(result).toEqual({ deletedCount: 3 });
  });
});
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm run test -- src/tests/services/retention.service.test.ts
```
Esperado: FAIL.

- [ ] **Step 3: Criar `src/server/services/retention.service.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { subDays } from 'date-fns';

type Deps = { prisma: PrismaClient };

export function createRetentionService({ prisma }: Deps) {
  async function cleanupSoftDeleted(daysOld = 30): Promise<{ deletedCount: number }> {
    const cutoff = subDays(new Date(), daysOld);
    const result = await prisma.patient.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });
    return { deletedCount: result.count };
  }

  return { cleanupSoftDeleted };
}
```

- [ ] **Step 4: Adicionar endpoint em `src/server/routes/admin.routes.ts`**

Adicionar import e nova rota dentro de `registerAdminRoutes`, antes do fechamento da função:

```typescript
import { createRetentionService } from '../services/retention.service.ts';
// (adicionar ao topo junto aos imports existentes)

// (dentro de registerAdminRoutes, antes do fechamento):
deps.app.post('/api/admin/retention-cleanup', deps.authenticate, async (req: any, res: any) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const retentionService = createRetentionService({ prisma });
    const result = await retentionService.cleanupSoftDeleted(30);
    return res.json({ message: `${result.deletedCount} pacientes removidos permanentemente.`, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 5: Rodar testes**

```bash
npm run test -- src/tests/services/retention.service.test.ts
```
Esperado: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/retention.service.ts src/server/routes/admin.routes.ts src/tests/services/retention.service.test.ts
git commit -m "feat: add soft delete cleanup service and admin retention-cleanup endpoint"
```

---

## Task 11: register-api-routes.ts — registrar nova rota de export

**Files:**
- Modify: `src/server/register-api-routes.ts`

- [ ] **Step 1: Adicionar import e registro da rota**

```typescript
// Adicionar ao bloco de imports:
import { registerAccountExportRoutes } from "./routes/account-export.routes.ts";

// Adicionar no bloco de registros, após registerAccountRoutes(deps):
registerAccountExportRoutes(deps);
```

- [ ] **Step 2: Checar TypeScript**

```bash
npm run lint
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/server/register-api-routes.ts
git commit -m "feat: register account export route in API"
```

---

## Task 12: Settings.tsx — botão "Exportar meus dados"

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Adicionar função de download e botão na aba privacy**

Localizar `TabsContent value="privacy"` (linha ~1391) e adicionar botão dentro do conteúdo existente:

```typescript
// Adicionar função antes do return do componente (ou dentro do bloco da aba):
async function handleExportData() {
  try {
    const token = await auth.currentUser?.getIdToken();
    const response = await fetch('/api/account/export', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Falha ao exportar dados');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meus-dados-nutrir.json';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error('Não foi possível exportar os dados. Tente novamente.');
  }
}
```

```tsx
{/* Adicionar dentro do TabsContent value="privacy" */}
<div className="space-y-2">
  <h3 className="text-sm font-medium">Portabilidade de dados</h3>
  <p className="text-sm text-muted-foreground">
    Conforme LGPD Art. 20, você pode exportar todos os seus dados em formato JSON.
  </p>
  <Button variant="outline" onClick={handleExportData}>
    Exportar meus dados
  </Button>
</div>
```

- [ ] **Step 2: Checar TypeScript**

```bash
npm run lint
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: add data export button in Settings privacy tab (LGPD Art. 20)"
```

---

## Task 13: Privacidade.tsx — seção Art. 33

**Files:**
- Modify: `src/pages/Privacidade.tsx`

- [ ] **Step 1: Localizar posição de inserção**

```bash
grep -n 'segurança\|Segurança\|Armazenamento\|armazenamento\|section\|Section' src/pages/Privacidade.tsx | head -20
```

- [ ] **Step 2: Adicionar seção de transferência internacional**

Inserir uma nova seção no arquivo, após a seção de segurança existente:

```tsx
<section>
  <h2 className="text-lg font-semibold mb-2">Transferência Internacional de Dados</h2>
  <p className="text-sm text-muted-foreground mb-2">
    Conforme o Art. 33, I da LGPD, informamos que seus dados podem ser transferidos para
    servidores localizados fora do Brasil, com base nos seguintes acordos de proteção:
  </p>
  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
    <li>
      <strong>Autenticação:</strong> Google Firebase Authentication (Google LLC, EUA) —
      protegido pelo{' '}
      <a
        href="https://cloud.google.com/terms/data-processing-addendum"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        DPA do Google Cloud
      </a>.
    </li>
    <li>
      <strong>Banco de dados:</strong> Neon PostgreSQL (infraestrutura AWS, EUA) —
      protegido pelo DPA da AWS e Neon.
    </li>
  </ul>
  <p className="text-sm text-muted-foreground mt-2">
    Ambos os provedores adotam cláusulas contratuais padrão e estão em conformidade com
    regulamentações internacionais de proteção de dados.
  </p>
</section>
```

- [ ] **Step 3: Checar TypeScript**

```bash
npm run lint
```
Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Privacidade.tsx
git commit -m "docs: add international data transfer disclosure (LGPD Art. 33)"
```

---

## Task 14: .env.example — ENCRYPTION_KEY

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Adicionar variável ao arquivo**

Adicionar ao final do `.env.example`:

```bash
# Criptografia de dados sensíveis (LGPD) — gere com: openssl rand -hex 32
# CRÍTICO: nunca perca esta chave. Dados criptografados ficam irrecuperáveis sem ela.
ENCRYPTION_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add ENCRYPTION_KEY to .env.example for LGPD field encryption"
```

---

## Task 15: Script de migração — criptografar dados existentes

**Files:**
- Create: `src/server/scripts/migrate-encryption.ts`

- [ ] **Step 1: Criar o script**

```typescript
// src/server/scripts/migrate-encryption.ts
// Execução: npx tsx src/server/scripts/migrate-encryption.ts
// IMPORTANTE: Fazer backup do banco no Neon antes de executar em produção.

import 'dotenv/config';
import { prisma } from '../lib/prisma.ts';
import { hashField } from '../lib/crypto.ts';

// O middleware Prisma já está ativo (via prisma.ts).
// Leitura: tenta decrypt → falha em plaintext → mantém original (graceful fallback).
// Escrita: encrypt automático dos campos configurados.
// Resultado: script é idempotente — pode ser executado mais de uma vez com segurança.

async function migrateNutritionists() {
  console.log('Migrando nutricionistas...');
  const records = await prisma.nutritionist.findMany({
    select: { id: true, cpf: true, cnpj: true },
  });

  let count = 0;
  for (const record of records) {
    await prisma.nutritionist.update({
      where: { id: record.id },
      data: {
        cpf:     record.cpf  ?? undefined,
        cnpj:    record.cnpj ?? undefined,
        cpfHash: record.cpf  ? hashField(record.cpf)  : null,
        cnpjHash: record.cnpj ? hashField(record.cnpj) : null,
      },
    });
    count++;
  }
  console.log(`  ✓ ${count} nutricionistas migrados`);
}

async function migratePatients() {
  console.log('Migrando pacientes...');
  const records = await prisma.patient.findMany({
    select: { id: true, cpf: true, diseases: true, medications: true, allergies: true },
  });

  let count = 0;
  for (const record of records) {
    await prisma.patient.update({
      where: { id: record.id },
      data: {
        cpf:         record.cpf         ?? undefined,
        diseases:    record.diseases    ?? undefined,
        medications: record.medications ?? undefined,
        allergies:   record.allergies   ?? undefined,
      },
    });
    count++;
  }
  console.log(`  ✓ ${count} pacientes migrados`);
}

async function migrateConsultations() {
  console.log('Migrando consultas...');
  const records = await prisma.consultation.findMany({
    select: { id: true, anamnesis: true, complaints: true },
  });

  let count = 0;
  for (const record of records) {
    await prisma.consultation.update({
      where: { id: record.id },
      data: {
        anamnesis:  record.anamnesis  ?? undefined,
        complaints: record.complaints ?? undefined,
      },
    });
    count++;
  }
  console.log(`  ✓ ${count} consultas migradas`);
}

async function migrateLabExams() {
  console.log('Migrando exames laboratoriais...');
  const records = await prisma.labExam.findMany({
    select: { id: true, observations: true, markers: true },
  });

  let count = 0;
  for (const record of records) {
    await prisma.labExam.update({
      where: { id: record.id },
      data: {
        observations: record.observations ?? undefined,
        markers:      record.markers      ?? undefined,
      },
    });
    count++;
  }
  console.log(`  ✓ ${count} exames migrados`);
}

async function main() {
  console.log('=== Iniciando migração de criptografia LGPD ===\n');
  await migrateNutritionists();
  await migratePatients();
  await migrateConsultations();
  await migrateLabExams();
  console.log('\n=== Migração concluída com sucesso ===');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add src/server/scripts/migrate-encryption.ts
git commit -m "feat: add one-shot encryption migration script for existing data (LGPD)"
```

---

## Task 16: Verificação end-to-end

- [ ] **Step 1: Rodar todos os testes**

```bash
npm run test
```
Esperado: todos PASS, sem regressões.

- [ ] **Step 2: Checar TypeScript**

```bash
npm run lint
```
Esperado: zero erros.

- [ ] **Step 3: Gerar ENCRYPTION_KEY e adicionar ao .env local**

```bash
openssl rand -hex 32
# Copiar saída para .env: ENCRYPTION_KEY=<valor>
```

- [ ] **Step 4: Subir o servidor e testar fluxo de CPF**

```bash
npm run dev
```
- Cadastrar/atualizar nutricionista com CPF → verificar no Neon que campo `cpf` está como ciphertext (`iv:tag:encrypted`)
- Tentar cadastrar segundo nutricionista com mesmo CPF → esperar resposta 409
- Acessar portal do paciente → digitar 3 últimos dígitos do CPF → confirmar acesso liberado

- [ ] **Step 5: Testar portabilidade**

- Settings → aba Privacidade → clicar "Exportar meus dados"
- Confirmar download do JSON com dados em texto claro (descriptografados pelo middleware)

- [ ] **Step 6: Testar soft delete**

- Remover paciente na UI → confirmar que não aparece na lista
- Query direta no Neon: `SELECT id, deleted_at FROM patients WHERE deleted_at IS NOT NULL` → confirmar registro com data

- [ ] **Step 7: Verificar página de privacidade**

- Navegar para `/privacidade` → confirmar seção "Transferência Internacional de Dados" visível com links para DPAs

- [ ] **Step 8: Rodar script de migração (staging primeiro)**

```bash
npx tsx src/server/scripts/migrate-encryption.ts
```
Esperado: saída com contadores de registros migrados por tabela, sem erros.

- [ ] **Step 9: Commit final**

```bash
git add .
git commit -m "chore: LGPD compliance implementation complete"
```
