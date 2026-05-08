import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Trash2,
  MessageSquare,
  Activity,
  Dna,
  Zap,
  Droplets,
  Apple,
  Coffee,
  Utensils,
  Moon,
  Sun,
  CloudMoon,
  Save,
  ArrowLeft,
  Clock,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Edit2,
  Calculator,
  Search,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';
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

interface MealPlanEditorProps {
  initialName?: string;
  initialItems?: any[];
  initialGeneralInstructions?: string;
  initialWaterIntake?: string;
  initialMealObservations?: Record<string, string>;
  initialCustomMeals?: any[];
  selectedCalculation?: NutritionCalculation | null;
  foodDataSource: 'Todas' | 'TACO' | 'TBCA' | 'Custom';
  onSave: (data: {
    name: string;
    items: any[];
    generalInstructions: string;
    waterIntake: string;
    mealObservations: Record<string, string>;
    customMeals: any[];
  }) => void;
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
        "bg-card rounded-[1.5rem] border border-border relative overflow-hidden transition-all duration-300",
        isSidebar ? "p-5 shadow-sm hover:shadow-md hover:border-emerald-100" : "p-4 shadow-sm"
      )}
    >
      <div className={cn("flex items-start justify-between", isSidebar ? "mb-4" : "mb-2")}>
        <div className={cn("rounded-xl flex items-center justify-center shadow-inner", 
          isSidebar ? "w-10 h-10" : "w-9 h-9",
          iconBg
        )}>
          <Icon className={cn(isSidebar ? "w-5 h-5" : "w-4.5 h-4.5", color)} />
        </div>
        <div className="text-right">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">{label}</p>
          <div className="flex items-baseline justify-end gap-1">
            <span className={cn("font-black leading-none tracking-tighter", isSidebar ? "text-2xl" : "text-lg", color)}>
              {Number(value).toFixed(0)}
            </span>
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{unit}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
          <span className="text-muted-foreground">Atingido</span>
          {total ? (
            <span className={cn("font-black", percentage >= 100 ? "text-emerald-500" : "text-muted-foreground")}>
              {percentage.toFixed(0)}% <span className="text-muted-foreground font-medium">de {total.toFixed(0)}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Sem meta</span>
          )}
        </div>
        <div className="w-full bg-muted/30 h-2 rounded-full overflow-hidden shadow-inner ring-1 ring-border/50">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }}
            className={cn("h-full rounded-full shadow-sm", progressColor, percentage > 100 && "bg-rose-500")}
          />
        </div>
      </div>
    </motion.div>
  );
};

