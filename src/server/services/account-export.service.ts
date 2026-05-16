import { PrismaClient } from '@prisma/client';
import { prisma as prismaClient } from '../lib/prisma.ts';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createAccountExportService(_deps?: { prisma?: PrismaClient }) {
  async function exportData(nutritionistId: string) {
    const [nutritionist, patients, subscriptions] = await Promise.all([
      prismaClient.nutritionist.findUnique({ where: { id: nutritionistId } }),
      prismaClient.patient.findMany({
        where: { nutritionistId },
        include: {
          consultations: true,
          labExams: true,
          mealPlans: { include: { items: true } },
          appointments: true,
          calculations: true,
        },
      }),
      prismaClient.subscription.findMany({ where: { nutritionistId } }),
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
