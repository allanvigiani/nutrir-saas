# Spec: Componente PageHeader — Padronização de Cabeçalhos

**Data:** 2026-06-21
**Status:** Aprovado pelo usuário

---

## Objetivo

Criar um componente `PageHeader` reutilizável e aplicá-lo em todas as páginas principais do sistema, garantindo que ícone, título, descrição e botão de ação sigam exatamente o mesmo padrão visual da página Receitas — já polida e aprovada como referência.

---

## Componente: `src/components/PageHeader.tsx`

### Props

```typescript
interface PageHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
}
```

- **`icon`** — ícone Lucide. Renderizado em `w-6 h-6 text-primary` ao lado do título.
- **`title`** — texto do `h1`. Aceita string dinâmica (ex: saudação do Dashboard).
- **`description`** — parágrafo abaixo do título em `text-sm text-muted-foreground mt-0.5`. Opcional.
- **`action`** — slot ReactNode para botão primário (ex: "Novo Paciente"). Opcional.
- **`badge`** — slot ReactNode para contador de plano free (ex: "2/3 pacientes"). Renderizado antes do `action`. Opcional.

### Estrutura HTML

```tsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
      <Icon className="w-6 h-6 text-primary shrink-0" />
      {title}
    </h1>
    {description && (
      <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
    )}
  </div>
  {(action || badge) && (
    <div className="flex items-center gap-2 shrink-0">
      {badge}
      {action}
    </div>
  )}
</div>
```

---

## Aplicação por página

### Dashboard (`src/pages/Dashboard.tsx`)
- **icon:** `LayoutDashboard` (lucide-react)
- **title:** saudação dinâmica — `"Bom dia, {nutritionist?.name?.split(' ')[0]}"` (lógica já existente, apenas migrada para o prop `title`)
- **description:** subtítulo existente ("Aqui está um resumo do seu consultório.")
- **action:** — (nenhum)
- **badge:** — (nenhum)

### Pacientes (`src/pages/Patients.tsx`)
- **icon:** `Users` (lucide-react — já importado)
- **title:** `"Pacientes"`
- **description:** texto já existente abaixo do h1
- **action:** botão "Novo Paciente" (já existente, migrado para o slot)
- **badge:** contador de plano free se houver (já existe inline — migrado para slot)

### Agenda (`src/pages/Schedule.tsx`)
- **icon:** `CalendarDays` (lucide-react)
- **title:** `"Agenda"`
- **description:** `"Visualize e gerencie seus agendamentos."`
- **action:** botão de novo agendamento (se existir na página)
- **badge:** — (nenhum)

### Financeiro (`src/pages/Financial.tsx`)
- **icon:** `DollarSign` (lucide-react — já importado)
- **title:** `"Financeiro"`
- **description:** `"Gerencie pagamentos e emita recibos para seus pacientes."`
- **action:** — (nenhum)
- **badge:** — (nenhum)

### Configurações (`src/pages/Settings.tsx`)
- **icon:** `Settings` (lucide-react — já importado)
- **title:** `"Configurações"`
- **description:** `"Gerencie seu perfil e preferências do sistema."`
- **action:** — (nenhum)
- **badge:** — (nenhum)

### Receitas (`src/pages/Recipes.tsx`)
- **icon:** `ChefHat` (lucide-react — já importado)
- **title:** `"Receitas"`
- **description:** `"Crie e gerencie suas receitas para incluir nos planos alimentares."`
- **action:** botão "Nova Receita" (já existente)
- **badge:** contador `"{minhasReceitas.length}/{FREE_MAX_RECEITAS} receitas"` (já existente — migrado para slot)

---

## Fora de Escopo

- `PatientProfile.tsx` — layout próprio de perfil de paciente, não é uma "página de módulo"
- `AdminDashboard.tsx` — pode ser atualizado em ciclo futuro
- `MealPlanEdit.tsx` — editor com layout especial (fullscreen)
- Páginas públicas (Landing, Login, Register, etc.)

---

## Convenções

- Ícone sempre `text-primary`, `w-6 h-6`, `shrink-0`
- `h1` sempre `text-2xl font-bold text-foreground tracking-tight`
- Descrição sempre `text-sm text-muted-foreground mt-0.5`
- Nenhuma lógica de negócio dentro do componente — apenas apresentação
- O componente não conhece `isPremium`, plano, ou qualquer estado global; quem passa o `badge` é a página

---

## Ordem de implementação

1. Criar `src/components/PageHeader.tsx`
2. Migrar `src/pages/Recipes.tsx` (referência — validar visual antes de prosseguir)
3. Migrar `src/pages/Dashboard.tsx`
4. Migrar `src/pages/Patients.tsx`
5. Migrar `src/pages/Schedule.tsx`
6. Migrar `src/pages/Financial.tsx`
7. Migrar `src/pages/Settings.tsx`
8. Rodar `npm run lint` e `npm run test` ao final
