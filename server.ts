import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from 'firebase-admin';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp as initializeClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, doc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';
import SmeeClient from "smee-client";
import { sendEmail, getPatientWelcomeTemplate, getPremiumWelcomeTemplate, getMealPlanEmailTemplate, getPasswordResetTemplate } from "./src/lib/mail.js";
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const adminDb = getAdminFirestore(admin.app(), (firebaseConfig as any).firestoreDatabaseId);

// Initialize Firebase Client (as fallback for PERMISSION_DENIED)
const clientApp = initializeClientApp(firebaseConfig);
const clientDb = getClientFirestore(clientApp, (firebaseConfig as any).firestoreDatabaseId);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASAAS_API_KEY = process.env.ASAAS_API_KEY || "";
const ASAAS_API_URL = process.env.ASAAS_API_URL || "https://sandbox.asaas.com/api/v3";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Middleware para log de requisições (ajuda a depurar o 302)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/asaas-webhook')) {
      console.log(`[Request Log] ${req.method} ${req.path}`);
    }
    next();
  });

  app.post("/api/test-email", async (req, res) => {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: "Destinatário é obrigatório." });

    try {
      await sendEmail({
        to,
        subject: "Teste de Configuração SMTP - Nutrir",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #059669;">Olá!</h2>
            <p>Este é um e-mail de teste para confirmar que a configuração SMTP da <b>Brevo</b> está funcionando corretamente no sistema Nutrir.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #666;">Enviado em: ${new Date().toLocaleString('pt-BR')}</p>
          </div>
        `
      });
      res.json({ success: true, message: "E-mail de teste enviado com sucesso!" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/send-welcome-email", async (req, res) => {
    const { patientEmail, patientName, nutritionistName, nutritionistEmail, nutritionistPhone } = req.body;

    if (!patientEmail || !patientName) {
      return res.status(400).json({ error: "Dados do paciente incompletos." });
    }

    try {
      const html = getPatientWelcomeTemplate(
        patientName,
        nutritionistName,
        nutritionistEmail,
        nutritionistPhone
      );

      await sendEmail({
        to: patientEmail,
        subject: `Bem-vindo ao Nutrir! - Seu nutricionista ${nutritionistName} te cadastrou`,
        html
      });

      res.json({ success: true, message: "E-mail de boas-vindas enviado!" });
    } catch (error: any) {
      console.error("[Email] Erro no endpoint de boas-vindas:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/send-meal-plan", async (req, res) => {
    const { patientEmail, patientName, nutritionistName, pdfBase64, fileName } = req.body;

    if (!patientEmail || !pdfBase64) {
      return res.status(400).json({ error: "Dados incompletos para envio do plano." });
    }

    try {
      const html = getMealPlanEmailTemplate(patientName, nutritionistName);

      await sendEmail({
        to: patientEmail,
        subject: `🍎 Seu Plano Alimentar - Nutricionista ${nutritionistName}`,
        html,
        attachments: [
          {
            filename: fileName || 'Plano_Alimentar.pdf',
            content: pdfBase64,
            encoding: 'base64'
          }
        ]
      });

      res.json({ success: true, message: "Plano alimentar enviado com sucesso!" });
    } catch (error: any) {
      console.error("[Email] Erro ao enviar plano alimentar:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Webhook para o Asaas - MOVIDO PARA O TOPO
  app.get("/api/asaas-webhook", (req, res) => {
    res.send("Webhook endpoint is active. Use POST for Asaas events.");
  });

  app.post(["/api/asaas-webhook", "/api/asaas-webhook/"], async (req, res) => {
    const event = req.body;
    console.log(`[Asaas Webhook] Evento recebido: ${event.event || 'Desconhecido'}`);

    // Validação do Token de Segurança
    const token = req.headers['asaas-access-token'];
    if (process.env.ASAAS_WEBHOOK_TOKEN && token !== process.env.ASAAS_WEBHOOK_TOKEN) {
      console.warn("[Asaas Webhook] Token inválido recebido.");
      return res.status(401).send('Unauthorized');
    }

    try {
      const payment = event.payment;
      const userId = payment?.externalReference || event.subscription?.externalReference;

      if (!userId) {
        console.warn("[Asaas Webhook] Evento sem externalReference (userId). Ignorando.");
        return res.status(200).send('OK - No User ID');
      }

      // Referência para o documento do nutricionista no Firestore
      const updateUserData = async (data: any) => {
        try {
          await adminDb.collection('nutritionists').doc(userId).update(data);
          console.log(`[Firestore] Atualizado via Admin SDK: ${userId}`);
        } catch (adminError: any) {
          if (adminError.message?.includes('PERMISSION_DENIED')) {
            console.warn(`[Firestore] Admin SDK sem permissão, tentando Client SDK fallback...`);
            try {
              await updateDoc(doc(clientDb, 'nutritionists', userId), data);
              console.log(`[Firestore] Atualizado via Client SDK Fallback: ${userId}`);
            } catch (clientError: any) {
              console.error(`[Firestore] Erro em ambos os SDKs:`, clientError.message);
              throw clientError;
            }
          } else {
            throw adminError;
          }
        }
      };

      switch (event.event) {
        case 'PAYMENT_CREATED':
          console.log(`[Asaas Webhook] Pagamento CRIADO (Pendente) para usuário: ${userId}`);
          await updateUserData({
            subscriptionStatus: 'pending',
            updatedAt: new Date().toISOString()
          });
          break;

        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
          console.log(`[Asaas Webhook] Pagamento CONFIRMADO para usuário: ${userId}`);
          await updateUserData({
            plan: 'premium',
            subscriptionStatus: 'active',
            currentPeriodEnd: payment.dueDate || null,
            lastSubscriptionCheck: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          // Enviar e-mail de boas-vindas ao Premium
          try {
            const userDoc = await adminDb.collection('nutritionists').doc(userId).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              if (userData?.email) {
                const html = getPremiumWelcomeTemplate(userData.name || 'Nutricionista');
                await sendEmail({
                  to: userData.email,
                  subject: "💎 Bem-vindo ao Plano Premium Nutrir!",
                  html
                });
                console.log(`[Email] Boas-vindas Premium enviado para: ${userData.email}`);
              }
            }
          } catch (emailErr) {
            console.error("[Email] Erro ao enviar boas-vindas Premium no webhook:", emailErr);
          }
          break;

        case 'PAYMENT_OVERDUE':
          console.log(`[Asaas Webhook] Pagamento VENCIDO para usuário: ${userId}`);
          await updateUserData({
            subscriptionStatus: 'overdue',
            updatedAt: new Date().toISOString()
          });
          break;

        case 'PAYMENT_REFUNDED':
        case 'PAYMENT_CHARGEBACK_REQUESTED':
          console.log(`[Asaas Webhook] Pagamento ESTORNADO para usuário: ${userId}`);
          await updateUserData({
            plan: 'free',
            subscriptionStatus: 'refunded',
            hadRefundBefore: true,
            updatedAt: new Date().toISOString()
          });
          break;

        case 'PAYMENT_DELETED':
          console.log(`[Asaas Webhook] Pagamento REMOVIDO para usuário: ${userId}`);
          break;

        case 'SUBSCRIPTION_CREATED':
          console.log(`[Asaas Webhook] Assinatura CRIADA para usuário: ${userId}`);
          await updateUserData({
            subscriptionId: event.subscription.id,
            subscriptionStatus: 'active',
            updatedAt: new Date().toISOString()
          });
          break;

        case 'SUBSCRIPTION_DELETED':
        case 'SUBSCRIPTION_INACTIVATED':
          console.log(`[Asaas Webhook] Assinatura CANCELADA/INATIVADA para usuário: ${userId}`);
          await updateUserData({
            subscriptionStatus: 'cancelled',
            cancelAtPeriodEnd: true,
            updatedAt: new Date().toISOString()
          });
          break;
          
        case 'SUBSCRIPTION_UPDATED':
          console.log(`[Asaas Webhook] Assinatura ATUALIZADA para usuário: ${userId}`);
          const sub = event.subscription;
          if (sub) {
            const isSubActive = sub.status === 'ACTIVE';
            await updateUserData({
              plan: isSubActive ? 'premium' : 'free',
              subscriptionStatus: sub.status.toLowerCase(),
              currentPeriodEnd: sub.nextDueDate || null,
              updatedAt: new Date().toISOString()
            });
          }
          break;
      }

      return res.status(200).send('OK');
    } catch (error: any) {
      console.error("[Asaas Webhook] Erro ao processar webhook:", error.message);
      return res.status(500).send('Internal Server Error');
    }
  });

  // Helper for Asaas API calls
  async function asaasFetch(endpoint: string, options: any = {}) {
    try {
      const baseUrl = (process.env.ASAAS_API_URL || "https://sandbox.asaas.com/api/v3").replace(/\/$/, "");
      const path = endpoint.replace(/^\//, "");
      
      // Se houver query params no endpoint, vamos garantir que a URL seja válida
      const url = `${baseUrl}/${path}`;
      
      console.log(`[Asaas Request] ${options.method || 'GET'} ${url}`);

      const response = await fetch(url, {
        ...options,
        headers: {
          'access_token': process.env.ASAAS_API_KEY || "",
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const text = await response.text();
      console.log(`[Asaas Response] Status: ${response.status}`);

      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        data = { message: text };
      }

      if (!response.ok) {
        console.error(`[Asaas Error] Status: ${response.status}`, JSON.stringify(data, null, 2));
        
        let errorMsg = "Erro na API do Asaas";
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          errorMsg = data.errors.map((e: any) => e.description).join(" | ");
        } else if (data.message) {
          errorMsg = data.message;
        } else {
          errorMsg = `Erro na API do Asaas (${response.status})`;
        }
        
        throw new Error(errorMsg);
      }
      return data;
    } catch (error: any) {
      console.error(`Erro em asaasFetch (${endpoint}):`, error.message);
      throw error;
    }
  }

  // Health check route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running" });
  });

  // API Routes
  app.post("/api/create-checkout-session", async (req, res) => {
    console.log("Recebida requisição para checkout Asaas:", req.body);
    const { userId, email, name, cpfCnpj } = req.body;

    // Sanitizar CPF/CNPJ (apenas números)
    const sanitizedCpfCnpj = cpfCnpj ? String(cpfCnpj).replace(/\D/g, '') : undefined;
    
    if (!sanitizedCpfCnpj) {
      return res.status(400).json({ 
        error: "CPF ou CNPJ é obrigatório para realizar uma assinatura no Asaas. Por favor, preencha seus dados de perfil nas Configurações." 
      });
    }

    if (sanitizedCpfCnpj.length !== 11 && sanitizedCpfCnpj.length !== 14) {
      return res.status(400).json({ 
        error: "CPF ou CNPJ inválido. Certifique-se de que o documento possui 11 (CPF) ou 14 (CNPJ) dígitos." 
      });
    }

    if (!process.env.ASAAS_API_KEY) {
      return res.status(500).json({ error: "Configuração do Asaas incompleta no servidor (Chave de API ausente)." });
    }

    try {
      // 1. Buscar ou criar cliente no Asaas
      let customer;
      const encodedEmail = encodeURIComponent(email);
      const customers = await asaasFetch(`/customers?email=${encodedEmail}`);
      
      if (customers.data && customers.data.length > 0) {
        customer = customers.data[0];
        // Atualizar externalReference se estiver vazio
        if (!customer.externalReference) {
          await asaasFetch(`/customers/${customer.id}`, {
            method: 'POST',
            body: JSON.stringify({ externalReference: userId })
          });
        }
        // Se o cliente existe mas não tem CPF/CNPJ e nós temos agora, vamos atualizar
        if (!customer.cpfCnpj && sanitizedCpfCnpj) {
          console.log("Atualizando CPF/CNPJ do cliente existente...");
          customer = await asaasFetch(`/customers/${customer.id}`, {
            method: 'POST',
            body: JSON.stringify({ cpfCnpj: sanitizedCpfCnpj })
          });
        }
      } else {
        console.log("Criando novo cliente no Asaas...");
        customer = await asaasFetch('/customers', {
          method: 'POST',
          body: JSON.stringify({
            name: name || email.split('@')[0],
            email: email,
            cpfCnpj: sanitizedCpfCnpj,
            externalReference: userId
          })
        });
      }

      // 2. Verificar se já existe uma assinatura ATIVA para este cliente
      console.log("Verificando assinaturas existentes para o cliente:", customer.id);
      const existingSubscriptions = await asaasFetch(`/subscriptions?customer=${customer.id}`);
      const activeSub = existingSubscriptions.data?.find((s: any) => s.status === 'ACTIVE');

      if (activeSub) {
        console.log("Assinatura ativa já encontrada:", activeSub.id);
        const payments = await asaasFetch(`/payments?subscription=${activeSub.id}&limit=1&order=desc`);
        if (payments.data && payments.data.length > 0) {
          return res.json({ 
            id: activeSub.id, 
            url: payments.data[0].invoiceUrl,
            message: "Você já possui uma assinatura ativa. Redirecionando para a fatura."
          });
        }
      }

      // 3. Criar uma Assinatura (Subscription) no Asaas se não houver ativa
      console.log("Criando nova assinatura para o cliente:", customer.id);
      
      // Data de vencimento: amanhã
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextDueDate = tomorrow.toISOString().split('T')[0];

      const subscription = await asaasFetch('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          customer: customer.id,
          billingType: 'CREDIT_CARD',
          value: 39.90,
          nextDueDate: nextDueDate,
          cycle: 'MONTHLY',
          description: 'Plano Premium Nutrir',
          externalReference: userId
        })
      });

      // 4. Buscar a cobrança inicial
      console.log("Buscando cobrança inicial para assinatura:", subscription.id);
      const payments = await asaasFetch(`/payments?subscription=${subscription.id}`);
      
      if (!payments.data || payments.data.length === 0) {
        throw new Error("A assinatura foi criada, mas nenhuma cobrança inicial foi gerada pelo Asaas. Verifique seu painel Asaas.");
      }

      const firstPayment = payments.data[0];

      res.json({ 
        id: subscription.id, 
        url: firstPayment.invoiceUrl
      });
    } catch (error: any) {
      console.error("Erro detalhado ao criar assinatura no Asaas:", error);
      res.status(500).json({ error: error.message || "Erro desconhecido na integração com Asaas" });
    }
  });

  app.post("/api/verify-subscription", async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório." });
    }

    try {
      const encodedEmail = encodeURIComponent(email);
      const customers = await asaasFetch(`/customers?email=${encodedEmail}`);
      
      if (!customers.data || customers.data.length === 0) {
        return res.json({ status: "no_customer", message: "Nenhum cliente encontrado." });
      }

      const customerId = customers.data[0].id;
      const subscriptions = await asaasFetch(`/subscriptions?customer=${customerId}`);

      if (subscriptions.data && subscriptions.data.length > 0) {
        // Ordenar por data de criação decrescente para pegar a mais recente
        const sortedSubs = [...subscriptions.data].sort((a: any, b: any) => 
          new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
        );

        // Busca a assinatura ATIVA primeiro
        const activeSub = sortedSubs.find((s: any) => s.status === 'ACTIVE');
        const sub = activeSub || sortedSubs[0];
        const isActive = sub.status === 'ACTIVE';
        
        // BUSCA PAGAMENTOS: Só damos Premium se houver pelo menos um pagamento CONFIRMADO ou RECEBIDO
        const payments = await asaasFetch(`/payments?subscription=${sub.id}&status=CONFIRMED,RECEIVED`);
        const hasPaidPayment = payments.data && payments.data.length > 0;

        const now = new Date();
        // Garantir que nextDueDate seja tratado como o fim do dia pago
        const nextDueDate = sub.nextDueDate ? new Date(sub.nextDueDate + 'T23:59:59') : null;
        
        let plan = "free";

        // Caso 1: Assinatura Ativa e com pelo menos um pagamento realizado
        if (isActive && hasPaidPayment) {
          plan = "premium";
        } 
        // Caso 2: Assinatura Cancelada (DELETED) mas ainda dentro do prazo pago (e houve pagamento prévio)
        else if ((sub.status === 'DELETED' || sub.deleted) && nextDueDate && nextDueDate >= now && hasPaidPayment) {
          plan = "premium";
        }
        
        return res.json({ 
          status: sub.status, 
          plan: plan,
          subscriptionId: sub.id,
          subscriptionStatus: sub.status,
          cancelAtPeriodEnd: sub.status === 'DELETED' || sub.deleted,
          currentPeriodEnd: sub.nextDueDate,
          subscriptionCreatedAt: sub.dateCreated,
          message: plan === "premium" ? "Assinatura válida encontrada." : "Assinatura encontrada, mas aguardando confirmação de pagamento."
        });
      }

      res.json({ status: "none", plan: "free", message: "Nenhuma assinatura encontrada." });
    } catch (error: any) {
      console.error("Erro ao verificar assinatura no Asaas:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/create-portal-session", async (req, res) => {
    const { email } = req.body;

    try {
      const encodedEmail = encodeURIComponent(email);
      const customers = await asaasFetch(`/customers?email=${encodedEmail}`);
      
      // Se o cliente não existe no Asaas, não há portal para mostrar
      if (!customers.data || customers.data.length === 0) {
        return res.status(404).json({ error: "Nenhuma assinatura ou histórico de pagamentos encontrado no Asaas." });
      }

      const customer = customers.data[0];
      
      // No Asaas não existe um "Portal do Cliente" idêntico ao de outros gateways.
      // Vamos buscar a última cobrança e retornar a invoiceUrl, que é pública.
      const payments = await asaasFetch(`/payments?customer=${customer.id}&limit=1&order=desc`);
      
      if (payments.data && payments.data.length > 0) {
        res.json({ url: payments.data[0].invoiceUrl });
      } else {
        // Se não houver cobrança, retornamos um erro informativo
        res.status(404).json({ error: "Nenhuma fatura encontrada. Se você acabou de assinar, aguarde alguns instantes." });
      }
    } catch (error: any) {
      console.error("Erro ao buscar portal Asaas:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/cancel-subscription", async (req, res) => {
    const { email } = req.body;

    try {
      const encodedEmail = encodeURIComponent(email);
      const customers = await asaasFetch(`/customers?email=${encodedEmail}`);
      
      // Se o cliente não existe no Asaas, ele não tem assinatura ativa para cancelar.
      // Retornamos sucesso para permitir que o frontend limpe o estado local.
      if (!customers.data || customers.data.length === 0) {
        return res.json({ 
          success: true, 
          message: "Nenhuma assinatura encontrada no Asaas para este e-mail.",
          refunded: false 
        });
      }

      const customer = customers.data[0];
      const subscriptions = await asaasFetch(`/subscriptions?customer=${customer.id}`);
      const activeSub = subscriptions.data?.find((s: any) => s.status === 'ACTIVE');

      if (!activeSub) {
        return res.status(400).json({ error: "Nenhuma assinatura ativa encontrada." });
      }

      // 1. Buscar ID do documento do usuário para atualização posterior
      let userDocId: string | null = null;
      try {
        const nutritionists = await adminDb.collection('nutritionists').where('email', '==', email).get();
        if (!nutritionists.empty) {
          userDocId = nutritionists.docs[0].id;
        }
      } catch (adminErr: any) {
        if (adminErr.message?.includes('PERMISSION_DENIED')) {
          const q = query(collection(clientDb, 'nutritionists'), where('email', '==', email));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            userDocId = snapshot.docs[0].id;
          }
        }
      }

      // 2. Verificar se é elegível para reembolso (dentro de 7 dias)
      const createdDate = activeSub.dateCreated ? new Date(activeSub.dateCreated) : new Date();
      const now = new Date();
      const diffDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      const isEligibleForRefund = diffDays <= 7;
      let refunded = false;

      // 3. Se for elegível, tentar estornar os pagamentos confirmados
      if (isEligibleForRefund) {
        try {
          console.log(`[Refund] Iniciando processo de estorno para assinatura ${activeSub.id} (Criada há ${diffDays.toFixed(1)} dias)`);
          
          // Buscar pagamentos confirmados/recebidos desta assinatura
          const paymentsResponse = await asaasFetch(`/payments?subscription=${activeSub.id}&status=CONFIRMED,RECEIVED`);
          
          if (paymentsResponse.data && paymentsResponse.data.length > 0) {
            for (const payment of paymentsResponse.data) {
              console.log(`[Refund] Estornando pagamento ${payment.id}...`);
              await asaasFetch(`/payments/${payment.id}/refund`, { method: 'POST' });
              refunded = true;
            }
          }
        } catch (refundErr: any) {
          console.error("[Refund] Erro ao processar estorno:", refundErr.message);
          // Continuamos com o cancelamento mesmo se o estorno falhar (ex: saldo insuficiente na conta Asaas)
        }
      }

      // 4. Cancelar assinatura no Asaas (apenas interrompe renovações futuras)
      try {
        await asaasFetch(`/subscriptions/${activeSub.id}`, { method: 'DELETE' });
        console.log(`[Cancel] Assinatura ${activeSub.id} cancelada com sucesso.`);
      } catch (e: any) {
        console.error("Erro ao cancelar assinatura no Asaas:", e.message);
        return res.status(500).json({ error: "Erro ao processar cancelamento no Asaas." });
      }

      // 5. Atualizar Firestore imediatamente para consistência
      if (userDocId) {
        try {
          const updateData: any = {
            subscriptionStatus: refunded ? 'refunded' : 'cancelled',
            cancelAtPeriodEnd: !refunded, // Se estornou, cancela agora. Se não, cancela no fim do período.
            updatedAt: new Date().toISOString(),
          };

          if (refunded) {
            updateData.plan = 'free';
            updateData.subscriptionId = null;
            updateData.currentPeriodEnd = null;
            updateData.hadRefundBefore = true;
          }

          try {
            await adminDb.collection('nutritionists').doc(userDocId).update(updateData);
          } catch (adminUpdateErr: any) {
            if (adminUpdateErr.message?.includes('PERMISSION_DENIED')) {
              await updateDoc(doc(clientDb, 'nutritionists', userDocId), updateData);
            } else {
              throw adminUpdateErr;
            }
          }
          console.log(`[Cancel] Firestore atualizado para usuário ${email}. Estornado: ${refunded}`);
        } catch (fsError) {
          console.error("Erro ao atualizar Firestore no cancelamento:", fsError);
        }
      }

      res.json({ 
        success: true, 
        refunded: refunded, 
        message: refunded 
          ? "Assinatura cancelada e reembolso solicitado com sucesso! O valor aparecerá na sua fatura em breve." 
          : "Assinatura cancelada com sucesso. Você manterá o acesso Premium até o final do período já pago."
      });
    } catch (error: any) {
      console.error("Erro no cancelamento Asaas:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Erro não tratado:", err);
    res.status(500).json({ error: err.message || "Erro interno do servidor" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    
    // Iniciar túnel do webhook se a URL do Smee estiver configurada
    const SMEE_URL = "https://smee.io/E2JeImFJtaeTbTlr";
    if (SMEE_URL) {
      const smee = new SmeeClient({
        source: SMEE_URL,
        target: `http://localhost:${PORT}/api/asaas-webhook`,
        logger: console
      });
      smee.start();
      console.log(`[Webhook Tunnel] Ativo: ${SMEE_URL} -> http://localhost:${PORT}/api/asaas-webhook`);
    }
  });
}

startServer();
