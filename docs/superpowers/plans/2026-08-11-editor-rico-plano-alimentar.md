# Editor de Texto Rico no Plano Alimentar Livre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir negrito, itálico, sublinhado, título e listas (marcador/numerada) no campo "Plano Alimentar" do modo livre, mantendo compatibilidade total com os planos já salvos como texto puro.

**Architecture:** `freeTextContent` passa a guardar HTML (saída do Tiptap) em vez de texto puro, sem mudança de schema. Um helper puro (`isRichTextHtml`) decide, em cada ponto de leitura, entre o caminho legado (texto puro, comportamento idêntico ao atual) e o caminho novo (HTML sanitizado). Três pontos consomem `freeTextContent`: o editor (`FreeTextMealPlanEditor`), a visualização do nutricionista (`PatientProfile`) e o gerador de PDF (`meal-plan-pdf.ts`) — cada um ganha sua própria lógica de renderização HTML, sem afetar os outros dois.

**Tech Stack:** React 19, Tiptap 3 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-underline`), DOMPurify 3, jsPDF (já em uso), Vitest.

## Global Constraints

- Escopo é só o campo "Plano Alimentar" (`freeTextContent`). O campo "Orientações Gerais" (`generalInstructions`) continua textarea simples — não tocar.
- Nenhuma migração de banco. `freeTextContent` continua `string | null` na coluna Prisma existente.
- Planos antigos (texto puro, sem tags HTML) devem renderizar **exatamente igual a hoje** em todos os três pontos de leitura, até serem reabertos e salvos no novo editor.
- `generateMealPlanPDF` (`src/lib/meal-plan-pdf.ts`) continua **síncrona** — nada de `doc.html()`/html2canvas.
- Tags HTML permitidas em todo o sistema (editor, visualização, PDF): `p, br, strong, em, u, h3, ul, ol, li`. Nenhuma outra tag (sem imagem, tabela, link, code block, blockquote).
- Sanitizar com DOMPurify em todo ponto que renderiza HTML vindo do banco (`RichTextViewer` e `renderFreeTextToPdf`) — nunca confiar em `freeTextContent` como HTML seguro sem sanitização.

---

### Task 1: Instalar dependências

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm install)

- [ ] **Step 1: Instalar Tiptap e DOMPurify**

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline dompurify
```

`dompurify` 3.x já inclui seus próprios tipos TypeScript (`dist/purify.cjs.d.ts`) — não instalar `@types/dompurify`.

- [ ] **Step 2: Verificar instalação**

Run: `npm run lint`
Expected: PASS (nenhuma mudança de código ainda, só valida que a instalação não quebrou a resolução de tipos existente)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: adiciona Tiptap e DOMPurify para editor de texto rico"
```

---

### Task 2: Helpers de detecção e conversão de conteúdo legado

**Files:**
- Create: `src/lib/rich-text.ts`
- Test: `src/tests/lib/rich-text.test.ts`

**Interfaces:**
- Produces: `isRichTextHtml(content: string): boolean`, `toEditableHtml(content: string): string` — usados pelas Tasks 3, 4 e 7.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `src/tests/lib/rich-text.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isRichTextHtml, toEditableHtml } from '../../lib/rich-text.ts';

describe('isRichTextHtml', () => {
  it('retorna false para texto puro', () => {
    expect(isRichTextHtml('Café da manhã: ovos e pão')).toBe(false);
  });

  it('retorna false para string vazia', () => {
    expect(isRichTextHtml('')).toBe(false);
  });

  it('retorna true para conteúdo HTML', () => {
    expect(isRichTextHtml('<p>Café da manhã</p>')).toBe(true);
  });

  it('retorna true mesmo com espaços em branco antes da tag', () => {
    expect(isRichTextHtml('   <p>Almoço</p>')).toBe(true);
  });
});

