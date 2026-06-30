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
  Save,
  ArrowLeft,
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
  X,
  Printer
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import { Checkbox } from './ui/checkbox';
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
import { getServingsForFood, FoodServing } from '../data/serving-map';
import { cn } from '../lib/utils';
import { CustomFoodDialog } from './CustomFoodDialog';

export interface MealType {
  id: string;
  label: string;
  time?: string;
  color: string;
}

export interface MealPlanEditorItem {
  id?: string;
  food: string;
  quantity: string;
  unit: string;
  weight_in_grams?: number;
  servings?: import('../data/serving-map').FoodServing[];
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
  meal: string;
  position?: number;
}

interface DraftData {
  name: string;
  items: MealPlanEditorItem[];
  generalInstructions: string;
  waterIntake: string;
  mealObservations: Record<string, string>;
  customMeals: MealType[];
  savedAt: string;
}

interface MealPlanEditorProps {
  initialName?: string;
  initialItems?: MealPlanEditorItem[];
  initialGeneralInstructions?: string;
  initialWaterIntake?: string;
  initialMealObservations?: Record<string, string>;
  initialCustomMeals?: MealType[];
  selectedCalculation?: NutritionCalculation | null;
  foodDataSource: 'Todas' | 'TACO' | 'TBCA' | 'Custom';
  isNew?: boolean;
  /** Chave do localStorage para o rascunho. Ex: 'nutrir:draft:mealplan:new:abc123' */
  draftKey?: string;
  children?: React.ReactNode;
  onSave: (data: {
    name: string;
    items: MealPlanEditorItem[];
    generalInstructions: string;
    waterIntake: string;
    mealObservations: Record<string, string>;
    customMeals: MealType[];
  }) => Promise<boolean>;
  onPrint?: () => Promise<void>;
  onClose: () => void;
}

const DEFAULT_MEAL_TYPES: MealType[] = [];

