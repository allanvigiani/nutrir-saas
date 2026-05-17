import { getDb } from '../lib/rls-context.ts';

type CreateAppointmentInput = {
  patientId: string;
  date: Date;
  status: string;
  googleEventId?: string;
  meetLink?: string;
};

export function createAppointmentsService() {
  async function list(nutritionistId: string) {
    return getDb().appointment.findMany({
      where: { nutritionistId },
      orderBy: { date: 'asc' },
      include: { patient: { select: { name: true } } },
    });
  }

  async function create(nutritionistId: string, data: CreateAppointmentInput) {
    return getDb().appointment.create({ data: { ...data, nutritionistId } });
  }

  async function update(nutritionistId: string, id: string, data: Partial<CreateAppointmentInput>) {
    const existing = await getDb().appointment.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().appointment.update({ where: { id }, data });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().appointment.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().appointment.delete({ where: { id } });
  }

  return { list, create, update, remove };
}
