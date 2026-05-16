# LGPD Compliance — Design Spec

**Data:** 2026-05-16  
**Escopo:** Implementação completa dos 5 itens LGPD + correção do account.service.ts + CPF server-side + unicidade de CPF/CNPJ  
**Sessão:** única (sem conflitos entre itens)

---

## Contexto

O Nutrir SaaS armazena dados sensíveis de saúde (doenças, medicamentos, alergias, anamnese, exames) e PII (CPF, CNPJ) de pacientes e nutricionistas no PostgreSQL (Neon) via Prisma ORM. Uma auditoria LGPD identificou 5 lacunas. Durante o design, foram descobertos dois problemas adicionais:

1. `account.service.ts` ainda usa código Firestore legado (migração incompleta)
2. Validação dos 3 últimos dígitos do CPF ocorre no frontend (CPF completo trafega para o browser)
3. Sem validação de unicidade de CPF/CNPJ no cadastro de nutricionistas

Todos os itens serão implementados em sessão única para evitar conflitos.

---

## Abordagem de Criptografia

**Prisma Middleware global (Opção A)**

Um middleware registrado em `prisma.ts` intercepta operações de escrita e leitura, aplicando `encrypt`/`decrypt` automaticamente nos campos configurados. Serviços existentes não mudam — continuam usando Prisma normalmente e recebem dados em texto claro.

O middleware verifica se o campo existe no `data` antes de operar, evitando problemas com `update` parcial.

---

## Módulos Novos

### `src/server/lib/crypto.ts`

Duas responsabilidades:
- `encrypt(text)` / `decrypt(ciphertext)` — AES-256-GCM com IV aleatório de 12 bytes. Formato do ciphertext: `iv:tag:encrypted` (hex separado por `:`).
- `hashField(text)` — SHA-256 do texto normalizado (lowercase, sem espaços). Usado para unicidade de CPF/CNPJ — determinístico e irreversível.

Chave lida de `process.env.ENCRYPTION_KEY` (32 bytes em hex). Se ausente, lança erro na inicialização.

### `src/server/lib/prisma-encrypt.ts`

Middleware Prisma com mapa de campos criptografados:

```
Patient:      cpf, diseases, medications, allergies
Nutritionist: cpf, cnpj
Consultation: anamnesis, complaints
LabExam:      observations, markers
```

Comportamento:
- **Escrita** (`create`, `update`, `upsert`): percorre os campos do `data` que existem no mapa e chama `encrypt`. Campos do tipo `Json` (ex: `markers`) são serializados com `JSON.stringify` antes de criptografar. Não toca campos ausentes no payload.
- **Leitura** (`findUnique`, `findFirst`, `findMany`): percorre resultado (array ou objeto, inclusive nested via includes) e chama `decrypt`. Campos marcados como JSON são parseados com `JSON.parse` após descriptografar. Se `decrypt` falhar (dado ainda não criptografado), mantém o valor original — permite coexistência durante migration.
- **Nested includes**: percorre recursivamente objetos e arrays no resultado para descriptografar relações incluídas (ex: `patient` com `consultations` incluídas).

---

## Alterações no Schema Prisma

```prisma
model Nutritionist {
  cpf     String?
  cpfHash String? @unique  // SHA-256 de cpf normalizado
  cnpj    String?
  cnpjHash String? @unique // SHA-256 de cnpj normalizado
  // ... demais campos
}

model Patient {
  // ... campos existentes
  deletedAt DateTime?  // soft delete LGPD Art. 5
}
```

Migration: `prisma migrate dev` gera SQL para adicionar as 3 colunas.

---

## Correções e Modificações

### `account.service.ts` — Corrigir migração incompleta

Remover todo o código Firestore (`fsQuery`, `fsBatchDelete`, `adminDb`, `COLLECTIONS_BY_NUTRITIONIST`). Substituir por:

```typescript
await prisma.nutritionist.delete({ where: { id: uid } });
// onDelete: Cascade no schema elimina patients e todos os relacionamentos
await admin.auth().deleteUser(uid); // Firebase Auth permanece
```

O serviço de cancelamento Asaas permanece inalterado.

### `auth.routes.ts` — Unicidade CPF/CNPJ

Antes do `upsert`, calcular `cpfHash` e `cnpjHash` com `hashField()`. No `upsert`, salvar ambos os campos. Antes de salvar, verificar se já existe outro nutricionista com o mesmo hash (excluindo o próprio UID) e retornar 409 se duplicado.

