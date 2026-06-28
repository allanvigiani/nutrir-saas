import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Input } from './ui/input';
import { Search, Check, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { TacoFood, tacoData } from '../data/taco';
import { TbcaFood, tbcaData } from '../data/tbca';
import { CustomFood } from '../types';
import { useApi } from '../hooks/useApi';

interface FoodAutocompleteProps {
  value: string;
  onSelect: (food: TacoFood | TbcaFood | CustomFood) => void;
  onChange: (value: string) => void;
  onAddNew?: (name: string) => void;
  placeholder?: string;
  className?: string;
  dataSource?: 'TACO' | 'TBCA' | 'Todas' | 'Custom';
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
  const [isFocused, setIsFocused] = useState(false);
  const [filteredFoods, setFilteredFoods] = useState<(TacoFood | TbcaFood | CustomFood)[]>([]);
  const { data: customFoodsData } = useApi<CustomFood[]>('/api/custom-foods');
  const customFoods = customFoodsData ?? [];
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const selectingFromListRef = useRef(false);

  useEffect(() => {
    if (value.length > 1) {
      const normalize = (s: string) =>
        s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const terms = normalize(value).split(/\s+/).filter(Boolean);
      const matchesAllTerms = (name: string) => {
        const normalized = normalize(name);
        return terms.every(term => normalized.includes(term));
      };

      let tacoFiltered: any[] = [];
      let tbcaFiltered: any[] = [];

      if (dataSource === 'TACO' || dataSource === 'Todas') {
        tacoFiltered = tacoData.filter(food => matchesAllTerms(food.name));
      }

      if (dataSource === 'TBCA' || dataSource === 'Todas') {
        tbcaFiltered = tbcaData.filter(food => matchesAllTerms(food.name));
      }

      let customFiltered: any[] = [];
      if (dataSource === 'Custom' || dataSource === 'Todas') {
        customFiltered = customFoods.filter(food => matchesAllTerms(food.name));
      }

      const combined = [...customFiltered, ...tacoFiltered, ...tbcaFiltered].slice(0, 15);
      setFilteredFoods(combined);
      if (selectingFromListRef.current) {
        selectingFromListRef.current = false;
        setIsOpen(false);
      } else if (isFocused) {
        setIsOpen(true);
      }
    } else {
      setFilteredFoods([]);
      setIsOpen(false);
      selectingFromListRef.current = false;
    }
  }, [value, customFoods, dataSource, isFocused]);

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

  const updateRect = () => {
    if (containerRef.current) {
      setDropdownRect(containerRef.current.getBoundingClientRect());
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    updateRect();
    if (value.length > 1) setIsOpen(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  useEffect(() => {
    if (isOpen) updateRect();
  }, [isOpen]);

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div className="relative flex items-center w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="pl-9 pr-2 border-none h-9 focus-visible:ring-0 bg-transparent font-semibold text-muted-foreground placeholder:text-muted-foreground w-full"
        />
      </div>

      {isOpen && dropdownRect && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-card rounded-xl border border-border shadow-2xl z-50 max-h-[350px] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
          style={(() => {
            const MARGIN = 8;
            const MAX_H = 350;
            const spaceBelow = window.innerHeight - dropdownRect.bottom - MARGIN;
            const openUpward = spaceBelow < MAX_H && dropdownRect.top > spaceBelow;
            return {
              left: dropdownRect.left,
              width: Math.max(320, dropdownRect.width),
              ...(openUpward
                ? { bottom: window.innerHeight - dropdownRect.top + MARGIN }
                : { top: dropdownRect.bottom + MARGIN }),
            };
          })()}
        >
          {filteredFoods.length > 0 ? (
            filteredFoods.map((food) => (
              <button
                key={food.id}
                className="w-full text-left px-4 py-3 hover:bg-muted/30 flex flex-col gap-1 transition-colors border-b border-border last:border-0"
                onClick={() => {
                  selectingFromListRef.current = true;
                  onSelect(food);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">{food.name}</span>
                    {('nutritionist_id' in food) && (
                      <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold">Próprio</span>
                    )}
                  </div>
                  {value === food.name && <Check className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground font-bold">
                  <span>{formatKcal(food.kcal)} kcal</span>
                  <span>P: {formatMacro(food.protein)}g</span>
                  <span>C: {formatMacro(food.carbs)}g</span>
                  <span>G: {formatMacro(food.fat)}g</span>
                  <span>Base: {formatBaseQuantity(food.baseQuantity)}{food.baseUnit}</span>
                  {food.serving && !Array.isArray(food.serving) && (
                    <span className="text-primary font-bold">1 {food.serving.name} = {Math.round(food.serving.weight)}g</span>
                  )}
                  {food.serving && Array.isArray(food.serving) && food.serving.length > 0 && (
                    <span className="text-primary font-bold">1 {food.serving[0].name} = {Math.round(food.serving[0].weight)}g</span>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">Nenhum alimento encontrado.</p>
              {onAddNew && (
                <button
                  onClick={() => {
                    onAddNew(value);
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-primary/10 text-primary rounded-lg font-bold text-sm hover:bg-primary/15 transition-colors"
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
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-muted/30 text-muted-foreground border-t border-border font-bold text-xs hover:bg-muted transition-colors"
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
