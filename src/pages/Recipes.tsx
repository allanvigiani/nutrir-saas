import React, { useState, useEffect, useCallback } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Plus,
  Trash2,
  Edit,
  Eye,
  ChefHat,
  Sparkles,
  BookOpen,
  Loader2,
  X,
  Copy,
  Search,
  UtensilsCrossed,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../contexts/AuthContext';
import { isAdminOrPremium } from '../lib/planLimits';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { PremiumFeature } from '../components/PremiumFeature';
import { UpgradeModal } from '../components/UpgradeModal';
import { PageHeader } from '../components/PageHeader';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Ingrediente {
  id?: string;
  recipeId?: string;
  name: string;
  quantity: string;
  unit: string;
}

interface Receita {
  id: string;
  nutritionistId: string;
  name: string;
  description?: string;
  prepMode?: string;
  isSuggested: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  ingredients: Ingrediente[];
}

// ─── Validação ────────────────────────────────────────────────────────────────

const ingredienteSchema = z.object({
  name: z.string().min(1, 'Nome do ingrediente obrigatório'),
  quantity: z.string().min(1, 'Quantidade obrigatória'),
  unit: z.string().min(1, 'Unidade obrigatória'),
});

const receitaSchema = z.object({
  name: z.string().min(1, 'Nome da receita é obrigatório'),
  description: z.string().optional(),
  prepMode: z.string().optional(),
  ingredients: z.array(ingredienteSchema).min(1, 'Adicione pelo menos um ingrediente'),
});

type ReceitaFormData = z.infer<typeof receitaSchema>;

// ─── Constantes ──────────────────────────────────────────────────────────────

const UNIDADES_SUGERIDAS = [
  'g',
  'kg',
  'ml',
  'L',
  'xícara',
  'colher de sopa',
  'colher de chá',
  'unidade',
  'fatia',
  'porção',
];

const FREE_MAX_RECEITAS = 3;

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
}

function EmptyState({
  isPremium,
  aba,
  onNova,
}: {
  isPremium: boolean;
  aba: 'minhas' | 'sugestoes';
  onNova: () => void;
}) {
  if (aba === 'sugestoes') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/30 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-accent-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma sugestão disponível</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Em breve você terá acesso a receitas sugeridas pela equipe Nutrir.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <ChefHat className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma receita criada ainda</h3>
      <p className="text-muted-foreground text-sm max-w-xs mb-6">
        Crie sua primeira receita para compartilhar com seus pacientes nos planos alimentares.
      </p>
      <Button onClick={onNova}>
        <Plus className="w-4 h-4 mr-1.5" />
        Criar primeira receita
      </Button>
    </div>
  );
}

// ─── Modal de Formulário ─────────────────────────────────────────────────────

interface ModalReceitaProps {
  isOpen: boolean;
  receita: Receita | null;
  onClose: () => void;
  onSalvo: (receita: Receita) => void;
}

