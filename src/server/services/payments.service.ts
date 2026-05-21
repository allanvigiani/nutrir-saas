import { getDb } from '../lib/rls-context.ts';

type CreatePaymentInput = {
  patientId: string;
  amount: number;
  date: Date;
  method: string;
  status: string;
  description?: string;
};

export function createPaymentsService() {
  async function list(nutritionistId: string) {
    return getDb().payment.findMany({
      where: { nutritionistId, deletedAt: null },
      orderBy: { date: 'desc' },
    });
  }

  async function create(nutritionistId: string, data: CreatePaymentInput) {
    return getDb().payment.create({ data: { ...data, nutritionistId } });
  }

  async function update(nutritionistId: string, id: string, data: Partial<CreatePaymentInput>) {
    const existing = await getDb().payment.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().payment.update({ where: { id }, data });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().payment.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().payment.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, create, update, remove };
}
