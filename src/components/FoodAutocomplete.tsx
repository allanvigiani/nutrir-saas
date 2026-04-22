import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Input } from './ui/input';
import { Search, Check, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { TacoFood, tacoData } from '../data/taco';
import { TbcaFood, tbcaData } from '../data/tbca';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CustomFood } from '../types';

interface FoodAutocompleteProps {
  value: string;
  onSelect: (food: TacoFood | TbcaFood | CustomFood) => void;
  onChange: (value: string) => void;
  onAddNew?: (name: string) => void;
  placeholder?: string;
  className?: string;
  dataSource?: 'TACO' | 'TBCA' | 'Todas';
}

export const FoodAutocomplete: React.FC<FoodAutocompleteProps> = ({
  value,
  onSelect,
  onChange,
  onAddNew,
  placeholder = "Buscar alimento...",
  className,
  dataSource = 'Todas'
}) => {
  const formatKcal = (value: number) => Math.round(value);
  const formatMacro = (value: number) => Math.round(value);
  const formatBaseQuantity = (value: number) => Math.round(value);

  const [isOpen, setIsOpen] = useState(false);
  const [filteredFoods, setFilteredFoods] = useState<(TacoFood | TbcaFood | CustomFood)[]>([]);
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const selectingFromListRef = useRef(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'custom_foods'),
      where('nutritionist_id', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const foods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomFood));
      setCustomFoods(foods);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (value.length > 1) {
      let tacoFiltered: any[] = [];
      let tbcaFiltered: any[] = [];

      if (dataSource === 'TACO' || dataSource === 'Todas') {
        tacoFiltered = tacoData.filter(food =>
          food.name.toLowerCase().includes(value.toLowerCase())
        );
      }

      if (dataSource === 'TBCA' || dataSource === 'Todas') {
        tbcaFiltered = tbcaData.filter(food =>
          food.name.toLowerCase().includes(value.toLowerCase())
        );
      }
      
      const customFiltered = customFoods.filter(food =>
        food.name.toLowerCase().includes(value.toLowerCase())
      );

      const combined = [...customFiltered, ...tacoFiltered, ...tbcaFiltered].slice(0, 15);
      setFilteredFoods(combined);
      if (selectingFromListRef.current) {
        selectingFromListRef.current = false;
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }
    } else {
      setFilteredFoods([]);
      setIsOpen(false);
      selectingFromListRef.current = false;
    }
  }, [value, customFoods, dataSource]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsideDropdown = dropdownRef.current?.contains(target);
      
      if (!isInsideContainer && !isInsideDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFocus = () => {
    if (containerRef.current) {
      setDropdownRect(containerRef.current.getBoundingClientRect());
    }
    if (value.length > 1) {
      setIsOpen(true);
    }
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div className="relative flex items-center w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="pl-9 pr-2 border-none h-9 focus-visible:ring-0 bg-transparent font-semibold text-slate-700 placeholder:text-slate-300 w-full"
        />
      </div>

      {isOpen && dropdownRect && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed bg-white rounded-xl border border-slate-200 shadow-2xl z-[9999] max-h-[350px] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
          style={{
            top: dropdownRect.bottom + 8,
            left: dropdownRect.left,
            width: Math.max(320, dropdownRect.width),
          }}
        >
          {filteredFoods.length > 0 ? (
            filteredFoods.map((food) => (
              <button
                key={food.id}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-col gap-1 transition-colors border-b border-slate-50 last:border-0"
                onClick={() => {
                  selectingFromListRef.current = true;
                  onSelect(food);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{food.name}</span>
                    {('nutritionist_id' in food) && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">Próprio</span>
                    )}
                  </div>
                  {value === food.name && <Check className="w-4 h-4 text-emerald-600" />}
                </div>
                <div className="flex gap-3 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  <span>{formatKcal(food.kcal)} kcal</span>
                  <span>P: {formatMacro(food.protein)}g</span>
                  <span>C: {formatMacro(food.carbs)}g</span>
                  <span>G: {formatMacro(food.fat)}g</span>
                  <span>Base: {formatBaseQuantity(food.baseQuantity)}{food.baseUnit}</span>
                  {food.serving && (
                    <span className="text-emerald-600 font-bold">1 {food.serving.name} = {Math.round(food.serving.weight)}g</span>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center">
              <p className="text-sm text-slate-500 mb-3">Nenhum alimento encontrado.</p>
              {onAddNew && (
                <button
                  onClick={() => {
                    onAddNew(value);
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-sm hover:bg-emerald-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar "{value}"
                </button>
              )}
            </div>
          )}
          
          {filteredFoods.length > 0 && onAddNew && (
            <button
              onClick={() => {
                onAddNew(value);
                setIsOpen(false);
              }}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-50 text-slate-600 border-t border-slate-100 font-bold text-xs hover:bg-slate-100 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Não encontrou? Cadastrar novo
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
