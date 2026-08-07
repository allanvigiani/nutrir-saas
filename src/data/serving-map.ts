/**
 * serving-map.ts
 * Mapa de unidades de medida disponíveis por categoria de alimento.
 * Baseado em medidas caseiras brasileiras (TBCA, Pinheiro et al. 2004).
 *
 * Fonte das categorias:
 *   - TACO: tabela_alimentos.json (~597 alimentos)
 *   - TBCA: tabela_alimentos_tbca.json (~5.668 alimentos)
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface FoodServing {
  /** Nome exibido ao usuário (ex: "colher de sopa") */
  label: string;
  /** Peso em gramas desta medida (1 = escala livre em g/ml) */
  weightInGrams: number;
}

export interface FoodItem {
  id: string | number;
  description: string;
  category?: string;
  /** Medidas caseiras customizadas (alimentos próprios do nutricionista) */
  servings?: { name: string; weight: number }[];
  /** Unidade base do alimento próprio (g, ml, un) — usada na escala livre */
  baseUnit?: string;
}

// ---------------------------------------------------------------------------
// Unidades padrão por categoria (TACO + TBCA unificadas)
// ---------------------------------------------------------------------------

/**
 * Chave = nome exato da categoria conforme aparece nas tabelas.
 * Valor = array de servings disponíveis para alimentos dessa categoria.
 * O primeiro serving sempre é { label: 'g', weightInGrams: 1 } — escala livre.
 */
