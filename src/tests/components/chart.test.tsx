// @vitest-environment jsdom
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ChartContainer, type ChartConfig } from '../../components/ui/chart';

describe('ChartContainer — proteção contra CSS injection via config', () => {
  it('injeta normalmente uma cor/chave válidas no <style>', () => {
    const config: ChartConfig = { desktop: { label: 'Desktop', color: '#2563eb' } };
    const { container } = render(
      <ChartContainer config={config}>
        <div />
      </ChartContainer>,
    );
    const style = container.querySelector('style');
    expect(style?.innerHTML).toContain('--color-desktop: #2563eb;');
  });

  it('descarta uma chave de config com caracteres fora do padrão de custom property', () => {
    const config = {
      'desktop; } body { display:none': { label: 'x', color: 'red' },
    } as unknown as ChartConfig;
    const { container } = render(
      <ChartContainer config={config}>
        <div />
      </ChartContainer>,
    );
    const style = container.querySelector('style');
    // Não deve existir nenhum <style> com a chave maliciosa, nem "body { display:none"
    expect(style?.innerHTML ?? '').not.toContain('display:none');
  });

  it('descarta um valor de cor com `;` que tentaria escapar da declaração CSS', () => {
    const config: ChartConfig = {
      desktop: { label: 'Desktop', color: 'red; } </style><script>alert(1)</script>' },
    };
    const { container } = render(
      <ChartContainer config={config}>
        <div />
      </ChartContainer>,
    );
    const style = container.querySelector('style');
    expect(style?.innerHTML ?? '').not.toContain('<script>');
    expect(style?.innerHTML ?? '').not.toContain('--color-desktop: red;');
  });

  it('aceita valores de cor em formatos comuns (hex, rgb, hsl, var())', () => {
    const config: ChartConfig = {
      a: { color: '#fff' },
      b: { color: 'rgb(255, 0, 0)' },
      c: { color: 'hsl(210, 40%, 96%)' },
      d: { color: 'var(--primary)' },
    };
    const { container } = render(
      <ChartContainer config={config}>
        <div />
      </ChartContainer>,
    );
    const style = container.querySelector('style');
    expect(style?.innerHTML).toContain('--color-a: #fff;');
    expect(style?.innerHTML).toContain('--color-b: rgb(255, 0, 0);');
    expect(style?.innerHTML).toContain('--color-c: hsl(210, 40%, 96%);');
    expect(style?.innerHTML).toContain('--color-d: var(--primary);');
  });
});
