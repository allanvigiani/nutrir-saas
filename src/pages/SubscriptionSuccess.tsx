import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export const SubscriptionSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const finalizeSubscription = async () => {
      if (!user || !sessionId) {
        setIsProcessing(false);
        return;
      }

      try {
        // Verify with Asaas to get real subscription data
        const response = await fetch('/api/verify-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
        });
        
        const asaasData = await response.json();

        if (asaasData.plan === 'premium') {
          await updateDoc(doc(db, 'nutritionists', user.uid), {
            plan: 'premium',
            subscriptionId: asaasData.subscriptionId || sessionId,
            subscriptionStatus: asaasData.subscriptionStatus || 'active',
            cancelAtPeriodEnd: asaasData.cancelAtPeriodEnd || false,
            currentPeriodEnd: asaasData.currentPeriodEnd || null,
            firstSubscriptionDate: asaasData.subscriptionCreatedAt || new Date().toISOString(),
            lastSubscriptionCheck: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          toast.success('Assinatura confirmada! Bem-vindo ao Premium.');
        } else {
          // Fallback if Asaas hasn't updated yet (rare but possible)
          await updateDoc(doc(db, 'nutritionists', user.uid), {
            plan: 'premium',
            subscriptionId: sessionId,
            updatedAt: new Date().toISOString(),
          });
          toast.success('Assinatura em processamento. Seu acesso Premium será liberado em instantes.');
        }
      } catch (error) {
        console.error('Error updating subscription:', error);
        toast.error('Erro ao processar sua assinatura.');
      } finally {
        setIsProcessing(false);
      }
    };

    finalizeSubscription();
  }, [user, sessionId]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto" />
          <p className="text-slate-600 font-medium">Processando sua assinatura...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full border-none shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">Pagamento Confirmado!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-slate-500">
            Sua assinatura de R$ 39,90/mês foi ativada com sucesso. Agora você tem acesso ilimitado a todos os recursos do sistema.
          </p>
          <Button 
            onClick={() => navigate('/')}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl h-12 font-bold transition-all active:scale-95"
          >
            Ir para o Dashboard <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
