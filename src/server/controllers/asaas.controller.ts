type AsaasControllerDeps = {
  isSuperAdmin: (user: { email?: string | null }) => boolean;
  asaasWebhookToken?: string;
  asaasService: {
    handleWebhookEvent: (event: any) => Promise<any>;
    createCheckoutSession: (params: { userId: string; email: string; name?: string; cpfCnpj?: string }) => Promise<any>;
    verifySubscription: (email: string) => Promise<any>;
    createPortalSession: (email: string) => Promise<any>;
    cancelSubscription: (email: string) => Promise<any>;
  };
};

export function createAsaasController({ isSuperAdmin, asaasWebhookToken, asaasService }: AsaasControllerDeps) {
  async function getWebhook(req: any, res: any) {
    res.send("Webhook endpoint is active. Use POST for Asaas events.");
  }

  async function postWebhook(req: any, res: any) {
    const event = req.body;
    const token = req.headers["asaas-access-token"];

    if (!asaasWebhookToken) {
      return res.status(503).send("Webhook token not configured");
    }
    if (token !== asaasWebhookToken) {
      return res.status(401).send("Unauthorized");
    }

    try {
      const result = await asaasService.handleWebhookEvent(event);
      if (result?.noUserId) return res.status(200).send("OK - No User ID");
      return res.status(200).send("OK");
    } catch (error: any) {
      console.error("[Asaas Webhook] Erro ao processar webhook:", error.message);
      return res.status(500).send("Internal Server Error");
    }
  }

  async function createCheckoutSession(req: any, res: any) {
    const { userId, email, name, cpfCnpj } = req.body;
    if (req.user.uid !== userId && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Não autorizado a criar checkout para este usuário." });
    }

    try {
      const data = await asaasService.createCheckoutSession({ userId, email, name, cpfCnpj });
      return res.json(data);
    } catch (error: any) {
      const message = error.message || "Erro desconhecido na integração com Asaas";
      const isValidationError = message.includes("CPF ou CNPJ");
      return res.status(isValidationError ? 400 : 500).json({ error: message });
    }
  }

  async function verifySubscription(req: any, res: any) {
    const { email } = req.body;
    if (req.user.email !== email && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Não autorizado a verificar esta assinatura." });
    }
    if (!email) return res.status(400).json({ error: "Email é obrigatório." });

    try {
      return res.json(await asaasService.verifySubscription(email));
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async function createPortalSession(req: any, res: any) {
    const { email } = req.body;
    if (req.user.email !== email && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Não autorizado a acessar este portal." });
    }

    try {
      return res.json(await asaasService.createPortalSession(email));
    } catch (error: any) {
      const message = error.message || "Erro ao buscar portal Asaas";
      const isNotFound = message.includes("Nenhuma assinatura") || message.includes("Nenhuma fatura");
      return res.status(isNotFound ? 404 : 500).json({ error: message });
    }
  }

  async function cancelSubscription(req: any, res: any) {
    const { email } = req.body;
    if (req.user.email !== email && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Não autorizado a cancelar esta assinatura." });
    }

    try {
      return res.json(await asaasService.cancelSubscription(email));
    } catch (error: any) {
      const message = error.message || "Erro no cancelamento Asaas";
      const isBadRequest = message.includes("Nenhuma assinatura ativa");
      return res.status(isBadRequest ? 400 : 500).json({ error: message });
    }
  }

  return {
    getWebhook,
    postWebhook,
    createCheckoutSession,
    verifySubscription,
    createPortalSession,
    cancelSubscription,
  };
}
