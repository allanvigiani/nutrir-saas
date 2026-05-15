import { describe, it, expect, vi } from 'vitest';
import { createDashboardService } from '../../server/services/dashboard.service.ts';

function makePrisma() {
  return {
    patient: { count: vi.fn().mockResolvedValue(5), findMany: vi.fn().mockResolvedValue([]) },
    appointment: { findMany: vi.fn().mockResolvedValue([]) },
    consultation: { findMany: vi.fn().mockResolvedValue([]) },
    payment: { findMany: vi.fn().mockResolvedValue([]) },
    mealPlan: { count: vi.fn().mockResolvedValue(3) },
  };
}

describe('DashboardService.getStats', () => {
  it('retorna contagem de pacientes ativos', async () => {
    const prisma = makePrisma();
    const service = createDashboardService({ prisma: prisma as any });
    const stats = await service.getStats('uid1');
    expect(prisma.patient.count).toHaveBeenCalledWith({ where: { nutritionistId: 'uid1', status: 'active' } });
    expect(stats.activePatients).toBe(5);
  });

  it('retorna total de planos alimentares ativos', async () => {
    const prisma = makePrisma();
    const service = createDashboardService({ prisma: prisma as any });
    const stats = await service.getStats('uid1');
    expect(stats.activeMealPlans).toBe(3);
  });
});
