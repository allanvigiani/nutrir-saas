import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Check, ShieldCheck, Zap, Users, History, FileUp, BarChart3, Download, Layers, Loader2 } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpgradeModal = ({ isOpen, onClose }: UpgradeModalProps) => {
  const { handleSubscribe, verifySubscription, isSubscribing, isVerifying } = useSubscription();

  const benefits = [
    { icon: Users, text: "Pacientes ilimitados (limite de 3 no gratuito)" },
    { icon: History, text: "Histórico completo (limite de 3 meses no gratuito)" },
    { icon: FileUp, text: "Upload de laudos e exames em PDF" },
    { icon: BarChart3, text: "Gráficos de evolução detalhados" },
    { icon: Download, text: "Exportação em PDF e Excel" },
    { icon: Layers, text: "Múltiplos planos alimentares simultâneos" },
    { icon: Zap, text: "Acesso antecipado a novas funcionalidades" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <DialogTitle className="text-2xl text-center font-bold text-slate-900">
            Seja Premium no Nutrir
          </DialogTitle>
          <DialogDescription className="text-center text-slate-500">
            Desbloqueie todo o potencial do seu consultório e ofereça o melhor acompanhamento para seus pacientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="mt-1 w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-emerald-600" />
              </div>
              <div className="flex gap-2 items-center">
                <benefit.icon className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">{benefit.text}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
          <p className="text-xs text-slate-500 text-center">
            Assine agora por apenas <span className="font-bold text-slate-900">R$ 39,90/mês</span> e cancele quando quiser.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleSubscribe}
            disabled={isSubscribing}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-6 rounded-xl shadow-lg shadow-emerald-100 transition-all active:scale-[0.98]"
          >
            {isSubscribing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Processando...
              </>
            ) : (
              'Quero ser Premium agora'
            )}
          </Button>

          <Button 
            variant="outline"
            onClick={() => {
              void verifySubscription();
            }}
            disabled={isVerifying}
            className="w-full border-slate-200 text-slate-600 font-medium py-6 rounded-xl transition-all active:scale-[0.98]"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Verificando...
              </>
            ) : (
              'Já assinei? Verificar agora'
            )}
          </Button>

          <Button 
            variant="ghost"
            onClick={onClose}
            className="w-full text-slate-400 hover:text-slate-600 font-medium"
          >
            Talvez mais tarde
          </Button>
          <p className="text-[10px] text-center mt-4 opacity-60 text-slate-400">
            Pagamento processado com segurança pelo Asaas.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
