import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  MessageSquare,
  Activity,
  Dna,
  Zap,
  Droplets,
  Apple,
  Utensils,
  Save,
  ArrowLeft,
  Clock,
  Edit2,
  Calculator,
  Search,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Loader2,
  History,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { FoodAutocomplete } from './FoodAutocomplete';
import { TacoFood } from '../data/taco';
import { CustomFood, MealPlan, MealPlanItem, NutritionCalculation } from '../types';
import { cn } from '../lib/utils';
import { CustomFoodDialog } from './CustomFoodDialog';

interface MealType {
  id: string;
  label: string;
  time?: string;
  color: string;
}

interface DraftData {
  name: string;
  items: any[];
  generalInstructions: string;
  waterIntake: string;
  mealObservations: Record<string, string>;
  customMeals: any[];
  savedAt: string;
}

interface MealPlanEditorProps {
  initialName?: string;
  initialItems?: any[];
  initialGeneralInstructions?: string;
  initialWaterIntake?: string;
  initialMealObservations?: Record<string, string>;
  initialCustomMeals?: any[];
  selectedCalculation?: NutritionCalculation | null;
  foodDataSource: 'Todas' | 'TACO' | 'TBCA' | 'Custom';
  isNew?: boolean;
  /** Chave do localStorage para o rascunho. Ex: 'nutrir:draft:mealplan:new:abc123' */
  draftKey?: string;
  children?: React.ReactNode;
  onSave: (data: {
    name: string;
    items: any[];
    generalInstructions: string;
    waterIntake: string;
    mealObservations: Record<string, string>;
    customMeals: any[];
  }) => Promise<boolean>;
  onClose: () => void;
}

const DEFAULT_MEAL_TYPES: MealType[] = [];

const SummaryCard = ({ label, value, total, unit, color, iconBg, progressColor, icon: Icon, variant = 'grid' }: any) => {
  const percentage = total ? Math.min((value / total) * 100, 100) : 0;
  const isSidebar = variant === 'sidebar';
  
  return (
    <motion.div 
      whileHover={isSidebar ? { x: 4 } : { y: -2, scale: 1.01 }}
      className={cn(
        "bg-card rounded-xl border border-border relative overflow-hidden transition-all duration-300",
        isSidebar ? "p-2.5 xl:p-3 hover:border-primary/20" : "p-4"
      )}
    >
      <div className={cn("flex items-center", isSidebar ? "gap-2 mb-2 xl:gap-2.5 xl:mb-2.5" : "gap-3 mb-2")}>
        <div className={cn("rounded-lg flex items-center justify-center shrink-0",
          isSidebar ? "w-7 h-7 xl:w-8 xl:h-8" : "w-8 h-8",
          iconBg
        )}>
          <Icon className={cn("w-3.5 h-3.5 xl:w-4 xl:h-4", color)} />
        </div>
        <div>
          <p className="text-[11px] xl:text-xs font-medium text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className={cn("font-bold leading-none tracking-tight", isSidebar ? "text-lg xl:text-xl" : "text-lg", color)}>
              {Number(value).toFixed(0)}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{unit}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-muted-foreground">Atingido</span>
          {total ? (
            <span className={cn("font-bold", percentage >= 100 ? "text-primary" : "text-muted-foreground")}>
              {percentage.toFixed(0)}% <span className="text-muted-foreground font-medium">de {total.toFixed(0)}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Sem meta</span>
          )}
        </div>
        <div className="w-full bg-muted h-1.5 xl:h-2 rounded-full overflow-hidden ring-1 ring-border/50">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }}
            className={cn("h-full rounded-full", progressColor, percentage > 100 && "bg-destructive")}
          />
        </div>
      </div>
    </motion.div>
  );
};

