# Free Plan Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar e exibir claramente todas as limitações do plano gratuito: 2 pacientes ativos, 2 consultas/mês totais, 1 consulta/mês por paciente, 1 cálculo nutricional por consulta.

**Architecture:** Hook centralizado `useFreeplanLimits` encapsula queries Firestore para limites de consultas mensais. Cada componente consome o hook e exibe banners/botões desabilitados para usuários free. Usuários premium não executam nenhuma query extra — o hook retorna imediatamente com permissões ilimitadas.

**Tech Stack:** React, TypeScript, Firebase Firestore, Tailwind CSS, shadcn/ui, date-fns, lucide-react

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/contexts/SettingsContext.tsx` | Modify | Adicionar campos de limite de consultas e corrigir maxPatients para 2 |
| `src/hooks/useFreeplanLimits.ts` | **Create** | Hook que verifica limites mensais de consultas no Firestore |
| `src/components/UpgradeModal.tsx` | Modify | Atualizar textos dos benefícios para refletir limites reais |
| `src/pages/Patients.tsx` | Modify | Tornar descrição do banner dinâmica (era hardcoded "3") |
| `src/pages/Dashboard.tsx` | Modify | Corrigir PremiumFeature hardcoded + adicionar contador de consultas free |
| `src/pages/PatientProfile.tsx` | Modify | Limites de consulta mensal + cálculo nutricional por consulta |

---

### Task 1: Atualizar SettingsContext

**Files:**
- Modify: `src/contexts/SettingsContext.tsx:57-79`

- [ ] **Step 1: Adicionar campos ao tipo `GlobalSettings` e corrigir defaults**

Em `src/contexts/SettingsContext.tsx`, substituir o bloco da interface e dos defaults (linhas 57–79):

```typescript
// Substituir a interface:
interface GlobalSettings {
  free: {
    maxPatients: number;
    maxConsultationsPerMonth: number;
    maxConsultationsPerPatientPerMonth: number;
    maxMealPlans: number;
    maxExams: number;
    historyMonths: number;
  };
}

// Substituir os defaults:
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

- [ ] **Step 2: Verificar TypeScript compila sem erros**

```bash
npm run lint
```

Resultado esperado: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/SettingsContext.tsx
git commit -m "feat: adicionar limites de consultas ao SettingsContext e corrigir maxPatients para 2"
```

---

### Task 2: Criar hook `useFreeplanLimits`

**Files:**
- Create: `src/hooks/useFreeplanLimits.ts`

- [ ] **Step 1: Criar o arquivo do hook**

Criar `src/hooks/useFreeplanLimits.ts` com o seguinte conteúdo:

```typescript
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

interface FreePlanLimits {
  consultationsThisMonth: number;
  canAddConsultation: boolean;
  patientAlreadyHasConsultationThisMonth: boolean;
  isLoading: boolean;
}

