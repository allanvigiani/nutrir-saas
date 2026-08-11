# Editor de texto rico (Tiptap) no plano alimentar modo livre

## Contexto

O modo "Plano Alimentar Livre" (`src/components/FreeTextMealPlanEditor.tsx`)
usa um `<Textarea>` simples para o campo `freeTextContent` — texto puro, sem
nenhuma formatação. Nutricionistas que colam planos vindos de Word/e-mail
perdem negrito, sublinhado e listas de tópicos, e não têm como formatar o
texto depois de colado.

O objetivo é permitir negrito, itálico, sublinhado, títulos (nível único) e
listas (com marcador e numerada) no campo grande "Plano Alimentar", mantendo
compatibilidade total com os planos já salvos como texto puro.

## Fora de escopo

- O campo "Orientações Gerais" (textarea menor, acima do campo principal)
  continua texto puro — é tipicamente uma frase curta, não precisa de
  formatação rica.
- Nenhuma migração de dados no banco. Planos antigos continuam válidos e
  são exibidos exatamente como hoje até serem reabertos e salvos no novo
  editor.
- Portal do paciente (`PatientAccess.tsx`) não renderiza `freeTextContent`
  diretamente — só oferece download do PDF (via `generateMealPlanPDF`,
  mesma função usada pelo botão de imprimir do nutricionista). Não há
  tela HTML adicional a ajustar ali.
- Tipos de plano estruturado (`plan.type !== 'free'`, com refeições/itens)
  não são afetados — o editor rico é exclusivo do modo livre.

## Arquitetura

### Formato de armazenamento

`freeTextContent` continua `string | null` (mesma coluna Prisma, sem
migração). Passa a guardar **HTML** (saída de `editor.getHTML()` do
Tiptap) em vez de texto puro, a partir do primeiro save feito no novo
editor.

Alternativa descartada: guardar o JSON estrutural do ProseMirror. Exigiria
uma instância do Tiptap (ou parser do schema dele) em todo lugar que só
*lê* o conteúdo — desnecessariamente pesado para a visualização somente-
leitura no perfil do paciente e para o gerador de PDF, sem ganho real já
que não há consultas estruturadas sobre o conteúdo.

### Detecção de conteúdo legado

Helper compartilhado `src/lib/rich-text.ts`:

```ts
export function isRichTextHtml(content: string): boolean {
  return /^\s*<[a-z][\s\S]*>/i.test(content);
}
```

Usado nos três pontos abaixo para decidir entre o caminho "legado" (texto
puro, comportamento idêntico ao atual) e o caminho "HTML" (novo).

### Componente de edição — `src/components/RichTextEditor.tsx`

Componente controlado: `{ value: string; onChange: (html: string) => void;
placeholder?: string }`.

- `@tiptap/react` + `useEditor` com extensões restritas: `Bold`, `Italic`,
  `Underline` (`@tiptap/extension-underline`, não incluída no StarterKit),
  `Heading` (limitado a `level: 3`), `BulletList`, `OrderedList`,
  `Paragraph`, `Text`, `Document`, `History`. Sem blockquote, code block,
  hr, imagem, tabela — fora de escopo.
- Toolbar própria acima da área editável: botões Negrito / Itálico /
  Sublinhado / Título / Lista / Lista numerada (ícones `lucide-react`:
  `Bold`, `Italic`, `Underline`, `Heading3`, `List`, `ListOrdered`),
  estado ativo via `editor.isActive(...)`.
- Estilo visual equivalente ao `Textarea` atual (borda, `rounded-lg`,
  `bg-card`, mesma altura mínima) para não alterar o layout do formulário.
- Ao inicializar com `value` legado (texto puro), converte via
  `toEditableHtml()` (mesmo arquivo `rich-text.ts`): se `!isRichTextHtml`,
  escapa o texto e transforma quebras de linha em `<p>`/`<br>`, preservando
  a formatação visual original dentro do editor.

### `FreeTextMealPlanEditor.tsx`

Troca o `<Textarea>` do campo "Plano Alimentar" (linhas 190-195) por
`<RichTextEditor value={freeTextContent} onChange={setFreeTextContent} />`.
Nenhuma outra mudança — o dirty-check (`hasUnsavedChanges`) e o fluxo de
save já operam sobre string e continuam funcionando sem alteração.

### Leitura — `PatientProfile.tsx:1803` (visualização pelo nutricionista)

Novo componente `src/components/RichTextViewer.tsx`:

```ts
{ html?: string | null }
```

- Legado (`!isRichTextHtml`) → `<pre className="whitespace-pre-wrap font-sans">`,
  idêntico ao comportamento atual — zero regressão visual em planos
  antigos.
- HTML → sanitiza com `DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p','br',
  'strong','em','u','h3','ul','ol','li'] })` e renderiza via
  `dangerouslySetInnerHTML`, com classes Tailwind aplicadas via seletor de
  filho (`[&_strong]:font-semibold [&_u]:underline [&_h3]:text-base
  [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal
  [&_ol]:pl-5`) já que o projeto não tem `@tailwindcss/typography`.

