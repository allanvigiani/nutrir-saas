import { PrismaClient } from '@prisma/client';

type Deps = { prisma: PrismaClient };

export function createPatientsService({ prisma }: Deps) {
  async function list(nutritionistId: string) {
    return prisma.patient.findMany({
      where: { nutritionistId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function getOne(nutritionistId: string, id: string) {
    const patient = await prisma.patient.findFirst({ where: { id, nutritionistId } });
    if (!patient) throw new Error('Paciente não encontrado');
    return patient;
  }

  async function create(nutritionistId: string, data: Record<string, unknown>) {
    return prisma.patient.create({ data: { ...(data as any), nutritionistId } });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await prisma.patient.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.patient.update({ where: { id }, data: data as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await prisma.patient.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.patient.delete({ where: { id } });
  }

  return { list, getOne, create, update, remove };
}