export const CATEGORY_SERVINGS_MAP: Record<string, FoodServing[]> = {
  // ── TACO ────────────────────────────────────────────────────────────────

  'Cereais e derivados': [
    { label: 'g', weightInGrams: 1 },
    { label: 'colher de sopa', weightInGrams: 15 },
    { label: 'colher de servir', weightInGrams: 30 },
    { label: 'xícara', weightInGrams: 160 },
    { label: 'fatia', weightInGrams: 25 },
    { label: 'unidade', weightInGrams: 50 },
  ],

  'Leguminosas e derivados': [
    { label: 'g', weightInGrams: 1 },
    { label: 'colher de sopa', weightInGrams: 15 },
    { label: 'concha', weightInGrams: 100 },
    { label: 'xícara', weightInGrams: 160 },
  ],

  'Frutas e derivados': [
    { label: 'g', weightInGrams: 1 },
    { label: 'unidade', weightInGrams: 100 },
    { label: 'fatia', weightInGrams: 80 },
    { label: 'xícara', weightInGrams: 150 },
  ],

  'Verduras, hortaliças e derivados': [
    { label: 'g', weightInGrams: 1 },
    { label: 'colher de sopa', weightInGrams: 15 },
    { label: 'xícara', weightInGrams: 80 },
    { label: 'unidade', weightInGrams: 100 },
  ],

  'Carnes e derivados': [
    { label: 'g', weightInGrams: 1 },
  ],

  'Leite e derivados': [
    { label: 'g', weightInGrams: 1 },
    { label: 'ml', weightInGrams: 1 },
    { label: 'copo', weightInGrams: 200 },
    { label: 'xícara', weightInGrams: 200 },
    { label: 'colher de sopa', weightInGrams: 15 },
    { label: 'fatia', weightInGrams: 20 },
  ],

  'Ovos e derivados': [
    { label: 'g', weightInGrams: 1 },
    { label: 'unidade', weightInGrams: 50 },
  ],

  'Gorduras e óleos': [
    { label: 'g', weightInGrams: 1 },
    { label: 'ml', weightInGrams: 0.9 },
    { label: 'colher de sopa', weightInGrams: 10 },
    { label: 'colher de chá', weightInGrams: 4 },
  ],

  'Produtos açucarados': [
    { label: 'g', weightInGrams: 1 },
    { label: 'colher de sopa', weightInGrams: 12 },
    { label: 'colher de chá', weightInGrams: 4 },
    { label: 'unidade', weightInGrams: 10 },
  ],

  'Nozes e sementes': [
    { label: 'g', weightInGrams: 1 },
    { label: 'unidade', weightInGrams: 5 },
    { label: 'colher de sopa', weightInGrams: 15 },
    { label: 'xícara', weightInGrams: 120 },
  ],

  'Pescados e frutos do mar': [
    { label: 'g', weightInGrams: 1 },
    { label: 'filé', weightInGrams: 120 },
    { label: 'unidade', weightInGrams: 100 },
    { label: 'colher de sopa', weightInGrams: 15 },
  ],

  'Bebidas (alcoólicas e não alcoólicas)': [
    { label: 'g', weightInGrams: 1 },
    { label: 'ml', weightInGrams: 1 },
    { label: 'copo', weightInGrams: 200 },
    { label: 'xícara', weightInGrams: 50 },
    { label: 'lata', weightInGrams: 350 },
    { label: 'taça', weightInGrams: 150 },
  ],

  'Alimentos preparados': [
    { label: 'g', weightInGrams: 1 },
    { label: 'colher de sopa', weightInGrams: 15 },
    { label: 'concha', weightInGrams: 100 },
    { label: 'xícara', weightInGrams: 160 },
    { label: 'unidade', weightInGrams: 100 },
    { label: 'fatia', weightInGrams: 50 },
  ],

  'Outros alimentos industrializados': [
    { label: 'g', weightInGrams: 1 },
    { label: 'unidade', weightInGrams: 30 },
    { label: 'fatia', weightInGrams: 25 },
    { label: 'colher de sopa', weightInGrams: 15 },
  ],

  'Miscelâneas': [
    { label: 'g', weightInGrams: 1 },
    { label: 'colher de sopa', weightInGrams: 15 },
    { label: 'colher de chá', weightInGrams: 5 },
    { label: 'unidade', weightInGrams: 50 },
  ],

  // ── TBCA (categorias adicionais não presentes na TACO) ──────────────────

  'Vegetais e derivados': [
    { label: 'g', weightInGrams: 1 },
    { label: 'colher de sopa', weightInGrams: 15 },
    { label: 'xícara', weightInGrams: 80 },
    { label: 'unidade', weightInGrams: 100 },
  ],

  'Açúcares e doces': [
    { label: 'g', weightInGrams: 1 },
    { label: 'colher de sopa', weightInGrams: 12 },
    { label: 'colher de chá', weightInGrams: 4 },
  ],

  'Bebidas': [
    { label: 'g', weightInGrams: 1 },
    { label: 'ml', weightInGrams: 1 },
    { label: 'copo', weightInGrams: 200 },
    { label: 'xícara', weightInGrams: 50 },
    { label: 'lata', weightInGrams: 350 },
  ],

  'Alimentos industrializados': [
    { label: 'g', weightInGrams: 1 },
    { label: 'unidade', weightInGrams: 30 },
    { label: 'fatia', weightInGrams: 25 },
    { label: 'colher de sopa', weightInGrams: 15 },
  ],

  'Alimentos para fins especiais': [
    { label: 'g', weightInGrams: 1 },
    { label: 'colher de sopa', weightInGrams: 15 },
    { label: 'colher de chá', weightInGrams: 5 },
  ],

  'Fast food': [
    { label: 'g', weightInGrams: 1 },
    { label: 'unidade', weightInGrams: 150 },
    { label: 'fatia', weightInGrams: 50 },
  ],

  'Sementes e Oleaginosas': [
    { label: 'g', weightInGrams: 1 },
    { label: 'unidade', weightInGrams: 5 },
    { label: 'colher de sopa', weightInGrams: 15 },
    { label: 'xícara', weightInGrams: 120 },
  ],

  'Pescados e Frutos do mar': [
    { label: 'g', weightInGrams: 1 },
    { label: 'filé', weightInGrams: 120 },
    { label: 'unidade', weightInGrams: 100 },
    { label: 'colher de sopa', weightInGrams: 15 },
  ],
};

// ---------------------------------------------------------------------------
// Aliases de categoria (TACO ↔ TBCA)
// ---------------------------------------------------------------------------

/**
 * Normaliza variações de nome de categoria para a chave canônica usada acima.
 * Permite que alimentos TBCA e TACO compartilhem o mesmo mapa de servings.
 */
export const CATEGORY_ALIASES: Record<string, string> = {
  // TBCA → TACO equivalentes
  'Vegetais e derivados': 'Verduras, hortaliças e derivados',
  'Bebidas': 'Bebidas (alcoólicas e não alcoólicas)',
  'Sementes e Oleaginosas': 'Nozes e sementes',
  'Pescados e Frutos do mar': 'Pescados e frutos do mar', // case
  'Alimentos industrializados': 'Outros alimentos industrializados',
  // TBCA: categorias sem equivalente direto → melhor aproximação
  'Alimentos para fins especiais': 'Alimentos preparados',
  'Fast food': 'Alimentos preparados',
};

