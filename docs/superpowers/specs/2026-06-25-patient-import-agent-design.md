# Design: Importação de Pacientes via IA

**Data:** 2026-06-25  
**Status:** Aprovado

---

## Problema

Nutricionistas que chegam ao Nutrir vindos de outros sistemas (Ágata, planilhas Excel, etc.) precisam cadastrar seus pacientes manualmente um a um. Com dezenas ou centenas de pacientes, isso é inviável e uma das maiores barreiras de adoção.

---

## Solução

Feature de importação assíncrona com IA. O nutricionista faz upload de um arquivo (CSV, Excel ou PDF), a IA processa em background mapeando e normalizando os dados, e o nutricionista confirma o preview antes de salvar.

---

## Stack Técnica

- **LLM:** OpenRouter via `fetch` direto (`https://openrouter.ai/api/v1/chat/completions`)
- **Observabilidade:** Langfuse (trace por importação, spans por chamada LLM)
- **Modelo recomendado:** `google/gemini-flash-1.5` ou `anthropic/claude-haiku-3` (rápidos e baratos para tarefas estruturadas)
- **Parse de arquivos:** `papaparse` (CSV), `xlsx` (Excel), `pdf-parse` (PDF)
- **Validação:** Zod

---

## Arquitetura

### Fluxo Completo

```
[Upload do arquivo]
        ↓
POST /api/patients/imports
→ Salva arquivo temporariamente
→ Cria ImportJob no banco (status: "processing")
→ Dispara processamento em background (sem await)
→ Retorna imediatamente: { jobId }

        ↓ [Background]

[1] Parse do arquivo
    CSV → papaparse | Excel → xlsx | PDF → pdf-parse

[2] LLM Call 1 — Mapeamento de colunas
    Entrada: nomes das colunas do arquivo
    Saída: { coluna_origem: campo_destino }

[3] LLM Call 2 — Normalização de valores
    Entrada: valores únicos por coluna (deduplicados)
    Saída: { coluna: { valor_original: valor_normalizado } }
    Aplicação: código aplica o mapa localmente em todas as linhas

[4] Validação Zod linha a linha
    ✅ válido | ⚠️ campo faltando | ❌ erro crítico

[5] Atualiza ImportJob
    status: "done", preview: JSON
    ou status: "error", errorMessage: string

        ↓ [Nutricionista]

GET /api/patients/imports
→ Lista jobs com status atualizado
→ Nutricionista clica em "Revisar preview"

POST /api/patients/imports/:jobId/confirm
→ Salva pacientes + consultas em transaction
→ Marca job como "confirmed"
```

---

## Banco de Dados

### Novo modelo: `ImportJob`

```prisma
model ImportJob {
  id             String    @id @default(cuid())
  nutritionistId String
  nutritionist   Nutritionist @relation(fields: [nutritionistId], references: [id], onDelete: Cascade)
  fileName       String
  fileKey        String
  status         String    @default("processing") // processing | done | error | confirmed
  preview        Json?
  errorMessage   String?
  totalRows      Int?
  validRows      Int?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@map("import_jobs")
}
```

---

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/patients/imports` | Inicia uma importação (upload do arquivo) |
| `GET` | `/api/patients/imports` | Lista todos os jobs do nutricionista |
| `GET` | `/api/patients/imports/:jobId` | Detalhes e preview de um job |
| `POST` | `/api/patients/imports/:jobId/confirm` | Confirma e salva os pacientes |

---

## LLM Calls

### Call 1 — Mapeamento de colunas

**Objetivo:** descobrir qual coluna do arquivo corresponde a qual campo do sistema.

**Entrada (só nomes de colunas, sem dados):**
```
Você é um assistente de mapeamento de dados clínicos.
Mapeie as colunas do arquivo para os campos do sistema.

Colunas do arquivo: ["nome_completo", "dt_nasc", "cel", "patologia", "meta", "sexo"]

Campos disponíveis no sistema:
- name (obrigatório)
- birthDate (obrigatório, formato YYYY-MM-DD)
- gender (obrigatório, "male" ou "female")
- phone, email, cpf, address (opcionais)
- objective (obrigatório: "weight_loss" | "weight_gain" | "health" | "other")
- activityLevel (obrigatório: "sedentary" | "light" | "moderate" | "active" | "very_active")
- diseases, medications, allergies, observations (opcionais, texto livre)

