import { describe, it, expect, vi } from 'vitest';

vi.stubEnv('ENCRYPTION_KEY', 'a'.repeat(64));

import { encrypt, decrypt, hashField } from '../../server/lib/crypto.ts';

describe('encrypt/decrypt', () => {
  it('round-trip retorna o texto original', () => {
    const original = '12345678901';
    expect(decrypt(encrypt(original))).toBe(original);
  });

  it('mesma entrada gera ciphertexts diferentes (IV aleatório)', () => {
    const a = encrypt('teste');
    const b = encrypt('teste');
    expect(a).not.toBe(b);
  });

  it('ciphertext tem formato iv:tag:encrypted', () => {
    const c = encrypt('x');
    const parts = c.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24); // 12 bytes → 24 hex chars
  });

  it('decrypt lança erro com ciphertext inválido', () => {
    expect(() => decrypt('invalido')).toThrow();
  });
});

describe('hashField', () => {
  it('é determinístico', () => {
    expect(hashField('123.456.789-00')).toBe(hashField('12345678900'));
  });

  it('normaliza pontuação de CPF (remove não-dígitos)', () => {
    // Com formatação vs sem formatação devem gerar o mesmo hash
    expect(hashField('12.345.678/0001-99')).toBe(hashField('12345678000199'));
  });

  it('retorna string de 64 chars (SHA-256 hex)', () => {
    expect(hashField('12345678900').length).toBe(64);
  });
});
