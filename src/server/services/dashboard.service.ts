import { PrismaClient } from '@prisma/client';

type Deps = { prisma: PrismaClient };

export function createDashboardService({ prisma }: Deps) {
  async function getStats(nutritionistId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [
      activePatients,
      recentPatients,
      todayAppointments,
      monthConsultations,
      monthPayments,
      activeMealPlans,
    ] = await Promise.all([
      prisma.patient.count({ where: { nutritionistId, status: 'active' } }),
      prisma.patient.findMany({
        where: { nutritionistId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, createdAt: true, status: true },
      }),
      prisma.appointment.findMany({
        where: { nutritionistId, date: { gte: startOfDay, lte: endOfDay } },
        include: { patient: { select: { name: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.consultation.findMany({
        where: { nutritionistId, createdAt: { gte: startOfMonth } },
        select: { id: true, createdAt: true },
      }),
      prisma.payment.findMany({
        where: { nutritionistId, status: 'paid', date: { gte: startOfMonth } },
        select: { amount: true },
      }),
      prisma.mealPlan.count({ where: { nutritionistId, status: 'active' } }),
    ]);

    const monthRevenue = monthPayments.reduce((sum, p) => sum + p.amount, 0);

    return {
      activePatients,
      recentPatients,
      todayAppointments,
      monthConsultations: monthConsultations.length,
      consultationDates: monthConsultations.map(c => c.createdAt),
      monthRevenue,
      activeMealPlans,
    };
  }

  return { getStats };
}
