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

  it('caminho legado (texto puro) quebra de página exatamente como o algoritmo antigo (currentY > pageHeight - 20)', () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, 'text');

    const startY = 100;
    const maxWidth = 180;
    const lineHeight = 5;
    const pageHeight = doc.internal.pageSize.getHeight();
    // Linhas curtas separadas por \n (cada uma cabe sozinha em maxWidth) para garantir
    // exatamente 60 linhas após o splitTextToSize, sem depender de wrap automático —
    // isso é necessário para realmente atravessar o ponto de quebra de página (índice 35)
    // e expor a divergência entre "currentY > pageHeight - 20" (antigo) e
    // "currentY + lineHeight > pageHeight - 20" (o bug do ensureSpace()).
    const longText = Array.from({ length: 60 }, (_, i) => `Linha ${i + 1}`).join('\n');

    // Simula, no próprio teste, a lógica do código antigo (pré-Task 7) para
    // calcular o Y esperado de cada linha: quebra de página apenas quando
    // currentY > pageHeight - 20 (não pageHeight - 25, como o ensureSpace() genérico faria).
    // Precisa fixar a mesma fonte/tamanho que renderFreeTextToPdf usa internamente,
    // pois splitTextToSize depende do tamanho de fonte atual do doc.
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const splitFreeText = doc.splitTextToSize(longText, maxWidth);
    let expectedY = startY;
    const expectedYs: number[] = [];
    for (let i = 0; i < splitFreeText.length; i++) {
      if (expectedY > pageHeight - 20) {
        expectedY = 20;
      }
      expectedYs.push(expectedY);
      expectedY += lineHeight;
    }

    renderFreeTextToPdf(doc, longText, startY, 14, maxWidth);

    const actualYs = textSpy.mock.calls.map((c) => c[2]);
    expect(actualYs).toEqual(expectedYs);
  });

  it('<br> força quebra de linha sem imprimir texto vazio', () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, 'text');

    renderFreeTextToPdf(doc, '<p>Primeiro<br>Segundo</p>', 100, 14, 180);

    const calls = textSpy.mock.calls.map((c) => ({ text: String(c[0]), y: c[2] as number }));
    const primeiro = calls.find((c) => c.text === 'Primeiro');
    const segundo = calls.find((c) => c.text === 'Segundo');

    expect(primeiro).toBeDefined();
    expect(segundo).toBeDefined();
    expect(segundo!.y).toBeGreaterThan(primeiro!.y);
    expect(calls.some((c) => c.text === '')).toBe(false);
  });

  it('texto órfão diretamente no body (sem tag envolvente) não é descartado', () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, 'text');

    // DOMPurify com ALLOWED_TAGS restrito remove <div> mas preserva o texto,
    // promovendo-o para o body como text node órfão.
    renderFreeTextToPdf(doc, '<div>Texto sem tag permitida</div>', 100, 14, 180);

    const texts = textSpy.mock.calls.map((c) => String(c[0]));
    expect(texts).toContain('Texto');
    expect(texts).toContain('sem');
  });

  it('parágrafo vazio (<p></p>) entre dois parágrafos preserva a linha em branco no PDF', () => {
    // Reproduz o Enter-duas-vezes do editor: <p>A</p><p></p><p>B</p>. Sem o fix, um <p>
    // vazio não gera tokens e renderTokens() não avança currentY (early return), então a
    // linha em branco que o nutricionista viu no editor some no PDF.
    const comLinhaEmBranco = new jsPDF();
    const yComLinhaEmBranco = renderFreeTextToPdf(comLinhaEmBranco, '<p>A</p><p></p><p>B</p>', 100, 14, 180);

    const semLinhaEmBranco = new jsPDF();
    const ySemLinhaEmBranco = renderFreeTextToPdf(semLinhaEmBranco, '<p>A</p><p>B</p>', 100, 14, 180);

    // O parágrafo vazio deve contribuir com pelo menos um lineHeight (5) a mais de altura.
    expect(yComLinhaEmBranco).toBeGreaterThanOrEqual(ySemLinhaEmBranco + 5);
  });

  it('não insere espaço espúrio entre uma tag inline e pontuação colada na origem (ex.: rótulo em negrito seguido de ":")', () => {
    const doc = new jsPDF();
    const calls: Array<{ text: string; x: number }> = [];
    const originalText = doc.text.bind(doc);
    vi.spyOn(doc, 'text').mockImplementation((text: any, x: any, y: any, opts?: any) => {
      calls.push({ text: String(text), x: Number(x) });
      return originalText(text, x, y, opts);
    });

    renderFreeTextToPdf(doc, '<p><strong>Café da manhã</strong>: ovos</p>', 100, 14, 180);

    const manha = calls.find((c) => c.text === 'manhã');
    const colon = calls.find((c) => c.text === ':');
    const ovos = calls.find((c) => c.text === 'ovos');
    expect(manha).toBeDefined();
    expect(colon).toBeDefined();
    expect(ovos).toBeDefined();

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const manhaWidth = doc.getTextWidth('manhã');

    // ":" deve colar imediatamente após "manhã" — sem <strong>...</strong> e ": ovos" não
    // havia whitespace na origem entre eles, então não pode haver espaço no PDF.
    expect(colon!.x).toBeCloseTo(manha!.x + manhaWidth, 2);

    doc.setFont('helvetica', 'normal');
    const colonWidth = doc.getTextWidth(':');
    const spaceWidth = doc.getTextWidth(' ');

    // "ovos" tem um espaço real na origem (": ovos") e deve manter esse espaço no PDF.
    expect(ovos!.x).toBeCloseTo(colon!.x + colonWidth + spaceWidth, 2);
  });

  it('lista aninhada dentro de <li> gera linhas separadas com marcador próprio, sem concatenar na linha do item pai', () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, 'text');

    renderFreeTextToPdf(
      doc,
      '<ul><li>Almoço<ul><li>Arroz</li><li>Feijão</li></ul></li><li>Jantar</li></ul>',
      100,
      14,
      180
    );

    const calls = textSpy.mock.calls.map((c) => ({ text: String(c[0]), x: c[1] as number, y: c[2] as number }));

    const almoco = calls.find((c) => c.text === 'Almoço');
    const arroz = calls.find((c) => c.text === 'Arroz');
    const feijao = calls.find((c) => c.text === 'Feijão');
    const jantar = calls.find((c) => c.text === 'Jantar');
    expect(almoco).toBeDefined();
    expect(arroz).toBeDefined();
    expect(feijao).toBeDefined();
    expect(jantar).toBeDefined();

    // 4 itens em 4 linhas (Y) distintas — "Arroz"/"Feijão" não podem ter sido
    // concatenados na mesma linha (mesmo Y) do item pai "Almoço".
    const ys = new Set([almoco!.y, arroz!.y, feijao!.y, jantar!.y]);
    expect(ys.size).toBe(4);

    // A sublista deve estar mais indentada que o item pai; "Jantar" (nível raiz, depois
    // da sublista) volta à indentação original de "Almoço".
    expect(arroz!.x).toBeGreaterThan(almoco!.x);
    expect(feijao!.x).toBeGreaterThan(almoco!.x);
    expect(jantar!.x).toBe(almoco!.x);

    // Um marcador "•" por item (Almoço, Arroz, Feijão, Jantar) — nenhum item perde seu
    // marcador próprio ao entrar na recursão da sublista.
    const bulletCount = textSpy.mock.calls.filter((c) => String(c[0]) === '•').length;
    expect(bulletCount).toBe(4);
  });

  it('palavra única maior que a largura disponível quebra em várias linhas (splitTextToSize), sem vazar da margem', () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, 'text');

    const longWord = 'a'.repeat(150); // sem espaços, ex.: URL longa
    const maxWidth = 20; // mm — bem menor que a largura da palavra sozinha

    renderFreeTextToPdf(doc, `<p>${longWord}</p>`, 100, 14, maxWidth);

    const texts = textSpy.mock.calls.map((c) => String(c[0]));
    // A palavra não pode ter sido emitida inteira numa única chamada (vazaria a margem).
    expect(texts).not.toContain(longWord);
    expect(texts.length).toBeGreaterThan(1);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    texts.forEach((text) => {
      expect(doc.getTextWidth(text)).toBeLessThanOrEqual(maxWidth + 0.01);
    });
  });
});
