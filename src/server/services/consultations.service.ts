import { PrismaClient } from '@prisma/client';

type Deps = { prisma: PrismaClient };

export function createConsultationsService({ prisma }: Deps) {
  async function list(nutritionistId: string, patientId: string) {
    return prisma.consultation.findMany({
      where: { patientId, nutritionistId },
      orderBy: { date: 'desc' },
    });
  }

  async function create(nutritionistId: string, patientId: string, data: Record<string, unknown>) {
    return prisma.consultation.create({
      data: { ...(data as any), patientId, nutritionistId },
    });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await prisma.consultation.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.consultation.update({ where: { id }, data: data as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await prisma.consultation.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.consultation.delete({ where: { id } });
  }

  return { list, create, update, remove };
}
