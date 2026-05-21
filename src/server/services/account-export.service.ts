import { getDb } from '../lib/rls-context.ts';

export function createAccountExportService() {
  async function exportData(nutritionistId: string) {
    const [nutritionist, patients, subscriptions] = await Promise.all([
      getDb().nutritionist.findUnique({ where: { id: nutritionistId } }),
      getDb().patient.findMany({
        where: { nutritionistId },
        include: {
          consultations: true,
          labExams: true,
          mealPlans: { include: { items: true } },
          appointments: true,
          calculations: true,
        },
      }),
      getDb().subscription.findMany({ where: { nutritionistId } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      nutritionist,
      patients,
      subscriptions,
    };
  }

  return { exportData };
}
