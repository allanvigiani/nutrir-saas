import React, { useEffect } from 'react';
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
import { db, auth } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { toast } from 'sonner';
import { CustomFood } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const foodSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  kcal: z.number().min(0, 'Valor inválido'),
  protein: z.number().min(0, 'Valor inválido'),
  carbs: z.number().min(0, 'Valor inválido'),
  fat: z.number().min(0, 'Valor inválido'),
  baseUnit: z.string().min(1, 'Unidade é obrigatória'),
  baseQuantity: z.number().min(0.1, 'Quantidade inválida'),
  servingName: z.string().optional(),
  servingWeight: z.number().optional(),
});

type FoodFormValues = z.infer<typeof foodSchema>;

interface CustomFoodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  food?: CustomFood | null;
  initialName?: string;
  onSuccess?: (food: CustomFood) => void;
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
      servingName: '',
      servingWeight: 0,
    }
  });

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
        servingName: food.serving?.name || '',
        servingWeight: food.serving?.weight || 0,
      });
    } else {
      reset({
        name: initialName,
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        baseUnit: 'g',
        baseQuantity: 100,
        servingName: '',
        servingWeight: 0,
      });
    }
  }, [food, initialName, reset]);

  const onSubmit = async (data: FoodFormValues) => {
    if (!auth.currentUser) return;

    const { servingName, servingWeight, ...rest } = data;
    const finalData = {
      ...rest,
      serving: servingName && servingWeight ? { name: servingName, weight: servingWeight } : undefined
    };

    try {
      if (food) {
        try {
          await updateDoc(doc(db, 'custom_foods', food.id), {
            ...finalData,
            updatedAt: new Date().toISOString(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `custom_foods/${food.id}`);
        }
        toast.success('Alimento atualizado com sucesso!');
        if (onSuccess) onSuccess({ ...food, ...finalData });
      } else {
        let docRef;
        try {
          docRef = await addDoc(collection(db, 'custom_foods'), {
            ...finalData,
            nutritionist_id: auth.currentUser.uid,
            createdAt: new Date().toISOString(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'custom_foods');
        }
        toast.success('Alimento cadastrado com sucesso!');
        if (onSuccess) onSuccess({ id: docRef.id, nutritionist_id: auth.currentUser.uid, ...finalData });
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
          <DialogTitle className="text-xl font-bold text-slate-900">
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
                className="bg-slate-50 border-none rounded-xl h-8 text-sm"
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="baseQuantity">Quantidade Base</Label>
                <Input 
                  id="baseQuantity" 
                  type="number" 
                  step="0.1"
                  {...register('baseQuantity', { valueAsNumber: true })} 
                  className="bg-slate-50 border-none rounded-xl h-8 text-sm"
                />
                {errors.baseQuantity && <p className="text-xs text-red-500">{errors.baseQuantity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseUnit">Unidade Base</Label>
                <Select 
                  defaultValue="g" 
                  onValueChange={(v) => setValue('baseUnit', v)}
                >
                  <SelectTrigger className="bg-slate-50 border-none rounded-xl h-8 text-sm">
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
                  className="bg-slate-50 border-none rounded-xl h-8 text-sm"
                />
                {errors.kcal && <p className="text-xs text-red-500">{errors.kcal.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="protein">Proteínas (g)</Label>
                <Input 
                  id="protein" 
                  type="number" 
                  step="0.1"
                  {...register('protein', { valueAsNumber: true })} 
                  className="bg-slate-50 border-none rounded-xl h-8 text-sm"
                />
                {errors.protein && <p className="text-xs text-red-500">{errors.protein.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="carbs">Carboidratos (g)</Label>
                <Input 
                  id="carbs" 
                  type="number" 
                  step="0.1"
                  {...register('carbs', { valueAsNumber: true })} 
                  className="bg-slate-50 border-none rounded-xl h-8 text-sm"
                />
                {errors.carbs && <p className="text-xs text-red-500">{errors.carbs.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fat">Gorduras (g)</Label>
                <Input 
                  id="fat" 
                  type="number" 
                  step="0.1"
                  {...register('fat', { valueAsNumber: true })} 
                  className="bg-slate-50 border-none rounded-xl h-8 text-sm"
                />
                {errors.fat && <p className="text-xs text-red-500">{errors.fat.message}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold text-emerald-700">Medida Caseira (Opcional)</Label>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Ex: 1 unidade = 50g</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="servingName">Nome da Medida</Label>
                <Input 
                  id="servingName" 
                  {...register('servingName')} 
                  placeholder="Ex: unidade, fatia, colher"
                  className="bg-slate-50 border-none rounded-xl h-8 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="servingWeight">Peso da Medida (g/ml)</Label>
                <Input 
                  id="servingWeight" 
                  type="number" 
                  step="0.1"
                  {...register('servingWeight', { valueAsNumber: true })} 
                  className="bg-slate-50 border-none rounded-xl h-8 text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-8 px-4 border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-all active:scale-95"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-5 font-bold text-sm transition-all shadow-sm active:scale-95"
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
