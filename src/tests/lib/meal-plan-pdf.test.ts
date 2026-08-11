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
