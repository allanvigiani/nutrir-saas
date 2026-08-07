import { describe, it, expect } from 'vitest';
import { getPasswordResetTemplate } from '../../lib/mail';

describe('getPasswordResetTemplate', () => {
  it('contém o link de reset no HTML', () => {
    const link = 'https://example.com/reset?oobCode=abc123';
    const html = getPasswordResetTemplate(link);
    expect(html).toContain(link);
  });

  it('contém texto de expiração de 1 hora', () => {
    const html = getPasswordResetTemplate('https://example.com');
    expect(html).toContain('1 hora');
  });

  it('contém botão de redefinição', () => {
    const html = getPasswordResetTemplate('https://example.com');
    expect(html).toContain('Redefinir minha senha');
  });
});
