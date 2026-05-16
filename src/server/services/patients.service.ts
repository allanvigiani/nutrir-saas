import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.ts';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createPatientsService(_deps?: { prisma?: PrismaClient }) {
  async function list(nutritionistId: string) {
    return prisma.patient.findMany({
      where: { nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function getOne(nutritionistId: string, id: string) {
    const patient = await prisma.patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!patient) throw new Error('Paciente não encontrado');
    return patient;
  }

  async function create(nutritionistId: string, data: Record<string, unknown>) {
    return prisma.patient.create({ data: { ...(data as any), nutritionistId } });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>) {
    const existing = await prisma.patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.patient.update({ where: { id }, data: data as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await prisma.patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.patient.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, getOne, create, update, remove };
}