`PatientProfile.tsx:1803` passa a chamar
`<RichTextViewer html={selectedMealPlan?.freeTextContent} />` no lugar da
interpolação direta.

### Leitura — `src/lib/meal-plan-pdf.ts` (PDF, impressão e download do paciente)

O bloco atual (linhas 82-102) que usa `doc.splitTextToSize` + loop manual é
extraído para uma função:

```ts
function renderFreeTextToPdf(
  doc: jsPDF,
  content: string,
  startY: number,
  x: number,
  maxWidth: number
): number // retorna o novo currentY
```

- Legado → mantém exatamente a lógica atual (mesmo loop, mesma quebra de
  página quando `currentY > pageHeight - 20`). Zero mudança de output para
  PDFs de planos antigos.
- HTML → sanitiza com DOMPurify (mesmo allowlist), faz parse com
  `DOMParser` (API de browser, disponível — este arquivo já roda no
  client) e percorre os nós filho:
  - texto dentro de `<strong>` → `doc.setFont('helvetica', 'bold')` só
    naquele trecho, revertendo para `normal` fora dele.
  - `<u>` → jsPDF não tem underline nativo em texto corrido; desenha uma
    linha manual (`doc.line`) sob o trecho, usando `doc.getTextWidth`
    para medir onde ela termina.
  - `<h3>` → negrito + `doc.setFontSize` um ponto maior, sempre em linha
    própria.
  - `<ul>/<ol> > <li>` → prefixo `•` (ou `1.`, `2.`...) com indentação de
    ~4mm em `x`.
  - Parágrafos (`<p>`) → mesma técnica de `splitTextToSize` por trecho,
    reaproveitando a lógica de quebra de página já existente.

`generateMealPlanPDF` continua **síncrona** — não usa `doc.html()` /
html2canvas, então o cabeçalho, dados do paciente e planos estruturados
(tipo diferente de `'free'`) não são tocados.

### Sem mudanças

`CopyMealPlanModal.tsx`, `MealPlanEdit.tsx`,
`src/server/services/meal-plans.service.ts`, `src/types.ts` — todos tratam
`freeTextContent` como `string | null` opaco, sem interpretar o conteúdo.
Nenhuma mudança de tipo ou de contrato de API.

## Dependências novas

- `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`,
  `@tiptap/extension-underline` — editor.
- `dompurify` + `@types/dompurify` — sanitização (usada tanto no
  `RichTextViewer` quanto no `renderFreeTextToPdf`).

## Implementação

1. `src/lib/rich-text.ts` — `isRichTextHtml()`, `toEditableHtml()`.
2. `src/components/RichTextEditor.tsx` — editor + toolbar.
3. `src/components/RichTextViewer.tsx` — visualização somente-leitura.
4. `src/components/FreeTextMealPlanEditor.tsx` — troca do `Textarea` pelo
   `RichTextEditor` no campo "Plano Alimentar".
5. `src/pages/PatientProfile.tsx:1803` — troca pela `RichTextViewer`.
6. `src/lib/meal-plan-pdf.ts` — extração do bloco de texto livre para
   `renderFreeTextToPdf()`, com os dois caminhos (legado/HTML).

## Testes

Unitários (Vitest) para as funções puras, sem mock de UI do Tiptap (lib de
terceiros já testada):

- `isRichTextHtml()` / `toEditableHtml()` — casos: texto puro com quebras
  de linha, texto já em HTML, string vazia.
- `renderFreeTextToPdf()` — mock de `jsPDF` (`setFont`, `text`, `line`,
  `getTextWidth`, `splitTextToSize`, `addPage`) verificando que:
  - conteúdo legado aciona o mesmo caminho de hoje (sem chamadas de
    parsing HTML).
  - `<strong>` aciona `setFont('helvetica', 'bold')` só no trecho correto.
  - `<li>` gera prefixo de marcador/numeração.
  - quebra de página ainda ocorre quando o conteúdo excede
    `pageHeight - 20`.

Manual no navegador (dev server):

- Criar plano livre novo, usar negrito/itálico/sublinhado/título/lista,
  salvar, reabrir → formatação preservada.
- Abrir um plano livre já existente (texto puro, salvo antes desta
  mudança) → aparece no editor com as quebras de linha originais,
  editável.
- Visualizar esse mesmo plano antigo na tela do nutricionista
  (`PatientProfile.tsx`) sem reabrir no editor → aparece exatamente como
  antes (via caminho legado).
- Gerar PDF (botão imprimir) de um plano com formatação nova → negrito,
  sublinhado, título e listas aparecem corretamente no PDF.
- Gerar PDF de um plano antigo (texto puro) → PDF idêntico ao gerado antes
  desta mudança.
- Paciente baixa o PDF pelo portal (`PatientAccess.tsx`) → mesmo resultado
  do botão de imprimir do nutricionista.
