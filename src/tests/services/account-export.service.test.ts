import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockNutritionistFindUnique, mockPatientFindMany, mockSubscriptionFindMany } = vi.hoisted(() => ({
  mockNutritionistFindUnique: vi.fn(),
  mockPatientFindMany:        vi.fn(),
  mockSubscriptionFindMany:   vi.fn(),
}));

vi.mock('../../server/lib/prisma.ts', () => ({
  prisma: {
    nutritionist: { findUnique: mockNutritionistFindUnique },
    patient:      { findMany: mockPatientFindMany },
    subscription: { findMany: mockSubscriptionFindMany },
  },
}));

import { createAccountExportService } from '../../server/services/account-export.service.ts';

const service = createAccountExportService({ prisma: {} as any });

describe('AccountExportService.exportData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNutritionistFindUnique.mockResolvedValue({ id: 'nutri-1', name: 'Ana' });
    mockPatientFindMany.mockResolvedValue([{ id: 'p-1', name: 'João' }]);
    mockSubscriptionFindMany.mockResolvedValue([]);
  });

  it('retorna exportedAt como ISO string', async () => {
    const result = await service.exportData('nutri-1');
    expect(typeof result.exportedAt).toBe('string');
    expect(new Date(result.exportedAt).toISOString()).toBe(result.exportedAt);
  });

  it('inclui nutritionist, patients e subscriptions', async () => {
    const result = await service.exportData('nutri-1');
    expect(result.nutritionist).toEqual({ id: 'nutri-1', name: 'Ana' });
    expect(result.patients).toHaveLength(1);
    expect(result.subscriptions).toHaveLength(0);
  });

  it('busca patients com include completo', async () => {
    await service.exportData('nutri-1');
    expect(mockPatientFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          consultations: true,
          labExams: true,
        }),
      }),
    );
  });
});
