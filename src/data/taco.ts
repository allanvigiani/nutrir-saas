import tabelaAlimentos from './tabela_alimentos.json';

export interface FoodServing {
  name: string;
  weight: number;
}

export interface TacoFood {
  id: string;
  name: string;
  category?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  baseUnit: string;
  baseQuantity: number;
  serving?: FoodServing;
}

interface TabelaAlimento {
  id: string | number;
  description: string;
  category?: string;
  energy_kcal: number;
  protein_g: number;
  carbohydrate_g: number;
  lipid_g: number;
  baseUnit?: string;
  baseQuantity?: number;
  serving?: {
    name: string;
    weight: number;
  };
}

const rawFoods = tabelaAlimentos as TabelaAlimento[];

const normalizeFoodName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const servingOverrides: Record<string, FoodServing> = {
  'pao, trigo, frances': { name: 'unidade', weight: 50 },
};

export const tacoData: TacoFood[] = rawFoods.map((food) => {
  const normalizedName = normalizeFoodName(food.description);
  const overrideServing = servingOverrides[normalizedName];
  const serving =
    overrideServing ||
    (food.serving && typeof food.serving.name === 'string' && typeof food.serving.weight === 'number'
      ? {
          name: food.serving.name,
          weight: food.serving.weight,
        }
      : undefined);

  return {
    id: String(food.id),
    name: food.description,
    category: food.category,
    kcal: Number(food.energy_kcal ?? 0),
    protein: Number(food.protein_g ?? 0),
    carbs: Number(food.carbohydrate_g ?? 0),
    fat: Number(food.lipid_g ?? 0),
    baseUnit: food.baseUnit || 'g',
    baseQuantity: Number(food.baseQuantity ?? 100),
    serving,
  };
});
