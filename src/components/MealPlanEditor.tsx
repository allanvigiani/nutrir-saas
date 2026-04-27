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
      className="group relative bg-white rounded-2xl p-4 border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all duration-200"
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
            className="bg-slate-50/50 group-hover:bg-white rounded-xl transition-all h-10"
          />
        </div>

        {/* Quantity & Unit */}
        <div className="md:col-span-3 flex items-center gap-2">
          <div className="flex-1 bg-slate-50/50 group-hover:bg-white rounded-xl h-10 px-3 ring-1 ring-slate-100/50 transition-all flex items-center">
            <Input
              value={item.quantity}
              onChange={(e) => onUpdate(index, 'quantity', e.target.value)}
              className="border-none p-0 h-auto focus-visible:ring-0 bg-transparent text-slate-900 font-semibold text-center w-full placeholder:text-slate-300"
              placeholder="Qtd."
            />
          </div>
          <Select
            value={item.unit}
            onValueChange={(v) => onUpdate(index, 'unit', v)}
          >
            <SelectTrigger className="flex-1 border-none h-10 focus:ring-0 bg-slate-50/50 group-hover:bg-white rounded-xl px-3 ring-1 ring-slate-100/50 text-slate-500 font-semibold text-[10px] uppercase tracking-widest transition-all">
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
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Kcal</p>
            <Input
              type="number"
              value={item.kcal}
              onChange={(e) => onUpdate(index, 'kcal', Number(e.target.value))}
              className="border-none p-0 h-7 focus-visible:ring-0 bg-transparent text-center text-slate-900 font-bold w-14 mx-auto"
            />
          </div>
          <div className="text-center border-l border-slate-100 pl-2">
            <p className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter mb-0.5">P</p>
            <Input
              type="number"
              value={item.protein}
              onChange={(e) => onUpdate(index, 'protein', Number(e.target.value))}
              className="border-none p-0 h-7 focus-visible:ring-0 bg-transparent text-center text-slate-600 font-semibold w-10 mx-auto"
            />
          </div>
          <div className="text-center border-l border-slate-100 pl-2">
            <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-tighter mb-0.5">C</p>
            <Input
              type="number"
              value={item.carbs}
              onChange={(e) => onUpdate(index, 'carbs', Number(e.target.value))}
              className="border-none p-0 h-7 focus-visible:ring-0 bg-transparent text-center text-slate-600 font-semibold w-10 mx-auto"
            />
          </div>
          <div className="text-center border-l border-slate-100 pl-2">
            <p className="text-[9px] font-bold text-purple-400 uppercase tracking-tighter mb-0.5">G</p>
            <Input
              type="number"
              value={item.fat}
              onChange={(e) => onUpdate(index, 'fat', Number(e.target.value))}
              className="border-none p-0 h-7 focus-visible:ring-0 bg-transparent text-center text-slate-600 font-semibold w-10 mx-auto"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="md:col-span-1 flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            className="h-9 w-9 rounded-xl hover:bg-red-50 hover:text-red-500 text-slate-300 transition-all opacity-0 group-hover:opacity-100"
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
        item.serving_name = food.serving?.name;
        item.serving_weight = food.serving?.weight;
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

  const getMealIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('café') || l.includes('desjejum')) return Coffee;
    if (l.includes('almoço')) return Utensils;
    if (l.includes('jantar') || l.includes('noite')) return Moon;
    if (l.includes('lanche')) return Apple;
    if (l.includes('ceia')) return CloudMoon;
    if (l.includes('treino')) return Activity;
    if (l.includes('suco') || l.includes('vitamina') || l.includes('shake')) return Droplets;
    return Sun;
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
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-hidden font-geist">
      {/* Premium Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 print:hidden"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-slate-100 transition-all h-10 w-10 shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Editor de Plano
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">Personalize a estratégia nutricional</p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1 p-1.5 bg-slate-100/50 rounded-2xl border border-slate-100 shadow-inner">
            {[
              { id: 'Todas', label: 'Todas', icon: Search },
              { id: 'TACO', label: 'TACO', icon: Activity },
              { id: 'TBCA', label: 'TBCA', icon: Zap },
              { id: 'Custom', label: 'Meus', icon: Plus },
            ].map((source) => (
              <button
                key={source.id}
                onClick={() => setCurrentFoodDataSource(source.id as any)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap uppercase tracking-tight",
                  currentFoodDataSource === source.id
                    ? "bg-white text-emerald-600 shadow-md ring-1 ring-slate-200/10"
                    : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                )}
              >
                <source.icon className={cn("w-3.5 h-3.5", currentFoodDataSource === source.id ? "text-emerald-500" : "text-slate-300")} />
                {source.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => onSave({
                name: mealPlanName,
                items: mealItems,
                generalInstructions,
                waterIntake,
                mealObservations,
                customMeals: mealTypes
              })}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 px-6 font-bold text-xs gap-2 shadow-sm transition-all active:scale-95"
            >
              <Save className="w-3.5 h-3.5" /> Salvar Plano
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-10">
          
          {/* Dashboard Section - Sticky */}
          <section className="sticky top-0 z-40 bg-[#F8FAFC]/95 backdrop-blur-md py-4 -mx-2 px-2 border-b border-slate-200/50 shadow-sm">
            <div className="flex items-center justify-between px-2 mb-4">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                Painel Nutricional
              </h2>
              {selectedCalculation && (
                <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 bg-slate-100/50 px-2 py-0.5 rounded-full border border-slate-100">
                  <Calculator className="w-3 h-3" />
                  Meta: {selectedCalculation.result.getAjustado.toFixed(0)} kcal
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <SummaryCard
                label="Calorias"
                value={mealTotals.kcal}
                total={selectedCalculation?.result.getAjustado}
                unit="kcal"
                color="text-orange-600"
                iconBg="bg-orange-50"
                progressColor="bg-orange-500"
                icon={Activity}
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
              />
            </div>
          </section>

          {/* Main Config */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <motion.div 
              whileHover={{ y: -2 }}
              className="lg:col-span-2 bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                <Edit2 className="w-32 h-32 text-slate-900" />
              </div>

              <div className="space-y-8 relative">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-1">Identificação do Plano</Label>
                  <Input
                    value={mealPlanName}
                    onChange={(e) => setMealPlanName(e.target.value)}
                    className="text-lg font-bold border-none bg-slate-50/50 focus:bg-white h-11 rounded-xl transition-all shadow-inner focus:shadow-none"
                    placeholder="Ex: Estratégia de Cutting..."
                  />
                </div>
                
                <div className="pt-8 border-t border-slate-50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-800">Orientações Gerais</h4>
                      <p className="text-[10px] text-slate-400">Instruções para o dia a dia</p>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Quais as orientações principais para este plano?"
                    className="min-h-[100px] rounded-xl border-none bg-slate-50/50 focus:bg-white shadow-inner focus:shadow-none resize-none transition-all text-sm font-medium leading-relaxed"
                    value={generalInstructions}
                    onChange={(e) => setGeneralInstructions(e.target.value)}
                  />
                </div>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -2 }}
              className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                <Droplets className="w-32 h-32 text-blue-900" />
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-800">Meta de Água</h4>
                  <p className="text-[10px] text-slate-400">Cálculo de hidratação</p>
                </div>
              </div>

              <div className="relative group/water my-auto">
                <Input
                  value={waterIntake}
                  onChange={(e) => setWaterIntake(e.target.value)}
                  placeholder="2.5"
                  className="text-3xl font-bold border-none bg-slate-50/50 h-16 px-6 rounded-xl w-full text-blue-600 transition-all placeholder:text-slate-200 text-center shadow-inner"
                />
                <div className="mt-3 text-center font-bold text-blue-400 uppercase tracking-widest text-[9px]">Litros por Dia</div>
              </div>

              <div className="mt-8">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100/50 relative">
                  <Sparkles className="absolute -top-1.5 -right-1.5 w-4 h-4 text-blue-300" />
                  <p className="text-[10px] text-blue-700 font-bold leading-relaxed italic text-center">
                    "A hidratação correta é a chave para a absorção eficiente de nutrientes."
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Meals Section */}
          <div className="space-y-8 pb-24">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Utensils className="w-3.5 h-3.5 text-emerald-500" />
                Cronograma de Refeições
              </h2>
            </div>

            <AnimatePresence mode="popLayout">
              {mealTypes.map((mealType, mealIdx) => {
                const items = mealItems.filter(i => i.meal === mealType.id);
                const totals = calculateMealTotals(mealType.id);
                const MealIcon = getMealIcon(mealType.label);

                return (
                  <motion.div
                    key={mealType.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group/meal relative bg-white/50 hover:bg-white rounded-3xl border border-slate-100 hover:border-emerald-100 p-6 transition-all duration-500"
                  >
                    {/* Meal Header */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100 flex items-center justify-center shrink-0">
                          <MealIcon className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Input
                              value={mealType.label}
                              onChange={(e) => updateMealType(mealType.id, 'label', e.target.value)}
                              className="font-bold text-lg border-none bg-transparent h-9 px-0 w-full lg:w-[250px] text-slate-900 focus:ring-0 placeholder:text-slate-200"
                              placeholder="Título da Refeição"
                            />
                            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-xl border border-slate-100 shadow-inner shrink-0 h-9">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <Input
                                type="time"
                                value={mealType.time || ''}
                                onChange={(e) => updateMealType(mealType.id, 'time', e.target.value)}
                                className="w-16 h-6 border-none bg-transparent text-xs font-bold p-0 focus:ring-0 text-slate-600"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-50">
                        <div className="flex items-center gap-3 px-3 py-1.5 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                          <div className="text-center">
                            <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-tighter">Energia</p>
                            <p className="text-xs font-bold text-slate-800">{totals.kcal.toFixed(0)}<span className="text-[9px] ml-0.5">kcal</span></p>
                          </div>
                          <div className="w-px h-5 bg-emerald-100" />
                          <div className="text-center">
                            <p className="text-[8px] font-bold text-blue-500 uppercase tracking-tighter">Prot</p>
                            <p className="text-xs font-bold text-slate-800">{totals.protein.toFixed(1)}g</p>
                          </div>
                          <div className="w-px h-5 bg-emerald-100" />
                          <div className="text-center">
                            <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-tighter">Carb</p>
                            <p className="text-xs font-bold text-slate-800">{totals.carbs.toFixed(1)}g</p>
                          </div>
                          <div className="w-px h-5 bg-emerald-100" />
                          <div className="text-center">
                            <p className="text-[8px] font-bold text-purple-500 uppercase tracking-tighter">Gord</p>
                            <p className="text-xs font-bold text-slate-800">{totals.fat.toFixed(1)}g</p>
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMealType(mealType.id)}
                          className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl h-9 w-9 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Meal Items List */}
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
                        className="w-full py-3 border-2 border-dashed border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:text-emerald-600 transition-all font-bold text-xs"
                      >
                        <Plus className="w-4 h-4" /> Adicionar Alimento
                      </motion.button>
                    </div>

                    {/* Meal Footer / Observations */}
                    <div className="pt-6 border-t border-slate-50 flex flex-col lg:flex-row gap-6">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 px-1">
                          <MessageSquare className="w-3 h-3 text-slate-400" />
                          <Label className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Observações específicas</Label>
                        </div>
                        <Textarea
                          placeholder="Observações importantes para esta refeição..."
                          className="min-h-[70px] text-xs font-medium bg-slate-50/50 border-none rounded-xl resize-none focus:bg-white shadow-inner focus:shadow-none transition-all"
                          value={mealObservations[mealType.id] || ''}
                          onChange={(e) => setMealObservations(prev => ({ ...prev, [mealType.id]: e.target.value }))}
                        />
                      </div>
                      <div className="lg:w-40 flex items-end">
                        <div className="w-full p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col items-center justify-center gap-1.5">
                           <Info className="w-3.5 h-3.5 text-slate-300" />
                           <p className="text-[8px] text-slate-400 font-bold uppercase text-center leading-tight">Total Nutricional da Refeição</p>
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
                className="flex flex-col items-center justify-center py-24 px-10 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.02)]"
              >
                <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 relative">
                  <Apple className="w-10 h-10 text-emerald-500" />
                  <div className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center">
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">O plano está vazio</h3>
                <p className="text-slate-400 max-w-sm mx-auto mb-8 font-medium text-sm leading-relaxed">
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
                  className="bg-white hover:bg-emerald-50 text-emerald-600 border-2 border-dashed border-emerald-200 rounded-2xl h-14 px-10 font-bold text-sm gap-3 transition-all shadow-[0_10px_30px_rgb(0,0,0,0.02)] hover:shadow-lg hover:border-emerald-300 active:scale-95"
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
  );
};

const SummaryCard = ({ label, value, total, unit, color, iconBg, progressColor, icon: Icon }: any) => {
  const percentage = total ? Math.min((value / total) * 100, 100) : 0;
  
  return (
    <motion.div 
      whileHover={{ y: -2, scale: 1.01 }}
      className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden"
    >
      <div className="flex items-start justify-between mb-2">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shadow-inner", iconBg)}>
          <Icon className={cn("w-4.5 h-4.5", color.replace('text-', 'text-'))} />
        </div>
        <div className="text-right">
          <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
          <div className="flex items-baseline justify-end gap-1">
            <span className={cn("text-lg font-bold leading-none", color)}>{Number(value).toFixed(0)}</span>
            <span className="text-[9px] font-bold text-slate-300 lowercase">{unit}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[7px] font-bold uppercase tracking-tighter">
          <span className="text-slate-400">Progresso</span>
          {total ? (
            <span className="text-slate-500">{percentage.toFixed(0)}% de {total.toFixed(0)}</span>
          ) : (
            <span className="text-slate-300">Sem meta</span>
          )}
        </div>
        <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden shadow-inner ring-1 ring-slate-100/50">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn("h-full rounded-full transition-all duration-500 shadow-sm", progressColor)}
          />
        </div>
      </div>
    </motion.div>
  );
};
