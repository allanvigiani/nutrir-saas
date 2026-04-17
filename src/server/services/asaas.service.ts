import { getPremiumWelcomeTemplate, sendEmail } from "../../lib/mail.ts";
import type { AsaasClient } from "../integrations/asaas.client.ts";
import type { FirestoreHelpers } from "../types.ts";

type AsaasServiceInput = FirestoreHelpers & {
  asaasClient: AsaasClient;
};

export function createAsaasService({ asaasClient, getDocWithFallback, updateDocWithFallback, queryWithFallback }: AsaasServiceInput) {
  async function handleWebhookEvent(event: any) {
    const payment = event.payment;
    const userId = payment?.externalReference || event.subscription?.externalReference;
    if (!userId) {
      return { ok: true, noUserId: true };
    }

    const updateUserData = async (data: any) => {
      await updateDocWithFallback("nutritionists", userId, data);
    };

    switch (event.event) {
      case "PAYMENT_CREATED":
        await updateUserData({ subscriptionStatus: "pending", updatedAt: new Date().toISOString() });
        break;
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED":
        await updateUserData({
          plan: "premium",
          subscriptionStatus: "active",
          currentPeriodEnd: payment?.dueDate || null,
          lastSubscriptionCheck: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        try {
          const userDoc = await getDocWithFallback("nutritionists", userId);
          if (userDoc.exists) {
            const userData = userDoc.data;
            if (userData?.email) {
              await sendEmail({
                to: userData.email,
                subject: "💎 Bem-vindo ao Plano Premium Nutrir!",
                html: getPremiumWelcomeTemplate(userData.name || "Nutricionista"),
              });
            }
          }
        } catch (error) {
          console.error("[Email] Erro ao enviar boas-vindas Premium no webhook:", error);
        }
        break;
      case "PAYMENT_OVERDUE":
        await updateUserData({ subscriptionStatus: "overdue", updatedAt: new Date().toISOString() });
        break;
      case "PAYMENT_REFUNDED":
      case "PAYMENT_CHARGEBACK_REQUESTED":
        await updateUserData({
          plan: "free",
          subscriptionStatus: "refunded",
          hadRefundBefore: true,
          updatedAt: new Date().toISOString(),
        });
        break;
      case "SUBSCRIPTION_CREATED":
        await updateUserData({
          subscriptionId: event.subscription.id,
          subscriptionStatus: "active",
          updatedAt: new Date().toISOString(),
        });
        break;
      case "SUBSCRIPTION_DELETED":
      case "SUBSCRIPTION_INACTIVATED":
        await updateUserData({
          subscriptionStatus: "cancelled",
          cancelAtPeriodEnd: true,
          updatedAt: new Date().toISOString(),
        });
        break;
      case "SUBSCRIPTION_UPDATED": {
        const sub = event.subscription;
        if (sub) {
          const isSubActive = sub.status === "ACTIVE";
          await updateUserData({
            plan: isSubActive ? "premium" : "free",
            subscriptionStatus: sub.status.toLowerCase(),
            currentPeriodEnd: sub.nextDueDate || null,
            updatedAt: new Date().toISOString(),
          });
        }
        break;
      }
    }

    return { ok: true };
  }

  async function createCheckoutSession(params: { userId: string; email: string; name?: string; cpfCnpj?: string }) {
    const { userId, email, name, cpfCnpj } = params;
    const sanitizedCpfCnpj = cpfCnpj ? String(cpfCnpj).replace(/\D/g, "") : undefined;
    if (!sanitizedCpfCnpj) {
      throw new Error("CPF ou CNPJ é obrigatório para realizar uma assinatura no Asaas. Por favor, preencha seus dados de perfil nas Configurações.");
    }
    if (sanitizedCpfCnpj.length !== 11 && sanitizedCpfCnpj.length !== 14) {
      throw new Error("CPF ou CNPJ inválido. Certifique-se de que o documento possui 11 (CPF) ou 14 (CNPJ) dígitos.");
    }

    let customer: any;
    const customers = await asaasClient.request(`/customers?email=${encodeURIComponent(email)}`);

    if (customers.data?.length > 0) {
      customer = customers.data[0];
      if (!customer.externalReference) {
        await asaasClient.request(`/customers/${customer.id}`, {
          method: "POST",
          body: JSON.stringify({ externalReference: userId }),
        });
      }
      if (!customer.cpfCnpj && sanitizedCpfCnpj) {
        customer = await asaasClient.request(`/customers/${customer.id}`, {
          method: "POST",
          body: JSON.stringify({ cpfCnpj: sanitizedCpfCnpj }),
        });
      }
    } else {
      customer = await asaasClient.request("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: name || email.split("@")[0],
          email,
          cpfCnpj: sanitizedCpfCnpj,
          externalReference: userId,
        }),
      });
    }

    const existingSubscriptions = await asaasClient.request(`/subscriptions?customer=${customer.id}`);
    const activeSub = existingSubscriptions.data?.find((s: any) => s.status === "ACTIVE");

    if (activeSub) {
      const payments = await asaasClient.request(`/payments?subscription=${activeSub.id}&limit=1&order=desc`);
      if (payments.data?.length > 0) {
        return { id: activeSub.id, url: payments.data[0].invoiceUrl, message: "Você já possui uma assinatura ativa. Redirecionando para a fatura." };
      }
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDueDate = tomorrow.toISOString().split("T")[0];

    const subscription = await asaasClient.request("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.id,
        billingType: "CREDIT_CARD",
        value: 39.9,
        nextDueDate,
        cycle: "MONTHLY",
        description: "Plano Premium Nutrir",
        externalReference: userId,
      }),
    });

    const payments = await asaasClient.request(`/payments?subscription=${subscription.id}`);
    if (!payments.data || payments.data.length === 0) {
      throw new Error("A assinatura foi criada, mas nenhuma cobrança inicial foi gerada pelo Asaas. Verifique seu painel Asaas.");
    }

    return { id: subscription.id, url: payments.data[0].invoiceUrl };
  }

  async function verifySubscription(email: string) {
    const customers = await asaasClient.request(`/customers?email=${encodeURIComponent(email)}`);
    if (!customers.data?.length) return { status: "no_customer", message: "Nenhum cliente encontrado." };

    const customerId = customers.data[0].id;
    const subscriptions = await asaasClient.request(`/subscriptions?customer=${customerId}`);
    if (!subscriptions.data?.length) return { status: "none", plan: "free", message: "Nenhuma assinatura encontrada." };

    const sortedSubs = [...subscriptions.data].sort(
      (a: any, b: any) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime(),
    );
    const activeSub = sortedSubs.find((s: any) => s.status === "ACTIVE");
    const sub = activeSub || sortedSubs[0];

    const payments = await asaasClient.request(`/payments?subscription=${sub.id}&status=CONFIRMED,RECEIVED`);
    const hasPaidPayment = payments.data && payments.data.length > 0;
    const nextDueDate = sub.nextDueDate ? new Date(sub.nextDueDate + "T23:59:59") : null;
    const now = new Date();

    let plan = "free";
    if (sub.status === "ACTIVE" && hasPaidPayment) plan = "premium";
    else if ((sub.status === "DELETED" || sub.deleted) && nextDueDate && nextDueDate >= now && hasPaidPayment) plan = "premium";

    return {
      status: sub.status,
      plan,
      subscriptionId: sub.id,
      subscriptionStatus: sub.status,
      cancelAtPeriodEnd: sub.status === "DELETED" || sub.deleted,
      currentPeriodEnd: sub.nextDueDate,
      subscriptionCreatedAt: sub.dateCreated,
      message: plan === "premium" ? "Assinatura válida encontrada." : "Assinatura encontrada, mas aguardando confirmação de pagamento.",
    };
  }

  async function createPortalSession(email: string) {
    const customers = await asaasClient.request(`/customers?email=${encodeURIComponent(email)}`);
    if (!customers.data?.length) {
      throw new Error("Nenhuma assinatura ou histórico de pagamentos encontrado no Asaas.");
    }

    const customer = customers.data[0];
    const payments = await asaasClient.request(`/payments?customer=${customer.id}&limit=1&order=desc`);
    if (payments.data?.length > 0) return { url: payments.data[0].invoiceUrl };

    throw new Error("Nenhuma fatura encontrada. Se você acabou de assinar, aguarde alguns instantes.");
  }

  async function cancelSubscription(email: string) {
    const customers = await asaasClient.request(`/customers?email=${encodeURIComponent(email)}`);
    if (!customers.data?.length) {
      return { success: true, message: "Nenhuma assinatura encontrada no Asaas para este e-mail.", refunded: false };
    }

    const customer = customers.data[0];
    const subscriptions = await asaasClient.request(`/subscriptions?customer=${customer.id}`);
    const activeSub = subscriptions.data?.find((s: any) => s.status === "ACTIVE");
    if (!activeSub) throw new Error("Nenhuma assinatura ativa encontrada.");

    let userDocId: string | null = null;
    const nutritionists = await queryWithFallback("nutritionists", "email", "==", email);
    if (!nutritionists.empty) userDocId = nutritionists.docs[0].id;

    const createdDate = activeSub.dateCreated ? new Date(activeSub.dateCreated) : new Date();
    const diffDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    const isEligibleForRefund = diffDays <= 7;
    let refunded = false;

    if (isEligibleForRefund) {
      try {
        const paymentsResponse = await asaasClient.request(`/payments?subscription=${activeSub.id}&status=CONFIRMED,RECEIVED`);
        if (paymentsResponse.data?.length > 0) {
          for (const payment of paymentsResponse.data) {
            await asaasClient.request(`/payments/${payment.id}/refund`, { method: "POST" });
            refunded = true;
          }
        }
      } catch (refundErr: any) {
        console.error("[Refund] Erro ao processar estorno:", refundErr.message);
      }
    }

    await asaasClient.request(`/subscriptions/${activeSub.id}`, { method: "DELETE" });

    if (userDocId) {
      try {
        const updateData: any = {
          subscriptionStatus: refunded ? "refunded" : "cancelled",
          cancelAtPeriodEnd: !refunded,
          updatedAt: new Date().toISOString(),
        };
        if (refunded) {
          updateData.plan = "free";
          updateData.subscriptionId = null;
          updateData.currentPeriodEnd = null;
          updateData.hadRefundBefore = true;
        }
        await updateDocWithFallback("nutritionists", userDocId, updateData);
      } catch (fsError) {
        console.error("Erro ao atualizar Firestore no cancelamento:", fsError);
      }
    }

    return {
      success: true,
      refunded,
      message: refunded
        ? "Assinatura cancelada e reembolso solicitado com sucesso! O valor aparecerá na sua fatura em breve."
        : "Assinatura cancelada com sucesso. Você manterá o acesso Premium até o final do período já pago.",
    };
  }

  return {
    handleWebhookEvent,
    createCheckoutSession,
    verifySubscription,
    createPortalSession,
    cancelSubscription,
  };
}