describe('toEditableHtml', () => {
  it('mantém HTML existente inalterado', () => {
    const html = '<p>Café da manhã</p><ul><li>Ovos</li></ul>';
    expect(toEditableHtml(html)).toBe(html);
  });

  it('converte texto puro de uma linha em um parágrafo', () => {
    expect(toEditableHtml('Café da manhã: ovos')).toBe('<p>Café da manhã: ovos</p>');
  });

  it('converte múltiplas linhas em parágrafos separados', () => {
    expect(toEditableHtml('Café da manhã\nAlmoço')).toBe('<p>Café da manhã</p><p>Almoço</p>');
  });

  it('escapa caracteres HTML especiais do texto legado', () => {
    expect(toEditableHtml('Menos de 5g < 10g')).toBe('<p>Menos de 5g &lt; 10g</p>');
  });

  it('retorna string vazia para conteúdo vazio', () => {
    expect(toEditableHtml('')).toBe('');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/tests/lib/rich-text.test.ts`
Expected: FAIL com "Failed to resolve import "../../lib/rich-text.ts"" (o arquivo ainda não existe)

- [ ] **Step 3: Implementar `src/lib/rich-text.ts`**

```ts
export function isRichTextHtml(content: string): boolean {
  return /^\s*<[a-z][\s\S]*>/i.test(content);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function toEditableHtml(content: string): string {
  if (!content) return '';
  if (isRichTextHtml(content)) return content;

  return content
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/tests/lib/rich-text.test.ts`
Expected: PASS (9 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/rich-text.ts src/tests/lib/rich-text.test.ts
git commit -m "feat: helpers de detecção/conversão de conteúdo legado do plano alimentar livre"
```

---

### Task 3: Componente `RichTextEditor`

**Files:**
- Create: `src/components/RichTextEditor.tsx`

**Interfaces:**
- Consumes: `toEditableHtml` de `../lib/rich-text` (Task 2); `cn` de `../lib/utils`; `Button` de `./ui/button`.
- Produces: `RichTextEditor({ value: string; onChange: (html: string) => void; className?: string })` — usado pela Task 5.

Sem testes automatizados aqui: Tiptap é biblioteca de terceiros já testada, e testar a interação de toolbar exigiria montar o editor completo em jsdom por baixo valor de sinal (decisão já validada na spec). A verificação é `npm run lint` (Step 2) e a checagem manual da Task 8.

- [ ] **Step 1: Criar `src/components/RichTextEditor.tsx`**

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, Underline as UnderlineIcon, Heading3, List, ListOrdered } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { toEditableHtml } from '../lib/rich-text';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
}

export function RichTextEditor({ value, onChange, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
    ],
    content: toEditableHtml(value),
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          'min-h-[380px] px-3 py-3 text-sm leading-relaxed focus:outline-none ' +
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ' +
          '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2',
      },
    },
  });

  if (!editor) return null;

  const toolbarButtons: Array<{
    icon: typeof Bold;
    label: string;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      icon: Bold,
      label: 'Negrito',
      active: editor.isActive('bold'),
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      label: 'Itálico',
      active: editor.isActive('italic'),
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      icon: UnderlineIcon,
      label: 'Sublinhado',
      active: editor.isActive('underline'),
      onClick: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      icon: Heading3,
      label: 'Título',
      active: editor.isActive('heading', { level: 3 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      icon: List,
      label: 'Lista',
      active: editor.isActive('bulletList'),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      label: 'Lista numerada',
      active: editor.isActive('orderedList'),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ];

  return (
    <div className={cn('rounded-lg border border-border bg-card overflow-hidden', className)}>
      <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
        {toolbarButtons.map(({ icon: Icon, label, active, onClick }) => (
          <Button
            key={label}
            type="button"
            variant="ghost"
            size="icon-sm"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={onClick}
            className={cn(active && 'bg-primary/10 text-primary')}
          >
            <Icon className="w-3.5 h-3.5" />
          </Button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
```

`content: toEditableHtml(value)` é usado só como valor **inicial** do Tiptap — o editor não fica re-sincronizando com a prop `value` a cada render (isso evitaria o cursor pular durante a digitação). Isso é seguro aqui porque `value` só muda como resultado do próprio `onChange` deste componente (ver Task 5); não há outro setter de `freeTextContent` no `FreeTextMealPlanEditor`.

- [ ] **Step 2: Verificar tipos**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/RichTextEditor.tsx
git commit -m "feat: componente RichTextEditor (Tiptap) para o plano alimentar livre"
```

---

### Task 4: Componente `RichTextViewer`

**Files:**
- Create: `src/components/RichTextViewer.tsx`

**Interfaces:**
- Consumes: `isRichTextHtml` de `../lib/rich-text` (Task 2); `cn` de `../lib/utils`; `dompurify`.
- Produces: `RichTextViewer({ html?: string | null; emptyFallback?: string; className?: string })` — usado pela Task 6.

- [ ] **Step 1: Criar `src/components/RichTextViewer.tsx`**

```tsx
import DOMPurify from 'dompurify';
import { cn } from '../lib/utils';
import { isRichTextHtml } from '../lib/rich-text';

export interface RichTextViewerProps {
  html?: string | null;
  emptyFallback?: string;
  className?: string;
}

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'h3', 'ul', 'ol', 'li'];

export function RichTextViewer({ html, emptyFallback = '', className }: RichTextViewerProps) {
  const content = html?.trim();

  if (!content) {
    return <div className={cn('text-sm text-foreground leading-relaxed', className)}>{emptyFallback}</div>;
  }

  if (!isRichTextHtml(content)) {
    return (
      <div className={cn('text-sm text-foreground leading-relaxed whitespace-pre-wrap', className)}>
        {content}
      </div>
    );
  }

  const sanitized = DOMPurify.sanitize(content, { ALLOWED_TAGS });

  return (
    <div
      className={cn(
        'text-sm text-foreground leading-relaxed ' +
          '[&_strong]:font-semibold [&_u]:underline ' +
          '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 ' +
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/RichTextViewer.tsx
git commit -m "feat: componente RichTextViewer para exibir HTML sanitizado do plano alimentar"
```

---

### Task 5: Integrar `RichTextEditor` no `FreeTextMealPlanEditor`

**Files:**
- Modify: `src/components/FreeTextMealPlanEditor.tsx`

**Interfaces:**
- Consumes: `RichTextEditor` (Task 3).

- [ ] **Step 1: Adicionar o import**

Em `src/components/FreeTextMealPlanEditor.tsx`, logo após a linha 6 (`import { Textarea } from './ui/textarea';`), adicionar:

```tsx
import { RichTextEditor } from './RichTextEditor';
```

- [ ] **Step 2: Trocar o Textarea do campo "Plano Alimentar"**

Substituir o bloco (linhas 188-196):

```tsx
          <div className="bg-card rounded-xl p-4 border border-border space-y-2">
            <Label className="text-xs font-medium text-muted-foreground ml-1">Plano Alimentar (cole aqui)</Label>
            <Textarea
              placeholder="Cole aqui o plano alimentar completo..."
              className="min-h-[420px] rounded-lg border border-border bg-card resize-y text-sm leading-relaxed p-3 font-mono"
              value={freeTextContent}
              onChange={(e) => setFreeTextContent(e.target.value)}
            />
          </div>
```

por:

```tsx
          <div className="bg-card rounded-xl p-4 border border-border space-y-2">
            <Label className="text-xs font-medium text-muted-foreground ml-1">Plano Alimentar (cole aqui)</Label>
            <RichTextEditor value={freeTextContent} onChange={setFreeTextContent} />
          </div>
```

O resto do arquivo (dirty-check, save, confirmação de saída) não muda — `freeTextContent` continua uma `string` comum.

- [ ] **Step 3: Verificar tipos e suíte de testes existente**

Run: `npm run lint && npm run test`
Expected: PASS (nenhum teste existente depende do Textarea removido)

- [ ] **Step 4: Commit**

```bash
git add src/components/FreeTextMealPlanEditor.tsx
git commit -m "feat: usa RichTextEditor no campo Plano Alimentar do modo livre"
```

---

### Task 6: Integrar `RichTextViewer` na visualização do nutricionista

**Files:**
- Modify: `src/pages/PatientProfile.tsx`

**Interfaces:**
- Consumes: `RichTextViewer` (Task 4).

- [ ] **Step 1: Adicionar o import**

Em `src/pages/PatientProfile.tsx`, logo após a linha 57 (`import { PremiumFeature } from '../components/PremiumFeature';`), adicionar:

```tsx
import { RichTextViewer } from '../components/RichTextViewer';
```

- [ ] **Step 2: Trocar a interpolação direta pelo `RichTextViewer`**

Substituir (linhas 1800-1805):

```tsx
                    <Card className="border-none shadow-sm bg-card overflow-hidden p-6 space-y-3">
                      <h4 className="font-medium text-xs text-primary">Plano Alimentar</h4>
                      <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-mono">
                        {selectedMealPlan?.freeTextContent || 'Nenhum conteúdo cadastrado.'}
                      </div>
                    </Card>
```

por:

```tsx
                    <Card className="border-none shadow-sm bg-card overflow-hidden p-6 space-y-3">
                      <h4 className="font-medium text-xs text-primary">Plano Alimentar</h4>
                      <RichTextViewer
                        html={selectedMealPlan?.freeTextContent}
                        emptyFallback="Nenhum conteúdo cadastrado."
                      />
                    </Card>
```

- [ ] **Step 3: Verificar tipos e suíte de testes existente**

Run: `npm run lint && npm run test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/PatientProfile.tsx
git commit -m "feat: usa RichTextViewer na visualização do plano alimentar livre"
```

---

### Task 7: Renderizar HTML formatado no PDF (`meal-plan-pdf.ts`)

**Files:**
- Modify: `src/lib/meal-plan-pdf.ts`
- Test: `src/tests/lib/meal-plan-pdf.test.ts`

**Interfaces:**
- Consumes: `isRichTextHtml` de `./rich-text` (Task 2), `dompurify`.
- Produces: `export function renderFreeTextToPdf(doc: jsPDF, content: string, startY: number, x: number, maxWidth: number): number` (retorna o novo `currentY`).

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `src/tests/lib/meal-plan-pdf.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import jsPDF from 'jspdf';
import { renderFreeTextToPdf } from '../../lib/meal-plan-pdf.ts';

describe('renderFreeTextToPdf', () => {
  it('conteúdo legado (texto puro) usa o caminho de texto simples, sem negrito/itálico', () => {
    const doc = new jsPDF();
    const setFontSpy = vi.spyOn(doc, 'setFont');

    const result = renderFreeTextToPdf(
      doc,
      'Café da manhã: ovos e pão\nAlmoço: arroz e feijão',
      100,
      14,
      180
    );

    expect(result).toBeGreaterThan(100);
    expect(setFontSpy.mock.calls.every(([, style]) => style === 'normal')).toBe(true);
  });

  it('<strong> aciona negrito só no trecho correto', () => {
    const doc = new jsPDF();
    const calls: Array<{ text: string; style: string }> = [];
    const originalText = doc.text.bind(doc);
    vi.spyOn(doc, 'text').mockImplementation((text: any, x: any, y: any, opts?: any) => {
      calls.push({ text: String(text), style: doc.getFont().fontStyle });
      return originalText(text, x, y, opts);
    });

    renderFreeTextToPdf(doc, '<p>Coma <strong>ovos</strong> no café</p>', 100, 14, 180);

    expect(calls.find((c) => c.text === 'ovos')?.style).toBe('bold');
    expect(calls.find((c) => c.text === 'Coma')?.style).toBe('normal');
  });

  it('<u> desenha uma linha sob o trecho sublinhado', () => {
    const doc = new jsPDF();
    const lineSpy = vi.spyOn(doc, 'line');

    renderFreeTextToPdf(doc, '<p><u>importante</u></p>', 100, 14, 180);

    expect(lineSpy).toHaveBeenCalled();
  });

  it('<li> gera prefixo de marcador (lista simples) e numeração (lista numerada)', () => {
    const bulletDoc = new jsPDF();
    const bulletTexts = vi.spyOn(bulletDoc, 'text').mock;
    renderFreeTextToPdf(bulletDoc, '<ul><li>Arroz</li><li>Feijão</li></ul>', 100, 14, 180);
    expect(bulletTexts.calls.map((c) => String(c[0]))).toContain('•');

    const orderedDoc = new jsPDF();
    const orderedTexts = vi.spyOn(orderedDoc, 'text').mock;
    renderFreeTextToPdf(orderedDoc, '<ol><li>Arroz</li><li>Feijão</li></ol>', 100, 14, 180);
    const texts = orderedTexts.calls.map((c) => String(c[0]));
    expect(texts).toContain('1.');
    expect(texts).toContain('2.');
  });

  it('quebra de página quando o conteúdo excede o espaço restante', () => {
    const doc = new jsPDF();
    const initialPages = doc.getNumberOfPages();
    const longText = Array.from(
      { length: 40 },
      (_, i) => `Linha ${i + 1} do plano alimentar com bastante texto para forçar a quebra de página.`
    ).join(' ');

    renderFreeTextToPdf(doc, longText, 280, 14, 180);

    expect(doc.getNumberOfPages()).toBeGreaterThan(initialPages);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/tests/lib/meal-plan-pdf.test.ts`
Expected: FAIL com `"renderFreeTextToPdf" is not exported by "src/lib/meal-plan-pdf.ts"` (ou erro equivalente de import)

- [ ] **Step 3: Implementar `renderFreeTextToPdf` em `src/lib/meal-plan-pdf.ts`**

Adicionar o import no topo do arquivo (após a linha 4, `import { MealPlan, MealPlanItem, Nutritionist } from '../types';`):

```ts
import DOMPurify from 'dompurify';
import { isRichTextHtml } from './rich-text';
```

Adicionar, entre o `type ReceitaVinculada` (linha 13) e `export function generateMealPlanPDF` (linha 15), a nova função exportada:

```ts
interface StyledToken {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

function fontStyleFor(bold: boolean, italic: boolean): 'normal' | 'bold' | 'italic' | 'bolditalic' {
  if (bold && italic) return 'bolditalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

function collectTokens(
  node: Node,
  bold: boolean,
  italic: boolean,
  underline: boolean,
  tokens: StyledToken[]
): void {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      (child.textContent || '')
        .split(/\s+/)
        .filter(Boolean)
        .forEach((word) => tokens.push({ text: word, bold, italic, underline }));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const el = child as HTMLElement;
    switch (el.tagName.toLowerCase()) {
      case 'strong':
        collectTokens(el, true, italic, underline, tokens);
        break;
      case 'em':
        collectTokens(el, bold, true, underline, tokens);
        break;
      case 'u':
        collectTokens(el, bold, italic, true, tokens);
        break;
      default:
        collectTokens(el, bold, italic, underline, tokens);
    }
  });
}

/**
 * Exportada apenas para testes (src/tests/lib/meal-plan-pdf.test.ts).
 */
export function renderFreeTextToPdf(
  doc: jsPDF,
  content: string,
  startY: number,
  x: number,
  maxWidth: number
): number {
  let currentY = startY;
  const lineHeight = 5;

  const ensureSpace = (needed = lineHeight) => {
    if (currentY + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      currentY = 20;
    }
  };

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  if (!isRichTextHtml(content)) {
    const splitFreeText = doc.splitTextToSize(content || '', maxWidth);
    for (const linha of splitFreeText) {
      ensureSpace();
      doc.text(linha, x, currentY);
      currentY += lineHeight;
    }
    return currentY;
  }

  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h3', 'ul', 'ol', 'li'],
  });
  const dom = new DOMParser().parseFromString(sanitized, 'text/html');

  const renderTokens = (tokens: StyledToken[], startX: number, width: number) => {
    if (tokens.length === 0) return;

    const spaceWidth = doc.getTextWidth(' ');
    let cursorX = startX;
    ensureSpace(lineHeight);

    tokens.forEach((token) => {
      doc.setFont('helvetica', fontStyleFor(token.bold, token.italic));
      const wordWidth = doc.getTextWidth(token.text);

      if (cursorX !== startX && cursorX + wordWidth > startX + width) {
        currentY += lineHeight;
        ensureSpace(lineHeight);
        cursorX = startX;
      }

      doc.text(token.text, cursorX, currentY);
      if (token.underline) {
        doc.line(cursorX, currentY + 0.5, cursorX + wordWidth, currentY + 0.5);
      }
      cursorX += wordWidth + spaceWidth;
    });

    doc.setFont('helvetica', 'normal');
    currentY += lineHeight;
  };

  dom.body.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;

    switch (el.tagName.toLowerCase()) {
      case 'h3': {
        const tokens: StyledToken[] = [];
        collectTokens(el, true, false, false, tokens);
        ensureSpace(lineHeight + 2);
        currentY += 2;
        doc.setFontSize(11);
        renderTokens(tokens, x, maxWidth);
        doc.setFontSize(10);
        currentY += 2;
        break;
      }
      case 'p': {
        const tokens: StyledToken[] = [];
        collectTokens(el, false, false, false, tokens);
        renderTokens(tokens, x, maxWidth);
        currentY += 2;
        break;
      }
      case 'ul':
      case 'ol': {
        let counter = 0;
        el.childNodes.forEach((liNode) => {
          if (liNode.nodeType !== Node.ELEMENT_NODE) return;
          const li = liNode as HTMLElement;
          if (li.tagName.toLowerCase() !== 'li') return;

          counter += 1;
          const marker = el.tagName.toLowerCase() === 'ol' ? `${counter}.` : '•';
          const tokens: StyledToken[] = [{ text: marker, bold: false, italic: false, underline: false }];
          collectTokens(li, false, false, false, tokens);
          renderTokens(tokens, x + 4, maxWidth - 4);
        });
        currentY += 2;
        break;
      }
      default:
        break;
    }
  });

  return currentY;
}
```

Trocar o bloco do modo livre (linhas 82-102, dentro de `generateMealPlanPDF`):

```ts
  if (plan.type === 'free') {
    // Modo Livre: renderiza o texto colado como texto corrido, sem tabelas por bloco
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PLANO ALIMENTAR', 14, currentY);
    doc.line(14, currentY + 2, pageWidth - 14, currentY + 2);
    currentY += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const splitFreeText = doc.splitTextToSize(plan.freeTextContent || '', pageWidth - 28);
    for (const linha of splitFreeText) {
      if (currentY > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        currentY = 20;
      }
      doc.text(linha, 14, currentY);
      currentY += 5;
    }
    currentY += 10;
  } else {
```

por:

```ts
  if (plan.type === 'free') {
    // Modo Livre: renderiza o texto colado como texto corrido, sem tabelas por bloco
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PLANO ALIMENTAR', 14, currentY);
    doc.line(14, currentY + 2, pageWidth - 14, currentY + 2);
    currentY += 10;

    currentY = renderFreeTextToPdf(doc, plan.freeTextContent || '', currentY, 14, pageWidth - 28);
    currentY += 10;
  } else {
```

O restante da função (`generateMealPlanPDF`) não muda.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/tests/lib/meal-plan-pdf.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Rodar tipos e suíte completa**

Run: `npm run lint && npm run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/meal-plan-pdf.ts src/tests/lib/meal-plan-pdf.test.ts
git commit -m "feat: renderiza negrito/itálico/sublinhado/títulos/listas no PDF do plano alimentar livre"
```

---

### Task 8: Verificação manual no navegador

Sem mudanças de código nesta task — é o checklist final de QA manual (mudança de UI, per `CLAUDE.md`).

- [ ] **Step 1: Iniciar o servidor de desenvolvimento**

Run: `npm run dev`

- [ ] **Step 2: Criar um plano livre novo com formatação**

Abrir um paciente → Novo Plano Alimentar → modo Livre. No campo "Plano Alimentar", usar a toolbar para aplicar negrito, itálico, sublinhado, um título e uma lista com marcadores. Salvar.

Esperado: ao reabrir o plano, a formatação aparece preservada no editor.

- [ ] **Step 3: Verificar plano antigo (texto puro) no editor**

Abrir um plano livre criado antes desta mudança (texto puro, sem formatação).

Esperado: abre no editor com as quebras de linha originais preservadas, editável.

- [ ] **Step 4: Verificar plano antigo na visualização do nutricionista**

Na tela do paciente, visualizar esse mesmo plano antigo **sem** reabri-lo no editor.

Esperado: aparece exatamente como antes desta mudança (texto simples com `whitespace-pre-wrap`).

- [ ] **Step 5: Gerar PDF de um plano com formatação nova**

Clicar em "Imprimir"/baixar PDF do plano criado no Step 2.

Esperado: negrito, itálico, sublinhado, título e lista de marcadores aparecem corretamente no PDF, sem sobreposição de texto e com quebra de página funcionando se o conteúdo for longo.

- [ ] **Step 6: Gerar PDF de um plano antigo (texto puro)**

Esperado: PDF idêntico ao gerado antes desta mudança.

- [ ] **Step 7: Conferir download do PDF pelo portal do paciente**

Acessar o link do portal do paciente (`PatientAccess.tsx`) e baixar o mesmo plano do Step 2.

Esperado: mesmo resultado do Step 5 (usa a mesma `generateMealPlanPDF`).
