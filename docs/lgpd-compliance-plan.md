# Plano LGPD — Nutrir SaaS

## Contexto

O sistema armazena dados sensíveis de saúde de pacientes (peso, altura, doenças, medicamentos, alergias, exames laboratoriais, anamnese clínica) e dados pessoais (CPF, e-mail, telefone, endereço) no PostgreSQL (Neon). Após auditoria de conformidade com a LGPD, foram identificadas 5 lacunas que precisam ser corrigidas. O banco migrou do Firestore para Postgres — todo o acesso é via Prisma ORM.

**Arquivos críticos:**
- `prisma/schema.prisma` — 11 modelos, 26 campos sensíveis
- `src/server/lib/prisma.ts` — instância do Prisma (PrismaPg adapter)
- `src/server/routes/account.routes.ts` — rota de deleção de conta
- `src/server/services/account.service.ts` — lógica de deleção em cascata
- `src/server/routes/patient-portal.routes.ts` — portal público do paciente
- `src/pages/Privacidade.tsx` — política de privacidade
- `src/pages/Settings.tsx` — configurações do usuário (abas de privacidade)

---

## Ordem de Execução

| # | Item | Artigo LGPD | Esforço | Dependências |
|---|------|-------------|---------|--------------|
| 1 | Documentar transferência internacional | Art. 33 | 2-4h | — |
| 2 | Portabilidade de dados (export) | Art. 20 | 1-2 dias | — |
| 3 | Prazos de retenção (soft delete) | Art. 5 | 2-3 dias | — |
| 4 | CPF com criptografia AES-256 | Art. 5 | 3-5 dias | — |
| 5 | Criptografia de dados de saúde | Art. 11 | 1-2 semanas | Item 4 |

Items 1, 2 e 3 são independentes e podem ser feitos em paralelo. Item 5 depende do Item 4 (reutiliza o `crypto.ts`).

---

## Item 1 — Transferência Internacional (Art. 33)

**Esforço: Muito Baixo (2-4h)**

### O que fazer
Atualizar `src/pages/Privacidade.tsx` adicionando uma seção "Transferência Internacional de Dados" que documente explicitamente:
- Dados de autenticação processados no Firebase Auth (Google LLC, EUA)
- Dados armazenados no Neon PostgreSQL (infraestrutura AWS)
- Base legal: Art. 33, I da LGPD — DPA assinado com Google e Neon/AWS
- Links para os DPAs dos provedores

### Conteúdo a adicionar
```
- Provedor de autenticação: Google Firebase Auth (servidores nos EUA)
- Banco de dados: Neon PostgreSQL (infraestrutura AWS)
- Base legal para transferência: DPA assinado com ambos os provedores
- DPA Google: https://cloud.google.com/terms/data-processing-addendum
- Direito de consultar os DPAs a qualquer momento
```

### Verificação
- Abrir `/privacidade` e confirmar seção nova visível
- Texto deve mencionar Art. 33 e os dois provedores internacionais

---

## Item 2 — Portabilidade de Dados (Art. 20)

**Esforço: Baixo (1-2 dias)**

### O que fazer
Criar endpoint `GET /api/account/export` que retorna todos os dados do nutricionista autenticado em formato JSON estruturado para download.

### Arquivos a criar/modificar
- **Criar** `src/server/services/account-export.service.ts`
- **Criar** `src/server/routes/account-export.routes.ts`
- **Modificar** `src/server/register-api-routes.ts` — registrar nova rota
- **Modificar** `src/pages/Settings.tsx` — adicionar botão "Exportar meus dados" na aba de privacidade (linha ~1391)

### Implementação do serviço
```typescript
export function createAccountExportService({ prisma }) {
  async function exportData(nutritionistId: string) {
    const [nutritionist, patients, appointments, subscriptions] = await Promise.all([
      prisma.nutritionist.findUnique({ where: { id: nutritionistId } }),
      prisma.patient.findMany({
        where: { nutritionistId },
        include: {
          consultations: true,
          labExams: true,
          mealPlans: { include: { items: true } },
          appointments: true,
          calculations: true,
        }
      }),
      prisma.appointment.findMany({ where: { nutritionistId } }),
      prisma.subscription.findMany({ where: { nutritionistId } }),
    ]);
    return { exportedAt: new Date().toISOString(), nutritionist, patients, appointments, subscriptions };
  }
  return { exportData };
}
```

### Rota
```
GET /api/account/export
Headers: Authorization: Bearer <firebase-token>
Response: JSON com Content-Disposition: attachment; filename="meus-dados-nutrir.json"
```

### Verificação
- Autenticar como nutricionista → GET /api/account/export → confirmar JSON com todos os dados
- Verificar que dados de outros nutricionistas não aparecem no export

---

## Item 3 — Prazos de Retenção (Art. 5)

**Esforço: Baixo-Médio (2-3 dias)**

### O que fazer
1. Adicionar soft delete (`deletedAt`) em `patients`
2. Criar job de cleanup automático
3. Documentar a política na página de Privacidade

### Política de retenção
- Conta ativa: dados retidos indefinidamente
- Conta cancelada: dados anonimizados após 90 dias
- Paciente removido pelo nutricionista: dados removidos após 30 dias (soft delete)

