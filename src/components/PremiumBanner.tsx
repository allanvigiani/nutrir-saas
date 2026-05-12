import React, { useState } from 'react';
import { Award, Zap, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { UpgradeModal } from './UpgradeModal';
import { cn } from '../lib/utils';
import { useSubscription } from '../hooks/useSubscription';

interface PremiumBannerProps {
  className?: string;
  title?: string;
  description?: string;
}

export const PremiumBanner = ({ 
  className, 
  title = "Desbloqueie o Plano Premium", 
  description = "Remova todos os limites e tenha acesso a recursos exclusivos para o seu consultório."
}: PremiumBannerProps) => {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const { verifySubscription, isVerifying } = useSubscription();

  return (
    <>
      <div className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-6 text-white shadow-lg shadow-primary/10",
        className
      )}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Award className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="text-sm text-primary-foreground opacity-90">{description}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button 
              onClick={() => setIsUpgradeModalOpen(true)}
              className="bg-white text-primary hover:bg-white/85 font-bold rounded-xl h-10 px-6 gap-2 transition-all active:scale-95 shadow-sm"
            >
              <Zap className="w-4 h-4" /> Conhecer Premium <ArrowRight className="w-4 h-4" />
            </Button>
            <button 
              onClick={() => {
                void verifySubscription();
              }}
              disabled={isVerifying}
              className="text-[10px] text-primary-foreground/60 hover:text-primary-foreground underline transition-colors disabled:opacity-50"
            >
              {isVerifying ? 'Verificando...' : 'Já assinou? Clique para sincronizar'}
            </button>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-black/20 blur-2xl" />
      </div>

      <UpgradeModal 
        isOpen={isUpgradeModalOpen} 
        onClose={() => setIsUpgradeModalOpen(false)} 
      />
    </>
  );
};