export function useFreeplanLimits(patientId?: string): FreePlanLimits {
  const { user, nutritionist } = useAuth();
  const { settings } = useSettings();
  const [consultationsThisMonth, setConsultationsThisMonth] = useState(0);
  const [patientConsultationsThisMonth, setPatientConsultationsThisMonth] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const isPremium = nutritionist?.plan === 'premium';

  useEffect(() => {
    if (isPremium || !user) return;

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    setIsLoading(true);

    const q = query(
      collection(db, 'consultations'),
      where('nutritionist_id', '==', user.uid),
      where('date', '>=', startOfMonth.toISOString()),
      where('date', '<=', endOfMonth.toISOString())
    );

    getDocs(q)
      .then((snap) => {
        const docs = snap.docs.map(d => d.data());
        setConsultationsThisMonth(docs.length);
        if (patientId) {
          setPatientConsultationsThisMonth(docs.filter(d => d.patient_id === patientId).length);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isPremium, user, patientId, settings.free.maxConsultationsPerMonth]);

  if (isPremium) {
    return {
      consultationsThisMonth: 0,
      canAddConsultation: true,
      patientAlreadyHasConsultationThisMonth: false,
      isLoading: false,
    };
  }

  return {
    consultationsThisMonth,
    canAddConsultation: consultationsThisMonth < settings.free.maxConsultationsPerMonth,
    patientAlreadyHasConsultationThisMonth: patientConsultationsThisMonth >= settings.free.maxConsultationsPerPatientPerMonth,
    isLoading,
  };
}
```

- [ ] **Step 2: Verificar TypeScript compila sem erros**

```bash
npm run lint
```

Resultado esperado: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFreeplanLimits.ts
git commit -m "feat: criar hook useFreeplanLimits para verificar limites mensais de consultas"
```

---

### Task 3: Atualizar textos do UpgradeModal

**Files:**
- Modify: `src/components/UpgradeModal.tsx:10,21-29`

- [ ] **Step 1: Adicionar `TrendingUp` ao import de lucide-react**

Em `src/components/UpgradeModal.tsx`, linha 10:

```typescript
// Antes:
import { Check, ShieldCheck, Zap, Users, History, FileUp, BarChart3, Download, Layers, Loader2 } from 'lucide-react';

// Depois:
import { Check, ShieldCheck, Zap, Users, History, FileUp, BarChart3, Download, Layers, Loader2, TrendingUp } from 'lucide-react';
```

- [ ] **Step 2: Atualizar array `benefits`**

```typescript
// Antes:
const benefits = [
  { icon: Users, text: "Pacientes ilimitados (limite de 3 no gratuito)" },
  { icon: History, text: "Histórico completo (limite de 3 meses no gratuito)" },
  { icon: FileUp, text: "Upload de laudos e exames em PDF" },
  { icon: BarChart3, text: "Gráficos de evolução detalhados" },
  { icon: Download, text: "Exportação em PDF e Excel" },
  { icon: Layers, text: "Múltiplos planos alimentares simultâneos" },
  { icon: Zap, text: "Acesso antecipado a novas funcionalidades" },
];

// Depois:
const benefits = [
  { icon: Users, text: "Pacientes ilimitados (limite de 2 no gratuito)" },
  { icon: TrendingUp, text: "Consultas ilimitadas (limite de 2/mês no gratuito)" },
  { icon: History, text: "Histórico completo (limite de 3 meses no gratuito)" },
  { icon: FileUp, text: "Upload de laudos e exames em PDF" },
  { icon: BarChart3, text: "Gráficos de evolução detalhados" },
  { icon: Download, text: "Exportação em PDF e Excel" },
  { icon: Layers, text: "Múltiplos planos alimentares simultâneos" },
];
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npm run lint
```

Resultado esperado: nenhum erro.

- [ ] **Step 4: Commit**

```bash
git add src/components/UpgradeModal.tsx
git commit -m "feat: atualizar benefícios do UpgradeModal com limites corretos do plano gratuito"
```

---

### Task 4: Patients.tsx — banner dinâmico

**Files:**
- Modify: `src/pages/Patients.tsx:564-568`

- [ ] **Step 1: Tornar descrição do banner dinâmica**

Localizar o bloco do `PremiumBanner` com `title="Limite de Pacientes Atingido"` (linha ~564) e substituir a `description` hardcoded:

```tsx
// Antes:
<PremiumBanner 
  title="Limite de Pacientes Atingido" 
  description="Você atingiu o limite de 3 pacientes ativos do plano gratuito. Assine o Premium para cadastrar pacientes ilimitados."
  className="mb-8"
/>

// Depois:
<PremiumBanner 
  title="Limite de Pacientes Atingido" 
  description={`Você atingiu o limite de ${settings.free.maxPatients} paciente${settings.free.maxPatients === 1 ? '' : 's'} ativo${settings.free.maxPatients === 1 ? '' : 's'} do plano gratuito. Assine o Premium para cadastrar pacientes ilimitados.`}
  className="mb-8"
/>
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npm run lint
```

Resultado esperado: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Patients.tsx
git commit -m "feat: tornar banner de limite de pacientes dinâmico"
```

---

### Task 5: Dashboard — contador de consultas e PremiumFeature corrigido

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Adicionar import de `useSettings` no Dashboard**

Em `src/pages/Dashboard.tsx`, adicionar após os imports existentes:

```typescript
import { useSettings } from '../contexts/SettingsContext';
```

- [ ] **Step 2: Instanciar `useSettings` no componente**

Dentro do componente `Dashboard`, logo após `const isPremium = nutritionist?.plan === 'premium';`:

```typescript
const { settings } = useSettings();
```

Nota: o Dashboard já tem `stats.monthConsultations` carregado via `onSnapshot` — não é necessário chamar `useFreeplanLimits` aqui; usaremos esse valor diretamente.

- [ ] **Step 3: Corrigir `PremiumFeature` do botão "Novo Paciente"**

Substituir a checagem hardcoded (linha ~170). O componente `PremiumFeature` já verifica `isPremium` internamente, então o `active` prop só precisa da contagem:

```tsx
// Antes:
<PremiumFeature active={stats.activePatients >= 3}>

// Depois:
<PremiumFeature active={stats.activePatients >= settings.free.maxPatients}>
```

- [ ] **Step 4: Adicionar card de uso de consultas mensais para usuários free**

Após o fechamento do grid de 3 StatCards (`</div>` do `grid grid-cols-1 md:grid-cols-3 gap-6`), adicionar:

```tsx
{!isPremium && (
  <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm">
    <TrendingUp className="w-4 h-4 text-amber-600 shrink-0" />
    <span className="text-amber-800 dark:text-amber-200">
      Consultas em {format(new Date(), 'MMMM', { locale: ptBR })}:{' '}
      <strong>{stats.monthConsultations}/{settings.free.maxConsultationsPerMonth}</strong> usadas
    </span>
    <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 shrink-0">
      Plano Gratuito
    </span>
  </div>
)}
```

O ícone `TrendingUp` já está importado no Dashboard.

- [ ] **Step 5: Verificar TypeScript**

```bash
npm run lint
```

Resultado esperado: nenhum erro.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: adicionar contador de consultas mensais no Dashboard e corrigir PremiumFeature de pacientes"
```

---

### Task 6: PatientProfile — limites de consulta mensal

**Files:**
- Modify: `src/pages/PatientProfile.tsx`

- [ ] **Step 1: Adicionar imports**

Em `src/pages/PatientProfile.tsx`, adicionar junto aos imports existentes de components (próximo às linhas 72-75):

```typescript
import { PremiumBanner } from '../components/PremiumBanner';
import { useFreeplanLimits } from '../hooks/useFreeplanLimits';
```

- [ ] **Step 2: Adicionar `isPremium` e instanciar o hook**

Próximo à linha 302 (onde está `isLabExamLimitReached`), adicionar:

```typescript
const isPremium = nutritionist?.plan === 'premium';
const {
  canAddConsultation,
  patientAlreadyHasConsultationThisMonth,
  consultationsThisMonth,
  isLoading: limitsLoading,
} = useFreeplanLimits(id);
```

- [ ] **Step 3: Adicionar guard no início de `onConsultationSubmit`**

Em `onConsultationSubmit` (linha ~646), adicionar as validações de plano gratuito logo no início da função, antes do `try`:

```typescript
const onConsultationSubmit = async (data: any) => {
  if (!user || !id) return;

  if (!isPremium && !selectedConsultation) {
    if (!canAddConsultation) {
      toast.error(`Limite de ${settings.free.maxConsultationsPerMonth} consultas mensais atingido no plano gratuito.`);
      return;
    }
    if (patientAlreadyHasConsultationThisMonth) {
      toast.error('Este paciente já possui uma consulta este mês. O plano gratuito permite 1 por paciente por mês.');
      return;
    }
  }

  try {
    // ... resto do código existente sem alteração
```

- [ ] **Step 4: Atualizar botão "Nova Consulta" (linha ~1523)**

```tsx
// Antes:
<Button
  size="sm"
  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-4 gap-2 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50"
  onClick={() => setIsConsultationModalOpen(true)}
  disabled={patient.status === 'inactive'}
>
  <Plus className="w-4 h-4" /> Nova Consulta
</Button>

// Depois:
<Button
  size="sm"
  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-4 gap-2 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50"
  onClick={() => setIsConsultationModalOpen(true)}
  disabled={
    patient.status === 'inactive' ||
    (!isPremium && (limitsLoading || !canAddConsultation || patientAlreadyHasConsultationThisMonth))
  }
>
  <Plus className="w-4 h-4" /> Nova Consulta
</Button>
```

- [ ] **Step 5: Adicionar banners de limite na aba de consultas**

Logo após `<CardContent className="pt-6">` dentro da `TabsContent value="consultations"`, inserir os dois banners condicionais:

```tsx
<CardContent className="pt-6">
  {!isPremium && !limitsLoading && !canAddConsultation && (
    <PremiumBanner
      className="mb-6"
      title="Limite de consultas do mês atingido"
      description={`Você usou ${consultationsThisMonth}/${settings.free.maxConsultationsPerMonth} consultas em ${format(new Date(), 'MMMM', { locale: ptBR })}. Assine o Premium para consultas ilimitadas.`}
    />
  )}
  {!isPremium && !limitsLoading && canAddConsultation && patientAlreadyHasConsultationThisMonth && (
    <PremiumBanner
      className="mb-6"
      title="Paciente já atendido este mês"
      description={`Este paciente já possui uma consulta em ${format(new Date(), 'MMMM', { locale: ptBR })}. O plano gratuito permite 1 consulta por paciente por mês.`}
    />
  )}
  {consultations.length > 0 ? (
  // ... restante do código inalterado
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npm run lint
```

Resultado esperado: nenhum erro.

- [ ] **Step 7: Commit**

```bash
git add src/pages/PatientProfile.tsx
git commit -m "feat: adicionar limites de consulta mensal no PatientProfile com banners e guards"
```

---

### Task 7: PatientProfile — limite de cálculo nutricional por consulta

**Files:**
- Modify: `src/pages/PatientProfile.tsx:1695-1706`

- [ ] **Step 1: Desabilitar botão "Novo Cálculo" quando consulta já tem cálculo**

Localizar o botão "Novo Cálculo" (linha ~1698) dentro do `.map((consultation) => ...)` e substituir:

```tsx
// Antes:
<Button
  size="sm"
  variant="outline"
  className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-8 text-xs"
  onClick={() => {
    setSelectedConsultationForCalc(consultation);
    setIsCalculatorModalOpen(true);
  }}
>
  <Calculator className="w-3.5 h-3.5 mr-1" /> Novo Cálculo
</Button>

// Depois:
<Button
  size="sm"
  variant="outline"
  className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-8 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
  title={
    !isPremium && calculations.some(c => c.consultation_id === consultation.id)
      ? 'Plano gratuito: 1 cálculo por consulta'
      : undefined
  }
  disabled={!isPremium && calculations.some(c => c.consultation_id === consultation.id)}
  onClick={() => {
    setSelectedConsultationForCalc(consultation);
    setIsCalculatorModalOpen(true);
  }}
>
  <Calculator className="w-3.5 h-3.5 mr-1" /> Novo Cálculo
</Button>
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npm run lint
```

Resultado esperado: nenhum erro.

- [ ] **Step 3: Executar suite de testes para verificar regressões**

```bash
npm run test
```

Resultado esperado: 118 tests passed (5 test files).

- [ ] **Step 4: Commit**

```bash
git add src/pages/PatientProfile.tsx
git commit -m "feat: desabilitar botão Novo Cálculo para usuários free quando consulta já tem cálculo"
```

---

## Verificação Manual Final

Iniciar o servidor e testar com um usuário `free`:

```bash
npm run dev
```

Cenários a verificar:

1. **Pacientes**: tentar cadastrar 3º paciente ativo → banner "Limite de Pacientes Atingido" visível + botão Novo Paciente desabilitado no Dashboard
2. **Consultas (global)**: criar 2 consultas em meses diferentes ou para 2 pacientes diferentes → tentar 3ª → banner "Limite de consultas do mês atingido" + botão Nova Consulta disabled
3. **Consultas (por paciente)**: criar 1 consulta para Paciente A → tentar criar 2ª → banner "Paciente já atendido este mês" (banner diferente do caso anterior)
4. **Cálculo**: criar cálculo nutricional numa consulta → botão "Novo Cálculo" fica disabled com tooltip "Plano gratuito: 1 cálculo por consulta"
5. **Dashboard**: card de uso "Consultas em [mês]: X/2 usadas" visível para free, invisível para premium
6. **Premium**: nenhum dos bloqueios acima se aplica
7. **Virada de mês**: (simular mudando a data do sistema ou criando consultas com datas de mês anterior) → contador reseta