### `patient-portal.routes.ts` — CPF server-side

1. Remover `cpf` do `select` em `GET /api/portal/patients/:id` — CPF não vai mais para o frontend.
2. Criar `POST /api/portal/patients/:id/verify-cpf`:
   - Body: `{ token: string, cpfSuffix: string }` (últimos 3 dígitos)
   - Busca paciente pelo `id` + `accessToken`
   - Descriptografa CPF via `decrypt()` (o middleware já faz isso automaticamente na leitura)
   - Compara últimos 3 dígitos do CPF limpo com `cpfSuffix`
   - Retorna `{ valid: true }` ou 401

### `PatientAccess.tsx` — Remover comparação local

Remover a comparação `cpfSuffix === lastThree`. Substituir por chamada ao novo endpoint `POST /api/portal/patients/:id/verify-cpf`. Liberar acesso apenas se resposta for `{ valid: true }`.

---

## Novos Serviços e Rotas

### `account-export.service.ts` + `account-export.routes.ts`

`GET /api/account/export` (autenticado via Firebase JWT):

```
Agrega via Prisma:
- nutritionist (dados do próprio)
- patients (com consultations, labExams, mealPlans + items, appointments, calculations)
- subscriptions

Retorna JSON com:
  Content-Type: application/json
  Content-Disposition: attachment; filename="meus-dados-nutrir.json"
```

Os dados já chegam descriptografados pelo middleware. O export reflete os dados em texto claro — é o que o titular precisa receber (Art. 20).

### `retention.service.ts` + endpoint admin

`POST /api/admin/retention-cleanup` protegido por verificação de `SUPER_ADMIN_EMAILS`:

```typescript
// Deleta permanentemente pacientes em soft delete há mais de 30 dias
prisma.patient.deleteMany({
  where: { deletedAt: { lt: subDays(new Date(), 30) } }
})
```

### `patients.service.ts` — Soft delete

`remove()` passa a fazer:
```typescript
prisma.patient.update({ where: { id }, data: { deletedAt: new Date() } })
```

Todas as queries de listagem (`list`, `getOne`) ganham `where: { deletedAt: null }`.

---

## Script de Migração

`src/server/scripts/migrate-encryption.ts`

Executado uma única vez em produção após deploy do código. Lê todos os registros existentes, testa se cada campo já está criptografado (tenta `decrypt` — se falhar, está em texto plano), e reescreve com `encrypt`. Processa em lotes de 50 para não estourar memória.

**Ordem:**
1. `nutritionists` (cpf, cnpj → também calcula cpfHash/cnpjHash)
2. `patients` (cpf)
3. `consultations` (anamnesis, complaints)
4. `lab_exams` (observations, markers)

**Antes de rodar em produção:** fazer backup do banco no painel do Neon.

---

## Documentação (Art. 33)

Adicionar seção "Transferência Internacional de Dados" em `Privacidade.tsx` cobrindo:
- Firebase Auth: Google LLC, servidores nos EUA — base legal: DPA Google
- Neon PostgreSQL: infraestrutura AWS — base legal: DPA AWS/Neon
- Referência explícita ao Art. 33, I da LGPD
- Links para os DPAs

---

## Variáveis de Ambiente

```bash
# .env e gerenciador de segredos da infraestrutura
ENCRYPTION_KEY=<openssl rand -hex 32>
```

A chave nunca pode ser perdida. Se perdida, todos os dados criptografados tornam-se irrecuperáveis.

---

## Verificação End-to-End

1. `npm run lint` — sem erros de tipo
2. `npm run test` — todos os testes passam
3. SELECT direto no Neon: `cpf`, `diseases`, `anamnesis` aparecem como ciphertext (`iv:tag:encrypted`)
4. Criar paciente via UI → perfil exibe CPF corretamente descriptografado
5. Acessar portal do paciente → digitar 3 últimos dígitos → acesso liberado
6. Tentar cadastrar nutricionista com CPF duplicado → retorna 409
7. Remover paciente → `deletedAt` preenchido, não aparece na lista
8. `GET /api/account/export` → JSON com todos os dados em texto claro para download
9. `/privacidade` → seção de transferência internacional visível
10. Settings → aba privacidade → botão "Exportar meus dados" funcional