const MealItemRow = React.memo(({
  item,
  index,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onAddNewFood,
  onMoveUp,
  onMoveDown,
  foodDataSource
}: {
  item: any,
  index: number,
  isFirst: boolean,
  isLast: boolean,
  onUpdate: (index: number, field: string, value: any) => void,
  onRemove: (index: number) => void,
  onAddNewFood: (name: string, index: number) => void,
  onMoveUp: (index: number) => void,
  onMoveDown: (index: number) => void,
  foodDataSource: string
}) => {
  const unitOptions = (
    <>
      <SelectItem value="g">g</SelectItem>
      <SelectItem value="un">un</SelectItem>
      <SelectItem value="ml">ml</SelectItem>
      <SelectItem value="colher">colher</SelectItem>
      <SelectItem value="fatia">fatia</SelectItem>
      {item.serving_name && !['g', 'un', 'ml', 'colher', 'fatia', 'unidade'].includes(item.serving_name) && (
        <SelectItem value={item.serving_name}>{item.serving_name}</SelectItem>
      )}
      {item.serving_name === 'unidade' && (
        <SelectItem value="unidade">unidade</SelectItem>
      )}
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group relative bg-card rounded-xl p-1.5 xl:p-2 border border-border hover:border-primary/30 transition-all duration-200"
    >
      {/* Mobile layout (< md) */}
      <div className="md:hidden space-y-1.5">
        <FoodAutocomplete
          value={item.food}
          onChange={(v) => onUpdate(index, 'food', v)}
          onSelect={(food) => onUpdate(index, 'food_object', food)}
          onAddNew={(name) => onAddNewFood(name, index)}
          placeholder="Qual o alimento?"
          dataSource={foodDataSource as any}
          className="bg-card hover:bg-card border-border focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 rounded-xl transition-all h-8"
        />
        <div className="flex items-center gap-1.5">
          <div className="w-14 bg-card border border-border focus-within:border-primary rounded-xl h-7 px-2 flex items-center">
            <Input
              value={item.quantity}
              onChange={(e) => onUpdate(index, 'quantity', e.target.value)}
              className="border-none p-0 h-auto focus-visible:ring-0 bg-transparent text-foreground font-semibold text-center w-full placeholder:text-muted-foreground text-xs"
              placeholder="Qtd"
            />
          </div>
          <Select value={item.unit} onValueChange={(v) => onUpdate(index, 'unit', v)}>
            <SelectTrigger className="w-16 bg-card border border-border h-7 rounded-xl px-2 text-muted-foreground font-medium text-xs">
              <SelectValue>{item.unit}</SelectValue>
            </SelectTrigger>
            <SelectContent>{unitOptions}</SelectContent>
          </Select>
          <div className="flex items-center gap-1 ml-auto">
            <div className="text-center">
              <Input type="number" value={item.kcal} onChange={(e) => onUpdate(index, 'kcal', Number(e.target.value))}
                className="border-none p-0 h-7 focus-visible:ring-0 bg-muted/50 rounded-lg text-center text-foreground font-bold w-10 mx-auto text-xs" />
            </div>
            <div className="text-center border-l border-border pl-1">
              <Input type="number" value={item.protein} onChange={(e) => onUpdate(index, 'protein', Number(e.target.value))}
                className="border-none p-0 h-7 focus-visible:ring-0 bg-muted/50 rounded-lg text-center text-muted-foreground font-semibold w-8 mx-auto text-xs" />
            </div>
            <div className="text-center border-l border-border pl-1">
              <Input type="number" value={item.carbs} onChange={(e) => onUpdate(index, 'carbs', Number(e.target.value))}
                className="border-none p-0 h-7 focus-visible:ring-0 bg-muted/50 rounded-lg text-center text-muted-foreground font-semibold w-8 mx-auto text-xs" />
            </div>
            <div className="text-center border-l border-border pl-1">
              <Input type="number" value={item.fat} onChange={(e) => onUpdate(index, 'fat', Number(e.target.value))}
                className="border-none p-0 h-7 focus-visible:ring-0 bg-muted/50 rounded-lg text-center text-muted-foreground font-semibold w-8 mx-auto text-xs" />
            </div>
          </div>
          <div className="flex items-center gap-1 ml-1 shrink-0">
            <div className="flex flex-col gap-px">
              <Button variant="ghost" size="icon" onClick={() => onMoveUp(index)} disabled={isFirst}
                className="h-5 w-5 rounded-md hover:bg-muted text-muted-foreground/40 transition-all disabled:opacity-20">
                <ChevronUp className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onMoveDown(index)} disabled={isLast}
                className="h-5 w-5 rounded-md hover:bg-muted text-muted-foreground/40 transition-all disabled:opacity-20">
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onRemove(index)}
              className="h-7 w-7 rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-all shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tablet + Desktop layout (md+) */}
      <div className="hidden md:grid grid-cols-12 gap-1.5 xl:gap-2 items-center">
        {/* Food Search */}
        <div className="col-span-4">
          <FoodAutocomplete
            value={item.food}
            onChange={(v) => onUpdate(index, 'food', v)}
            onSelect={(food) => onUpdate(index, 'food_object', food)}
            onAddNew={(name) => onAddNewFood(name, index)}
            placeholder="Qual o alimento?"
            dataSource={foodDataSource as any}
            className="bg-card hover:bg-card border-border focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 rounded-xl transition-all h-7 xl:h-8"
          />
        </div>

        {/* Quantity & Unit */}
        <div className="col-span-3 flex items-center gap-1.5 xl:gap-2">
          <div className="flex-1 bg-card border border-border focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 rounded-xl h-7 xl:h-8 px-2 xl:px-3 transition-all flex items-center">
            <Input
              value={item.quantity}
              onChange={(e) => onUpdate(index, 'quantity', e.target.value)}
              className="border-none p-0 h-auto focus-visible:ring-0 bg-transparent text-foreground font-semibold text-center w-full placeholder:text-muted-foreground text-xs"
              placeholder="Qtd."
            />
          </div>
          <Select value={item.unit} onValueChange={(v) => onUpdate(index, 'unit', v)}>
            <SelectTrigger className="flex-1 bg-card border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 h-7 xl:h-8 rounded-xl px-2 xl:px-3 text-muted-foreground font-medium text-xs transition-all">
              <SelectValue>{item.unit}</SelectValue>
            </SelectTrigger>
            <SelectContent>{unitOptions}</SelectContent>
          </Select>
        </div>

        {/* Macros Summary */}
        <div className="col-span-3 flex items-center justify-around gap-1 xl:gap-2 px-1 xl:px-2">
          <div className="text-center">
            <p className="text-[10px] font-medium text-chart-3 mb-0.5 hidden xl:block">Kcal</p>
            <Input type="number" value={item.kcal} onChange={(e) => onUpdate(index, 'kcal', Number(e.target.value))}
              className="border-none p-0 h-7 focus-visible:ring-0 bg-muted/50 hover:bg-muted/50 focus:bg-card rounded-lg text-center text-foreground font-bold w-10 xl:w-14 mx-auto transition-all text-xs" />
          </div>
          <div className="text-center border-l border-border pl-1 xl:pl-2">
            <p className="text-[10px] font-medium text-chart-4 mb-0.5 hidden xl:block">Prot</p>
            <Input type="number" value={item.protein} onChange={(e) => onUpdate(index, 'protein', Number(e.target.value))}
              className="border-none p-0 h-7 focus-visible:ring-0 bg-muted/50 hover:bg-muted/50 focus:bg-card rounded-lg text-center text-muted-foreground font-semibold w-8 xl:w-10 mx-auto transition-all text-xs" />
          </div>
          <div className="text-center border-l border-border pl-1 xl:pl-2">
            <p className="text-[10px] font-medium text-primary mb-0.5 hidden xl:block">Carb</p>
            <Input type="number" value={item.carbs} onChange={(e) => onUpdate(index, 'carbs', Number(e.target.value))}
              className="border-none p-0 h-7 focus-visible:ring-0 bg-muted/50 hover:bg-muted/50 focus:bg-card rounded-lg text-center text-muted-foreground font-semibold w-8 xl:w-10 mx-auto transition-all text-xs" />
          </div>
          <div className="text-center border-l border-border pl-1 xl:pl-2">
            <p className="text-[10px] font-medium text-chart-2 mb-0.5 hidden xl:block">Gord</p>
            <Input type="number" value={item.fat} onChange={(e) => onUpdate(index, 'fat', Number(e.target.value))}
              className="border-none p-0 h-7 focus-visible:ring-0 bg-muted/50 hover:bg-muted/50 focus:bg-card rounded-lg text-center text-muted-foreground font-semibold w-8 xl:w-10 mx-auto transition-all text-xs" />
          </div>
        </div>

        {/* Actions */}
        <div className="col-span-2 flex justify-end items-center gap-1.5">
          <div className="flex flex-col gap-px">
            <Button variant="ghost" size="icon" onClick={() => onMoveUp(index)} disabled={isFirst}
              className="h-5 w-5 xl:h-6 xl:w-6 rounded-md hover:bg-muted text-muted-foreground/40 transition-all disabled:opacity-20">
              <ChevronUp className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onMoveDown(index)} disabled={isLast}
              className="h-5 w-5 xl:h-6 xl:w-6 rounded-md hover:bg-muted text-muted-foreground/40 transition-all disabled:opacity-20">
              <ChevronDown className="w-3 h-3" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onRemove(index)}
            className="h-7 w-7 xl:h-9 xl:w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-all">
            <Trash2 className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
});

