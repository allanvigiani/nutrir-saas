import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Droplets, Loader2, MessageSquare, Printer, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export interface FreeTextMealPlanEditorProps {
  initialName?: string;
  initialWaterIntake?: string;
  initialGeneralInstructions?: string;
  initialFreeTextContent?: string;
  isNew?: boolean;
  onSave: (data: {
    name: string;
    waterIntake: string;
    generalInstructions: string;
    freeTextContent: string;
  }) => Promise<boolean>;
  onPrint?: () => Promise<void>;
  onClose: () => void;
}

export function FreeTextMealPlanEditor({
  initialName = '',
  initialWaterIntake = '',
  initialGeneralInstructions = '',
  initialFreeTextContent = '',
  isNew = false,
  onSave,
  onPrint,
  onClose,
}: FreeTextMealPlanEditorProps) {
  const [name, setName] = useState(initialName);
  const [waterIntake, setWaterIntake] = useState(initialWaterIntake);
  const [generalInstructions, setGeneralInstructions] = useState(initialGeneralInstructions);
  const [freeTextContent, setFreeTextContent] = useState(initialFreeTextContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const [savedSnapshot, setSavedSnapshot] = useState(() => ({
    name: initialName,
    waterIntake: initialWaterIntake,
    generalInstructions: initialGeneralInstructions,
    freeTextContent: initialFreeTextContent,
  }));

  const hasUnsavedChanges = useMemo(() => {
    return (
      name !== savedSnapshot.name ||
      waterIntake !== savedSnapshot.waterIntake ||
      generalInstructions !== savedSnapshot.generalInstructions ||
      freeTextContent !== savedSnapshot.freeTextContent
    );
  }, [name, waterIntake, generalInstructions, freeTextContent, savedSnapshot]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleRequestClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowLeaveConfirm(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  const handleSaveClick = useCallback(async () => {
    if (!freeTextContent.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      const success = await onSave({ name, waterIntake, generalInstructions, freeTextContent });
      if (success) {
        setSavedSnapshot({ name, waterIntake, generalInstructions, freeTextContent });
      }
    } finally {
      setIsSaving(false);
    }
  }, [onSave, name, waterIntake, generalInstructions, freeTextContent]);

  return (
    <div className="h-screen flex flex-col bg-muted/30">
      <div className="sticky top-0 z-50 bg-card border-b border-border px-3 py-2 md:px-4 xl:px-6 xl:py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-5">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRequestClose}
              className="rounded-lg border-border hover:bg-muted/30 transition-all h-8 w-8 shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </Button>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span>Plano Alimentar</span>
              <span className="text-primary font-semibold">· Livre</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onPrint && (
              <Button
                variant="outline"
                size="icon"
                onClick={async () => {
                  setIsPrinting(true);
                  try { await onPrint(); } finally { setIsPrinting(false); }
                }}
                disabled={hasUnsavedChanges || isPrinting}
                title={hasUnsavedChanges ? 'Salve as alterações antes de imprimir' : 'Baixar PDF'}
                className="rounded-lg border-border hover:bg-muted/30 transition-all h-8 w-8 shrink-0"
              >
                {isPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 text-muted-foreground" />}
              </Button>
            )}
            <Button
              onClick={handleSaveClick}
              disabled={isSaving || !freeTextContent.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-8 px-4 font-medium text-xs gap-2 transition-all active:scale-95"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isNew ? 'Criar Plano' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto p-4 xl:p-6 space-y-4">
          <div className="bg-card rounded-xl p-4 border border-border space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground ml-1">Nome do Plano</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-sm font-medium border border-border bg-card h-9 rounded-lg px-3"
                  placeholder="Ex: Estratégia de Cutting..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground ml-1">Ingestão de Água</Label>
                <div className="relative">
                  <Droplets className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={waterIntake}
                    onChange={(e) => setWaterIntake(e.target.value)}
                    className="pl-9 border border-border bg-card h-9 rounded-lg"
                    placeholder="Ex: 2,5L"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border">
              <div className="flex items-center gap-2 mb-2 px-1">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs font-medium text-muted-foreground">Orientações Gerais</Label>
              </div>
              <Textarea
                placeholder="Quais as orientações principais para este plano?"
                className="min-h-[72px] rounded-lg border border-border bg-card resize-none text-sm leading-relaxed p-3"
                value={generalInstructions}
                onChange={(e) => setGeneralInstructions(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border space-y-2">
            <Label className="text-xs font-medium text-muted-foreground ml-1">Plano Alimentar (cole aqui)</Label>
            <Textarea
              placeholder="Cole aqui o plano alimentar completo..."
              className="min-h-[420px] rounded-lg border border-border bg-card resize-y text-sm leading-relaxed p-3 font-mono"
              value={freeTextContent}
              onChange={(e) => setFreeTextContent(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sair sem salvar?</DialogTitle>
            <DialogDescription>
              Você tem alterações não salvas neste plano alimentar. Se sair agora, elas serão perdidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setShowLeaveConfirm(false)}>
              Continuar editando
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowLeaveConfirm(false);
                onClose();
              }}
            >
              Sair sem salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
