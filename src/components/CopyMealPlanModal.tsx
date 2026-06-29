import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Loader2, FilePlus, Copy, X, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { auth } from '@/lib/firebase';

// ─── Tipos espelhando o contrato de API ───────────────────────────────────────

interface MealPlanItemHistory {
  id?: string;
  meal_plan_id?: string;
  nutritionist_id?: string;
  meal: string;
  food: string;
  quantity: string;
  unit: string;
  kcal?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  base_kcal?: number | null;
  base_protein?: number | null;
  base_carbs?: number | null;
  base_fat?: number | null;
  base_quantity?: number | null;
  serving_name?: string | null;
  serving_weight?: number | null;
  weight_in_grams: number;
  position: number;
}

export interface MealPlanHistoryEntry {
  consultationId: string;
  consultationDate: string; // ISO 8601
  mealPlan: {
    id: string;
    name: string;
    generalInstructions: string | null;
    waterIntake: string | null;
    mealObservations: Record<string, string> | null;
    customMeals: string[] | null;
    items: MealPlanItemHistory[];
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CopyMealPlanModalProps {
  isOpen: boolean;
  patientId: string;
  /** ID da consulta atual — exclui ela da lista */
  currentConsultationId: string;
  onClose: () => void;
  /** Chamado quando o usuário quer criar do zero (sem dados copiados) */
  onCreateFromScratch: () => void;
  /** Chamado quando o usuário seleciona um plano para copiar */
  onCopyPlan: (entry: MealPlanHistoryEntry) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CopyMealPlanModal({
  isOpen,
  patientId,
  currentConsultationId,
  onClose,
  onCreateFromScratch,
  onCopyPlan,
}: CopyMealPlanModalProps) {
  const [historico, setHistorico] = useState<MealPlanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  // ── Busca o histórico quando o modal abre ──────────────────────────────────
  const fetchHistorico = useCallback(async () => {
    if (!isOpen || !patientId) return;

    setLoading(true);
    setError(null);
    setSelecionado(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const url = `/api/patients/${patientId}/meal-plans/history?excludeConsultationId=${currentConsultationId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: MealPlanHistoryEntry[] = await res.json();
      setHistorico(data);
    } catch (err) {
      console.error('Erro ao buscar histórico de planos:', err);
      setError('Não foi possível carregar o histórico de planos.');
    } finally {
      setLoading(false);
    }
  }, [isOpen, patientId, currentConsultationId]);

  useEffect(() => {
    fetchHistorico();
  }, [fetchHistorico]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSelecionar(consultationId: string) {
    setSelecionado(prev => (prev === consultationId ? null : consultationId));
  }

  function handleCopiar() {
    const entrada = historico.find(h => h.consultationId === selecionado);
    if (entrada) onCopyPlan(entrada);
  }

  // ── Renderização ──────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0">
        {/* Cabeçalho */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Copy className="w-4 h-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground leading-tight">
                Copiar Plano Alimentar
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Selecione um plano de consulta anterior ou crie do zero
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo */}
        <div className="px-6 py-4 space-y-3">
          {/* Estado: loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            </div>
          )}

          {/* Estado: erro */}
          {!loading && error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchHistorico}
                className="w-full"
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Lista de planos anteriores */}
          {!loading && !error && historico.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Consultas com plano alimentar
              </p>
              <ScrollArea className="max-h-[280px] pr-1">
                <div className="space-y-2">
                  {historico.map(entrada => {
                    const isSelecionado = selecionado === entrada.consultationId;
                    const dataFormatada = (() => {
                      try {
                        return format(parseISO(entrada.consultationDate), "dd/MM/yyyy", { locale: ptBR });
                      } catch {
                        return entrada.consultationDate;
                      }
                    })();

                    return (
                      <button
                        key={entrada.consultationId}
                        type="button"
                        onClick={() => handleSelecionar(entrada.consultationId)}
                        className={cn(
                          'w-full text-left rounded-xl border px-4 py-3 transition-all duration-150',
                          'hover:border-primary/40 hover:bg-primary/5',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                          isSelecionado
                            ? 'border-primary bg-primary/8 shadow-sm'
                            : 'border-border bg-card'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {entrada.mealPlan.name || 'Plano sem nome'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Consulta de {dataFormatada}
                            </p>
                          </div>
                          {isSelecionado && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <X className="w-3 h-3 text-primary-foreground rotate-45" style={{ transform: 'none' }} />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Sem histórico — não deveria aparecer (o modal só abre se há histórico), mas por segurança */}
          {!loading && !error && historico.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum plano alimentar anterior encontrado.
            </p>
          )}
        </div>

        {/* Rodapé com ações */}
        <div className="px-6 pb-6 pt-2 border-t border-border space-y-2">
          {/* Copiar selecionado */}
          {!loading && !error && (
            <Button
              className="w-full gap-2"
              disabled={!selecionado}
              onClick={handleCopiar}
            >
              <Copy className="w-4 h-4" />
              Copiar plano selecionado
            </Button>
          )}

          {/* Criar do zero — sempre visível */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onCreateFromScratch}
          >
            <FilePlus className="w-4 h-4" />
            Criar do zero
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
