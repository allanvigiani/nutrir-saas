# Design: Limitações do Plano Gratuito

**Data:** 2026-05-08  
**Status:** Aprovado  
**Área:** Monetização / Plano Gratuito

---

## Contexto

O sistema Nutrir possui planos `free` e `premium`. Algumas limitações do plano gratuito já estavam parcialmente implementadas (exames, gráficos de evolução, limite de pacientes com valor incorreto). Esta spec consolida e completa **todas** as limitações do plano gratuito com UX clara de bloqueio.

---

## Regras do Plano Gratuito

| Recurso | Limite |
|---|---|
| Pacientes ativos | 2 |
| Consultas por mês (total do nutricionista) | 2 |
| Consultas por mês por paciente | 1 |
| Cálculos nutricionais por consulta | 1 |
| Exames laboratoriais por paciente | 1 (já implementado) |
| Gráficos de evolução | Bloqueado (já implementado) |

**Plano premium:** sem limites em nenhum dos recursos acima.

---

## Arquitetura

### Abordagem escolhida: Hook centralizado `useFreeplanLimits`

Centraliza toda a lógica de limites de consultas num hook dedicado, evitando lógica espalhada. Segue o padrão já existente no projeto (`useSubscription`).

A checagem de "consulta já tem cálculo" permanece inline em `PatientProfile` pois usa o estado `calculations` já carregado localmente — sem query adicional.

---

## Mudanças por arquivo

### 1. `src/contexts/SettingsContext.tsx`

Adicionar dois campos ao tipo `GlobalSettings.free` e ajustar o default:

```typescript
interface GlobalSettings {
  free: {
    maxPatients: number;               // 2 (era 3)
    maxConsultationsPerMonth: number;  // 2 (novo)
    maxConsultationsPerPatientPerMonth: number; // 1 (novo)
    maxMealPlans: number;              // 1 (sem mudança)
    maxExams: number;                  // 1 (sem mudança)
    historyMonths: number;             // 3 (sem mudança)
  };
}

const defaultSettings: GlobalSettings = {
  free: {
    maxPatients: 2,
    maxConsultationsPerMonth: 2,
    maxConsultationsPerPatientPerMonth: 1,
    maxMealPlans: 1,
    maxExams: 1,
    historyMonths: 3,
  }
};
```

### 2. `src/hooks/useFreeplanLimits.ts` — NOVO ARQUIVO

Hook que recebe `patientId` opcional. Para usuários `premium`, retorna imediatamente sem query.

**Assinatura:**
```typescript
export function useFreeplanLimits(patientId?: string): {
  consultationsThisMonth: number;
  canAddConsultation: boolean;
  patientAlreadyHasConsultationThisMonth: boolean;
  isLoading: boolean;
}
```

**Implementação:**
- Busca `nutritionist?.plan` de `AuthContext`
- Se `premium`: retorna `{ canAddConsultation: true, patientAlreadyHasConsultationThisMonth: false, consultationsThisMonth: 0, isLoading: false }`
- Se `free`: faz query no Firestore:
  ```
  consultations
    WHERE nutritionist_id == user.uid
    AND date >= startOfMonth(today)
    AND date <= endOfMonth(today)
  ```
- `consultationsThisMonth` = total de docs retornados
- `canAddConsultation` = `consultationsThisMonth < settings.free.maxConsultationsPerMonth`
- `patientAlreadyHasConsultationThisMonth` = se `patientId` fornecido, verifica se algum doc tem `patient_id == patientId`
- A query usa `getDocs` (one-shot, não `onSnapshot`) para evitar listener desnecessário

### 3. `src/pages/Patients.tsx`

- O valor `maxPatients` já vem de `settings.free.maxPatients` — ao mudar o default para 2, o comportamento muda automaticamente
- Atualizar mensagens hardcoded "3 pacientes" → "2 pacientes" (buscar e substituir)
- Banner em `Patients.tsx` linha ~567: atualizar description para refletir limite de 2

### 4. `src/components/UpgradeModal.tsx`

Atualizar textos dos benefícios:
- `"Pacientes ilimitados (limite de 3 no gratuito)"` → `"Pacientes ilimitados (limite de 2 no gratuito)"`
- Adicionar item: `"Consultas ilimitadas (limite de 2/mês no gratuito)"`

