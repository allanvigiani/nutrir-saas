import { logger } from "../logger.ts";
import { createAsaasClient } from "../integrations/asaas.client.ts";
import { getDb } from "../lib/rls-context.ts";

interface AccountServiceDeps {
  admin: any;
  asaasApiUrl: string;
  asaasApiKey: string;
}

export function createAccountService({
  admin,
  asaasApiUrl,
  asaasApiKey,
}: AccountServiceDeps) {
  const asaasClient = createAsaasClient({ asaasApiUrl, asaasApiKey });

  async function cancelAsaasSubscription(uid: string): Promise<void> {
    const nutritionist = await getDb().nutritionist.findUnique({
      where: { id: uid },
      include: { subscription: true },
    });
    const subscriptionId = nutritionist?.subscription?.asaasSubscriptionId;
    const plan = nutritionist?.plan;

    if (!subscriptionId || plan !== 'premium') return;

    logger.info('Cancelando assinatura Asaas antes de excluir conta', { uid, subscriptionId });
    try {
      await asaasClient.request(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
      logger.info('Assinatura Asaas cancelada com sucesso', { uid, subscriptionId });
    } catch (err: any) {
      logger.error('Falha ao cancelar assinatura Asaas', { uid, err: err.message });
      throw new Error(
        'Não foi possível cancelar sua assinatura premium. ' +
        'Tente novamente ou contate suporte@nutrir.app antes de excluir a conta.'
      );
    }
  }

  async function deleteAccount(uid: string): Promise<{ deleted: Record<string, number> }> {
    logger.info('Iniciando exclusão de conta (LGPD Art. 18)', { uid });

    // 1. Cancelar assinatura Asaas se premium
    await cancelAsaasSubscription(uid);

    // 2. Deletar nutricionista — cascata elimina patients e todos os relacionamentos
    await getDb().nutritionist.delete({ where: { id: uid } });
    logger.info('Nutricionista e dados em cascata deletados via Prisma', { uid });

    // 3. Deletar usuário do Firebase Auth
    await admin.auth().deleteUser(uid);
    logger.info('Conta excluída com sucesso (LGPD Art. 18)', { uid });

    return { deleted: { nutritionists: 1 } };
  }

  return { deleteAccount };
}