const SummaryCard = ({ label, value, total, unit, color, progressColor }: any) => {
  const percentage = total ? Math.min((value / total) * 100, 100) : 0;
  const ringSize = 54;
  const strokeWidth = 5;
  const radius = (ringSize - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  // "bg-macro-kcal" → "var(--color-macro-kcal)" para SVG style (não via className dinâmico)
  const strokeColor = `var(--color-${progressColor?.replace('bg-', '') ?? 'primary'})`;

  return (
    <motion.div
      whileHover={{ x: 2 }}
      className="flex items-center gap-3 bg-card rounded-xl border border-border p-2.5 xl:p-3 hover:border-primary/20 transition-all duration-300"
    >
      {/* Ring circular de progresso */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
          {/* Trilha de fundo — cinza visível */}
          <circle
            cx={ringSize / 2} cy={ringSize / 2} r={radius}
            fill="none" strokeWidth={strokeWidth}
            style={{ stroke: 'oklch(0.88 0 0)' }}
          />
          {/* Arco colorido proporcional à % preenchida */}
          <motion.circle
            cx={ringSize / 2} cy={ringSize / 2} r={radius}
            fill="none" strokeWidth={strokeWidth}
            style={{ stroke: strokeColor }}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-[10px] font-bold leading-none", color)}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Info textual */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] xl:text-xs font-medium text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className={cn("font-bold text-base xl:text-lg leading-none", color)}>
            {Number(value).toFixed(0)}
          </span>
          <span className="text-xs font-medium text-muted-foreground">{unit}</span>
        </div>
        {total && (
          <p className="text-[10px] text-muted-foreground mt-0.5">Meta: {total.toFixed(0)} {unit}</p>
        )}
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
  item: MealPlanEditorItem,
  index: number,
  isFirst: boolean,
  isLast: boolean,
  onUpdate: (index: number, field: string, value: unknown) => void,
  onRemove: (index: number) => void,
  onAddNewFood: (name: string, index: number) => void,
  onMoveUp: (index: number) => void,
  onMoveDown: (index: number) => void,
  foodDataSource: string
}) => {
  // Reconstrói servings: usa os persistidos, ou item.serving_name/weight do banco, ou fallback g
  const servings: FoodServing[] = item.servings && item.servings.length > 0
    ? item.servings
    : item.serving_name && item.serving_weight
      ? [
          { label: item.serving_name, weightInGrams: item.serving_weight },
          { label: 'g', weightInGrams: 1 },
        ]
      : [{ label: 'g', weightInGrams: 1 }];
  const showUnitSelect = servings.length > 1;

  const displayUnit = (unit: string) => {
    if (unit === 'g') return 'gramas';
    if (unit === 'ml') return 'mililitros';
    return unit;
  };

  const unitOptions = servings.map((s: FoodServing) => {
    const label = s.weightInGrams === 1
      ? displayUnit(s.label)
      : `${displayUnit(s.label)} (~${s.weightInGrams}g)`;
    return <SelectItem key={s.label} value={s.label}>{label}</SelectItem>;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative rounded-lg transition-all duration-200 hover:bg-muted/20",
        !isLast && "border-b border-border/40"
      )}
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
          className="bg-card hover:bg-card border-border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 rounded-lg transition-all h-8"
        />
        <div className="flex items-center gap-1.5">
          <div className="w-14 bg-card border border-border focus-within:border-ring rounded-lg h-7 px-2 flex items-center">
            <Input
              value={item.quantity}
              onChange={(e) => onUpdate(index, 'quantity', e.target.value)}
              className="border-none p-0 h-auto focus-visible:ring-0 bg-transparent text-foreground font-semibold text-center w-full placeholder:text-muted-foreground text-xs"
              placeholder="Qtd"
            />
          </div>
          {showUnitSelect ? (
            <Select value={item.unit} onValueChange={(v) => onUpdate(index, 'unit', v)}>
              <SelectTrigger className="w-20 bg-card border border-border h-7 rounded-lg px-2 text-muted-foreground font-medium text-xs">
                <SelectValue>{item.unit}</SelectValue>
              </SelectTrigger>
              <SelectContent>{unitOptions}</SelectContent>
            </Select>
          ) : (
            <span className="text-xs font-medium text-muted-foreground w-6 text-center">g</span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <div className="text-center">
              <Input type="number" value={item.kcal} onChange={(e) => onUpdate(index, 'kcal', Number(e.target.value))}
                className="border-none p-0 h-7 focus-visible:ring-0 bg-muted/50 rounded-lg text-center text-foreground font-medium w-10 mx-auto text-xs" />
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
              className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-all shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tablet + Desktop layout (md+) */}
      <div className="hidden md:flex items-center gap-2 px-2 py-1.5">
        {/* Bullet */}
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />

        {/* Food Search — ícone de busca oculto neste contexto */}
        <div className="flex-1 min-w-0">
          <FoodAutocomplete
            value={item.food}
            onChange={(v) => onUpdate(index, 'food', v)}
            onSelect={(food) => onUpdate(index, 'food_object', food)}
            onAddNew={(name) => onAddNewFood(name, index)}
            placeholder="Qual o alimento?"
            dataSource={foodDataSource as any}
            className="[&>div>svg]:hidden [&>div>input]:pl-2 [&>div>input]:h-7 [&>div>input]:text-sm"
          />
        </div>

        {/* Quantity & Unit — bloco de largura fixa para alinhar colunas de macros */}
        <div className="flex items-center gap-1 shrink-0 w-[120px]">
          <input
            value={item.quantity}
            onChange={(e) => onUpdate(index, 'quantity', e.target.value)}
            className="w-10 border-none outline-none bg-muted/40 rounded px-1 h-6 text-right text-foreground font-semibold text-xs shrink-0"
            placeholder="—"
          />
          {showUnitSelect ? (
            <Select value={item.unit} onValueChange={(v) => onUpdate(index, 'unit', v)}>
              <SelectTrigger className="flex-1 h-7 bg-transparent border-none text-muted-foreground font-medium text-xs px-1 focus-visible:ring-0 min-w-0">
                <SelectValue className="truncate">{displayUnit(item.unit)}</SelectValue>
              </SelectTrigger>
              <SelectContent>{unitOptions}</SelectContent>
            </Select>
          ) : (
            <span className="flex-1 text-xs font-medium text-muted-foreground truncate">{displayUnit(item.unit || 'g')}</span>
          )}
        </div>

        {/* Macros — colunas fixas com label separado do valor */}
        <div className="flex items-center gap-2 shrink-0 text-xs">
          <span className="flex items-baseline gap-1 justify-end w-[58px]">
            <input type="number" value={item.kcal ?? 0}
              onChange={(e) => onUpdate(index, 'kcal', Number(e.target.value))}
              className="w-10 border-none outline-none bg-transparent text-right text-macro-kcal font-semibold p-0 [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden" />
            <span className="text-[10px] font-medium text-macro-kcal shrink-0">Kcal</span>
          </span>
          <span className="flex items-baseline gap-1 justify-end w-[58px]">
            <input type="number" value={item.protein ?? 0}
              onChange={(e) => onUpdate(index, 'protein', Number(e.target.value))}
              className="w-8 border-none outline-none bg-transparent text-right text-macro-protein font-semibold p-0 [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden" />
            <span className="text-[10px] font-medium text-macro-protein shrink-0">Prot.</span>
          </span>
          <span className="flex items-baseline gap-1 justify-end w-[62px]">
            <input type="number" value={item.carbs ?? 0}
              onChange={(e) => onUpdate(index, 'carbs', Number(e.target.value))}
              className="w-8 border-none outline-none bg-transparent text-right text-macro-carbs font-semibold p-0 [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden" />
            <span className="text-[10px] font-medium text-macro-carbs shrink-0">Carb.</span>
          </span>
          <span className="flex items-baseline gap-1 justify-end w-[62px]">
            <input type="number" value={item.fat ?? 0}
              onChange={(e) => onUpdate(index, 'fat', Number(e.target.value))}
              className="w-8 border-none outline-none bg-transparent text-right text-macro-fat font-semibold p-0 [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden" />
            <span className="text-[10px] font-medium text-macro-fat shrink-0">Gord.</span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
            className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-all">
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
  onPrint,
  onClose
}: MealPlanEditorProps) => {
  const [mealPlanName, setMealPlanName] = useState(initialName);
  const [mealItems, setMealItems] = useState(initialItems);
  const [generalInstructions, setGeneralInstructions] = useState(initialGeneralInstructions);
  const [waterIntake, setWaterIntake] = useState(initialWaterIntake);
  const [mealObservations, setMealObservations] = useState(initialMealObservations);
  const [showMealObs, setShowMealObs] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    Object.entries(initialMealObservations).forEach(([k, v]) => {
      if (v?.trim()) init[k] = true;
    });
    return init;
  });
  const [mealTypes, setMealTypes] = useState<MealType[]>(initialCustomMeals.length > 0 ? initialCustomMeals : DEFAULT_MEAL_TYPES);
  const [currentFoodDataSource, setCurrentFoodDataSource] = useState<'Todas' | 'TACO' | 'TBCA' | 'Custom'>(foodDataSource as any || 'Todas');

  const [isCustomFoodDialogOpen, setIsCustomFoodDialogOpen] = useState(false);
  const [initialFoodName, setInitialFoodName] = useState('');
  const [activeMealItemIndex, setActiveMealItemIndex] = useState<number | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
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
    const emptyFoodItems = mealItems.filter(item => !item.food?.trim());
    if (emptyFoodItems.length > 0) {
      const firstEmpty = emptyFoodItems[0];
      const meal = mealTypes.find(m => m.id === firstEmpty.meal);
      const mealLabel = meal?.label || firstEmpty.meal;
      if (emptyFoodItems.length === 1) {
        toast.error(`Há 1 alimento sem nome em "${mealLabel}". Preencha ou remova-o antes de salvar.`);
      } else {
        toast.error(`Há ${emptyFoodItems.length} alimentos sem nome no plano. Preencha ou remova-os antes de salvar.`);
      }
      return;
    }

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
      weight_in_grams: 0,
      servings: [{ label: 'g', weightInGrams: 1 }],
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

  const updateMealItem = useCallback((index: number, field: string, value: unknown) => {
    setMealItems(prev => {
      const newItems = [...prev];
      if (!newItems[index]) return prev;
      
      const item = { ...newItems[index] };

      if (field === 'food_object') {
        const food = value as TacoFood | CustomFood;
        item.food = food.name;

        // Busca servings dinâmicos via serving-map
        // Para CustomFood com múltiplas medidas, normaliza serving para array
        const customServings: { name: string; weight: number }[] | undefined = (() => {
          if (!('serving' in food) || !food.serving) return undefined;
          const s = (food as CustomFood).serving;
          if (!s) return undefined;
          if (Array.isArray(s)) return s;
          return [s];
        })();

        const foodForMap = {
          id: food.id,
          description: food.name,
          category: 'category' in food ? (food as TacoFood).category : undefined,
          servings: customServings,
          baseUnit: 'baseUnit' in food ? (food as CustomFood).baseUnit : undefined,
        };
        const servings = getServingsForFood(foodForMap);
        item.servings = servings;

        // Unidade inicial: primeira serving disponível
        const initialServing = servings[0];
        item.unit = initialServing.label;

        // Macros por 100g (base_quantity sempre 100 para cálculo correto)
        // base_kcal/protein/carbs/fat = valores per 100g do alimento
        item.base_kcal = food.kcal;
        item.base_protein = food.protein;
        item.base_carbs = food.carbs;
        item.base_fat = food.fat;
        item.base_quantity = food.baseQuantity;
        // serving_name/weight: usar primeira medida customizada se disponível
        const firstCustomServing = customServings?.[0];
        item.serving_name = firstCustomServing?.name || null;
        item.serving_weight = firstCustomServing?.weight || null;

        if (initialServing.weightInGrams === 1) {
          // Escala livre em g: exibe baseQuantity gramas
          item.quantity = food.baseQuantity.toString();
          const weightInGrams = food.baseQuantity;
          item.weight_in_grams = weightInGrams;
          const ratio = weightInGrams / 100;
          item.kcal = Math.round(food.kcal * ratio);
          item.protein = Math.round(food.protein * ratio);
          item.carbs = Math.round(food.carbs * ratio);
          item.fat = Math.round(food.fat * ratio);
        } else {
          // Medida caseira: começa com 1 unidade da serving
          item.quantity = "1";
          const weightInGrams = initialServing.weightInGrams;
          item.weight_in_grams = weightInGrams;
          const ratio = weightInGrams / 100;
          item.kcal = Math.round(food.kcal * ratio);
          item.protein = Math.round(food.protein * ratio);
          item.carbs = Math.round(food.carbs * ratio);
          item.fat = Math.round(food.fat * ratio);
        }
      } else if (field === 'food') {
        item.food = value as string;
        item.base_kcal = null;
        item.base_protein = null;
        item.base_carbs = null;
        item.base_fat = null;
        item.base_quantity = null;
        item.serving_name = null;
        item.serving_weight = null;
        item.servings = [{ label: 'g', weightInGrams: 1 }];
        item.weight_in_grams = 0;
      } else if (field === 'quantity' || field === 'unit') {
        // Reconstrói servings a partir dos dados persistidos quando item.servings está vazio
        // (item.serving_name + item.serving_weight são salvos no banco; item.servings não é)
        const servings: FoodServing[] = item.servings && item.servings.length > 0
          ? item.servings
          : item.serving_name && item.serving_weight
            ? [
                { label: item.serving_name, weightInGrams: item.serving_weight },
                { label: 'g', weightInGrams: 1 },
              ]
            : [{ label: 'g', weightInGrams: 1 }];

        if (field === 'unit') {
          // Converte a quantidade para manter o mesmo peso total ao trocar unidade
          // Ex: 100g → "unidade (100g)" converte para qty=1, não qty=100
          const oldServing = servings.find((s: FoodServing) => s.label === item.unit)
            ?? { label: 'g', weightInGrams: 1 };
          const newServing = servings.find((s: FoodServing) => s.label === (value as string))
            ?? { label: 'g', weightInGrams: 1 };
          const currentQty = parseFloat(item.quantity);
          if (!isNaN(currentQty) && newServing.weightInGrams > 0) {
            const totalWeight = currentQty * oldServing.weightInGrams;
            const converted = totalWeight / newServing.weightInGrams;
            let finalQty: number;
            if (newServing.weightInGrams === 1) {
              // g ou ml: manter uma casa decimal, mínimo 1
              finalQty = converted < 1 ? 1 : Math.round(converted * 10) / 10;
            } else {
              // medida caseira (unidade, fatia, colher, concha...): sempre inteiro, mínimo 1
              finalQty = Math.max(1, Math.round(converted));
            }
            item.quantity = String(finalQty);
          }
          item.unit = value as string;
        } else {
          item.quantity = value as string;
        }

        const newQty = parseFloat(item.quantity);
        if (!isNaN(newQty) && item.base_kcal != null) {
          const selectedServing = servings.find((s: FoodServing) => s.label === item.unit)
            ?? { label: 'g', weightInGrams: 1 };

          const weightInGrams = newQty * selectedServing.weightInGrams;
          item.weight_in_grams = weightInGrams;
          const ratio = weightInGrams / 100;
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
    setShowMealObs(prev => { const next = { ...prev }; delete next[id]; return next; });
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

  const mealTimeColors = [
    'bg-primary/15 text-primary',
    'bg-chart-3/15 text-chart-3',
    'bg-chart-4/15 text-chart-4',
    'bg-chart-2/15 text-chart-2',
  ];

  const mealBorderColors = [
    'var(--color-primary)',
    'var(--color-chart-3)',
    'var(--color-chart-4)',
    'var(--color-chart-2)',
  ];

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
            <span className="text-xs font-medium text-muted-foreground">Progresso</span>
          </div>

          <div className="grid gap-2 xl:gap-3">
            <SummaryCard
              label="Energia Total"
              value={mealTotals.kcal}
              total={selectedCalculation?.result.getAjustado}
              unit="kcal"
              color="text-macro-kcal"
              progressColor="bg-macro-kcal"
              icon={Activity}
              variant="sidebar"
            />
            <SummaryCard
              label="Proteínas"
              value={mealTotals.protein}
              total={selectedCalculation?.result.macronutrientes.ptnG}
              unit="g"
              color="text-macro-protein"
              progressColor="bg-macro-protein"
              icon={Dna}
              variant="sidebar"
            />
            <SummaryCard
              label="Carboidratos"
              value={mealTotals.carbs}
              total={selectedCalculation?.result.macronutrientes.choG}
              unit="g"
              color="text-macro-carbs"
              progressColor="bg-macro-carbs"
              icon={Zap}
              variant="sidebar"
            />
            <SummaryCard
              label="Gorduras"
              value={mealTotals.fat}
              total={selectedCalculation?.result.macronutrientes.lipG}
              unit="g"
              color="text-macro-fat"
              progressColor="bg-macro-fat"
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
          className="sticky top-0 z-50 bg-card border-b border-border px-3 py-2 md:px-4 xl:px-6 xl:py-3 print:hidden"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 md:gap-3 xl:gap-8">
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
                <ChevronRight className="w-3 h-3" />
                <span className="text-primary font-semibold">Edição</span>
              </div>
            </div>

            {/* Tablet: compact Select (md–xl) */}
            <div className="hidden md:flex xl:hidden items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium shrink-0">Base:</span>
              <Select value={currentFoodDataSource} onValueChange={(v) => setCurrentFoodDataSource(v as any)}>
                <SelectTrigger className="h-7 w-24 bg-card border border-border rounded-lg text-xs font-medium text-muted-foreground px-2">
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
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
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
                  {isPrinting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </Button>
              )}
              <Button
                onClick={handleSaveClick}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-8 px-3 xl:px-6 font-medium text-xs gap-2 transition-all active:scale-95 group"
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
                    className="h-8 px-4 bg-accent-foreground text-accent text-xs font-medium rounded-lg hover:bg-accent-foreground/90 transition-all active:scale-95"
                  >
                    Continuar rascunho
                  </button>
                  <button
                    onClick={handleDiscardDraft}
                    className="h-8 px-3 text-xs font-medium rounded-lg border border-accent-foreground/30 text-accent-foreground/70 hover:bg-accent-foreground/10 hover:text-accent-foreground transition-all active:scale-95 flex items-center gap-1.5"
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
              <div className="w-2 h-2 rounded-full bg-macro-kcal" />
              <span className="text-xs font-bold text-macro-kcal">{mealTotals.kcal.toFixed(0)}</span>
              <span className="text-[11px] text-muted-foreground">kcal</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-macro-protein" />
              <span className="text-xs font-bold text-macro-protein">{mealTotals.protein.toFixed(0)}g</span>
              <span className="text-[11px] text-muted-foreground">prot</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-macro-carbs" />
              <span className="text-xs font-bold text-macro-carbs">{mealTotals.carbs.toFixed(0)}g</span>
              <span className="text-[11px] text-muted-foreground">carb</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-macro-fat" />
              <span className="text-xs font-bold text-macro-fat">{mealTotals.fat.toFixed(0)}g</span>
              <span className="text-[11px] text-muted-foreground">gord</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="w-full p-4 xl:p-6 space-y-4">

            {/* Top Config Section */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl p-4 border border-border relative overflow-hidden"
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
                      className="text-sm font-medium border border-border bg-card focus:bg-card focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 h-9 rounded-lg transition-all px-3"
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
                        className="pl-9 border border-border bg-card focus:bg-card focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 h-9 rounded-lg transition-all"
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
                    className="min-h-[72px] rounded-lg border border-border bg-card focus:bg-card focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none transition-all text-sm leading-relaxed p-3"
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
                  <h2 className="font-heading font-medium text-base text-foreground">
                    Cronograma de Refeições
                  </h2>
                  <p className="text-xs text-muted-foreground font-medium mt-1">Estruture os horários e alimentos do paciente</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 bg-card rounded-xl border border-border flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {mealItems.length} alimentos adicionados
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
                      style={{ borderLeftColor: mealBorderColors[mealIdx % mealBorderColors.length], borderLeftWidth: '3px' }}
                      className="group/meal relative bg-card rounded-xl border border-border p-3 xl:p-5 transition-all duration-300"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          {/* Time badge — cor cicla por índice de refeição */}
                          <div className={cn(
                            "px-3 py-1.5 rounded-xl shrink-0 flex items-center justify-center",
                            mealTimeColors[mealIdx % mealTimeColors.length]
                          )}>
                            <input
                              type="time"
                              value={mealType.time || ''}
                              onChange={(e) => updateMealType(mealType.id, 'time', e.target.value)}
                              style={{ textAlign: 'center' }}
                              className="w-[64px] h-5 border-none outline-none bg-transparent text-xs font-bold p-0 [&::-webkit-calendar-picker-indicator]:hidden text-current"
                            />
                          </div>
                          <div>
                            <Input
                              value={mealType.label}
                              onChange={(e) => updateMealType(mealType.id, 'label', e.target.value)}
                              className="font-heading font-medium text-sm border-none bg-transparent hover:bg-muted/50 focus:bg-card h-7 px-2 w-full sm:w-[160px] xl:w-[200px] text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 rounded-lg placeholder:text-muted-foreground transition-all"
                              placeholder="Título da Refeição"
                            />
                            <p className="text-[11px] text-muted-foreground px-2 mt-0.5">{items.length} {items.length === 1 ? 'alimento' : 'alimentos'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="font-semibold text-macro-kcal">{totals.kcal.toFixed(0)} <span className="font-medium text-muted-foreground">kcal</span></span>
                            <span className="flex items-baseline gap-0.5 font-semibold">
                              <span className="text-macro-protein">{totals.protein.toFixed(0)}g</span><span className="text-[10px] font-bold text-macro-protein">P</span>
                            </span>
                            <span className="flex items-baseline gap-0.5 font-semibold">
                              <span className="text-macro-carbs">{totals.carbs.toFixed(0)}g</span><span className="text-[10px] font-bold text-macro-carbs">C</span>
                            </span>
                            <span className="flex items-baseline gap-0.5 font-semibold">
                              <span className="text-macro-fat">{totals.fat.toFixed(0)}g</span><span className="text-[10px] font-bold text-macro-fat">G</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => moveMealType(mealType.id, 'up')}
                              disabled={mealIdx === 0}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg h-7 w-7 transition-all disabled:opacity-30"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => moveMealType(mealType.id, 'down')}
                              disabled={mealIdx === mealTypes.length - 1}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg h-7 w-7 transition-all disabled:opacity-30"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMealType(mealType.id)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg h-7 w-7 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-border/60 pt-2">
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
                      </div>

                      {/* Observações específicas com toggle */}
                      <div className="mt-3 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer group/obs px-1">
                          <Checkbox
                            checked={!!showMealObs[mealType.id]}
                            onCheckedChange={(checked) => {
                              setShowMealObs(prev => ({ ...prev, [mealType.id]: !!checked }));
                              if (!checked) setMealObservations(prev => ({ ...prev, [mealType.id]: '' }));
                            }}
                          />
                          <span className="text-xs text-muted-foreground group-hover/obs:text-foreground transition-colors select-none">
                            Adicionar observações específicas
                          </span>
                        </label>
                        {showMealObs[mealType.id] && (
                          <Textarea
                            placeholder="Observações importantes para esta refeição..."
                            className="min-h-[64px] text-sm bg-card border border-border rounded-lg resize-none focus:bg-card focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-all p-3"
                            value={mealObservations[mealType.id] || ''}
                            onChange={(e) => setMealObservations(prev => ({ ...prev, [mealType.id]: e.target.value }))}
                          />
                        )}
                      </div>

                      <button
                        onClick={() => addMealItem(mealType.id)}
                        className="w-full mt-3 py-2 flex items-center justify-center gap-1.5 text-muted-foreground hover:text-primary transition-colors font-medium text-xs rounded-lg hover:bg-muted/30"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Alimento
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {mealTypes.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-8 px-10 text-center bg-card rounded-xl border border-dashed border-border"
                >
                  <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 relative">
                    <Apple className="w-7 h-7 text-primary" />
                    <div className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-card rounded-full ring-1 ring-border flex items-center justify-center">
                      <Plus className="w-3.5 h-3.5 text-primary" />
                    </div>
                  </div>
                  <h3 className="font-heading font-medium text-lg text-foreground mb-2">O plano está vazio</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-4 font-medium text-sm leading-relaxed">
                    Comece adicionando a primeira refeição para estruturar a estratégia do seu paciente.
                  </p>
                  <Button
                    onClick={addCustomMeal}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-8 px-6 font-medium transition-all active:scale-95 text-sm"
                  >
                    <Plus className="w-5 h-5 mr-2" /> Nova Refeição
                  </Button>
                </motion.div>
              )}

              {mealTypes.length > 0 && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={addCustomMeal}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors font-medium text-xs py-2 px-4 rounded-lg hover:bg-muted/30"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Refeição
                  </button>
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
