import { Prisma } from '@prisma/client';
import { getDb, withAdminRLS } from '../lib/rls-context.ts';

const LIMITE_RECEITAS_FREE = 3;

export interface RecipeIngredientInput {
  name: string;
  quantity: string;
  unit: string;
}

export interface RecipeCreateInput {
  name: string;
  description?: string;
  prepMode?: string;
  ingredients: RecipeIngredientInput[];
}

export interface RecipeUpdateInput {
  name?: string;
  description?: string;
  prepMode?: string;
  ingredients?: RecipeIngredientInput[];
}

export function createRecipesService() {
  async function list(nutritionistId: string, isPremium: boolean) {
    // Próprias ativas
    const proprias = await getDb().recipe.findMany({
      where: { nutritionistId, deletedAt: null },
      include: { ingredients: true },
      orderBy: { createdAt: 'desc' },
    });

    // Sugeridas (apenas premium)
    if (!isPremium) {
      return proprias;
    }

    const sugeridas = await withAdminRLS(() =>
      getDb().recipe.findMany({
        where: { isSuggested: true, deletedAt: null },
        include: { ingredients: true },
        orderBy: { createdAt: 'desc' },
      })
    );

    return [...proprias, ...sugeridas];
  }

  async function getOne(nutritionistId: string, id: string, isPremium: boolean) {
    const propria = await getDb().recipe.findFirst({
      where: { id, nutritionistId, deletedAt: null },
      include: { ingredients: true },
    });
    if (propria) return propria;

    const sugerida = await withAdminRLS(() =>
      getDb().recipe.findFirst({
        where: { id, isSuggested: true, deletedAt: null },
        include: { ingredients: true },
      })
    );
    if (sugerida) {
      if (!isPremium) {
        throw Object.assign(new Error('Plano premium necessário para acessar receitas sugeridas'), { status: 403 });
      }
      return sugerida;
    }

    throw Object.assign(new Error('Receita não encontrada'), { status: 404 });
  }

  async function create(nutritionistId: string, isPremium: boolean, data: RecipeCreateInput) {
    if (!isPremium) {
      const count = await getDb().recipe.count({
        where: { nutritionistId, deletedAt: null },
      });
      if (count >= LIMITE_RECEITAS_FREE) {
        throw Object.assign(
          new Error('Limite de receitas do plano gratuito atingido'),
          { status: 403 }
        );
      }
    }

    const { ingredients, ...rest } = data;
    return getDb().recipe.create({
      data: {
        ...rest,
        nutritionistId,
        ingredients: {
          create: ingredients,
        },
      },
      include: { ingredients: true },
    });
  }

  async function update(nutritionistId: string, id: string, data: RecipeUpdateInput) {
    const existing = await getDb().recipe.findFirst({
      where: { id, nutritionistId, deletedAt: null },
    });
    if (!existing) {
      throw Object.assign(new Error('Receita não encontrada ou sem permissão'), { status: 404 });
    }

    const { ingredients, ...rest } = data;

    // Se ingredients fornecidos, substitui tudo
    if (ingredients !== undefined) {
      await getDb().recipeIngredient.deleteMany({ where: { recipeId: id } });
    }

    return getDb().recipe.update({
      where: { id },
      data: {
        ...rest,
        ...(ingredients !== undefined
          ? { ingredients: { create: ingredients } }
          : {}),
      },
      include: { ingredients: true },
    });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().recipe.findFirst({
      where: { id, nutritionistId, deletedAt: null },
    });
    if (!existing) {
      throw Object.assign(new Error('Receita não encontrada ou sem permissão'), { status: 404 });
    }
    await getDb().recipe.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async function clone(nutritionistId: string, isPremium: boolean, id: string) {
    if (!isPremium) {
      throw Object.assign(new Error('Plano premium necessário para clonar receitas'), { status: 403 });
    }

    const original = await withAdminRLS(() =>
      getDb().recipe.findFirst({
        where: { id, isSuggested: true, deletedAt: null },
        include: { ingredients: true },
      })
    );
    if (!original) {
      throw Object.assign(new Error('Receita sugerida não encontrada'), { status: 404 });
    }

    return getDb().recipe.create({
      data: {
        nutritionistId,
        name: original.name,
        description: original.description,
        prepMode: original.prepMode,
        isSuggested: false,
        ingredients: {
          create: original.ingredients.map(({ name, quantity, unit }) => ({
            name,
            quantity,
            unit,
          })),
        },
      },
      include: { ingredients: true },
    });
  }

  // ── Vínculos plano-receita ──────────────────────────────────────────────

  async function listMealPlanRecipes(nutritionistId: string, mealPlanId: string) {
    // Verifica ownership do plano
    const plano = await getDb().mealPlan.findFirst({
      where: { id: mealPlanId, nutritionistId, deletedAt: null },
    });
    if (!plano) {
      throw Object.assign(new Error('Plano alimentar não encontrado'), { status: 404 });
    }

    return getDb().mealPlanRecipe.findMany({
      where: { mealPlanId },
      include: { recipe: { include: { ingredients: true } } },
      orderBy: [{ meal: 'asc' }, { position: 'asc' }],
    });
  }

  async function linkRecipe(
    nutritionistId: string,
    mealPlanId: string,
    body: { recipeId: string; meal: string; position?: number },
    isPremium: boolean
  ) {
    const plano = await getDb().mealPlan.findFirst({
      where: { id: mealPlanId, nutritionistId, deletedAt: null },
    });
    if (!plano) {
      throw Object.assign(new Error('Plano alimentar não encontrado'), { status: 404 });
    }

    const receita = await withAdminRLS(() =>
      getDb().recipe.findFirst({
        where: {
          id: body.recipeId,
          deletedAt: null,
          OR: [{ nutritionistId }, { isSuggested: true }],
        },
      })
    );
    if (!receita) {
      throw Object.assign(new Error('Receita não encontrada'), { status: 404 });
    }

    if (receita.isSuggested && !isPremium) {
      throw Object.assign(
        new Error('Plano premium necessário para vincular receitas sugeridas'),
        { status: 403 }
      );
    }

    try {
      return await getDb().mealPlanRecipe.create({
        data: {
          mealPlanId,
          recipeId: body.recipeId,
          meal: body.meal,
          position: body.position ?? 0,
        },
        include: { recipe: { include: { ingredients: true } } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw Object.assign(new Error('Receita já vinculada a esta refeição'), { status: 409 });
      }
      throw err;
    }
  }

  async function unlinkRecipe(nutritionistId: string, planId: string, linkId: string) {
    // Verifica ownership do plano
    const plano = await getDb().mealPlan.findFirst({
      where: { id: planId, nutritionistId, deletedAt: null },
    });
    if (!plano) {
      throw Object.assign(new Error('Plano alimentar não encontrado'), { status: 404 });
    }

    const link = await getDb().mealPlanRecipe.findFirst({
      where: { id: linkId, mealPlanId: planId },
    });
    if (!link) {
      throw Object.assign(new Error('Vínculo não encontrado'), { status: 404 });
    }

    await getDb().mealPlanRecipe.delete({ where: { id: linkId } });
  }

  return {
    list,
    getOne,
    create,
    update,
    remove,
    clone,
    listMealPlanRecipes,
    linkRecipe,
    unlinkRecipe,
  };
}
