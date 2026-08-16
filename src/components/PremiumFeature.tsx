import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from "./ui/tooltip";
import { UpgradeModal, type BenefitKey } from './UpgradeModal';
import { cn } from '../lib/utils';
import { isAdminOrPremium } from '../lib/planLimits';

interface PremiumFeatureProps {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  /** Gatilho repassado ao UpgradeModal para destacar o benefício correspondente. */
  trigger?: BenefitKey;
  /** 'lock' (padrão) esconde o conteúdo com opacidade; 'blur' borra mantendo o conteúdo real visível como prévia. */
  variant?: 'lock' | 'blur';
}

export const PremiumFeature = ({ children, className, active = true, trigger, variant = 'lock' }: PremiumFeatureProps) => {
  const { nutritionist } = useAuth();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const isPremium = isAdminOrPremium(nutritionist);

  if (isPremium || !active) {
    return <>{children}</>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsUpgradeModalOpen(true);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger render={
          <div
            className={cn("relative inline-block cursor-not-allowed", variant === 'blur' ? 'blur-sm' : 'opacity-60', className)}
            onClick={handleClick}
          />
        }>
          <div className="pointer-events-none select-none">
            {children}
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-card/80 p-1 rounded-full shadow-sm">
            <Lock className="w-4 h-4 text-muted-foreground" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Disponível no plano Premium</p>
        </TooltipContent>
      </Tooltip>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        trigger={trigger}
      />
    </>
  );
};
