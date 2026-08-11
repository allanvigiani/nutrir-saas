# Importar dados da última consulta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a button at the top of the "Nova Consulta" modal that fills the form with the patient's most recent consultation data, so the nutritionist doesn't have to retype everything on a follow-up visit.

**Architecture:** Pure frontend change to a single file, `src/pages/PatientProfile.tsx`. No backend/API changes — the `consultations` array is already fetched client-side and sorted most-recent-first, so `consultations[0]` is always the last consultation. The button appears only when creating a new consultation (not editing) and only if the patient has prior consultation history. Clicking it either applies the values directly (form still empty) or opens a confirmation dialog first (form already has data), following the file's existing standalone-`Dialog`-with-boolean-state pattern used for delete confirmations.

**Tech Stack:** React, react-hook-form, zod, shadcn/ui `Dialog`/`Button`, `lucide-react` icons, `sonner` toast.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-importar-ultima-consulta-design.md`
- Fields copied: `weight`, `height`, `fatPercentage`, `waist`, `hip`, `abdomen`, `arm`, `anamnesis`, `complaints`, `objectives`, `observations`. `date` is never copied.
- Button visible only when `!selectedConsultation && consultations.length > 0`.
- No backend changes. No premium gating.
- No automated test suite exists for `PatientProfile.tsx` and CLAUDE.md scopes Vitest coverage to `src/server/**/*.ts` — verify this feature manually in the browser (dev server + Playwright browser tools), not with new Vitest specs.

---

### Task 1: Import button with direct apply (form-empty path)

**Files:**
- Modify: `src/pages/PatientProfile.tsx:3` (icon import list)
- Modify: `src/pages/PatientProfile.tsx:193` (add field-list constant after `ConsultationFormValues`)
- Modify: `src/pages/PatientProfile.tsx:346` (form hook — add `getValues`/`setValue`)
- Modify: `src/pages/PatientProfile.tsx:364` (add handler functions after `formatDateSafely`)
- Modify: `src/pages/PatientProfile.tsx:839` (button JSX, first child of the consultation `<form>`)

**Interfaces:**
- Produces: `IMPORTABLE_CONSULTATION_FIELDS` (module-level `const`, array of the 11 field names), `getValuesConsultation`, `setValueConsultation` (renamed destructures from `useForm`), `applyLastConsultationValues()`, `handleImportLastConsultation()` — all consumed by Task 2.

- [ ] **Step 1: Add the `Download` icon to the lucide-react import**

In `src/pages/PatientProfile.tsx`, the import block starts at line 3:

```tsx
import {
  User,
  Calendar,
  FileText,
  Beaker,
  TrendingUp,
  ArrowLeft,
  Plus,
  Mail,
  Phone,
  MapPin,
  Activity,
  Trash2,
  Edit,
  AlertCircle,
  Printer,
  Clock,
  Coffee,
  Apple,
  Utensils,
  Moon,
  CloudMoon,
  Dna,
  Zap,
  Droplets,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Calculator,
  X
} from 'lucide-react';
```

Add `Download` after `X`:

```tsx
  X,
  Download
} from 'lucide-react';
```

- [ ] **Step 2: Add the importable-fields constant**

Right after `type ConsultationFormValues = z.infer<typeof consultationSchema>;` (line 193), add:

```tsx
const IMPORTABLE_CONSULTATION_FIELDS = [
  'weight',
  'height',
  'fatPercentage',
  'waist',
  'hip',
  'abdomen',
  'arm',
  'anamnesis',
  'complaints',
  'objectives',
  'observations',
] as const satisfies readonly (keyof ConsultationFormValues)[];
```

- [ ] **Step 3: Expose `getValues`/`setValue` from the consultation form hook**

Change line 346 from:

```tsx
  const { register: regConsultation, handleSubmit: handleConsultationSubmit, reset: resetConsultation, formState: { isSubmitting: isConsultationSubmitting } } = useForm<any>({
```

to:

```tsx
  const { register: regConsultation, handleSubmit: handleConsultationSubmit, reset: resetConsultation, getValues: getValuesConsultation, setValue: setValueConsultation, formState: { isSubmitting: isConsultationSubmitting } } = useForm<any>({
```

- [ ] **Step 4: Add `applyLastConsultationValues` and `handleImportLastConsultation`**

`formatDateSafely` is declared right after the `useForm` block (lines 353-364). Insert the new handlers right after `formatDateSafely`'s closing brace (after line 364), before `onConsultationSubmit` (line 366):

```tsx
  const applyLastConsultationValues = () => {
    const last = consultations[0];
    if (!last) return;
    IMPORTABLE_CONSULTATION_FIELDS.forEach((field) => {
      setValueConsultation(field, (last as any)[field] ?? undefined);
    });
    toast.success(`Dados importados da consulta de ${formatDateSafely(last.date, 'dd/MM/yyyy')}`);
  };

  const handleImportLastConsultation = () => {
    if (consultations.length === 0) return;
    applyLastConsultationValues();
  };
```

- [ ] **Step 5: Add the button to the modal**

The consultation form starts at line 839:

```tsx
              <form key={isConsultationModalOpen ? 'open' : 'closed'} onSubmit={handleConsultationSubmit(onConsultationSubmit)} className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
```

Insert a new block as the first child of the `<form>`, before the existing `grid` div:

```tsx
              <form key={isConsultationModalOpen ? 'open' : 'closed'} onSubmit={handleConsultationSubmit(onConsultationSubmit)} className="space-y-6 py-4">
                {!selectedConsultation && consultations.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleImportLastConsultation}
                    className="rounded-xl h-8 px-4 text-sm gap-2"
                  >
                    <Download className="w-4 h-4" /> Importar última consulta
                  </Button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
```

- [ ] **Step 6: Verify manually in the browser**

Run `npm run dev`, log in, open a patient that already has at least one consultation registered. Open "Nova Consulta" and confirm:
- The "Importar última consulta" button is visible at the top of the modal.
- Clicking it fills `Peso`, `Altura`, `Gordura Corp.`, `Cintura`, `Quadril`, `Abdômen`, `Braço`, `Anamnese`, `Queixas`, `Objetivos da Consulta`, `Observações Adicionais` with the last consultation's values.
- `Data da Consulta` stays as today's date (not overwritten).
- A success toast appears naming the last consultation's date.
- Open "Editar Consulta" on an existing consultation — the button must NOT appear.
- Open "Nova Consulta" for a patient with zero consultations — the button must NOT appear.

- [ ] **Step 7: Commit**

```bash
git add src/pages/PatientProfile.tsx
git commit -m "feat: adiciona botão para importar dados da última consulta"
```

---

### Task 2: Confirm-before-overwrite guard

**Files:**
- Modify: `src/pages/PatientProfile.tsx` (near the other `isDelete*ConfirmOpen` state declarations, e.g. line 242)
- Modify: `src/pages/PatientProfile.tsx` (`handleImportLastConsultation`, added in Task 1)
- Modify: `src/pages/PatientProfile.tsx:1887` (new confirm `Dialog`, placed alongside the existing delete-confirmation dialogs)

**Interfaces:**
- Consumes: `IMPORTABLE_CONSULTATION_FIELDS`, `getValuesConsultation`, `applyLastConsultationValues()`, `handleImportLastConsultation()` (all from Task 1).
- Produces: `isImportConfirmOpen` state, `confirmImportLastConsultation()` — internal to this feature, no downstream consumers.

- [ ] **Step 1: Add the confirmation dialog state**

Near the existing delete-confirmation state declarations (`src/pages/PatientProfile.tsx:242`, `const [isDeleteConsultationConfirmOpen, setIsDeleteConsultationConfirmOpen] = useState(false);`), add:

```tsx
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
```

- [ ] **Step 2: Add the "form already filled" check and wire it into the handler**

Replace the `handleImportLastConsultation` added in Task 1:

```tsx
  const handleImportLastConsultation = () => {
    if (consultations.length === 0) return;
    applyLastConsultationValues();
  };
```

with:

```tsx
  const isConsultationFormFilled = () => {
    const values = getValuesConsultation();
    return IMPORTABLE_CONSULTATION_FIELDS.some((field) => {
      const value = values[field];
      return value !== undefined && value !== null && value !== '' && value !== 0;
    });
  };

  const handleImportLastConsultation = () => {
    if (consultations.length === 0) return;
    if (isConsultationFormFilled()) {
      setIsImportConfirmOpen(true);
      return;
    }
    applyLastConsultationValues();
  };

  const confirmImportLastConsultation = () => {
    applyLastConsultationValues();
    setIsImportConfirmOpen(false);
  };
```

- [ ] **Step 3: Add the confirmation dialog JSX**

Right before the existing delete-meal-plan confirmation dialog (`src/pages/PatientProfile.tsx:1887`):

```tsx
        <Dialog open={isDeleteMealPlanConfirmOpen} onOpenChange={setIsDeleteMealPlanConfirmOpen}>
```

insert a new standalone `Dialog`, following the same visual pattern:

```tsx
        <Dialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Importar dados da última consulta?</DialogTitle>
              <DialogDescription>
                Isso vai substituir os dados já preenchidos neste formulário.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setIsImportConfirmOpen(false)}>Cancelar</Button>
              <Button onClick={confirmImportLastConsultation}>Importar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteMealPlanConfirmOpen} onOpenChange={setIsDeleteMealPlanConfirmOpen}>
```

- [ ] **Step 4: Verify manually in the browser**

With `npm run dev` running, open a patient with prior consultation history:

- Open "Nova Consulta" with an empty form, click "Importar última consulta" → fields fill immediately, no confirmation dialog (same as Task 1's behavior, now gated through `isConsultationFormFilled`).
- Reopen "Nova Consulta", type any value into e.g. `Peso` or `Anamnese`, then click "Importar última consulta" → the confirmation dialog "Importar dados da última consulta?" appears.
  - Click "Cancelar" → dialog closes, the manually typed value is untouched.
  - Click the button again, click "Importar" in the dialog → fields are overwritten with the last consultation's values, dialog closes, success toast appears.
- Confirm a field that was empty/`undefined` in the last consultation (e.g. `Gordura Corp.` if never recorded) stays empty after import — it must not become `0`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PatientProfile.tsx
git commit -m "feat: pede confirmação ao importar última consulta sobre dados já preenchidos"
```
