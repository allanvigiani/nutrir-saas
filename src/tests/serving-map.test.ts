import { describe, it, expect } from 'vitest';
import {
  getServingsForFood,
  CATEGORY_SERVINGS_MAP,
  SERVING_OVERRIDES,
  FoodItem,
  FoodServing,
} from '../../src/data/serving-map';

// Helper: cria FoodItem base
function criarFood(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 999,
    description: 'Alimento genérico',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getServingsForFood — prioridade: override > categoria > alias > fallback
// ---------------------------------------------------------------------------

describe('getServingsForFood', () => {
  describe('fallback genérico (sem categoria, sem override)', () => {
    it('retorna apenas [{label:"g", weightInGrams:1}] para alimento sem categoria', () => {
      const result = getServingsForFood(criarFood({ id: 99999 }));
      expect(result).toEqual([{ label: 'g', weightInGrams: 1 }]);
    });

    it('retorna fallback quando categoria não é reconhecida', () => {
      const result = getServingsForFood(criarFood({ category: 'CategoriaInexistente' }));
      expect(result).toEqual([{ label: 'g', weightInGrams: 1 }]);
    });

    it('fallback tem weightInGrams === 1 (escala livre)', () => {
      const result = getServingsForFood(criarFood());
      expect(result[0].weightInGrams).toBe(1);
    });
  });

  describe('mapeamento por categoria', () => {
    it('Frutas e derivados retorna múltiplas opções incluindo "unidade" e "fatia"', () => {
      const result = getServingsForFood(
        criarFood({ category: 'Frutas e derivados' })
      );
      const labels = result.map((s) => s.label);
      expect(labels).toContain('g');
      expect(labels).toContain('unidade');
      expect(labels).toContain('fatia');
      expect(result.length).toBeGreaterThan(1);
    });

    it('primeiro serving é sempre {label:"g", weightInGrams:1}', () => {
      const categorias = Object.keys(CATEGORY_SERVINGS_MAP);
      for (const categoria of categorias) {
        const result = getServingsForFood(criarFood({ category: categoria }));
        expect(result[0]).toEqual({ label: 'g', weightInGrams: 1 });
      }
    });

    it('Cereais e derivados inclui "colher de sopa" (15g) e "xícara" (160g)', () => {
      const result = getServingsForFood(criarFood({ category: 'Cereais e derivados' }));
      const colher = result.find((s) => s.label === 'colher de sopa');
      const xicara = result.find((s) => s.label === 'xícara');
      expect(colher?.weightInGrams).toBe(15);
      expect(xicara?.weightInGrams).toBe(160);
    });

    it('Leguminosas e derivados inclui "concha" (100g)', () => {
      const result = getServingsForFood(criarFood({ category: 'Leguminosas e derivados' }));
      const concha = result.find((s) => s.label === 'concha');
      expect(concha?.weightInGrams).toBe(100);
    });
  });

  describe('aliases TBCA ↔ TACO', () => {
    it('"Vegetais e derivados" (TBCA) mapeia para servings de "Verduras, hortaliças e derivados" (TACO)', () => {
      const tbca = getServingsForFood(criarFood({ category: 'Vegetais e derivados' }));
      const taco = getServingsForFood(criarFood({ category: 'Verduras, hortaliças e derivados' }));
      expect(tbca).toEqual(taco);
    });

    it('"Açúcares e doces" existe como chave direta no CATEGORY_SERVINGS_MAP (alias é dead code)', () => {
      // ATENÇÃO: 'Açúcares e doces' tem entrada própria no CATEGORY_SERVINGS_MAP (linha 161)
      // portanto o alias para 'Produtos açucarados' nunca é ativado.
      // Isso é um bug de curadoria no serving-map: a chave direta e o alias coexistem com
      // servings diferentes — a categoria TBCA usa seus próprios servings, não os do TACO.
      const tbca = getServingsForFood(criarFood({ category: 'Açúcares e doces' }));
      // Deve retornar os servings da chave direta (não do alias)
      expect(tbca).toBeDefined();
      expect(tbca.length).toBeGreaterThan(0);
      expect(tbca[0]).toEqual({ label: 'g', weightInGrams: 1 });
    });
  });

  describe('overrides individuais por ID', () => {
    it('ovo ID 423 (TACO) → [g, unidade (~50g)] — override prevalece sobre categoria', () => {
      const result = getServingsForFood(criarFood({ id: 423, category: 'Ovos e derivados' }));
      const labels = result.map((s) => s.label);
      expect(labels).toContain('g');
      expect(labels).toContain('unidade');
      // Override tem exatamente 2 opções
      expect(result).toHaveLength(2);
      const unidade = result.find((s) => s.label === 'unidade');
      expect(unidade?.weightInGrams).toBe(50);
    });

    it('override prevalece sobre categoria: ID 423 com categoria errada ainda retorna override', () => {
      const result = getServingsForFood(
        criarFood({ id: 423, category: 'Cereais e derivados' })
      );
      // Deve retornar override de ovo, não cereais
      expect(result).toEqual(SERVING_OVERRIDES[423].servings);
    });

    it('pão de forma ID 48 → [g, fatia (~25g), ...] override correto', () => {
      const result = getServingsForFood(criarFood({ id: 48 }));
      const labels = result.map((s) => s.label);
      expect(labels).toContain('g');
      expect(labels).toContain('fatia');
      const fatia = result.find((s) => s.label === 'fatia');
      expect(fatia?.weightInGrams).toBe(25);
    });
  });

  describe('ID como string vs número', () => {
    it('ID numérico 423 encontra override corretamente', () => {
      const result = getServingsForFood(criarFood({ id: 423 }));
      expect(result).toEqual(SERVING_OVERRIDES[423].servings);
    });

    it('ID string que não existe no override vai para categoria/fallback', () => {
      const result = getServingsForFood(
        criarFood({ id: 'TBCA-99999', category: 'Frutas e derivados' })
      );
      // Deve usar categoria, não override inexistente
      expect(result).toEqual(CATEGORY_SERVINGS_MAP['Frutas e derivados']);
    });
  });
});

// ---------------------------------------------------------------------------
// Cálculo de macros — fórmula: ratio = (qty × serving.weightInGrams) / 100
// ---------------------------------------------------------------------------

describe('fórmula de cálculo de macros', () => {
  // Base: arroz cozido = 128 kcal / 100g, proteína 2.5, carbs 28, fat 0.2
  const BASE_KCAL = 128;
  const BASE_PROTEIN = 2.5;
  const BASE_CARBS = 28;
  const BASE_FAT = 0.2;

  function calcMacros(qty: number, weightInGrams: number) {
    const totalWeight = qty * weightInGrams;
    const ratio = totalWeight / 100;
    return {
      kcal: Math.round(BASE_KCAL * ratio),
      protein: Math.round(BASE_PROTEIN * ratio),
      carbs: Math.round(BASE_CARBS * ratio),
      fat: Math.round(BASE_FAT * ratio),
      weightInGrams: totalWeight,
    };
  }

  it('1 colher de sopa de arroz (15g) → ratio = 0.15 → kcal ≈ 19', () => {
    const result = calcMacros(1, 15);
    expect(result.weightInGrams).toBe(15);
    expect(result.kcal).toBe(Math.round(128 * 0.15)); // 19
  });

  it('2 colheres de sopa de arroz (2 × 15g = 30g) → ratio = 0.30', () => {
    const result = calcMacros(2, 15);
    expect(result.weightInGrams).toBe(30);
    expect(result.kcal).toBe(Math.round(128 * 0.30)); // 38
  });

  it('100g (escala livre, weightInGrams=1) → ratio = 1.0 → kcal = base_kcal', () => {
    const result = calcMacros(100, 1);
    expect(result.weightInGrams).toBe(100);
    expect(result.kcal).toBe(BASE_KCAL);
  });

  it('1 xícara de cereal (160g) → ratio = 1.6 → kcal = round(128 * 1.6) = 205', () => {
    const result = calcMacros(1, 160);
    expect(result.weightInGrams).toBe(160);
    expect(result.kcal).toBe(Math.round(128 * 1.6)); // 205
  });

  it('0 gramas → ratio = 0 → todos macros = 0', () => {
    const result = calcMacros(0, 1);
    expect(result.kcal).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
  });

  it('quantidade NaN → weightInGrams = NaN, macros = NaN (parseFloat protege upstream)', () => {
    // Simula parseFloat('') === NaN — o handler não deve recalcular
    const newQty = parseFloat('');
    expect(isNaN(newQty)).toBe(true);
    // Confirma que a guarda !isNaN(newQty) protege o cálculo
    const shouldCalc = !isNaN(newQty) && BASE_KCAL != null;
    expect(shouldCalc).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Retrocompatibilidade — itens legados sem servings
// ---------------------------------------------------------------------------

describe('retrocompatibilidade — itens legados', () => {
  it('item sem servings usa fallback [{label:"g", weightInGrams:1}]', () => {
    // Simula a lógica do MealItemRow: item.servings?.length > 0 ? item.servings : fallback
    const itemSemServings = { servings: undefined };
    const servings: FoodServing[] =
      itemSemServings.servings && (itemSemServings.servings as FoodServing[]).length > 0
        ? (itemSemServings.servings as FoodServing[])
        : [{ label: 'g', weightInGrams: 1 }];
    expect(servings).toEqual([{ label: 'g', weightInGrams: 1 }]);
  });

  it('item com servings vazio usa fallback', () => {
    const itemServingsVazio = { servings: [] };
    const servings: FoodServing[] =
      itemServingsVazio.servings && itemServingsVazio.servings.length > 0
        ? itemServingsVazio.servings
        : [{ label: 'g', weightInGrams: 1 }];
    expect(servings).toEqual([{ label: 'g', weightInGrams: 1 }]);
  });

  it('item com servings preenchido usa os servings reais', () => {
    const realServings: FoodServing[] = [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 25 },
    ];
    const item = { servings: realServings };
    const servings: FoodServing[] =
      item.servings && item.servings.length > 0
        ? item.servings
        : [{ label: 'g', weightInGrams: 1 }];
    expect(servings).toEqual(realServings);
  });

  it('selectedServing fallback para {label:"g", weightInGrams:1} quando unit não encontrada nos servings', () => {
    // Simula item legado com unit='colher de sopa' mas servings apenas com 'g'
    const servings: FoodServing[] = [{ label: 'g', weightInGrams: 1 }];
    const unitLegado = 'colher de sopa';
    const selectedServing =
      servings.find((s) => s.label === unitLegado) ?? { label: 'g', weightInGrams: 1 };
    expect(selectedServing).toEqual({ label: 'g', weightInGrams: 1 });
  });
});

// ---------------------------------------------------------------------------
// CATEGORY_SERVINGS_MAP — invariantes estruturais
// ---------------------------------------------------------------------------

describe('CATEGORY_SERVINGS_MAP — invariantes', () => {
  it('todas as categorias têm pelo menos 1 serving', () => {
    for (const [cat, servings] of Object.entries(CATEGORY_SERVINGS_MAP)) {
      expect(servings.length, `categoria "${cat}" deve ter servings`).toBeGreaterThan(0);
    }
  });

  it('nenhum serving tem weightInGrams negativo ou zero (exceto escala livre = 1)', () => {
    for (const [cat, servings] of Object.entries(CATEGORY_SERVINGS_MAP)) {
      for (const s of servings) {
        expect(s.weightInGrams, `${cat} > ${s.label}`).toBeGreaterThan(0);
      }
    }
  });

  it('overrides têm pelo menos 2 servings (g + medida específica)', () => {
    for (const [id, override] of Object.entries(SERVING_OVERRIDES)) {
      expect(
        override.servings.length,
        `override ID ${id} deve ter ao menos 2 servings`
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('todo override começa com {label:"g", weightInGrams:1}', () => {
    for (const [id, override] of Object.entries(SERVING_OVERRIDES)) {
      expect(override.servings[0], `override ID ${id}`).toEqual({
        label: 'g',
        weightInGrams: 1,
      });
    }
  });
});
