import { getDb, withAdminRLS } from '../lib/rls-context.ts';
import { createSubscriptionService } from '../services/subscription.service.ts';
import { logger } from '../logger.ts';

type UpsertOnly = Pick<ReturnType<typeof createSubscriptionService>, 'upsert'>;

export function createSubscriptionExpiryMiddleware(
  deps: { subscriptionService?: UpsertOnly } = {}
) {
  const subscriptionService: UpsertOnly = deps.subscriptionService ?? createSubscriptionService();

  return async (req: any, res: any, next: any) => {
    if (req.user?.isAdmin || req.user?.dbPlan !== 'premium') {
      return next();
    }

    const userId = req.user?.uid;
    if (!userId) return next();

    try {
      const sub = await withAdminRLS(() =>
        getDb().subscription.findUnique({
          where: { nutritionistId: userId },
          select: { currentPeriodEnd: true },
        })
      );

      if (!sub?.currentPeriodEnd) return next();

      const isExpired = sub.currentPeriodEnd < new Date();
      if (!isExpired) return next();

      req.user.dbPlan = 'free';
      req.user.isPremium = false;

      subscriptionService
        .upsert(userId, {
          plan: 'free',
          cancelAtPeriodEnd: false,
        })
        .catch((err: unknown) =>
          logger.error('[SubscriptionExpiry] Erro ao rebaixar plano', err, { userId })
        );
    } catch (err) {
      logger.error('[SubscriptionExpiry] Erro ao verificar expiração', err, { userId });
    }

    return next();
  };
}
