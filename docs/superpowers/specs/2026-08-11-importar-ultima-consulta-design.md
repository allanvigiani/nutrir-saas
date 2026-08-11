# Importar dados da última consulta no modal de Nova Consulta

## Contexto

Quando um paciente retorna (ex.: uma semana depois) para ajustes no plano
alimentar, o nutricionista hoje precisa redigitar do zero todos os dados
antropométricos e clínicos no modal "Nova Consulta"
(`src/pages/PatientProfile.tsx:792-940`), mesmo que a maior parte desses
dados mude pouco de uma consulta para outra.

O objetivo é adicionar um botão no topo do modal que preenche
automaticamente os campos do formulário com os dados da consulta mais
recente do paciente, agilizando o registro de consultas de retorno.

## Fora de escopo

- Plano alimentar e cálculo nutricional **não** são copiados por este
  botão. Eles são entidades separadas (`MealPlan`, cálculo nutricional),
  vinculadas à consulta via `consultation_id`, e já têm seus próprios
  mecanismos de reaproveitamento (`CopyMealPlanModal` para plano alimentar;
  a calculadora nutricional já pré-popula peso/altura a partir de
  `latestConsultation`, ver `NutritionalCalculator.tsx:38-43`).
- Nenhuma mudança de backend/API — `consultations` (estado do componente)
  já é buscado e ordenado por data decrescente
  (`PatientProfile.tsx:655`/`719`), então `consultations[0]` já é a
  consulta mais recente, disponível no cliente sem chamada adicional.

## Comportamento

### Visibilidade do botão

- Botão "Importar última consulta" no topo do modal, logo abaixo do
  `DialogDescription`, dentro do `<form>`.
- Só aparece quando:
  - `!selectedConsultation` — ou seja, apenas ao **criar** uma nova
    consulta, nunca ao editar uma existente.
  - `consultations.length > 0` — só se o paciente já tiver ao menos uma
    consulta anterior. Se for a primeira consulta do paciente, o botão
    fica oculto (não desabilitado).

### Campos importados

Da consulta em `consultations[0]`, são copiados para o formulário:

- `weight`, `height`, `fatPercentage`, `waist`, `hip`, `abdomen`, `arm`
- `anamnesis`, `complaints`, `objectives`, `observations`

**Não copiado:** `date` — permanece sempre a data padrão (hoje), definida
pelo `resetConsultation` já existente.

Campos numéricos opcionais que estavam vazios/`undefined` na última
consulta permanecem vazios no formulário (nunca viram `0`).

### Confirmação antes de sobrescrever

Ao clicar no botão:

1. Verificar via `getValues()` do react-hook-form se algum dos 11 campos
   acima já tem conteúdo digitado pelo usuário no formulário atual.
2. Se **nenhum** campo tiver conteúdo: importar imediatamente e mostrar
   toast de sucesso (ex.: "Dados importados da consulta de 04/08/2026").
3. Se **algum** campo já tiver conteúdo: abrir um `Dialog` de confirmação
   seguindo o mesmo padrão visual dos diálogos de exclusão já existentes
   no arquivo (ex.: `PatientProfile.tsx:1887-1900` — `Dialog` simples com
   título, descrição, botão "Cancelar" e botão de ação). Texto: "Importar
   dados da última consulta? Isso vai substituir os dados já preenchidos
   neste formulário." Botões: "Cancelar" / "Importar".
4. Confirmando (ou no caso 2), aplicar os valores via `setValue` do
   react-hook-form para cada um dos 11 campos.

### Gating premium

Nenhum. A consulta mais recente sempre está acessível independente do
limite de `historyMonths` do plano gratuito (mesmo comportamento já usado
por `NutritionalCalculator` ao receber `latestConsultation`).

## Implementação

Mudanças concentradas em `src/pages/PatientProfile.tsx`:

1. No `useForm` da consulta (linha ~346), adicionar `getValues` e
   `setValue` à desestruturação (hoje só tem `register`, `handleSubmit`,
   `reset`, `formState`).
2. Novo estado local: `isImportConfirmOpen` (`boolean`).
3. Handler `handleImportLastConsultation()`: implementa a lógica de
   verificação/confirmação/importação descrita acima.
4. Handler `performImportLastConsultation()`: aplica os `setValue` e
   dispara o toast.
5. Botão + `Dialog` de confirmação adicionados no JSX do modal existente
   (não é um novo componente — mantém tudo local ao modal, como o resto
   do formulário de consulta já é).

## Testes

Mudança de UI — testar manualmente no navegador (dev server):

- Paciente com consultas anteriores: abrir "Nova Consulta", clicar em
  "Importar última consulta" com formulário vazio → campos preenchidos,
  data permanece hoje, toast exibido.
- Repetir preenchendo algum campo manualmente antes de clicar → diálogo
  de confirmação aparece; cancelar não altera nada; confirmar sobrescreve.
- Paciente sem nenhuma consulta anterior → botão não aparece.
- Abrir "Editar Consulta" em uma consulta existente → botão não aparece.
- Campos opcionais vazios na última consulta (ex.: sem `fatPercentage`)
  → permanecem vazios após importar, não viram `0`.
