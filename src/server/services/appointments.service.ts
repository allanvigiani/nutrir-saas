import { PrismaClient } from '@prisma/client';

type Deps = { prisma: PrismaClient };

type CreateAppointmentInput = {
  patientId: string;
  date: Date;
  status: string;
  googleEventId?: string;
  meetLink?: string;
};

export function createAppointmentsService({ prisma }: Deps) {
  async function list(nutritionistId: string) {
    return prisma.appointment.findMany({
      where: { nutritionistId },
      orderBy: { date: 'asc' },
      include: { patient: { select: { name: true } } },
    });
  }

  async function create(nutritionistId: string, data: CreateAppointmentInput) {
    return prisma.appointment.create({ data: { ...data, nutritionistId } });
  }

  async function update(nutritionistId: string, id: string, data: Partial<CreateAppointmentInput>) {
    const existing = await prisma.appointment.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.appointment.update({ where: { id }, data });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await prisma.appointment.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.appointment.delete({ where: { id } });
  }

  return { list, create, update, remove };
}
