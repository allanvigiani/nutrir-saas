import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { CustomFood, CustomFoodServing } from '../types';
import { apiRequest } from '../hooks/useApi';
import { X, Plus } from 'lucide-react';

const MAX_SERVINGS = 5;

const foodSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  kcal: z.number().min(0, 'Valor inválido'),
  protein: z.number().min(0, 'Valor inválido'),
  carbs: z.number().min(0, 'Valor inválido'),
  fat: z.number().min(0, 'Valor inválido'),
  baseUnit: z.string().min(1, 'Unidade é obrigatória'),
  baseQuantity: z.number().min(0.1, 'Quantidade inválida'),
});

type FoodFormValues = z.infer<typeof foodSchema>;

interface ServingDraft {
  name: string;
  weight: number | '';
}

interface CustomFoodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  food?: CustomFood | null;
  initialName?: string;
  onSuccess?: (food: CustomFood) => void;
}

/** Normaliza serving (objeto legado ou array) para array */
function normalizeServings(serving: CustomFood['serving']): CustomFoodServing[] {
  if (!serving) return [];
  if (Array.isArray(serving)) return serving;
  return [serving];
}

export const CustomFoodDialog: React.FC<CustomFoodDialogProps> = ({
  open,
  onOpenChange,
  food,
  initialName = '',
  onSuccess
}) => {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FoodFormValues>({
    resolver: zodResolver(foodSchema),
    defaultValues: {
      name: initialName,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      baseUnit: 'g',
      baseQuantity: 100,
    }
  });

  const [servings, setServings] = useState<ServingDraft[]>([]);
  const baseUnit = watch('baseUnit') || 'g';

  useEffect(() => {
    if (food) {
      reset({
        name: food.name,
        kcal: food.kcal,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        baseUnit: food.baseUnit,
        baseQuantity: food.baseQuantity,
      });
      setServings(normalizeServings(food.serving).map((s) => ({ name: s.name, weight: s.weight })));
    } else {
      reset({
        name: initialName,
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        baseUnit: 'g',
        baseQuantity: 100,
      });
      setServings([]);
    }
  }, [food, initialName, reset]);

  const addServing = () => {
    if (servings.length >= MAX_SERVINGS) return;
    setServings((prev) => [...prev, { name: '', weight: '' }]);
  };

  const removeServing = (idx: number) => {
    setServings((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateServingField = (idx: number, field: keyof ServingDraft, value: string) => {
    setServings((prev) => prev.map((s, i) => {
      if (i !== idx) return s;
      if (field === 'weight') {
        const parsed = parseFloat(value);
        return { ...s, weight: isNaN(parsed) ? '' : parsed };
      }
      return { ...s, [field]: value };
    }));
  };

  const onSubmit = async (data: FoodFormValues) => {
    // Valida servings antes de enviar
    const validServings = servings.filter((s) => s.name.trim() && typeof s.weight === 'number' && s.weight > 0);
    const invalidServings = servings.filter((s) => !s.name.trim() || typeof s.weight !== 'number' || s.weight <= 0);

    if (invalidServings.length > 0) {
      toast.error('Preencha o nome e o peso de todas as medidas ou remova as incompletas.');
      return;
    }

    const finalData = {
      ...data,
      serving: validServings.length > 0
        ? validServings.map((s) => ({ name: s.name.trim(), weight: s.weight as number }))
        : undefined,
    };

    try {
      if (food) {
        const updated = await apiRequest<CustomFood>(`/api/custom-foods/${food.id}`, 'PATCH', finalData);
        toast.success('Alimento atualizado com sucesso!');
        if (onSuccess) onSuccess(updated);
      } else {
        const created = await apiRequest<CustomFood>('/api/custom-foods', 'POST', finalData);
        toast.success('Alimento cadastrado com sucesso!');
        if (onSuccess) onSuccess(created);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving custom food:", error);
      toast.error('Erro ao salvar alimento.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {food ? 'Editar Alimento' : 'Cadastrar Novo Alimento'}
          </DialogTitle>
          <DialogDescription>
            Informe os valores nutricionais base para o alimento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Alimento</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Ex: Pão de Queijo Caseiro"
                className="bg-muted/30 border-none rounded-xl h-8 text-sm"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="baseQuantity">Quantidade Base</Label>
                <Input
                  id="baseQuantity"
                  type="number"
                  step="0.1"
                  {...register('baseQuantity', { valueAsNumber: true })}
                  className="bg-muted/30 border-none rounded-xl h-8 text-sm"
                />
                {errors.baseQuantity && <p className="text-xs text-destructive">{errors.baseQuantity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseUnit">Unidade Base</Label>
                <Select
                  defaultValue="g"
                  onValueChange={(v) => setValue('baseUnit', v)}
                >
                  <SelectTrigger className="bg-muted/30 border-none rounded-xl h-8 text-sm">
                    <SelectValue placeholder="Selecione">
                      {watch('baseUnit') === 'g' ? 'Gramas (g)' :
                       watch('baseUnit') === 'ml' ? 'Mililitros (ml)' :
                       watch('baseUnit') === 'un' ? 'Unidade (un)' : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g">Gramas (g)</SelectItem>
                    <SelectItem value="ml">Mililitros (ml)</SelectItem>
                    <SelectItem value="un">Unidade (un)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="kcal">Calorias (kcal)</Label>
                <Input
                  id="kcal"
                  type="number"
                  step="0.1"
                  {...register('kcal', { valueAsNumber: true })}
                  className="bg-muted/30 border-none rounded-xl h-8 text-sm"
                />
                {errors.kcal && <p className="text-xs text-destructive">{errors.kcal.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="protein">Proteínas (g)</Label>
                <Input
                  id="protein"
                  type="number"
                  step="0.1"
                  {...register('protein', { valueAsNumber: true })}
                  className="bg-muted/30 border-none rounded-xl h-8 text-sm"
                />
                {errors.protein && <p className="text-xs text-destructive">{errors.protein.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="carbs">Carboidratos (g)</Label>
                <Input
                  id="carbs"
                  type="number"
                  step="0.1"
                  {...register('carbs', { valueAsNumber: true })}
                  className="bg-muted/30 border-none rounded-xl h-8 text-sm"
                />
                {errors.carbs && <p className="text-xs text-destructive">{errors.carbs.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fat">Gorduras (g)</Label>
                <Input
                  id="fat"
                  type="number"
                  step="0.1"
                  {...register('fat', { valueAsNumber: true })}
                  className="bg-muted/30 border-none rounded-xl h-8 text-sm"
                />
                {errors.fat && <p className="text-xs text-destructive">{errors.fat.message}</p>}
              </div>
            </div>
          </div>

          {/* Medidas caseiras — múltiplas */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-bold text-primary">Medidas Caseiras</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">A medida em "{baseUnit}" está sempre disponível. Adicione medidas extras abaixo.</p>
              </div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                {servings.length}/{MAX_SERVINGS}
              </span>
            </div>

            {servings.length > 0 && (
              <div className="space-y-2">
                {servings.map((s, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <Input
                      value={s.name}
                      onChange={(e) => updateServingField(idx, 'name', e.target.value)}
                      placeholder="Ex: unidade, fatia"
                      className="bg-muted/30 border-none rounded-xl h-8 text-sm"
                    />
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        value={s.weight === '' ? '' : s.weight}
                        onChange={(e) => updateServingField(idx, 'weight', e.target.value)}
                        placeholder={`Peso (${baseUnit})`}
                        className="bg-muted/30 border-none rounded-xl h-8 text-sm pr-7"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">{baseUnit}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeServing(idx)}
                      className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {servings.length < MAX_SERVINGS && (
              <Button
                type="button"
                variant="outline"
                onClick={addServing}
                className="w-full rounded-xl h-8 border-dashed border-border text-muted-foreground text-xs gap-1.5 hover:bg-muted/30 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar medida
              </Button>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-8 px-4 border-border text-muted-foreground text-sm hover:bg-muted/30 transition-all active:scale-95"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-8 px-5 font-bold text-sm transition-all shadow-sm active:scale-95"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Alimento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