// ---------------------------------------------------------------------------
// Overrides de curadoria — ~24 alimentos com unidades específicas
// IDs numéricos = TACO, strings com prefixo = TBCA
// ---------------------------------------------------------------------------

/**
 * Serving com tipo auxiliar para os overrides
 */
interface ServingOverride {
  servings: FoodServing[];
}

export const SERVING_OVERRIDES: Record<string | number, ServingOverride> = {
  // Ovos (TACO)
  423: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },
  424: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },
  425: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },

  // Pão de forma — variantes TACO (ids: 48=aveia, 50=glúten, 51=milho, 52=trigo integral)
  48: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 25 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },
  50: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 25 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },
  51: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 25 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },
  52: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 25 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },

  // Pão francês (TACO id: 53)
  53: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },

  // Pão, de queijo, assado (TACO id: 140)
  140: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 25 },
    ],
  },

  // Pão, de queijo, cru (TACO id: 141)
  141: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 25 },
    ],
  },

  // Pão, de queijo, industrializado, assado (TBCA id: C0123B)
  'C0123B': {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 40 },
    ],
  },

  // Pão, de queijo, industrializado, cru (TBCA id: C0124B)
  'C0124B': {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 40 },
    ],
  },

  // Arroz, tipo 1, cozido (TACO id: 3)
  3: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'colher de sopa', weightInGrams: 15 },
      { label: 'colher de servir', weightInGrams: 30 },
      { label: 'xícara', weightInGrams: 160 },
      { label: 'concha', weightInGrams: 100 },
    ],
  },

  // Arroz, integral, cozido (TACO id: 1)
  1: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'colher de sopa', weightInGrams: 15 },
      { label: 'colher de servir', weightInGrams: 30 },
      { label: 'xícara', weightInGrams: 160 },
      { label: 'concha', weightInGrams: 100 },
    ],
  },

  // Macarrão, trigo, cru (TACO id: 40) — proxy para macarrão cozido
  // (TACO não possui versão cozida; weightInGrams ajustado pelo frontend)
  40: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'colher de servir', weightInGrams: 30 },
      { label: 'xícara', weightInGrams: 160 },
      { label: 'concha', weightInGrams: 150 },
    ],
  },

  // Feijão, carioca, cozido (TACO id: 561)
  561: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'concha', weightInGrams: 100 },
      { label: 'xícara', weightInGrams: 160 },
      { label: 'colher de sopa', weightInGrams: 15 },
    ],
  },

  // Feijão, preto, cozido (TACO id: 567)
  567: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'concha', weightInGrams: 100 },
      { label: 'xícara', weightInGrams: 160 },
      { label: 'colher de sopa', weightInGrams: 15 },
    ],
  },

  // Banana, prata, crua (TACO id: 182)
  182: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 80 },
    ],
  },

  // Maçã, Fuji, com casca, crua (TACO id: 222)
  222: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 130 },
    ],
  },

  // Mamão, Formosa, cru (TACO id: 225)
  225: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 200 },
    ],
  },

  // Mamão, Papaia, cru (TACO id: 226)
  226: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 170 },
    ],
  },

  // Abacaxi, cru (TACO id: 164)
  164: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 80 },
      { label: 'unidade', weightInGrams: 1000 },
    ],
  },

  // Leite, de vaca, integral (TACO id: 458)
  458: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 200 },
      { label: 'xícara', weightInGrams: 200 },
    ],
  },

  // Queijo, mozarela (TACO id: 463)
  463: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 20 },
    ],
  },

  // Iogurte, natural (TACO id: 448)
  448: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 170 },
    ],
  },

  // Azeite, de oliva, extra virgem (TACO id: 260)
  260: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 0.9 },
      { label: 'colher de sopa', weightInGrams: 10 },
      { label: 'colher de chá', weightInGrams: 4 },
    ],
  },

  // Açúcar, refinado (TACO id: 494)
  494: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'colher de sopa', weightInGrams: 12 },
      { label: 'colher de chá', weightInGrams: 4 },
    ],
  },

  // Mel, de abelha (TACO id: 507)
  507: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'colher de sopa', weightInGrams: 20 },
      { label: 'colher de chá', weightInGrams: 7 },
    ],
  },

  // Castanha-do-Brasil, crua (TACO id: 589)
  589: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 5 },
    ],
  },

  // Castanha-de-caju, torrada, salgada (TACO id: 588)
  588: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 4 },
    ],
  },

  // Café, infusão 10% (TACO id: 471)
  471: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'xícara', weightInGrams: 50 },
      { label: 'copo', weightInGrams: 180 },
    ],
  },

  // ── Frutas sólidas TACO — unidade/fatia específicas por fruta ──────────

  // Abacate, cru (TACO id: 163)
  163: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 200 },
      { label: 'fatia', weightInGrams: 80 },
      { label: 'colher de sopa', weightInGrams: 15 },
    ],
  },

  // Banana, da terra, crua (TACO id: 175)
  175: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 120 },
    ],
  },

  // Banana, figo, crua (TACO id: 177)
  177: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 70 },
    ],
  },

  // Banana, maçã, crua (TACO id: 178)
  178: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 80 },
    ],
  },

  // Banana, nanica, crua (TACO id: 179)
  179: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 80 },
    ],
  },

  // Banana, ouro, crua (TACO id: 180)
  180: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },

  // Banana, pacova, crua (TACO id: 181)
  181: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 100 },
    ],
  },

  // Figo, cru (TACO id: 194)
  194: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },

  // Goiaba, branca, com casca, crua (TACO id: 197)
  197: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 100 },
    ],
  },

  // Goiaba, vermelha, com casca, crua (TACO id: 200)
  200: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 100 },
    ],
  },

  // Jaca, crua (TACO id: 204)
  204: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 80 },
    ],
  },

  // Kiwi, cru (TACO id: 207)
  207: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 80 },
    ],
  },

  // Laranja, baía, crua (TACO id: 208)
  208: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 160 },
    ],
  },

  // Laranja, da terra, crua (TACO id: 210)
  210: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 160 },
    ],
  },

  // Laranja, lima, crua (TACO id: 212)
  212: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 120 },
    ],
  },

  // Laranja, pêra, crua (TACO id: 214)
  214: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 160 },
    ],
  },

  // Laranja, valência, crua (TACO id: 216)
  216: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 160 },
    ],
  },

  // Maçã, Argentina, com casca, crua (TACO id: 221)
  221: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 130 },
    ],
  },

  // Manga, Haden, crua (TACO id: 228)
  228: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 300 },
      { label: 'fatia', weightInGrams: 80 },
    ],
  },

  // Manga, Palmer, crua (TACO id: 229)
  229: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 350 },
      { label: 'fatia', weightInGrams: 80 },
    ],
  },

  // Manga, Tommy Atkins, crua (TACO id: 231)
  231: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 300 },
      { label: 'fatia', weightInGrams: 80 },
    ],
  },

  // Maracujá, cru (TACO id: 232)
  232: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 80 },
    ],
  },

  // Melancia, crua (TACO id: 235)
  235: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 300 },
    ],
  },

  // Melão, cru (TACO id: 236)
  236: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 200 },
    ],
  },

  // Mexerica, Murcote, crua (TACO id: 237)
  237: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 100 },
    ],
  },

  // Mexerica, Rio, crua (TACO id: 238)
  238: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 100 },
    ],
  },

  // Morango, cru (TACO id: 239)
  239: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 15 },
      { label: 'xícara', weightInGrams: 150 },
    ],
  },

  // Pêra, Park, crua (TACO id: 242)
  242: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 150 },
    ],
  },

  // Pêra, Williams, crua (TACO id: 243)
  243: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 150 },
    ],
  },

  // Pêssego, Aurora, cru (TACO id: 244)
  244: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 100 },
    ],
  },

  // Tangerina, Poncã, crua (TACO id: 251)
  251: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 100 },
    ],
  },

  // Uva, Itália, crua (TACO id: 256)
  256: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'cacho', weightInGrams: 200 },
      { label: 'unidade', weightInGrams: 8 },
    ],
  },

  // Uva, Rubi, crua (TACO id: 257)
  257: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'cacho', weightInGrams: 200 },
      { label: 'unidade', weightInGrams: 6 },
    ],
  },

  // ── Sucos/polpas (líquidos) — precisam de ml/copo ────────────────────────

  // Açaí, polpa, com xarope (TACO id: 167)
  167: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 200 },
      { label: 'colher de sopa', weightInGrams: 15 },
    ],
  },

  // Açaí, polpa, congelada (TACO id: 168)
  168: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 200 },
      { label: 'colher de sopa', weightInGrams: 15 },
    ],
  },

  // Laranja, baía, suco (TACO id: 209)
  209: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 200 },
    ],
  },

  // Laranja, da terra, suco (TACO id: 211)
  211: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 200 },
    ],
  },

  // Laranja, lima, suco (TACO id: 213)
  213: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 200 },
    ],
  },

  // Laranja, pêra, suco (TACO id: 215)
  215: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 200 },
    ],
  },

  // Laranja, valência, suco (TACO id: 217)
  217: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 200 },
    ],
  },

  // Tangerina, Poncã, suco (TACO id: 252)
  252: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 200 },
    ],
  },

  // ── Leite e derivados TACO — ajustes específicos ─────────────────────────

  // Leite, de vaca, desnatado, UHT (TACO id: 457)
  457: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 200 },
      { label: 'xícara', weightInGrams: 200 },
    ],
  },

  // Leite, de cabra (TACO id: 454)
  454: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 200 },
    ],
  },

  // Iogurte, natural, desnatado (TACO id: 449)
  449: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 170 },
    ],
  },

  // Iogurte, sabor abacaxi (TACO id: 450)
  450: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 170 },
    ],
  },

  // Iogurte, sabor morango (TACO id: 451)
  451: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 170 },
    ],
  },

  // Iogurte, sabor pêssego (TACO id: 452)
  452: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'copo', weightInGrams: 170 },
    ],
  },

  // Leite, condensado (TACO id: 453)
  453: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'colher de sopa', weightInGrams: 20 },
      { label: 'colher de chá', weightInGrams: 7 },
    ],
  },

  // Creme de leite (TACO id: 447)
  447: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 1 },
      { label: 'colher de sopa', weightInGrams: 15 },
    ],
  },

  // Queijo, minas, frescal (TACO id: 461)
  461: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 30 },
    ],
  },

  // Queijo, minas, meia cura (TACO id: 462)
  462: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 25 },
    ],
  },

  // Queijo, parmesão (TACO id: 464)
  464: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'colher de sopa', weightInGrams: 10 },
      { label: 'colher de chá', weightInGrams: 5 },
    ],
  },

  // Queijo, prato (TACO id: 467)
  467: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 20 },
    ],
  },

  // Queijo, ricota (TACO id: 469)
  469: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 30 },
      { label: 'colher de sopa', weightInGrams: 15 },
    ],
  },

  // ── Gorduras e óleos TACO — óleos vegetais ───────────────────────────────

  // Azeite, de dendê (TACO id: 259)
  259: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 0.9 },
      { label: 'colher de sopa', weightInGrams: 10 },
      { label: 'colher de chá', weightInGrams: 4 },
    ],
  },

  // Manteiga, com sal (TACO id: 261)
  261: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'colher de chá', weightInGrams: 5 },
      { label: 'colher de sopa', weightInGrams: 15 },
    ],
  },

  // Manteiga, sem sal (TACO id: 262)
  262: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'colher de chá', weightInGrams: 5 },
      { label: 'colher de sopa', weightInGrams: 15 },
    ],
  },

  // Margarina, com sal (TACO id: 263)
  263: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'colher de chá', weightInGrams: 5 },
      { label: 'colher de sopa', weightInGrams: 15 },
    ],
  },

  // Óleo, de canola (TACO id: 268)
  268: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 0.92 },
      { label: 'colher de sopa', weightInGrams: 10 },
      { label: 'colher de chá', weightInGrams: 4 },
    ],
  },

  // Óleo, de soja (TACO id: 272)
  272: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 0.92 },
      { label: 'colher de sopa', weightInGrams: 10 },
      { label: 'colher de chá', weightInGrams: 4 },
    ],
  },

  // Óleo, de girassol (TACO id: 269)
  269: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 0.92 },
      { label: 'colher de sopa', weightInGrams: 10 },
      { label: 'colher de chá', weightInGrams: 4 },
    ],
  },

  // Óleo, de milho (TACO id: 270)
  270: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'ml', weightInGrams: 0.92 },
      { label: 'colher de sopa', weightInGrams: 10 },
      { label: 'colher de chá', weightInGrams: 4 },
    ],
  },

  // ── Ovos TACO — ovos de galinha inteiros ─────────────────────────────────

  // Ovo, de galinha, inteiro, cozido (TACO id: 488)
  488: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },

  // Ovo, de galinha, inteiro, cru (TACO id: 489)
  489: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },

  // Ovo, de galinha, inteiro, frito (TACO id: 490)
  490: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },

  // Ovo, de codorna, inteiro, cru (TACO id: 485)
  485: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 10 },
    ],
  },

  // ── Cereais TACO — biscoitos, bolos, pipoca ────────────────────────────────

  // Biscoito, doce, maisena (TACO id: 8)
  8: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 10 },
    ],
  },

  // Biscoito, doce, recheado com chocolate (TACO id: 9)
  9: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 14 },
    ],
  },

  // Biscoito, doce, recheado com morango (TACO id: 10)
  10: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 14 },
    ],
  },

  // Biscoito, doce, wafer, recheado de chocolate (TACO id: 11)
  11: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 10 },
    ],
  },

  // Biscoito, doce, wafer, recheado de morango (TACO id: 12)
  12: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 10 },
    ],
  },

  // Biscoito, salgado, cream cracker (TACO id: 13)
  13: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 7 },
    ],
  },

  // Pipoca, com óleo de soja, sem sal (TACO id: 61)
  61: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'xícara', weightInGrams: 10 },
    ],
  },

  // Torrada, pão francês (TACO id: 63)
  63: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 20 },
    ],
  },

  // Pão, de soja (TACO id: 49)
  49: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'fatia', weightInGrams: 25 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },

  // Pão, trigo, sovado (TACO id: 54)
  54: {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 50 },
    ],
  },

  // ── TBCA overrides — alimentos "Vegetais e derivados" que são pão/tapioca ──

  // Tapioca, sem manteiga, sem recheio (TBCA id: C0906B)
  'C0906B': {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 70 },
    ],
  },

  // Tapioca, c/ manteiga, c/ sal (TBCA id: C0137B)
  'C0137B': {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 80 },
    ],
  },

  // Tapioca, c/ queijo coalho e muçarela (TBCA id: C0841B)
  'C0841B': {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 100 },
    ],
  },

  // Tapioca, c/ leite condensado e coco (TBCA id: C0839B)
  'C0839B': {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 90 },
    ],
  },

  // Tapioca, c/ banana, açúcar e canela (TBCA id: C0843B)
  'C0843B': {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 90 },
    ],
  },

  // Tapioca, c/ peito de frango refogado e requeijão (TBCA id: C0842B)
  'C0842B': {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 100 },
    ],
  },

  // Tapioca, c/ charque e queijo coalho (TBCA id: C0840B)
  'C0840B': {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 110 },
    ],
  },

  // Biscoito, polvilho, doce, industrializado (TBCA id: C0096B)
  'C0096B': {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 5 },
    ],
  },

  // Pão, de queijo, industrializado, cru (TBCA id: C0094B)
  'C0094B': {
    servings: [
      { label: 'g', weightInGrams: 1 },
      { label: 'unidade', weightInGrams: 40 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Retorna as unidades de medida disponíveis para um alimento.
 * Prioridade: medidas customizadas do alimento > override individual > categoria > fallback genérico.
 *
 * @param food - objeto com id, description, category e servings (opcional para alimentos customizados)
 * @returns array de FoodServing ordenado (g sempre primeiro)
 */
export function getServingsForFood(food: FoodItem): FoodServing[] {
  // Unidade de escala livre: 'g' por padrão, ou a unidade base do alimento próprio (ex: 'ml')
  const freeScaleUnit = food.baseUnit || 'g';

  // 0. Medidas customizadas do próprio alimento (CustomFood com N medidas)
  if (food.servings && food.servings.length > 0) {
    const normalized: FoodServing[] = food.servings.map((s) => ({
      label: s.name,
      weightInGrams: s.weight,
    }));
    // Garante que a unidade base é sempre a primeira opção
    const hasBaseUnit = normalized.some((s) => s.label === freeScaleUnit && s.weightInGrams === 1);
    return hasBaseUnit
      ? normalized
      : [{ label: freeScaleUnit, weightInGrams: 1 }, ...normalized];
  }

  // 1. Override individual por ID
  const override = SERVING_OVERRIDES[food.id];
  if (override) return override.servings;

  // 2. Categoria direta
  if (food.category) {
    const direct = CATEGORY_SERVINGS_MAP[food.category];
    if (direct) return direct;

    // 3. Alias de categoria (TBCA ↔ TACO)
    const aliasKey = CATEGORY_ALIASES[food.category];
    if (aliasKey) {
      const aliased = CATEGORY_SERVINGS_MAP[aliasKey];
      if (aliased) return aliased;
    }
  }

  // 4. Fallback genérico — escala livre na unidade base do alimento
  return [{ label: freeScaleUnit, weightInGrams: 1 }];
}
