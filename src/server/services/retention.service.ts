import { getDb } from '../lib/rls-context.ts';
import { subDays } from 'date-fns';

export function createRetentionService() {
  async function cleanupSoftDeleted(daysOld = 30): Promise<{ deletedCount: number }> {
    const cutoff = subDays(new Date(), daysOld);
    const result = await getDb().patient.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });
    return { deletedCount: result.count };
  }

  return { cleanupSoftDeleted };
}