### 5. `src/pages/Dashboard.tsx`

Para usuários `free`: exibir card de uso mensal de consultas abaixo das estatísticas existentes.

**Visual:** badge/card compacto com texto:
> "Consultas em [mês]: X/2 — [Assine o Premium]"

Usa o hook `useFreeplanLimits()` (sem patientId) para obter `consultationsThisMonth`.

### 6. `src/pages/PatientProfile.tsx`

Esta é a mudança mais extensa (~2900 linhas, editar com cuidado).

#### 6a. Instanciar o hook
```typescript
const { canAddConsultation, patientAlreadyHasConsultationThisMonth, consultationsThisMonth, isLoading: limitsLoading } = useFreeplanLimits(id);
```

#### 6b. Banner de limite mensal (aba Consultas)

Exibir antes do botão "Nova Consulta", apenas para `free`:

```
Estado 1 — limite global atingido:
"Você atingiu o limite de 2 consultas em [mês]. 
 Assine o Premium para consultas ilimitadas."

Estado 2 — paciente já tem consulta no mês:
"Este paciente já possui uma consulta em [mês]. 
 O plano gratuito permite 1 consulta por paciente por mês."
```

Usar componente `PremiumBanner` já existente ou um `Alert` do shadcn/ui com variante `warning`.

#### 6c. Botão "Nova Consulta" desabilitado

Quando `!isPremium && (!canAddConsultation || patientAlreadyHasConsultationThisMonth)`:
- `disabled={true}`
- O banner acima explica o motivo

#### 6d. Guard em `onConsultationSubmit`

Antes de criar nova consulta:
```typescript
if (!isPremium && !selectedConsultation) {
  if (!canAddConsultation) {
    toast.error('Limite de 2 consultas mensais atingido no plano gratuito.');
    return;
  }
  if (patientAlreadyHasConsultationThisMonth) {
    toast.error('Este paciente já possui uma consulta este mês.');
    return;
  }
}
```

#### 6e. Botão "Novo Cálculo" — 1 por consulta para free

Derivar inline (usa `calculations` já carregado):
```typescript
const consultationAlreadyHasCalculation = (consultationId: string) =>
  calculations.some(c => c.consultation_id === consultationId);
```

Para cada consulta na listagem:
- Se `!isPremium && consultationAlreadyHasCalculation(consultation.id)`:
  - Botão "Novo Cálculo": `disabled={true}` com `title="Plano gratuito: 1 cálculo por consulta"`
  - Exibir texto auxiliar pequeno abaixo: *"Plano gratuito: 1 cálculo por consulta"*

---

## UX — Padrão de bloqueio por recurso

| Recurso | Bloqueio |
|---|---|
| Paciente (3º+) | Banner `PremiumBanner` + botão disabled (já existe) |
| Consulta (limite mensal/paciente) | Banner `Alert` warning + botão "Nova Consulta" disabled |
| Cálculo (2º na mesma consulta) | Botão "Novo Cálculo" disabled + texto auxiliar inline |
| Exame (2º por paciente) | Toast de erro (já existe) |
| Gráficos de evolução | `PremiumFeature` overlay com cadeado (já existe) |
| Dashboard — contador | Card "X/2 consultas em [mês]" com link de upgrade |

---

## O que NÃO muda

- Lógica de exames (`isLabExamLimitReached`) — já correta
- `PremiumFeature` wrapper nos gráficos de evolução — já correto
- Fluxo de pagamento / assinatura
- Plano premium — sem nenhum limite

---

## Testes a verificar manualmente

1. Nutricionista free tenta cadastrar 3º paciente → bloqueado
2. Nutricionista free cria 2 consultas no mês → 3ª é bloqueada
3. Mesmo paciente recebe 2ª consulta no mesmo mês → bloqueada
4. Consulta com cálculo existente → botão "Novo Cálculo" desabilitado
5. Nutricionista premium → nenhum dos bloqueios acima se aplica
6. Dashboard exibe contador correto de consultas do mês
7. Virada de mês → contador reseta (baseado em `date >= startOfMonth`)
