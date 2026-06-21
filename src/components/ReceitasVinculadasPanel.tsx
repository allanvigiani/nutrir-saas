import React, { useState, useEffect, useCallback } from 'react';
import {
  ChefHat,
  Plus,
  Trash2,
  Eye,
  Loader2,
  UtensilsCrossed,
  BookOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Label } from './ui/label';
import { auth } from '../lib/firebase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Ingrediente {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
}

interface Receita {
  id: string;
  name: string;
  description?: string;
  prepMode?: string;
  isSuggested: boolean;
  createdAt: string;
  ingredients: Ingrediente[];
}

interface MealPlanRecipeLink {
  id: string;
  mealPlanId: string;
  recipeId: string;
  meal: string;
  position?: number;
  createdAt: string;
  recipe: Receita;
}

interface Props {
  planId: string;
  mealTypes: { id: string; label: string }[];
}

// ─── Modal de Visualização de Receita ─────────────────────────────────────────

function ModalVisualizacaoReceita({
  isOpen,
  receita,
  onClose,
}: {
  isOpen: boolean;
  receita: Receita | null;
  onClose: () => void;
}) {
  if (!receita) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-primary" />
            {receita.name}
          </DialogTitle>
          {receita.description && (
            <DialogDescription>{receita.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
              Ingredientes ({receita.ingredients.length})
            </h4>
            <ul className="space-y-1">
              {receita.ingredients.map((ing, idx) => (
                <li key={ing.id ?? idx} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span className="text-foreground">
                    {ing.quantity} {ing.unit} de{' '}
                    <span className="font-medium">{ing.name}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {receita.prepMode && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  Modo de Preparo
                </h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {receita.prepMode}
                </p>
              </div>
            </>
          )}

          <Separator />
          <p className="text-xs text-muted-foreground">
            Criada em{' '}
            {format(new Date(receita.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal de Vincular Receita ────────────────────────────────────────────────

function ModalVincularReceita({
  isOpen,
  planId,
  mealTypes,
  onClose,
  onVinculado,
}: {
  isOpen: boolean;
  planId: string;
  mealTypes: { id: string; label: string }[];
  onClose: () => void;
  onVinculado: (link: MealPlanRecipeLink) => void;
}) {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loadingReceitas, setLoadingReceitas] = useState(false);
  const [receitaSelecionada, setReceitaSelecionada] = useState('');
  const [refeicaoSelecionada, setRefeicaoSelecionada] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setReceitaSelecionada('');
    setRefeicaoSelecionada('');
    setLoadingReceitas(true);
    auth.currentUser
      ?.getIdToken()
      .then((token) =>
        fetch('/api/recipes', { headers: { Authorization: `Bearer ${token}` } })
      )
      .then((r) => r.json())
      .then((data: Receita[]) => {
        setReceitas(data.filter((r) => !r.isSuggested));
        setLoadingReceitas(false);
      })
      .catch(() => {
        toast.error('Erro ao carregar receitas.');
        setLoadingReceitas(false);
      });
  }, [isOpen]);

  const handleVincular = async () => {
    if (!receitaSelecionada || !refeicaoSelecionada) {
      toast.error('Selecione a receita e a refeição.');
      return;
    }
    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/meal-plans/${planId}/recipes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipeId: receitaSelecionada, meal: refeicaoSelecionada }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const link: MealPlanRecipeLink = await res.json();
      toast.success('Receita vinculada ao plano!');
      onVinculado(link);
      onClose();
    } catch (err: any) {
      console.error('Erro ao vincular receita:', err);
      toast.error(err.message || 'Erro ao vincular receita.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular Receita</DialogTitle>
          <DialogDescription>
            Selecione uma receita e a refeição em que ela será incluída no PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seletor de Receita */}
          <div className="space-y-1.5">
            <Label>Receita</Label>
            {loadingReceitas ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando receitas...
              </div>
            ) : receitas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Nenhuma receita cadastrada.{' '}
                <a href="/recipes" className="underline text-primary">
                  Criar receita
                </a>
              </p>
            ) : (
              <Select value={receitaSelecionada} onValueChange={setReceitaSelecionada}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma receita...">
                    {receitaSelecionada
                      ? (receitas.find((r) => r.id === receitaSelecionada)?.name ?? receitaSelecionada)
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {receitas.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Seletor de Refeição */}
          <div className="space-y-1.5">
            <Label>Refeição</Label>
            {mealTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Nenhuma refeição configurada neste plano.
              </p>
            ) : (
              <Select value={refeicaoSelecionada} onValueChange={setRefeicaoSelecionada}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a refeição...">
                    {refeicaoSelecionada
                      ? (mealTypes.find((m) => m.id === refeicaoSelecionada)?.label ?? refeicaoSelecionada)
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {mealTypes.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleVincular}
            disabled={isSubmitting || !receitaSelecionada || !refeicaoSelecionada}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Painel Principal ────────────────────────────────────────────────────────

export function ReceitasVinculadasPanel({ planId, mealTypes }: Props) {
  const [links, setLinks] = useState<MealPlanRecipeLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorLinks, setErrorLinks] = useState<string | null>(null);
  const [isModalVincularOpen, setIsModalVincularOpen] = useState(false);
  const [receitaVisualizando, setReceitaVisualizando] = useState<Receita | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    if (!planId || planId === 'new') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorLinks(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/meal-plans/${planId}/recipes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MealPlanRecipeLink[] = await res.json();
      setLinks(data);
    } catch (err) {
      console.error('Erro ao carregar receitas vinculadas:', err);
      setErrorLinks('Erro ao carregar receitas vinculadas.');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleDesvincular = async (linkId: string) => {
    if (!confirm('Desvincular esta receita do plano?')) return;
    setRemovingId(linkId);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/meal-plans/${planId}/recipes/${linkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      toast.success('Receita desvinculada.');
    } catch (err) {
      console.error('Erro ao desvincular receita:', err);
      toast.error('Erro ao desvincular receita.');
    } finally {
      setRemovingId(null);
    }
  };

  // Planos novos ainda não têm ID — não exibir
  if (planId === 'new' || !planId) return null;

  return (
    <>
      <Card className="mt-4 mx-4 mb-4 border-dashed border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-primary" />
                Receitas Vinculadas ao Plano
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Receitas que serão incluídas no PDF ao final do plano alimentar.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalVincularOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Vincular Receita
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando receitas vinculadas...
            </div>
          ) : errorLinks ? (
            <div className="flex items-center justify-between py-4">
              <p className="text-sm text-destructive">{errorLinks}</p>
              <Button variant="ghost" size="sm" onClick={fetchLinks}>
                Tentar novamente
              </Button>
            </div>
          ) : links.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                Nenhuma receita vinculada. As receitas vinculadas serão exportadas no PDF.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((link) => {
                const refeicaoLabel =
                  mealTypes.find((m) => m.id === link.meal)?.label ?? link.meal;
                return (
                  <div
                    key={link.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors bg-card"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <ChefHat className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {link.recipe.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {link.recipe.ingredients.length} ingrediente
                          {link.recipe.ingredients.length !== 1 ? 's' : ''} •{' '}
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            {refeicaoLabel}
                          </Badge>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setReceitaVisualizando(link.recipe)}
                        title="Visualizar receita"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-8 w-8 text-muted-foreground hover:text-destructive',
                          removingId === link.id && 'opacity-50 pointer-events-none'
                        )}
                        onClick={() => handleDesvincular(link.id)}
                        title="Desvincular receita"
                        disabled={removingId === link.id}
                      >
                        {removingId === link.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ModalVincularReceita
        isOpen={isModalVincularOpen}
        planId={planId}
        mealTypes={mealTypes}
        onClose={() => setIsModalVincularOpen(false)}
        onVinculado={(link) => setLinks((prev) => [...prev, link])}
      />

      <ModalVisualizacaoReceita
        isOpen={!!receitaVisualizando}
        receita={receitaVisualizando}
        onClose={() => setReceitaVisualizando(null)}
      />
    </>
  );
}
