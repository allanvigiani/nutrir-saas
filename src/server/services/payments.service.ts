import { PrismaClient } from '@prisma/client';

type Deps = { prisma: PrismaClient };

type CreatePaymentInput = {
  patientId: string;
  amount: number;
  date: Date;
  method: string;
  status: string;
  description?: string;
};

export function createPaymentsService({ prisma }: Deps) {
  async function list(nutritionistId: string) {
    return prisma.payment.findMany({
      where: { nutritionistId },
      orderBy: { date: 'desc' },
    });
  }

  async function create(nutritionistId: string, data: CreatePaymentInput) {
    return prisma.payment.create({ data: { ...data, nutritionistId } });
  }

  async function update(nutritionistId: string, id: string, data: Partial<CreatePaymentInput>) {
    const existing = await prisma.payment.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.payment.update({ where: { id }, data });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await prisma.payment.findFirst({ where: { id, nutritionistId } });
    if (!existing) throw new Error('Não autorizado');
    return prisma.payment.delete({ where: { id } });
  }

  return { list, create, update, remove };
}