const MealItemRow = React.memo(({
  item,
  index,
  onUpdate,
  onRemove,
  onAddNewFood,
  foodDataSource
}: {
  item: any,
  index: number,
  onUpdate: (index: number, field: string, value: any) => void,
  onRemove: (index: number) => void,
  onAddNewFood: (name: string, index: number) => void,
  foodDataSource: string
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group relative bg-card rounded-2xl p-4 border border-border hover:border-emerald-200 hover:shadow-md transition-all duration-200"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Food Search */}
        <div className="md:col-span-5">
          <FoodAutocomplete
            value={item.food}
            onChange={(v) => onUpdate(index, 'food', v)}
            onSelect={(food) => onUpdate(index, 'food_object', food)}
            onAddNew={(name) => onAddNewFood(name, index)}
            placeholder="Qual o alimento?"
            dataSource={foodDataSource as any}
            className="bg-card hover:bg-card border-border focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 rounded-xl transition-all h-10 shadow-sm"
          />
        </div>

        {/* Quantity & Unit */}
        <div className="md:col-span-3 flex items-center gap-2">
          <div className="flex-1 bg-card border border-border focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 rounded-xl h-10 px-3 transition-all flex items-center shadow-sm">
            <Input
              value={item.quantity}
              onChange={(e) => onUpdate(index, 'quantity', e.target.value)}
              className="border-none p-0 h-auto focus-visible:ring-0 bg-transparent text-foreground font-semibold text-center w-full placeholder:text-muted-foreground"
              placeholder="Qtd."
            />
          </div>
          <Select
            value={item.unit}
            onValueChange={(v) => onUpdate(index, 'unit', v)}
          >
            <SelectTrigger className="flex-1 bg-card border border-border focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 h-10 rounded-xl px-3 text-muted-foreground font-bold text-xs uppercase tracking-widest transition-all shadow-sm">
              <SelectValue>{item.unit}</SelectValue>
            </SelectTrigger>
            <SelectContent>
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
            </SelectContent>
          </Select>
        </div>

        {/* Macros Summary */}
        <div className="md:col-span-3 flex items-center justify-around gap-2 px-2">
          <div className="text-center">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-tighter mb-0.5">Kcal</p>
            <Input
              type="number"
              value={item.kcal}
              onChange={(e) => onUpdate(index, 'kcal', Number(e.target.value))}
              className="border-none p-0 h-7 focus-visible:ring-0 bg-muted/50 hover:bg-muted/50 focus:bg-card rounded-lg text-center text-foreground font-bold w-14 mx-auto transition-all shadow-inner focus:shadow-none"
            />
          </div>
          <div className="text-center border-l border-border pl-2">
            <p className="text-[11px] font-bold text-blue-400 uppercase tracking-tighter mb-0.5">P</p>
            <Input
              type="number"
              value={item.protein}
              onChange={(e) => onUpdate(index, 'protein', Number(e.target.value))}
              className="border-none p-0 h-7 focus-visible:ring-0 bg-muted/50 hover:bg-muted/50 focus:bg-card rounded-lg text-center text-muted-foreground font-semibold w-10 mx-auto transition-all shadow-inner focus:shadow-none"
            />
          </div>
          <div className="text-center border-l border-border pl-2">
            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-tighter mb-0.5">C</p>
            <Input
              type="number"
              value={item.carbs}
              onChange={(e) => onUpdate(index, 'carbs', Number(e.target.value))}
              className="border-none p-0 h-7 focus-visible:ring-0 bg-muted/50 hover:bg-muted/50 focus:bg-card rounded-lg text-center text-muted-foreground font-semibold w-10 mx-auto transition-all shadow-inner focus:shadow-none"
            />
          </div>
          <div className="text-center border-l border-border pl-2">
            <p className="text-[11px] font-bold text-purple-400 uppercase tracking-tighter mb-0.5">G</p>
            <Input
              type="number"
              value={item.fat}
              onChange={(e) => onUpdate(index, 'fat', Number(e.target.value))}
              className="border-none p-0 h-7 focus-visible:ring-0 bg-muted/50 hover:bg-muted/50 focus:bg-card rounded-lg text-center text-muted-foreground font-semibold w-10 mx-auto transition-all shadow-inner focus:shadow-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="md:col-span-1 flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            className="h-9 w-9 rounded-xl hover:bg-red-50 hover:text-red-500 text-muted-foreground/50 hover:text-red-500 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
});

MealItemRow.displayName = 'MealItemRow';

export const MealPlanEditor = ({
  initialName = '',
  initialItems = [],
  initialGeneralInstructions = '',
  initialWaterIntake = '',
  initialMealObservations = {},
  initialCustomMeals = [],
  selectedCalculation,
  foodDataSource,
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
      color: 'bg-emerald-50 border-emerald-100 text-emerald-700'
    }]);
  };

  const removeMealType = (id: string) => {
    setMealTypes(prev => prev.filter(m => m.id !== id));
    setMealItems(prev => prev.filter(item => item.meal !== id));
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
        initial={{ x: -320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-[320px] bg-card border-r border-border flex flex-col h-full hidden lg:flex shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]"
      >
        <div className="p-8 border-b border-border bg-muted/30">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground tracking-tight uppercase">Dashboard</h2>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Nutricional</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-muted/20">
          {selectedCalculation && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Calculator className="w-16 h-16" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    <Calculator className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-100">Meta Sugerida</span>
                </div>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-4xl font-black tracking-tighter text-white">
                    {selectedCalculation.result.getAjustado.toFixed(0)}
                  </span>
                  <span className="text-xs font-bold text-emerald-200 uppercase tracking-widest">kcal</span>
                </div>
                <p className="text-xs font-medium text-emerald-100 leading-relaxed">
                  Baseado no cálculo de TMB e nível de atividade selecionado.
                </p>
              </div>
            </motion.div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Macronutrientes</span>
              <div className="w-12 h-px bg-muted" />
            </div>
            
            <div className="grid gap-4">
              <SummaryCard
                label="Energia Total"
                value={mealTotals.kcal}
                total={selectedCalculation?.result.getAjustado}
                unit="kcal"
                color="text-orange-600"
                iconBg="bg-orange-50"
                progressColor="bg-orange-500"
                icon={Activity}
                variant="sidebar"
              />
              <SummaryCard
                label="Proteínas"
                value={mealTotals.protein}
                total={selectedCalculation?.result.macronutrientes.ptnG}
                unit="g"
                color="text-blue-600"
                iconBg="bg-blue-50"
                progressColor="bg-blue-500"
                icon={Dna}
                variant="sidebar"
              />
              <SummaryCard
                label="Carboidratos"
                value={mealTotals.carbs}
                total={selectedCalculation?.result.macronutrientes.choG}
                unit="g"
                color="text-emerald-600"
                iconBg="bg-emerald-50"
                progressColor="bg-emerald-500"
                icon={Zap}
                variant="sidebar"
              />
              <SummaryCard
                label="Gorduras"
                value={mealTotals.fat}
                total={selectedCalculation?.result.macronutrientes.lipG}
                unit="g"
                color="text-purple-600"
                iconBg="bg-purple-50"
                progressColor="bg-purple-500"
                icon={Droplets}
                variant="sidebar"
              />
            </div>
          </div>

        </div>

        <div className="p-6 border-t border-border bg-muted/30">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Sincronizado em tempo real</p>
          </div>
        </div>
      </motion.aside>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Command Center Header */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="sticky top-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border px-6 py-3 print:hidden"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
            <div className="flex items-center gap-5">
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                className="rounded-xl border-border hover:bg-muted/30 transition-all h-9 w-9 shrink-0 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </Button>
              
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                  <span>Plano Alimentar</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-emerald-600">Edição</span>
                </div>
                <h1 className="text-base font-bold text-foreground tracking-tight leading-none truncate max-w-[200px] lg:max-w-md">
                  {mealPlanName || 'Novo Plano Alimentar'}
                </h1>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 p-1 bg-muted/80 rounded-xl border border-border/60 shadow-inner">
              <div className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-tight border-r border-border mr-1">
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
                      ? "bg-card text-emerald-600 shadow-sm ring-1 ring-border/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                  )}
                >
                  <source.icon className={cn("w-3.5 h-3.5", currentFoodDataSource === source.id ? "text-emerald-500" : "text-muted-foreground")} />
                  {source.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => onSave({
                  name: mealPlanName,
                  items: mealItems,
                  generalInstructions,
                  waterIntake,
                  mealObservations,
                  customMeals: mealTypes
                })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-6 font-bold text-xs gap-2 shadow-lg shadow-emerald-600/10 transition-all active:scale-95 group"
              >
                <Save className="w-3.5 h-3.5 transition-transform group-hover:scale-110" /> 
                <span>Salvar Alterações</span>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Mobile macro summary — shown only when sidebar is hidden */}
        <div className="lg:hidden border-b border-border bg-card px-4 py-2 print:hidden">
          <div className="flex items-center justify-around gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-xs font-bold text-foreground">{mealTotals.kcal.toFixed(0)}</span>
              <span className="text-[11px] text-muted-foreground">kcal</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-bold text-foreground">{mealTotals.protein.toFixed(0)}g</span>
              <span className="text-[11px] text-muted-foreground">prot</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-foreground">{mealTotals.carbs.toFixed(0)}g</span>
              <span className="text-[11px] text-muted-foreground">carb</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-xs font-bold text-foreground">{mealTotals.fat.toFixed(0)}g</span>
              <span className="text-[11px] text-muted-foreground">gord</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-5xl mx-auto w-full p-6 lg:p-10 space-y-12">
            
            {/* Top Config Section */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-[2.5rem] p-8 lg:p-10 border border-border shadow-[0_20px_50px_rgba(0,0,0,0.03)] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none">
                <Edit2 className="w-48 h-48 text-foreground" />
              </div>

              <div className="space-y-10 relative">
                <div className="grid grid-cols-1 gap-10">
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase text-muted-foreground tracking-[0.2em] ml-1">Identificação do Plano</Label>
                    <Input
                      value={mealPlanName}
                      onChange={(e) => setMealPlanName(e.target.value)}
                      className="text-2xl font-black border-2 border-border bg-card focus:bg-card focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 h-16 rounded-2xl transition-all shadow-sm px-6"
                      placeholder="Ex: Estratégia de Cutting..."
                    />
                  </div>

                </div>
                
                <div className="pt-10 border-t border-border">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-foreground tracking-tight uppercase">Orientações Gerais</h4>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Instruções comportamentais</p>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Quais as orientações principais para este plano?"
                    className="min-h-[140px] rounded-[1.5rem] border-2 border-border bg-card focus:bg-card focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-sm resize-none transition-all text-base font-medium leading-relaxed p-6"
                    value={generalInstructions}
                    onChange={(e) => setGeneralInstructions(e.target.value)}
                  />
                </div>
              </div>
            </motion.div>

            {/* Meals Section */}
            <div className="space-y-12 pb-24">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2">
                <div>
                  <h2 className="text-xl font-black text-foreground tracking-tight flex items-center gap-3">
                    Cronograma de Refeições
                  </h2>
                  <p className="text-xs text-muted-foreground font-medium mt-1 ml-11">Estruture os horários e alimentos do paciente</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 bg-card rounded-2xl border border-border shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
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
                      className="group/meal relative bg-card/50 hover:bg-card rounded-3xl border border-border hover:border-emerald-100 p-6 transition-all duration-500 shadow-sm hover:shadow-xl"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                        <div className="flex items-center gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Input
                                value={mealType.label}
                                onChange={(e) => updateMealType(mealType.id, 'label', e.target.value)}
                                className="font-black text-xl border-none bg-muted/50 hover:bg-muted/50 focus:bg-card h-11 px-4 w-full lg:w-[320px] text-foreground focus:ring-2 focus:ring-emerald-500/20 rounded-xl placeholder:text-muted-foreground transition-all shadow-inner focus:shadow-none"
                                placeholder="Título da Refeição"
                              />
                              <div className="flex items-center gap-2 px-4 py-1.5 bg-card rounded-xl border-2 border-border focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 shadow-sm shrink-0 h-11 transition-all">
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

                        <div className="flex items-center gap-2 bg-card p-2 rounded-2xl shadow-sm border border-border">
                          <div className="flex items-center gap-3 px-3 py-1.5 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                            <div className="text-center">
                              <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-tighter">Energia</p>
                              <p className="text-xs font-bold text-foreground">{totals.kcal.toFixed(0)}<span className="text-[11px] ml-0.5">kcal</span></p>
                            </div>
                            <div className="w-px h-5 bg-emerald-100" />
                            <div className="text-center">
                              <p className="text-[11px] font-bold text-blue-500 uppercase tracking-tighter">Prot</p>
                              <p className="text-xs font-bold text-foreground">{totals.protein.toFixed(1)}g</p>
                            </div>
                            <div className="w-px h-5 bg-emerald-100" />
                            <div className="text-center">
                              <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-tighter">Carb</p>
                              <p className="text-xs font-bold text-foreground">{totals.carbs.toFixed(1)}g</p>
                            </div>
                            <div className="w-px h-5 bg-emerald-100" />
                            <div className="text-center">
                              <p className="text-[11px] font-bold text-purple-500 uppercase tracking-tighter">Gord</p>
                              <p className="text-xs font-bold text-foreground">{totals.fat.toFixed(1)}g</p>
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMealType(mealType.id)}
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-xl h-9 w-9 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3 mb-8">
                        <AnimatePresence mode="popLayout">
                          {items.map((item) => {
                            const itemIndex = mealItems.findIndex(mi => mi === item);
                            return (
                              <MealItemRow
                                key={`${mealType.id}-${itemIndex}`}
                                item={item}
                                index={itemIndex}
                                onUpdate={updateMealItem}
                                onRemove={removeMealItem}
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
                          className="w-full py-3 border-2 border-dashed border-border hover:border-emerald-200 hover:bg-emerald-50/30 rounded-xl flex items-center justify-center gap-2 text-muted-foreground hover:text-emerald-600 transition-all font-bold text-xs"
                        >
                          <Plus className="w-4 h-4" /> Adicionar Alimento
                        </motion.button>
                      </div>

                      <div className="pt-6 border-t border-border flex flex-col lg:flex-row gap-6">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 px-1">
                            <MessageSquare className="w-3 h-3 text-muted-foreground" />
                            <Label className="text-[11px] uppercase font-bold text-muted-foreground tracking-widest">Observações específicas</Label>
                          </div>
                          <Textarea
                            placeholder="Observações importantes para esta refeição..."
                            className="min-h-[90px] text-sm font-medium bg-card border-2 border-border rounded-2xl resize-none focus:bg-card focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-sm transition-all p-5"
                            value={mealObservations[mealType.id] || ''}
                            onChange={(e) => setMealObservations(prev => ({ ...prev, [mealType.id]: e.target.value }))}
                          />
                        </div>
                        <div className="lg:w-48 flex items-end">
                          <div className="w-full p-3 bg-muted/30 rounded-xl border border-border space-y-2">
                            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider text-center">Total da Refeição</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg px-2 py-1 text-center">
                                <p className="text-[10px] font-bold text-orange-600 uppercase">Kcal</p>
                                <p className="text-sm font-black text-foreground">{totals.kcal.toFixed(0)}</p>
                              </div>
                              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg px-2 py-1 text-center">
                                <p className="text-[10px] font-bold text-blue-600 uppercase">Prot</p>
                                <p className="text-sm font-black text-foreground">{totals.protein.toFixed(1)}g</p>
                              </div>
                              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg px-2 py-1 text-center">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase">Carb</p>
                                <p className="text-sm font-black text-foreground">{totals.carbs.toFixed(1)}g</p>
                              </div>
                              <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg px-2 py-1 text-center">
                                <p className="text-[10px] font-bold text-purple-600 uppercase">Gord</p>
                                <p className="text-sm font-black text-foreground">{totals.fat.toFixed(1)}g</p>
                              </div>
                            </div>
                          </div>
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
                  className="flex flex-col items-center justify-center py-24 px-10 text-center bg-card rounded-[2rem] border-2 border-dashed border-border shadow-[0_20px_50px_rgba(0,0,0,0.02)]"
                >
                  <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 relative">
                    <Apple className="w-10 h-10 text-emerald-500" />
                    <div className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-card rounded-full shadow-lg flex items-center justify-center">
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">O plano está vazio</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-8 font-medium text-sm leading-relaxed">
                    Comece adicionando a primeira refeição para estruturar a estratégia do seu paciente.
                  </p>
                  <Button 
                    onClick={addCustomMeal}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 px-10 font-bold shadow-xl shadow-emerald-200 transition-all active:scale-95 text-base"
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
                    className="bg-card hover:bg-emerald-50 text-emerald-600 border-2 border-dashed border-emerald-200 rounded-2xl h-14 px-10 font-bold text-sm gap-3 transition-all shadow-[0_10px_30px_rgb(0,0,0,0.02)] hover:shadow-lg hover:border-emerald-300 active:scale-95"
                  >
                    <Plus className="w-5 h-5" /> Adicionar Refeição
                  </Button>
                </div>
              )}
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
      </div>
    </div>
  );
};