function ModalReceita({ isOpen, receita, onClose, onSalvo }: ModalReceitaProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReceitaFormData>({
    resolver: zodResolver(receitaSchema),
    defaultValues: {
      name: '',
      description: '',
      prepMode: '',
      ingredients: [{ name: '', quantity: '', unit: 'g' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredients',
  });

  // Popula form ao editar
  useEffect(() => {
    if (receita) {
      form.reset({
        name: receita.name,
        description: receita.description ?? '',
        prepMode: receita.prepMode ?? '',
        ingredients:
          receita.ingredients.length > 0
            ? receita.ingredients.map((i) => ({
                name: i.name,
                quantity: i.quantity,
                unit: i.unit,
              }))
            : [{ name: '', quantity: '', unit: 'g' }],
      });
    } else {
      form.reset({
        name: '',
        description: '',
        prepMode: '',
        ingredients: [{ name: '', quantity: '', unit: 'g' }],
      });
    }
  }, [receita, isOpen, form]);

  const handleSubmit = async (data: ReceitaFormData) => {
    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const url = receita ? `/api/recipes/${receita.id}` : '/api/recipes';
      const method = receita ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403 && err.error?.includes('Limite')) {
          toast.error('Limite de receitas do plano gratuito atingido. Faça upgrade para criar mais receitas.');
          return;
        }
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const receitaSalva: Receita = await res.json();
      toast.success(receita ? 'Receita atualizada!' : 'Receita criada!');
      onSalvo(receitaSalva);
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar receita:', error);
      toast.error(error.message || 'Erro ao salvar receita');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{receita ? 'Editar Receita' : 'Nova Receita'}</DialogTitle>
          <DialogDescription>
            {receita
              ? 'Atualize as informações da receita.'
              : 'Preencha os dados para criar uma nova receita.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="recipe-name">
              Nome da Receita <span className="text-destructive">*</span>
            </Label>
            <Input
              id="recipe-name"
              placeholder="Ex: Omelete de Espinafre"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="recipe-description">Descrição</Label>
            <Input
              id="recipe-description"
              placeholder="Breve descrição da receita"
              {...form.register('description')}
            />
          </div>

          {/* Ingredientes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Ingredientes <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: '', quantity: '', unit: 'g' })}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Adicionar
              </Button>
            </div>

            {form.formState.errors.ingredients?.root && (
              <p className="text-xs text-destructive">
                {form.formState.errors.ingredients.root.message}
              </p>
            )}

            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder="Nome do ingrediente"
                      {...form.register(`ingredients.${index}.name`)}
                      className={cn(
                        form.formState.errors.ingredients?.[index]?.name && 'border-destructive'
                      )}
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      placeholder="Qtd"
                      {...form.register(`ingredients.${index}.quantity`)}
                      className={cn(
                        form.formState.errors.ingredients?.[index]?.quantity && 'border-destructive'
                      )}
                    />
                  </div>
                  <div className="w-36">
                    <Select
                      defaultValue={field.unit || 'g'}
                      onValueChange={(val) => form.setValue(`ingredients.${index}.unit`, val)}
                    >
                      <SelectTrigger
                        className={cn(
                          form.formState.errors.ingredients?.[index]?.unit && 'border-destructive'
                        )}
                      >
                        <SelectValue placeholder="Unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIDADES_SUGERIDAS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fields.length > 1 && remove(index)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={fields.length <= 1}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Modo de Preparo */}
          <div className="space-y-1.5">
            <Label htmlFor="recipe-prepMode">Modo de Preparo</Label>
            <Textarea
              id="recipe-prepMode"
              placeholder="Descreva o passo a passo do preparo..."
              rows={4}
              {...form.register('prepMode')}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {receita ? 'Salvar Alterações' : 'Criar Receita'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal de Visualização ────────────────────────────────────────────────────

interface ModalVisualizacaoProps {
  isOpen: boolean;
  receita: Receita | null;
  onClose: () => void;
  onEditar: () => void;
}

function ModalVisualizacao({ isOpen, receita, onClose, onEditar }: ModalVisualizacaoProps) {
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
          {/* Ingredientes */}
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

          {/* Modo de Preparo */}
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {!receita.isSuggested && (
            <Button onClick={onEditar}>
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card de Receita ─────────────────────────────────────────────────────────

interface CardReceitaProps {
  receita: Receita;
  isPremium: boolean;
  onVer: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onClonar?: () => void;
}

function CardReceita({ receita, isPremium, onVer, onEditar, onExcluir, onClonar }: CardReceitaProps) {
  return (
    <Card className="hover:border-primary/30 transition-colors duration-150 group flex flex-col">
      <CardHeader className="pb-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle
              className="text-sm font-medium leading-snug line-clamp-2 text-foreground"
              title={receita.name}
            >
              {receita.name}
            </CardTitle>
            {receita.description && (
              <CardDescription className="line-clamp-1 mt-0.5 text-xs">
                {receita.description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={onVer}
              title="Visualizar receita"
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
            {receita.isSuggested ? (
              onClonar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={onClonar}
                  title="Clonar receita"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              )
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={onEditar}
                  title="Editar receita"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={onExcluir}
                  title="Excluir receita"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {receita.ingredients.length} ingrediente{receita.ingredients.length !== 1 ? 's' : ''}
          </span>
          <span className="text-muted-foreground/40 text-xs select-none">·</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(receita.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
          </span>
          {receita.isSuggested && (
            <Badge variant="secondary" className="h-5 text-xs px-1.5 gap-1">
              <Sparkles className="w-3 h-3" />
              Sugerida
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Página Principal ────────────────────────────────────────────────────────

export const Recipes = () => {
  const { user, nutritionist } = useAuth();
  const isPremium = isAdminOrPremium(nutritionist);

  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const [isModalFormOpen, setIsModalFormOpen] = useState(false);
  const [isModalVerOpen, setIsModalVerOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [receitaEditando, setReceitaEditando] = useState<Receita | null>(null);
  const [receitaVisualizando, setReceitaVisualizando] = useState<Receita | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReceitas = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/recipes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Receita[] = await res.json();
      setReceitas(data);
    } catch (err: any) {
      console.error('Erro ao carregar receitas:', err);
      setError('Erro ao carregar receitas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReceitas();
  }, [fetchReceitas]);

  const minhasReceitas = receitas.filter((r) => !r.isSuggested);
  const sugestoes = receitas.filter((r) => r.isSuggested);

  const minhasReceitasFiltradas = minhasReceitas.filter((r) =>
    r.name.toLowerCase().includes(busca.toLowerCase())
  );
  const sugestoesFiltradas = sugestoes.filter((r) =>
    r.name.toLowerCase().includes(busca.toLowerCase())
  );

  const atinuiuLimiteGratuito = !isPremium && minhasReceitas.length >= FREE_MAX_RECEITAS;

  const handleNova = () => {
    if (atinuiuLimiteGratuito) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setReceitaEditando(null);
    setIsModalFormOpen(true);
  };

  const handleEditar = (receita: Receita) => {
    setReceitaEditando(receita);
    setIsModalFormOpen(true);
    setIsModalVerOpen(false);
  };

  const handleVer = (receita: Receita) => {
    setReceitaVisualizando(receita);
    setIsModalVerOpen(true);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir esta receita? Esta ação não pode ser desfeita.')) return;
    setDeletingId(id);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/recipes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReceitas((prev) => prev.filter((r) => r.id !== id));
      toast.success('Receita excluída.');
    } catch (err: any) {
      console.error('Erro ao excluir receita:', err);
      toast.error('Erro ao excluir receita.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClonar = async (receita: Receita) => {
    if (!isPremium) {
      setIsUpgradeModalOpen(true);
      return;
    }
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/recipes/${receita.id}/clone`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const clonada: Receita = await res.json();
      setReceitas((prev) => [clonada, ...prev]);
      toast.success(`Receita "${clonada.name}" clonada para Minhas Receitas!`);
    } catch (err: any) {
      console.error('Erro ao clonar receita:', err);
      toast.error(err.message || 'Erro ao clonar receita.');
    }
  };

  const handleSalvo = (receitaSalva: Receita) => {
    setReceitas((prev) => {
      const existe = prev.find((r) => r.id === receitaSalva.id);
      if (existe) return prev.map((r) => (r.id === receitaSalva.id ? receitaSalva : r));
      return [receitaSalva, ...prev];
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ChefHat}
        title="Receitas"
        description="Crie e gerencie suas receitas para incluir nos planos alimentares."
        action={<Button onClick={handleNova} disabled={atinuiuLimiteGratuito && !isPremium}><Plus className="w-4 h-4 mr-1.5" />Nova Receita</Button>}
        badge={!isPremium ? <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">{minhasReceitas.length}/{FREE_MAX_RECEITAS} receitas</span> : undefined}
      />

      {/* Aviso de limite */}
      {atinuiuLimiteGratuito && (
        <Card className="border-accent bg-accent/20 dark:bg-accent/10 dark:border-accent/40">
          <CardContent className="py-3 px-4">
            <p className="text-sm text-foreground font-medium">
              Você atingiu o limite de {FREE_MAX_RECEITAS} receitas do plano gratuito.{' '}
              <button
                onClick={() => setIsUpgradeModalOpen(true)}
                className="underline underline-offset-2 hover:no-underline font-semibold"
              >
                Faça upgrade para criar mais.
              </button>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar receitas..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Abas */}
      <Tabs defaultValue="minhas">
        <TabsList className="flex w-full items-center justify-start gap-1 bg-transparent border-b border-border p-0 rounded-none h-auto overflow-x-auto">
          <TabsTrigger
            value="minhas"
            className="relative gap-2 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <ChefHat className="w-4 h-4" />
            Minhas Receitas
            {minhasReceitas.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                {minhasReceitas.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="sugestoes"
            className="relative gap-2 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            Sugestões
            {!isPremium && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 bg-accent text-accent-foreground">
                Premium
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Aba: Minhas Receitas */}
        <TabsContent value="minhas" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : error ? (
            <Card className="border-destructive/30">
              <CardContent className="py-6 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={fetchReceitas}>
                  Tentar novamente
                </Button>
              </CardContent>
            </Card>
          ) : minhasReceitasFiltradas.length === 0 ? (
            <EmptyState isPremium={isPremium} aba="minhas" onNova={handleNova} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {minhasReceitasFiltradas.map((receita) => (
                <CardReceita
                  key={receita.id}
                  receita={receita}
                  isPremium={isPremium}
                  onVer={() => handleVer(receita)}
                  onEditar={() => handleEditar(receita)}
                  onExcluir={() => {
                    if (deletingId !== receita.id) handleExcluir(receita.id);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Aba: Sugestões */}
        <TabsContent value="sugestoes" className="mt-4">
          {!isPremium ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <PremiumFeature>
                <div className="w-16 h-16 rounded-2xl bg-accent/30 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-accent-foreground" />
                </div>
              </PremiumFeature>
              <h3 className="text-lg font-semibold text-foreground mb-1">Receitas Sugeridas</h3>
              <p className="text-muted-foreground text-sm max-w-xs mb-6">
                Acesse receitas criadas pela equipe Nutrir e clone-as para seus pacientes.
              </p>
              <Button variant="outline" onClick={() => setIsUpgradeModalOpen(true)}>
                <Sparkles className="w-4 h-4 mr-2 text-accent-foreground" />
                Ver planos Premium
              </Button>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : sugestoesFiltradas.length === 0 ? (
            <EmptyState isPremium={isPremium} aba="sugestoes" onNova={handleNova} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sugestoesFiltradas.map((receita) => (
                <CardReceita
                  key={receita.id}
                  receita={receita}
                  isPremium={isPremium}
                  onVer={() => handleVer(receita)}
                  onEditar={() => handleEditar(receita)}
                  onExcluir={() => handleExcluir(receita.id)}
                  onClonar={() => handleClonar(receita)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modais */}
      <ModalReceita
        isOpen={isModalFormOpen}
        receita={receitaEditando}
        onClose={() => setIsModalFormOpen(false)}
        onSalvo={handleSalvo}
      />

      <ModalVisualizacao
        isOpen={isModalVerOpen}
        receita={receitaVisualizando}
        onClose={() => setIsModalVerOpen(false)}
        onEditar={() => receitaVisualizando && handleEditar(receitaVisualizando)}
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </div>
  );
};
