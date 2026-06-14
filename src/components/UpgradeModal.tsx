import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Check, ShieldCheck, Zap, Users, History, FileUp, BarChart3, Download, Layers, Loader2, TrendingUp } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpgradeModal = ({ isOpen, onClose }: UpgradeModalProps) => {
  const { handleSubscribe, verifySubscription, isSubscribing, isVerifying } = useSubscription();

  const benefits = [
    { icon: Users, text: "Pacientes ilimitados (limite de 2 no gratuito)" },
    { icon: TrendingUp, text: "Consultas ilimitadas (limite de 2/mês no gratuito)" },
    { icon: History, text: "Histórico completo (limite de 3 meses no gratuito)" },
    { icon: FileUp, text: "Upload de laudos e exames em PDF" },
    { icon: BarChart3, text: "Gráficos de evolução detalhados" },
    { icon: Download, text: "Exportação em PDF e Excel" },
    { icon: Layers, text: "Múltiplos planos alimentares simultâneos" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-2xl text-center font-bold text-foreground">
            Seja Premium no Nutrir
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Desbloqueie todo o potencial do seu consultório e ofereça o melhor acompanhamento para seus pacientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="mt-1 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-primary" />
              </div>
              <div className="flex gap-2 items-center">
                <benefit.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{benefit.text}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-muted/30 p-4 rounded-xl border border-border mb-4">
          <p className="text-xs text-muted-foreground text-center">
            Assine agora por apenas <span className="font-bold text-foreground">R$ 39,90/mês</span> e cancele quando quiser.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleSubscribe}
            disabled={isSubscribing}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-[0.98]"
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
            className="w-full border-border text-muted-foreground font-medium py-6 rounded-xl transition-all active:scale-[0.98]"
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
            className="w-full text-muted-foreground hover:text-muted-foreground font-medium"
          >
            Talvez mais tarde
          </Button>
          <p className="text-[10px] text-center mt-4 opacity-60 text-muted-foreground">
            Pagamento processado com segurança pelo{' '}
            <a
              href="https://www.asaas.com/sobre-nos"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              Asaas
            </a>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