### Arquivos a criar/modificar
- **Modificar** `prisma/schema.prisma` — adicionar `deletedAt DateTime?` em `Patient`
- **Criar** `prisma/migrations/YYYYMMDD_add_soft_delete/migration.sql`
- **Criar** `src/server/services/retention.service.ts` — lógica de cleanup
- **Criar** `src/server/routes/admin.routes.ts` — endpoint `POST /api/admin/retention-cleanup` protegido por `SUPER_ADMIN_EMAILS`
- **Modificar** `src/server/services/patients.service.ts` — `remove()` vira soft delete (seta `deletedAt`)
- **Modificar** `src/pages/Privacidade.tsx` — documentar os prazos

### Verificação
- Remover paciente → confirmar `deletedAt` preenchido, registro ainda existe no banco
- Chamar endpoint de cleanup → confirmar que pacientes com `deletedAt` > 30 dias são deletados
- Listagens normais não devem retornar pacientes com `deletedAt` preenchido

---

## Item 4 — CPF com Criptografia AES (Art. 5)

**Esforço: Médio (3-5 dias)**

### O que fazer
Criptografar CPF de `patients` e `nutritionists` com AES-256-GCM antes de persistir no banco. Como o CPF é usado para autenticação (últimos 3 dígitos no portal do paciente), precisa de criptografia **reversível** — não hash.

### Arquivos a criar/modificar
- **Criar** `src/server/lib/crypto.ts` — funções `encrypt()` e `decrypt()` com AES-256-GCM
- **Criar** `src/server/scripts/migrate-cpf-encryption.ts` — script one-shot para criptografar CPFs existentes
- **Modificar** `src/server/services/patients.service.ts` — encrypt no create/update, decrypt no read
- **Modificar** `src/server/routes/patient-portal.routes.ts` — decrypt CPF antes de comparar últimos 3 dígitos
- **Modificar** `.env.example` — adicionar `ENCRYPTION_KEY`

### Implementação do crypto.ts
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

### Gerar a chave
```bash
openssl rand -hex 32
```

### Verificação
- Criar novo paciente → SELECT direto no Neon confirma CPF criptografado
- Acessar portal do paciente com últimos 3 dígitos → autenticação ainda funciona
- **Crítico**: fazer backup do banco antes de rodar o script de migração em produção

---

## Item 5 — Criptografia de Dados de Saúde (Art. 11)

**Esforço: Alto (1-2 semanas) | Depende do Item 4**

### O que fazer
Criptografar campos de texto livre com dados de saúde, reutilizando o `crypto.ts` do Item 4.

### Campos a criptografar
```
patients:       diseases, medications, allergies
consultations:  anamnesis, complaints
lab_exams:      observations, markers (JSON serializado)
```

> Campos numéricos de `consultations` (weight, height, imc, etc.) não serão criptografados na primeira versão — criptografia quebraria ordenação e queries, e esses campos só são acessíveis pelo nutricionista autenticado.

### Arquivos a criar/modificar
- **Reutilizar** `src/server/lib/crypto.ts` (criado no Item 4)
- **Criar** `src/server/lib/prisma-encrypt.ts` — Prisma middleware de encrypt/decrypt automático
- **Criar** `src/server/scripts/migrate-health-data-encryption.ts` — script one-shot para criptografar dados existentes
- **Modificar** `src/server/lib/prisma.ts` — registrar o middleware

### Implementação do Prisma middleware
```typescript
// src/server/lib/prisma-encrypt.ts
import { encrypt, decrypt } from './crypto';

const ENCRYPTED_FIELDS: Record<string, string[]> = {
  patient: ['diseases', 'medications', 'allergies'],
  consultation: ['anamnesis', 'complaints'],
  labExam: ['observations', 'markers'],
};

function encryptFields(data: any, fields: string[]) {
  for (const field of fields) {
    if (data[field] != null) {
      const value = typeof data[field] === 'object' ? JSON.stringify(data[field]) : data[field];
      data[field] = encrypt(value);
    }
  }
}

function decryptFields(data: any, fields: string[]) {
  if (!data) return;
  const records = Array.isArray(data) ? data : [data];
  for (const record of records) {
    for (const field of fields) {
      if (record[field]) {
        try { record[field] = decrypt(record[field]); } catch {}
      }
    }
  }
}

export function applyEncryptionMiddleware(prisma: any) {
  prisma.$use(async (params: any, next: any) => {
    const fields = ENCRYPTED_FIELDS[params.model?.toLowerCase?.()];
    if (fields && ['create', 'update', 'upsert'].includes(params.action)) {
      encryptFields(params.args.data, fields);
    }
    const result = await next(params);
    if (fields && ['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
      decryptFields(result, fields);
    }
    return result;
  });
}
```

### Riscos e Mitigações
- **Perda de dados**: Rodar migration em staging primeiro; backup antes de produção
- **Busca**: Confirmar que não há `WHERE diseases LIKE` ou similar no codebase antes de criptografar
- **Performance**: AES-GCM é rápido, impacto negligenciável para o volume atual

### Verificação
- Criar consulta com anamnese → SELECT direto no Neon confirma campo criptografado
- Abrir `PatientProfile.tsx` → dados aparecem corretamente descriptografados
- Rodar testes: `npm run test`

---

## Variáveis de Ambiente Necessárias

```bash
# Adicionar ao .env e ao gerenciador de segredos da infraestrutura
ENCRYPTION_KEY=<saída do comando: openssl rand -hex 32>
```

**Crítico**: Esta chave não pode ser perdida. Se perdida, todos os dados criptografados tornam-se irrecuperáveis. Guardar no gerenciador de segredos da infra (Vercel env vars, Railway secrets, etc.) e fazer backup seguro da chave.
