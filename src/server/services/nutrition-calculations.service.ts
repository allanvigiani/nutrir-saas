import { PrismaClient } from '@prisma/client';

type Deps = { prisma: PrismaClient };

export function createNutritionCalculationsService({ prisma }: Deps) {
  async function list(nutritionistId: string, patientId: string) {
    return prisma.nutritionCalculation.findMany({
      where: { patientId, nutritionistId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>) {
    return prisma.nutritionCalculation.create({
      data: { ...(data as any), patientId, nutritionistId },
    });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await prisma.nutritionCalculation.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.nutritionCalculation.delete({ where: { id } });
  }

  return { list, create, remove };
}