MealItemRow.displayName = 'MealItemRow';

// Helpers de localStorage com try/catch silencioso
function isValidDraft(d: unknown): d is DraftData {
  return (
    typeof d === 'object' && d !== null &&
    typeof (d as Record<string, unknown>).name === 'string' &&
    Array.isArray((d as Record<string, unknown>).items) &&
    typeof (d as Record<string, unknown>).savedAt === 'string'
  );
}

function readDraft(key: string): DraftData | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, data: DraftData): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // silencioso — localStorage pode estar indisponível
  }
}

function removeDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // silencioso
  }
}

export const MealPlanEditor = ({
  initialName = '',
  initialItems = [],
  initialGeneralInstructions = '',
  initialWaterIntake = '',
  initialMealObservations = {},
  initialCustomMeals = [],
  selectedCalculation,
  foodDataSource,
  isNew = false,
  draftKey,
  children,
  onSave,
  onClose
}: MealPlanEditorProps) => {
  const [mealPlanName, setMealPlanName] = useState(initialName);
  const [mealItems, setMealItems] = useState(initialItems);
  const [generalInstructions, setGeneralInstructions] = useState(initialGeneralInstructions);
  const [waterIntake, setWaterIntake] = useState(initialWaterIntake);
  const [mealObservations, setMealObservations] = useState(initialMealObservations);
  const [mealTypes, setMealTypes] = useState<MealType[]>(initialCustomMeals.length > 0 ? initialCustomMeals : DEFAULT_MEAL_TYPES);
  const [currentFoodDataSource, setCurrentFoodDataSource] = useState<'Todas' | 'TACO' | 'TBCA' | 'Custom'>(foodDataSource as any || 'Todas');

  const [isCustomFoodDialogOpen, setIsCustomFoodDialogOpen] = useState(false);
  const [initialFoodName, setInitialFoodName] = useState('');
  const [activeMealItemIndex, setActiveMealItemIndex] = useState<number | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // --- Autosave / rascunho ---
  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  // Controla se já verificamos o rascunho ao montar (evitar re-verificação)
  const draftCheckedRef = useRef(false);
  // Ref para o debounce timer
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ao montar: verifica rascunho existente
  useEffect(() => {
    if (!draftKey || draftCheckedRef.current) return;
    draftCheckedRef.current = true;

    const draft = readDraft(draftKey);
    if (draft) {
      setHasDraft(true);
      setDraftSavedAt(draft.savedAt);
    }
  }, [draftKey]);

  const handleContinueDraft = useCallback(() => {
    if (!draftKey) return;
    const draft = readDraft(draftKey);
    if (!draft) return;

    setMealPlanName(draft.name);
    setMealItems(draft.items);
    setGeneralInstructions(draft.generalInstructions);
    setWaterIntake(draft.waterIntake);
    setMealObservations(draft.mealObservations || {});
    setMealTypes(draft.customMeals?.length > 0 ? draft.customMeals : DEFAULT_MEAL_TYPES);
    setHasDraft(false);
    setDraftSavedAt(null);
  }, [draftKey]);

  const handleDiscardDraft = useCallback(() => {
    if (draftKey) removeDraft(draftKey);
    setHasDraft(false);
    setDraftSavedAt(null);
  }, [draftKey]);

  const [savedSnapshot, setSavedSnapshot] = useState(() => ({
    name: initialName,
    instructions: initialGeneralInstructions,
    waterIntake: initialWaterIntake,
    items: JSON.stringify(initialItems),
    mealTypes: JSON.stringify(initialCustomMeals.length > 0 ? initialCustomMeals : DEFAULT_MEAL_TYPES),
  }));

  // Mantido para compatibilidade com o autosave (lê via savedSnapshot.items e savedSnapshot.mealTypes)
  const initialItemsRef = useRef(savedSnapshot.items);
  const initialMealTypesRef = useRef(savedSnapshot.mealTypes);

  const hasUnsavedChanges = useMemo(() => {
    if (mealPlanName !== savedSnapshot.name) return true;
    if (generalInstructions !== savedSnapshot.instructions) return true;
    if (waterIntake !== savedSnapshot.waterIntake) return true;
    if (JSON.stringify(mealItems) !== savedSnapshot.items) return true;
    if (JSON.stringify(mealTypes) !== savedSnapshot.mealTypes) return true;
    return false;
  }, [mealPlanName, mealItems, generalInstructions, waterIntake, mealTypes, savedSnapshot]);

  // Autosave com debounce de 1000ms — só grava quando há mudanças reais (hasUnsavedChanges)
  // e enquanto o banner de rascunho estiver visível (hasDraft), o autosave fica pausado
  useEffect(() => {
    if (!draftKey || !draftCheckedRef.current || hasDraft || !hasUnsavedChanges) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(() => {
      writeDraft(draftKey, {
        name: mealPlanName,
        items: mealItems,
        generalInstructions,
        waterIntake,
        mealObservations,
        customMeals: mealTypes,
        savedAt: new Date().toISOString(),
      });
    }, 1000);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [draftKey, hasDraft, hasUnsavedChanges, mealPlanName, mealItems, generalInstructions, waterIntake, mealObservations, mealTypes]);

  // Avisa o navegador antes de fechar a aba/recarregar com alterações não salvas
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
    setIsSaving(true);
    try {
      const success = await onSave({
        name: mealPlanName,
        items: mealItems,
        generalInstructions,
        waterIntake,
        mealObservations,
        customMeals: mealTypes
      });
      if (success) {
        setSavedSnapshot({
          name: mealPlanName,
          instructions: generalInstructions,
          waterIntake,
          items: JSON.stringify(mealItems),
          mealTypes: JSON.stringify(mealTypes),
        });
        if (draftKey) removeDraft(draftKey);
      }
    } finally {
      setIsSaving(false);
    }
  }, [onSave, mealPlanName, mealItems, generalInstructions, waterIntake, mealObservations, mealTypes, draftKey]);

  const mealTotals = useMemo(() => mealItems.reduce((acc, item) => ({
    kcal: acc.kcal + (Number(item.kcal) || 0),
    protein: acc.protein + (Number(item.protein) || 0),
    carbs: acc.carbs + (Number(item.carbs) || 0),
    fat: acc.fat + (Number(item.fat) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }), [mealItems]);

  const addMealItem = useCallback((mealId: string) => {
    setMealItems(prev => [...prev, {
      meal: mealId,
      food: '',
      quantity: '',
      unit: 'g',
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    }]);
  }, []);

  const removeMealItem = useCallback((index: number) => {
    setMealItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveMealItem = useCallback((index: number, direction: 'up' | 'down') => {
    setMealItems(prev => {
      const item = prev[index];
      if (!item) return prev;
      const mealId = item.meal;
      // Índices globais dos itens desta refeição
      const groupIndices = prev.reduce<number[]>((acc, mi, i) => {
        if (mi.meal === mealId) acc.push(i);
        return acc;
      }, []);
      const posInGroup = groupIndices.indexOf(index);
      if (direction === 'up' && posInGroup === 0) return prev;
      if (direction === 'down' && posInGroup === groupIndices.length - 1) return prev;
      const swapGlobalIdx = direction === 'up' ? groupIndices[posInGroup - 1] : groupIndices[posInGroup + 1];
      const next = [...prev];
      [next[index], next[swapGlobalIdx]] = [next[swapGlobalIdx], next[index]];
      return next;
    });
  }, []);

  const updateMealItem = useCallback((index: number, field: string, value: any) => {
    setMealItems(prev => {
      const newItems = [...prev];
      if (!newItems[index]) return prev;
      
      const item = { ...newItems[index] };

      if (field === 'food_object') {
        const food = value as TacoFood | CustomFood;
        item.food = food.name;

        if (food.serving) {
          item.unit = food.serving.name;
          item.quantity = "1";
          const ratio = food.serving.weight / (food.baseQuantity || 100);
          item.kcal = Math.round(food.kcal * ratio);
          item.protein = Math.round(food.protein * ratio);
          item.carbs = Math.round(food.carbs * ratio);
          item.fat = Math.round(food.fat * ratio);
        } else {
          item.unit = food.baseUnit;
          item.quantity = food.baseQuantity.toString();
          item.kcal = Math.round(food.kcal);
          item.protein = Math.round(food.protein);
          item.carbs = Math.round(food.carbs);
          item.fat = Math.round(food.fat);
        }

        item.base_kcal = food.kcal;
        item.base_protein = food.protein;
        item.base_carbs = food.carbs;
        item.base_fat = food.fat;
        item.base_quantity = food.baseQuantity;
        item.serving_name = food.serving?.name || null;
        item.serving_weight = food.serving?.weight || null;
      } else if (field === 'food') {
        item.food = value;
        item.base_kcal = null;
        item.base_protein = null;
        item.base_carbs = null;
        item.base_fat = null;
        item.base_quantity = null;
        item.serving_name = null;
        item.serving_weight = null;
      } else if (field === 'quantity' || field === 'unit') {
        if (field === 'quantity') item.quantity = value;
        if (field === 'unit') item.unit = value;

        const newQty = parseFloat(item.quantity);
        if (!isNaN(newQty) && item.base_quantity && item.base_quantity > 0) {
          let effectiveWeight = newQty;
          const isServingUnit = item.unit === item.serving_name ||
            (item.unit === 'un' && item.serving_name === 'unidade') ||
            (item.unit === 'unidade' && item.serving_name === 'un');

          if (isServingUnit && item.serving_weight) {
            effectiveWeight = newQty * item.serving_weight;
          }

          const ratio = effectiveWeight / item.base_quantity;
          item.kcal = Math.round((item.base_kcal || 0) * ratio);
          item.protein = Math.round((item.base_protein || 0) * ratio);
          item.carbs = Math.round((item.base_carbs || 0) * ratio);
          item.fat = Math.round((item.base_fat || 0) * ratio);
        }
      } else {
        (item as any)[field] = value;
      }

      newItems[index] = item;
      return newItems;
    });
  }, []);

  const updateMealType = (id: string, field: string, value: string) => {
    setMealTypes(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const addCustomMeal = () => {
    const newId = `meal_${Date.now()}`;
    setMealTypes(prev => [...prev, {
      id: newId,
      label: 'Nova Refeição',
      time: '08:00',
      color: 'bg-primary/10 border-primary/20 text-primary'
    }]);
  };

  const removeMealType = (id: string) => {
    setMealTypes(prev => prev.filter(m => m.id !== id));
    setMealItems(prev => prev.filter(item => item.meal !== id));
  };

  const moveMealType = (id: string, direction: 'up' | 'down') => {
    setMealTypes(prev => {
      const idx = prev.findIndex(m => m.id === id);
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;
      const next = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };


  const calculateMealTotals = (mealId: string) => {
    return mealItems.filter(i => i.meal === mealId).reduce((acc, item) => ({
      kcal: acc.kcal + (Number(item.kcal) || 0),
      protein: acc.protein + (Number(item.protein) || 0),
      carbs: acc.carbs + (Number(item.carbs) || 0),
      fat: acc.fat + (Number(item.fat) || 0),
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  };

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Left Sidebar - Nutritional Intelligence */}
      <motion.aside
        initial={{ x: -270, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-[270px] bg-card border-r border-border flex flex-col h-full hidden md:flex shrink-0 z-20"
      >
        <div className="p-5 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-heading font-medium text-foreground tracking-tight">Dashboard</h2>
              <p className="text-xs text-muted-foreground font-medium">Nutricional</p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors mt-3",
              hasUnsavedChanges
                ? "bg-accent border-accent-foreground/20"
                : "bg-card border-border"
            )}
          >
            {hasUnsavedChanges ? (
              <CircleAlert className="w-3.5 h-3.5 text-accent-foreground shrink-0" />
            ) : (
              <CircleCheck className="w-3.5 h-3.5 text-primary shrink-0" />
            )}
            <p className="text-xs font-medium text-foreground">
              {hasUnsavedChanges ? 'Alterações não salvas' : 'Tudo salvo'}
            </p>
          </div>
        </div>

        {selectedCalculation && (
          <div className="shrink-0 p-4 bg-muted/20">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl bg-primary text-primary-foreground relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Calculator className="w-16 h-16" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                    <Calculator className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <span className="text-xs font-medium text-primary-foreground/80">Meta Sugerida</span>
                </div>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-4xl font-bold tracking-tight text-primary-foreground">
                    {selectedCalculation.result.getAjustado.toFixed(0)}
                  </span>
                  <span className="text-xs font-medium text-primary-foreground/60">kcal</span>
                </div>
                <p className="text-xs font-medium text-primary-foreground/80 leading-relaxed">
                  Baseado no cálculo de TMB e nível de atividade selecionado.
                </p>
              </div>
            </motion.div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-muted/20 border-t border-border">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">Macronutrientes</span>
            <div className="w-12 h-px bg-muted" />
          </div>

          <div className="grid gap-2 xl:gap-3">
            <SummaryCard
              label="Energia Total"
              value={mealTotals.kcal}
              total={selectedCalculation?.result.getAjustado}
              unit="kcal"
              color="text-chart-3"
              iconBg="bg-chart-3/10"
              progressColor="bg-chart-3"
              icon={Activity}
              variant="sidebar"
            />
            <SummaryCard
              label="Proteínas"
              value={mealTotals.protein}
              total={selectedCalculation?.result.macronutrientes.ptnG}
              unit="g"
              color="text-emerald-600"
              iconBg="bg-emerald-500/10"
              progressColor="bg-emerald-500"
              icon={Dna}
              variant="sidebar"
            />
            <SummaryCard
              label="Carboidratos"
              value={mealTotals.carbs}
              total={selectedCalculation?.result.macronutrientes.choG}
              unit="g"
              color="text-blue-600"
              iconBg="bg-blue-500/10"
              progressColor="bg-blue-500"
              icon={Zap}
              variant="sidebar"
            />
            <SummaryCard
              label="Gorduras"
              value={mealTotals.fat}
              total={selectedCalculation?.result.macronutrientes.lipG}
              unit="g"
              color="text-red-500"
              iconBg="bg-red-500/10"
              progressColor="bg-red-500"
              icon={Droplets}
              variant="sidebar"
            />
          </div>
        </div>

      </motion.aside>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Command Center Header */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="sticky top-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border px-3 py-2 md:px-4 xl:px-6 xl:py-3 print:hidden"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 md:gap-3 xl:gap-8">
            <div className="flex items-center gap-5">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRequestClose}
                className="rounded-xl border-border hover:bg-muted/30 transition-all h-9 w-9 shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </Button>
              
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span>Plano Alimentar</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-primary font-semibold">Edição</span>
              </div>
            </div>

            {/* Tablet: compact Select (md–xl) */}
            <div className="hidden md:flex xl:hidden items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium shrink-0">Base:</span>
              <Select value={currentFoodDataSource} onValueChange={(v) => setCurrentFoodDataSource(v as any)}>
                <SelectTrigger className="h-7 w-24 bg-card border border-border rounded-lg text-xs font-bold text-muted-foreground px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todas">Todas</SelectItem>
                  <SelectItem value="TACO">TACO</SelectItem>
                  <SelectItem value="TBCA">TBCA</SelectItem>
                  <SelectItem value="Custom">Própria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Desktop: tab buttons (xl+) */}
            <div className="hidden xl:flex items-center gap-1.5 p-1 bg-muted/80 rounded-xl border border-border/60">
              <div className="px-3 text-xs font-medium text-muted-foreground border-r border-border mr-1">
                Base de Dados
              </div>
              {[
                { id: 'Todas', label: 'Todas', icon: Search },
                { id: 'TACO', label: 'TACO', icon: Activity },
                { id: 'TBCA', label: 'TBCA', icon: Zap },
                { id: 'Custom', label: 'Própria', icon: Plus },
              ].map((source) => (
                <button
                  key={source.id}
                  onClick={() => setCurrentFoodDataSource(source.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap tracking-wide",
                    currentFoodDataSource === source.id
                      ? "bg-card text-primary ring-1 ring-border/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                  )}
                >
                  <source.icon className={cn("w-3.5 h-3.5", currentFoodDataSource === source.id ? "text-primary" : "text-muted-foreground")} />
                  {source.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleSaveClick}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-8 xl:h-10 px-3 xl:px-6 font-bold text-xs gap-2 transition-all active:scale-95 group"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                )}
                <span className="hidden md:inline xl:hidden">{isNew ? 'Criar' : 'Salvar'}</span>
                <span className="hidden xl:inline">{isNew ? 'Criar Plano' : 'Salvar Alterações'}</span>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Banner de recuperação de rascunho */}
        <AnimatePresence>
          {hasDraft && draftKey && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="z-40 bg-accent border-b border-accent-foreground/20 px-3 py-2.5 md:px-6 print:hidden"
            >
              <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-accent-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                    <History className="w-4 h-4 text-accent-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-accent-foreground leading-tight">
                      Encontramos um rascunho salvo
                    </p>
                    <p className="text-xs text-accent-foreground/70 font-medium mt-0.5">
                      Salvo{' '}
                      {draftSavedAt
                        ? formatDistanceToNow(new Date(draftSavedAt), { addSuffix: true, locale: ptBR })
                        : ''}
                      . Deseja continuar de onde parou?
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 pl-11 sm:pl-0">
                  <button
                    onClick={handleContinueDraft}
                    className="h-8 px-4 bg-accent-foreground text-accent text-xs font-bold rounded-xl hover:bg-accent-foreground/90 transition-all active:scale-95"
                  >
                    Continuar rascunho
                  </button>
                  <button
                    onClick={handleDiscardDraft}
                    className="h-8 px-3 text-xs font-bold rounded-xl border border-accent-foreground/30 text-accent-foreground/70 hover:bg-accent-foreground/10 hover:text-accent-foreground transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Descartar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile macro summary — shown only when sidebar is hidden */}
        <div className="md:hidden border-b border-border bg-card px-4 py-2 print:hidden">
          <div className="flex items-center justify-around gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-chart-3" />
              <span className="text-xs font-bold text-foreground">{mealTotals.kcal.toFixed(0)}</span>
              <span className="text-[11px] text-muted-foreground">kcal</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-chart-4" />
              <span className="text-xs font-bold text-foreground">{mealTotals.protein.toFixed(0)}g</span>
              <span className="text-[11px] text-muted-foreground">prot</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-bold text-foreground">{mealTotals.carbs.toFixed(0)}g</span>
              <span className="text-[11px] text-muted-foreground">carb</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-chart-2" />
              <span className="text-xs font-bold text-foreground">{mealTotals.fat.toFixed(0)}g</span>
              <span className="text-[11px] text-muted-foreground">gord</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            
            {/* Top Config Section */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl p-4 border border-border relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none">
                <Edit2 className="w-48 h-48 text-foreground" />
              </div>

              <div className="space-y-4 relative">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground ml-1">Nome do Plano</Label>
                    <Input
                      value={mealPlanName}
                      onChange={(e) => setMealPlanName(e.target.value)}
                      className="text-xl font-bold border-2 border-border bg-card focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 h-12 rounded-xl transition-all px-5"
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
                        className="pl-9 border-2 border-border bg-card focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 h-12 rounded-xl transition-all"
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
                    className="min-h-[72px] rounded-xl border-2 border-border bg-card focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all text-sm font-medium leading-relaxed p-3"
                    value={generalInstructions}
                    onChange={(e) => setGeneralInstructions(e.target.value)}
                  />
                </div>
              </div>
            </motion.div>

            {/* Meals Section */}
            <div className="space-y-4 pb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 xl:gap-6 px-2">
                <div>
                  <h2 className="text-base xl:text-xl font-bold text-foreground tracking-tight flex items-center gap-3">
                    Cronograma de Refeições
                  </h2>
                  <p className="text-xs text-muted-foreground font-medium mt-1">Estruture os horários e alimentos do paciente</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 bg-card rounded-xl border border-border flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {mealItems.length} Alimentos selecionados
                    </span>
                  </div>
                </div>
              </div>

              <AnimatePresence mode="popLayout">
                {mealTypes.map((mealType, mealIdx) => {
                  const items = mealItems.filter(i => i.meal === mealType.id);
                  const totals = calculateMealTotals(mealType.id);

                  return (
                    <motion.div
                      key={mealType.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group/meal relative bg-card/50 hover:bg-card rounded-2xl border border-border hover:border-primary/20 p-3 xl:p-6 transition-all duration-500"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 xl:gap-6 mb-4 xl:mb-8">
                        <div className="flex items-center gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Input
                                value={mealType.label}
                                onChange={(e) => updateMealType(mealType.id, 'label', e.target.value)}
                                className="font-bold text-base xl:text-xl border-none bg-muted/50 hover:bg-muted/50 focus:bg-card h-8 xl:h-11 px-3 xl:px-4 w-full md:w-[180px] xl:w-[320px] text-foreground focus:ring-2 focus:ring-primary/20 rounded-xl placeholder:text-muted-foreground transition-all"
                                placeholder="Título da Refeição"
                              />
                              <div className="flex items-center gap-2 px-2 xl:px-4 py-1 xl:py-1.5 bg-card rounded-xl border-2 border-border focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 shrink-0 h-8 xl:h-11 transition-all">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <Input
                                  type="time"
                                  value={mealType.time || ''}
                                  onChange={(e) => updateMealType(mealType.id, 'time', e.target.value)}
                                  className="w-[85px] h-6 border-none bg-transparent text-sm font-bold p-0 focus:ring-0 text-muted-foreground [&::-webkit-calendar-picker-indicator]:hidden"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 bg-card p-2 rounded-xl border border-border">
                          <div className="flex items-center gap-3 px-3 py-1.5 bg-primary/10 rounded-xl border border-primary/20">
                            <div className="text-center">
                              <p className="text-xs font-medium text-chart-3">Energia</p>
                              <p className="text-xs font-bold text-foreground">{totals.kcal.toFixed(0)}<span className="text-[11px] ml-0.5">kcal</span></p>
                            </div>
                            <div className="w-px h-5 bg-primary/15" />
                            <div className="text-center">
                              <p className="text-xs font-medium text-chart-4">Prot</p>
                              <p className="text-xs font-bold text-foreground">{totals.protein.toFixed(1)}g</p>
                            </div>
                            <div className="w-px h-5 bg-primary/15" />
                            <div className="text-center">
                              <p className="text-xs font-medium text-primary">Carb</p>
                              <p className="text-xs font-bold text-foreground">{totals.carbs.toFixed(1)}g</p>
                            </div>
                            <div className="w-px h-5 bg-primary/15" />
                            <div className="text-center">
                              <p className="text-xs font-medium text-chart-2">Gord</p>
                              <p className="text-xs font-bold text-foreground">{totals.fat.toFixed(1)}g</p>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveMealType(mealType.id, 'up')}
                            disabled={mealIdx === 0}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-7 w-7 xl:h-9 xl:w-9 transition-all disabled:opacity-30"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveMealType(mealType.id, 'down')}
                            disabled={mealIdx === mealTypes.length - 1}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-7 w-7 xl:h-9 xl:w-9 transition-all disabled:opacity-30"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMealType(mealType.id)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl h-7 w-7 xl:h-9 xl:w-9 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2 xl:space-y-3 mb-4 xl:mb-8">
                        <AnimatePresence mode="popLayout">
                          {items.map((item, posInGroup) => {
                            const itemIndex = mealItems.findIndex(mi => mi === item);
                            return (
                              <MealItemRow
                                key={`${mealType.id}-${itemIndex}`}
                                item={item}
                                index={itemIndex}
                                isFirst={posInGroup === 0}
                                isLast={posInGroup === items.length - 1}
                                onUpdate={updateMealItem}
                                onRemove={removeMealItem}
                                onMoveUp={(idx) => moveMealItem(idx, 'up')}
                                onMoveDown={(idx) => moveMealItem(idx, 'down')}
                                onAddNewFood={(name, index) => {
                                  setInitialFoodName(name);
                                  setActiveMealItemIndex(index);
                                  setIsCustomFoodDialogOpen(true);
                                }}
                                foodDataSource={currentFoodDataSource}
                              />
                            );
                          })}
                        </AnimatePresence>

                        <motion.button
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => addMealItem(mealType.id)}
                          className="w-full py-3 border-2 border-dashed border-border hover:border-primary/30 hover:bg-primary/10 rounded-xl flex items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all font-bold text-xs"
                        >
                          <Plus className="w-4 h-4" /> Adicionar Alimento
                        </motion.button>
                      </div>

                      <div className="pt-6 border-t border-border">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 px-1">
                            <MessageSquare className="w-3 h-3 text-muted-foreground" />
                            <Label className="text-xs font-medium text-muted-foreground">Observações específicas</Label>
                          </div>
                          <Textarea
                            placeholder="Observações importantes para esta refeição..."
                            className="min-h-[80px] text-sm font-medium bg-card border-2 border-border rounded-xl resize-none focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all p-4"
                            value={mealObservations[mealType.id] || ''}
                            onChange={(e) => setMealObservations(prev => ({ ...prev, [mealType.id]: e.target.value }))}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {mealTypes.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-8 px-10 text-center bg-card rounded-2xl border-2 border-dashed border-border"
                >
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 relative">
                    <Apple className="w-7 h-7 text-primary" />
                    <div className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-card rounded-full ring-1 ring-border flex items-center justify-center">
                      <Plus className="w-3.5 h-3.5 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">O plano está vazio</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-4 font-medium text-sm leading-relaxed">
                    Comece adicionando a primeira refeição para estruturar a estratégia do seu paciente.
                  </p>
                  <Button
                    onClick={addCustomMeal}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-9 px-6 font-bold transition-all active:scale-95 text-sm"
                  >
                    <Plus className="w-5 h-5 mr-2" /> Nova Refeição
                  </Button>
                </motion.div>
              )}

              {mealTypes.length > 0 && (
                <div className="flex justify-center pt-8">
                  <Button
                    onClick={addCustomMeal}
                    variant="outline"
                    className="bg-card hover:bg-primary/10 text-primary border border-dashed border-primary/30 rounded-xl h-8 px-4 font-medium text-xs gap-1.5 transition-all hover:border-primary/40 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Refeição
                  </Button>
                </div>
              )}

              {children}
            </div>
          </div>
        </div>

        <CustomFoodDialog
          open={isCustomFoodDialogOpen}
          onOpenChange={setIsCustomFoodDialogOpen}
          initialName={initialFoodName}
          onSuccess={(food) => {
            if (activeMealItemIndex !== null) {
              updateMealItem(activeMealItemIndex, 'food_object', food);
            }
          }}
        />

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
    </div>
  );
};
