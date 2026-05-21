import { subDays } from 'date-fns';

type Deps = { db: any };

export function createDashboardService({ db }: Deps) {
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
      db.patient.count({ where: { nutritionistId, status: 'active', deletedAt: null } }),
      db.patient.findMany({
        where: { nutritionistId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, createdAt: true, status: true },
      }),
      db.appointment.findMany({
        where: { nutritionistId, date: { gte: startOfDay.toISOString(), lte: endOfDay.toISOString() } },
        include: { patient: { select: { name: true } } },
        orderBy: { date: 'asc' },
      }),
      db.consultation.findMany({
        where: { nutritionistId, createdAt: { gte: startOfMonth } },
        select: { id: true, createdAt: true },
      }),
      db.payment.findMany({
        where: { nutritionistId, status: 'paid', date: { gte: startOfMonth.toISOString() } },
        select: { amount: true },
      }),
      db.mealPlan.count({ where: { nutritionistId, status: 'active' } }),
    ]);

    const monthRevenue = monthPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

    return {
      activePatients,
      recentPatients,
      todayAppointments,
      monthConsultations: monthConsultations.length,
      consultationDates: monthConsultations.map((c: any) => c.createdAt),
      monthRevenue,
      activeMealPlans,
    };
  }

  return { getStats };
}
