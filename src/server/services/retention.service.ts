import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.ts';
import { subDays } from 'date-fns';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createRetentionService(_deps?: { prisma?: PrismaClient }) {
  async function cleanupSoftDeleted(daysOld = 30): Promise<{ deletedCount: number }> {
    const cutoff = subDays(new Date(), daysOld);
    const result = await prisma.patient.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });
    return { deletedCount: result.count };
  }

  return { cleanupSoftDeleted };
}
