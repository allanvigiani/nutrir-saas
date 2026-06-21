import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any) as any;

const receitasSugeridas = [
  {
    name: 'Vitamina de Banana com Aveia',
    description: 'Vitamina nutritiva e energética, ideal para o café da manhã ou lanche pré-treino.',
    prepMode: 'Bata no liquidificador 1 banana congelada, 200ml de leite (ou bebida vegetal), 2 colheres de sopa de aveia em flocos e mel a gosto. Sirva gelado.',
    ingredients: [
      { name: 'Banana', quantity: '1', unit: 'unidade' },
      { name: 'Leite integral ou bebida vegetal', quantity: '200', unit: 'ml' },
      { name: 'Aveia em flocos', quantity: '2', unit: 'colheres de sopa' },
      { name: 'Mel', quantity: '1', unit: 'colher de chá' },
    ],
  },
  {
    name: 'Bowl de Açaí Funcional',
    description: 'Bowl de açaí rico em antioxidantes e energia, com toppings nutritivos.',
    prepMode: 'Bata 200g de açaí sem adição de açúcar com 50ml de água gelada até formar uma pasta espessa. Despeje no bowl e adicione os toppings.',
    ingredients: [
      { name: 'Polpa de açaí sem açúcar', quantity: '200', unit: 'g' },
      { name: 'Granola sem açúcar', quantity: '3', unit: 'colheres de sopa' },
      { name: 'Banana fatiada', quantity: '1/2', unit: 'unidade' },
      { name: 'Morango fatiado', quantity: '5', unit: 'unidades' },
      { name: 'Mel', quantity: '1', unit: 'colher de chá' },
      { name: 'Chia', quantity: '1', unit: 'colher de chá' },
    ],
  },
  {
    name: 'Overnight Oats com Frutas Vermelhas',
    description: 'Aveia preparada na véspera com frutas vermelhas, prática e nutritiva.',
    prepMode: 'Na noite anterior, misture aveia, iogurte natural e leite em um pote. Adicione mel e leve à geladeira. Pela manhã, adicione as frutas vermelhas e sirva.',
    ingredients: [
      { name: 'Aveia em flocos', quantity: '4', unit: 'colheres de sopa' },
      { name: 'Iogurte natural desnatado', quantity: '150', unit: 'g' },
      { name: 'Leite desnatado', quantity: '100', unit: 'ml' },
      { name: 'Frutas vermelhas mistas', quantity: '1/2', unit: 'xícara' },
      { name: 'Mel', quantity: '1', unit: 'colher de chá' },
      { name: 'Canela em pó', quantity: '1/2', unit: 'colher de chá' },
    ],
  },
  {
    name: 'Salada de Grão-de-Bico com Legumes',
    description: 'Salada proteica e rica em fibras, perfeita para almoço leve ou jantar.',
    prepMode: 'Escorra e lave o grão-de-bico cozido. Misture com os legumes picados e tempere com azeite, suco de limão, sal, pimenta e salsinha.',
    ingredients: [
      { name: 'Grão-de-bico cozido', quantity: '1', unit: 'xícara' },
      { name: 'Pepino', quantity: '1/2', unit: 'unidade' },
      { name: 'Tomate cereja', quantity: '10', unit: 'unidades' },
      { name: 'Cebola roxa', quantity: '1/4', unit: 'unidade' },
      { name: 'Pimentão amarelo', quantity: '1/4', unit: 'unidade' },
      { name: 'Azeite de oliva', quantity: '1', unit: 'colher de sopa' },
      { name: 'Suco de limão', quantity: '1', unit: 'colher de sopa' },
      { name: 'Salsinha fresca', quantity: 'a gosto', unit: '' },
    ],
  },
  {
    name: 'Frango Grelhado com Batata-Doce',
    description: 'Prato completo com proteína magra e carboidrato complexo de baixo índice glicêmico.',
    prepMode: 'Tempere o frango com alho, limão, sal e ervas. Grelhe por 6-8 minutos de cada lado. Cozinhe a batata-doce no forno por 30 minutos. Sirva com salada verde.',
    ingredients: [
      { name: 'Peito de frango', quantity: '150', unit: 'g' },
      { name: 'Batata-doce', quantity: '150', unit: 'g' },
      { name: 'Azeite de oliva', quantity: '1', unit: 'colher de chá' },
      { name: 'Alho amassado', quantity: '1', unit: 'dente' },
      { name: 'Suco de limão', quantity: '1', unit: 'colher de chá' },
      { name: 'Sal, pimenta e ervas', quantity: 'a gosto', unit: '' },
    ],
  },
  {
    name: 'Sopa Detox de Legumes',
    description: 'Sopa leve e nutritiva para desintoxicação, rica em vitaminas e minerais.',
    prepMode: 'Refogue cebola e alho no azeite. Adicione os legumes picados e cubra com caldo de legumes. Cozinhe por 20 minutos. Tempere com sal, pimenta e cúrcuma.',
    ingredients: [
      { name: 'Abobrinha', quantity: '1', unit: 'unidade' },
      { name: 'Cenoura', quantity: '1', unit: 'unidade' },
      { name: 'Chuchu', quantity: '1', unit: 'unidade' },
      { name: 'Espinafre', quantity: '1', unit: 'xícara' },
      { name: 'Cebola', quantity: '1/2', unit: 'unidade' },
      { name: 'Alho', quantity: '2', unit: 'dentes' },
      { name: 'Caldo de legumes', quantity: '500', unit: 'ml' },
      { name: 'Cúrcuma', quantity: '1/2', unit: 'colher de chá' },
    ],
  },
  {
    name: 'Panqueca Proteica de Aveia e Whey',
    description: 'Panqueca rica em proteína, ideal para café da manhã ou pós-treino.',
    prepMode: 'Bata todos os ingredientes no liquidificador. Cozinhe as panquecas em frigideira antiaderente em fogo médio, virando quando borbulhar.',
    ingredients: [
      { name: 'Aveia em flocos', quantity: '4', unit: 'colheres de sopa' },
      { name: 'Whey protein baunilha', quantity: '1', unit: 'scoop (30g)' },
      { name: 'Ovo', quantity: '2', unit: 'unidades' },
      { name: 'Banana madura', quantity: '1', unit: 'unidade' },
      { name: 'Leite', quantity: '50', unit: 'ml' },
      { name: 'Fermento em pó', quantity: '1/2', unit: 'colher de chá' },
    ],
  },
  {
    name: 'Arroz Integral com Feijão e Couve Refogada',
    description: 'Prato completo da culinária brasileira com proteína vegetal e fibras.',
    prepMode: 'Cozinhe o arroz integral. Refogue o feijão com alho. Para a couve, refogue no azeite com alho por 2-3 minutos. Monte o prato e sirva quente.',
    ingredients: [
      { name: 'Arroz integral cozido', quantity: '2', unit: 'colheres de servir' },
      { name: 'Feijão cozido', quantity: '2', unit: 'colheres de servir' },
      { name: 'Couve manteiga fatiada', quantity: '3', unit: 'folhas' },
      { name: 'Alho', quantity: '2', unit: 'dentes' },
      { name: 'Azeite de oliva', quantity: '1', unit: 'colher de sopa' },
    ],
  },
  {
    name: 'Smoothie Verde Detox',
    description: 'Smoothie repleto de nutrientes e clorofila para detox e energia.',
    prepMode: 'Bata todos os ingredientes no liquidificador até obter consistência homogênea. Consuma imediatamente.',
    ingredients: [
      { name: 'Espinafre fresco', quantity: '1', unit: 'xícara' },
      { name: 'Couve folha', quantity: '1', unit: 'folha' },
      { name: 'Maçã verde', quantity: '1/2', unit: 'unidade' },
      { name: 'Pepino', quantity: '1/4', unit: 'unidade' },
      { name: 'Suco de limão', quantity: '1', unit: 'colher de sopa' },
      { name: 'Gengibre', quantity: '1', unit: 'cm' },
      { name: 'Água de coco', quantity: '200', unit: 'ml' },
    ],
  },
  {
    name: 'Omelete de Claras com Espinafre',
    description: 'Omelete leve, rica em proteína e ferro, ideal para qualquer refeição.',
    prepMode: 'Bata as claras com sal e pimenta. Refogue o espinafre com alho no azeite por 2 minutos. Despeje as claras na frigideira, adicione o espinafre e o queijo. Dobre ao meio quando firmar.',
    ingredients: [
      { name: 'Claras de ovos', quantity: '4', unit: 'unidades' },
      { name: 'Espinafre fresco', quantity: '1', unit: 'xícara' },
      { name: 'Alho', quantity: '1', unit: 'dente' },
      { name: 'Queijo cottage ou ricota', quantity: '2', unit: 'colheres de sopa' },
      { name: 'Azeite de oliva', quantity: '1', unit: 'colher de chá' },
    ],
  },
];

function makeSlug(name: string): string {
  return `suggested-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
}

async function main() {
  await prisma.$connect();
  console.log('Seeding receitas sugeridas...');

  for (const receita of receitasSugeridas) {
    const { ingredients, ...receitaData } = receita;
    const id = makeSlug(receita.name);

    const existing = await prisma.recipe.findUnique({ where: { id } });

    if (existing) {
      // Atualiza receita e substitui ingredientes
      await prisma.recipeIngredient.deleteMany({ where: { recipeId: id } });
      await prisma.recipe.update({
        where: { id },
        data: {
          ...receitaData,
          ingredients: { create: ingredients },
        },
      });
      console.log(`  atualizada: ${receita.name}`);
    } else {
      await prisma.recipe.create({
        data: {
          id,
          ...receitaData,
          isSuggested: true,
          nutritionistId: null,
          ingredients: { create: ingredients },
        },
      });
      console.log(`  criada: ${receita.name}`);
    }
  }

  console.log(`\nTotal: ${receitasSugeridas.length} receitas sugeridas processadas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
