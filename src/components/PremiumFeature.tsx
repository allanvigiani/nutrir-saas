import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from "./ui/tooltip";
import { UpgradeModal } from './UpgradeModal';
import { cn } from '../lib/utils';

interface PremiumFeatureProps {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}

export const PremiumFeature = ({ children, className, active = true }: PremiumFeatureProps) => {
  const { nutritionist } = useAuth();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const isPremium = nutritionist?.plan === 'premium';

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
            className={cn("relative inline-block cursor-not-allowed opacity-60", className)}
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
      />
    </>
  );
};
