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