Retorne SOMENTE o JSON: { "coluna_origem": "campo_destino" }
Omita colunas sem equivalente claro.
```

**Saída esperada:**
```json
{ "nome_completo": "name", "dt_nasc": "birthDate", "cel": "phone", "patologia": "diseases", "meta": "objective", "sexo": "gender" }
```

**Custo:** mínimo — apenas strings de nomes de colunas.

---

### Call 2 — Normalização de valores

**Objetivo:** converter valores do arquivo para o formato do sistema.

**Estratégia de economia:** antes de chamar o LLM, o código deduplica os valores únicos por coluna. Se 200 linhas têm `"Fem"`, o LLM recebe esse valor uma única vez.

**Entrada:**
```
Normalize os valores abaixo para os padrões do sistema.
Retorne SOMENTE o JSON no formato especificado.

gender → ["male", "female"]:
valores: ["Fem", "M", "Masculino", "F", "feminino"]

birthDate → "YYYY-MM-DD":
valores: ["28/03/1990", "1985.06.15", "12-04-2001"]

objective → ["weight_loss","weight_gain","health","other"]:
valores: ["emagrecer", "ganhar massa", "saúde geral", "hipertrofia"]

activityLevel → ["sedentary","light","moderate","active","very_active"]:
valores: ["sedentário", "pouco ativo", "ativo", "muito ativo"]

Formato de retorno:
{ "coluna": { "valor_original": "valor_normalizado" } }
```

**Saída esperada:**
```json
{
  "gender": { "Fem": "female", "M": "male", "Masculino": "male", "F": "female", "feminino": "female" },
  "birthDate": { "28/03/1990": "1990-03-28", "1985.06.15": "1985-06-15", "12-04-2001": "2001-04-12" },
  "objective": { "emagrecer": "weight_loss", "ganhar massa": "weight_gain", "saúde geral": "health", "hipertrofia": "weight_gain" },
  "activityLevel": { "sedentário": "sedentary", "pouco ativo": "light", "ativo": "active", "muito ativo": "very_active" }
}
```

O código aplica esse mapa localmente em todas as linhas — sem mais chamadas ao LLM.

---

## Preview JSON (retornado pelo job quando status = "done")

```json
{
  "totalRows": 215,
  "validRows": 198,
  "warningRows": 12,
  "errorRows": 5,
  "rows": [
    {
      "status": "valid",
      "patient": { "name": "João Silva", "birthDate": "1990-03-28", "gender": "male", ... },
      "consultation": { "weight": 85.0, "height": 1.75, ... }
    },
    {
      "status": "warning",
      "patient": { "name": "Maria Souza", "birthDate": "1985-06-15", ... },
      "consultation": null,
      "warnings": ["Campo 'phone' ausente"]
    },
    {
      "status": "error",
      "rawData": { "nome_completo": "???" },
      "errors": ["Campo 'name' obrigatório ausente"]
    }
  ]
}
```

---

## UI — Tela de Importações

Aba ou seção dentro da página de Pacientes.

**Lista de jobs:**

| Arquivo | Data | Total | Válidos | Status | Ação |
|---------|------|-------|---------|--------|------|
| planilha_ago.xlsx | 25/06/2026 | 215 | 198 | ✅ Concluído | Revisar preview |
| pacientes_2025.csv | 25/06/2026 | — | — | ⏳ Processando | ↻ Atualizar |
| dados_velhos.pdf | 24/06/2026 | 50 | — | ❌ Erro | Ver detalhes |

Botão global **↻ Atualizar** chama `GET /api/patients/imports` e re-renderiza a lista.

**Modal de preview (ao clicar em "Revisar preview"):**
- Tabela com todas as linhas
- Linhas verdes (válidas), amarelas (warnings), vermelhas (erros)
- Linhas com warning permitem edição inline dos campos faltando
- Linhas com erro ficam desabilitadas para importação
- Botão "Importar X pacientes válidos" → chama `/confirm`

---

## Observabilidade com Langfuse

Cada importação gera um trace no Langfuse com:
- **Span 1:** parse do arquivo (tempo, tamanho, formato)
- **Span 2:** LLM call 1 — mapeamento (prompt, resposta, tokens, custo)
- **Span 3:** LLM call 2 — normalização (prompt, resposta, tokens, custo)
- **Metadata:** `nutritionistId`, `fileName`, `totalRows`, `validRows`

---

## Gating Premium

Importação de pacientes é feature **premium**. Verificar `isPremium` antes de processar. Retornar `403` com mensagem clara se não for premium.

---

## Tratamento de Erros

| Cenário | Comportamento |
|---------|---------------|
| Formato de arquivo não suportado | Job criado com status "error" imediatamente |
| LLM retorna JSON inválido | Retry uma vez; se falhar, status "error" |
| Arquivo sem colunas mapeáveis | Status "error" com mensagem descritiva |
| Linha com campos obrigatórios ausentes | Linha marcada como "error" no preview, restante segue |
| Erro de banco no `/confirm` | Transaction faz rollback, job não marcado como "confirmed" |
