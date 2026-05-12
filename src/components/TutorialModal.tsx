import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useTutorial } from '../contexts/TutorialContext';
import { TutorialSlide } from './TutorialSlide';
import { TUTORIAL_SLIDES, TOTAL_SLIDES } from './tutorial/slides';

export function TutorialModal() {
  const { isOpen, closeTutorial } = useTutorial();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  const handleNext = useCallback(() => {
    if (step < TOTAL_SLIDES - 1) {
      setStep((s) => s + 1);
    } else {
      closeTutorial();
    }
  }, [step, closeTutorial]);

  const handleBack = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTutorial();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleNext, handleBack, closeTutorial]);

  if (!isOpen) return null;

  const slide = TUTORIAL_SLIDES[step];
  const isFirst = step === 0;
  const isLast = step === TOTAL_SLIDES - 1;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeTutorial();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-2xl p-0 overflow-hidden gap-0"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Passo {step + 1} de {TOTAL_SLIDES}
            </span>
            <div className="flex gap-0.5" role="progressbar" aria-valuenow={step + 1} aria-valuemax={TOTAL_SLIDES}>
              {TUTORIAL_SLIDES.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1 w-5 rounded-full transition-colors',
                    i <= step ? 'bg-primary' : 'bg-muted',
                  )}
                />
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs gap-1 h-7 px-2"
            onClick={closeTutorial}
          >
            Fechar <X className="w-3 h-3" />
          </Button>
        </div>

        {/* ── Body ── */}
        <TutorialSlide slide={slide} />

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            disabled={isFirst}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>

          <div className="flex gap-1.5">
            {TUTORIAL_SLIDES.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-full transition-all',
                  i === step
                    ? 'w-3 h-2 bg-primary'
                    : 'w-2 h-2 bg-muted-foreground/30',
                )}
              />
            ))}
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={handleNext}
            className="gap-1"
          >
            {isLast ? (
              <>Concluir <Check className="w-4 h-4" /></>
            ) : (
              <>Próximo <ChevronRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
