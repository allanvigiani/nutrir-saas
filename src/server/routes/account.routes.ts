import type { BaseRouteDeps, AsaasConfig } from "../types.ts";
import { createAccountService } from "../services/account.service.ts";
import { logger } from "../logger.ts";

export function registerAccountRoutes(deps: BaseRouteDeps & Partial<AsaasConfig>) {
  const accountService = createAccountService({
    admin: deps.admin,
    adminDb: deps.adminDb,
    asaasApiUrl: deps.asaasApiUrl || '',
    asaasApiKey: deps.asaasApiKey || '',
    firestoreProjectId: deps.firestoreProjectId,
    firestoreDatabaseId: deps.firestoreDatabaseId,
  });

  deps.app.delete("/api/account", deps.authenticate, async (req: any, res: any) => {
    const uid: string = req.user.uid;
    const email: string = req.user.email || '';

    // Confirmação obrigatória no corpo da requisição
    const { confirmation } = req.body;
    if (confirmation !== email) {
      return res.status(400).json({
        error: 'Confirmação inválida. Informe seu e-mail corretamente para prosseguir.',
      });
    }

    // Extrai o ID token do header Authorization para usar na REST API do Firestore
    const idToken = (req.headers.authorization as string).split('Bearer ')[1];

    try {
      const result = await accountService.deleteAccount(uid, idToken);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      logger.error('Erro ao excluir conta', err, { uid });
      return res.status(500).json({
        error: err.message || 'Erro ao excluir conta.',
        detail: err.code || err.stack?.split('\n')[0] || undefined,
      });
    }
  });
}
