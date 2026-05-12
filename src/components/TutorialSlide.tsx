import React from 'react';
import { cn } from '@/lib/utils';
import { type TutorialSlideData } from './tutorial/slides';

interface TutorialSlideProps {
  slide: TutorialSlideData;
}

export function TutorialSlide({ slide }: TutorialSlideProps) {
  const { icon, title, description, accentClass, Preview } = slide;

  return (
    <div className="relative h-72 bg-muted/30 overflow-hidden">
      {/* Preview do módulo ao fundo (opacidade reduzida) */}
      <div className="absolute inset-0 opacity-45 pointer-events-none">
        <Preview />
      </div>

      {/* Overlay card com destaque */}
      <div className="absolute bottom-4 left-4 right-4">
        <div
          className={cn(
            'rounded-xl px-4 py-3 shadow-lg',
            accentClass ?? 'bg-primary text-primary-foreground',
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl" role="img" aria-hidden="true">{icon}</span>
            <span className="font-semibold text-sm">{title}</span>
          </div>
          <p className="text-xs leading-relaxed opacity-90">{description}</p>
        </div>
      </div>
    </div>
  );
}
