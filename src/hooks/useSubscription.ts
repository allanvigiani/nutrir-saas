import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { logEvent } from '../lib/firebase';
import { apiRequest } from './useApi';

const PENDING_PAYMENT_KEY = 'nutrir_pending_payment';

export const useSubscription = () => {
  const { user } = useAuth();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  // Ref para acessar verifySubscription dentro do listener sem closure stale
  const verifyRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);

  const handleManageSubscription = async () => {
    if (!user?.email) return;
    
    setIsManaging(true);
    const toastId = toast.loading('Abrindo portal de gerenciamento...');

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: user.email,
          returnUrl: window.location.href
        }),
      });

      const data = await response.json();

      if (data.url) {
        // Usar window.open para evitar restrições de iframe
        const portalWindow = window.open(data.url, '_blank');
        
        if (!portalWindow) {
          console.warn("Popup bloqueado, tentando redirecionar na mesma janela");
          window.location.href = data.url;
        }
      } else {
        throw new Error(data.error || 'URL do portal não encontrada.');
      }
    } catch (error: any) {
      console.error('Erro ao abrir portal:', error);
      toast.error('Erro ao abrir portal: ' + (error.message || 'Tente novamente.'), { id: toastId });
    } finally {
      setIsManaging(false);
      toast.dismiss(toastId);
    }
  };

  const verifySubscription = async (silent = false) => {
    if (!user?.email) return;
    
    setIsVerifying(true);
    const toastId = !silent ? toast.loading('Verificando assinatura no Asaas...') : null;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/verify-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: user.email,
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error('Resposta inválida do servidor ao verificar assinatura.');
      }

      if (data.plan) {
        // Atualiza a tabela subscriptions com os dados reais do Asaas
        const updateData: any = {
          plan: data.plan,
          asaasSubscriptionId: data.subscriptionId || null,
          asaasStatus: data.subscriptionStatus || null,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
          currentPeriodEnd: data.currentPeriodEnd || null,
          lastCheckedAt: new Date().toISOString(),
        };

        // Se for a primeira vez que identificamos uma assinatura, salva a data de criação
        if (data.plan === 'premium' && data.subscriptionCreatedAt) {
          updateData.firstSubscriptionDate = data.subscriptionCreatedAt;
        }

        await apiRequest('/api/subscription', 'PUT', updateData);

        if (!silent) {
          if (data.plan === 'premium') {
            toast.success('Assinatura Premium identificada e ativada!', { id: toastId! });
          } else {
            toast.info('Sua assinatura não está ativa. Plano Gratuito mantido.', { id: toastId! });
          }
        }
      } else if (!silent) {
        toast.error('Não foi possível verificar sua assinatura.', { id: toastId! });
      }
    } catch (error: any) {
      console.error('Erro ao verificar assinatura:', error);
      if (!silent) {
        toast.error('Erro ao verificar assinatura: ' + (error.message || 'Tente novamente.'), { id: toastId! });
      }
    } finally {
      setIsVerifying(false);
      if (toastId) toast.dismiss(toastId);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      toast.error('Você precisa estar logado para assinar.');
      return;
    }
    
    setIsSubscribing(true);
    const toastId = toast.loading('Iniciando checkout...');

    try {
      const token = await user.getIdToken();
      // Busca dados do nutricionista para ter o CPF/CNPJ se disponível
      const nutritionistData = await apiRequest<any>('/api/me', 'GET');
      const cpfCnpj = nutritionistData?.cpf || nutritionistData?.cnpj || nutritionistData?.cpfCnpj;

      if (!cpfCnpj) {
        toast.error('CPF ou CNPJ não encontrado. Por favor, preencha seus dados nas Configurações antes de assinar.', { id: toastId });
        setIsSubscribing(false);
        return;
      }

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          name: user.displayName || nutritionistData?.name,
          cpfCnpj: cpfCnpj
        }),
      });

      const text = await response.text();
      let session;
      try {
        session = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error('Resposta inválida do servidor: ' + text.substring(0, 100));
      }

      if (session.error) {
        throw new Error(session.error);
      }

      console.log("Sessão criada com sucesso:", session);
      
      if (session.url) {
        console.log("Redirecionando para:", session.url);
        // Marca pagamento pendente — ao voltar para a aba, verifica automaticamente
        void logEvent('inicio_upgrade_premium');
        localStorage.setItem(PENDING_PAYMENT_KEY, 'true');
        const checkoutWindow = window.open(session.url, '_blank');

        if (!checkoutWindow) {
          console.warn("Popup bloqueado, tentando redirecionar na mesma janela");
          window.location.href = session.url;
        }
      } else {
        throw new Error('URL de checkout não encontrada.');
      }
    } catch (error: any) {
      console.error('Erro ao iniciar assinatura:', error);
      toast.error('Erro ao iniciar assinatura: ' + (error.message || 'Tente novamente.'), { id: toastId });
    } finally {
      setIsSubscribing(false);
      toast.dismiss(toastId);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user?.email) return;

    setIsManaging(true);
    const toastId = toast.loading('Processando cancelamento...');

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: user.email,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Se houve reembolso, remove o acesso imediatamente
        // Se NÃO houve reembolso, mantém o acesso até o fim do período (cancelAtPeriodEnd)
        const updateData: any = {
          asaasStatus: 'cancelled',
        };

        if (data.refunded) {
          updateData.plan = 'free';
          updateData.asaasSubscriptionId = null;
          updateData.currentPeriodEnd = null;
          updateData.hadRefundBefore = true;
          toast.success('Assinatura cancelada e reembolso solicitado!', { id: toastId });
        } else {
          updateData.cancelAtPeriodEnd = true;
          toast.success('Assinatura cancelada! Você manterá o acesso Premium até o final do período atual.', { id: toastId });
        }

        await apiRequest('/api/subscription', 'PUT', updateData);
      } else {
        throw new Error(data.error || 'Erro ao processar cancelamento.');
      }
    } catch (error: any) {
      console.error('Erro no cancelamento:', error);
      toast.error('Erro: ' + (error.message || 'Tente novamente.'), { id: toastId });
    } finally {
      setIsManaging(false);
      toast.dismiss(toastId);
    }
  };

  // Mantém a ref sempre atualizada com a versão atual de verifySubscription
  verifyRef.current = verifySubscription;

  // Ao retornar à aba após abrir o checkout Asaas, verifica silenciosamente
  useEffect(() => {
    if (!user) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && localStorage.getItem(PENDING_PAYMENT_KEY)) {
        verifyRef.current?.(true).then(() => {
          localStorage.removeItem(PENDING_PAYMENT_KEY);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user]);

  return {
    handleSubscribe,
    verifySubscription,
    handleManageSubscription,
    handleCancelSubscription,
    isSubscribing,
    isVerifying,
    isManaging
  };
};
