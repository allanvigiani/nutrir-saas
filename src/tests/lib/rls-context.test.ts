import { describe, it, expect, vi } from 'vitest';

vi.mock('../../server/lib/prisma.ts', () => ({
  prisma: {
    $transaction: vi.fn(async (fn: any) => fn({ _isMockTx: true })),
    patient: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

import { getDb, withNutritionistRLS, withPatientRLS, withAdminRLS, withPortalAuth } from '../../server/lib/rls-context.ts';
import { prisma } from '../../server/lib/prisma.ts';

describe('getDb', () => {
  it('retorna prisma global fora de contexto RLS', () => {
    const db = getDb();
    expect(db).toBe(prisma);
  });

  it('retorna tx dentro de withNutritionistRLS', async () => {
    let capturedDb: any;
    await withNutritionistRLS('uid-1', async () => {
      capturedDb = getDb();
    });
    expect(capturedDb).toMatchObject({ _isMockTx: true });
  });

  it('retorna tx dentro de withPatientRLS', async () => {
    let capturedDb: any;
    await withPatientRLS('patient-1', async () => {
      capturedDb = getDb();
    });
    expect(capturedDb).toMatchObject({ _isMockTx: true });
  });

  it('retorna tx dentro de withAdminRLS', async () => {
    let capturedDb: any;
    await withAdminRLS(async () => {
      capturedDb = getDb();
    });
    expect(capturedDb).toMatchObject({ _isMockTx: true });
  });
});

describe('withPortalAuth', () => {
  it('executa fn com patient quando accessToken válido', async () => {
    const mockPatient = { id: 'p-1', cpf: '12345678900', accessToken: 'tok' };
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({ _isMockTx: true, patient: { findFirst: vi.fn().mockResolvedValue(mockPatient) } })
    );

    let receivedPatient: any;
    await withPortalAuth('p-1', 'tok', async (p) => {
      receivedPatient = p;
    });
    expect(receivedPatient).toEqual(mockPatient);
  });

  it('lança erro 401 quando accessToken inválido', async () => {
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({ _isMockTx: true, patient: { findFirst: vi.fn().mockResolvedValue(null) } })
    );

    await expect(
      withPortalAuth('p-1', 'tok-invalido', async () => {})
    ).rejects.toMatchObject({ status: 401 });
  });
});
