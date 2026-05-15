import { PrismaClient } from '@prisma/client';

type Deps = { prisma: PrismaClient };

export function createNutritionistsService({ prisma }: Deps) {
  async function getMe(uid: string) {
    const nutritionist = await prisma.nutritionist.findUnique({
      where: { id: uid },
      include: { subscription: true },
    });
    if (!nutritionist) throw new Error('Nutricionista não encontrado');
    return nutritionist;
  }

  async function updateMe(uid: string, data: Record<string, unknown>) {
    return prisma.nutritionist.update({
      where: { id: uid },
      data: { ...data, updatedAt: new Date() },
    });
  }

  return { getMe, updateMe };
}
