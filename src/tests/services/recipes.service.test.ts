import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const recipe = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
};

const recipeIngredient = {
  deleteMany: vi.fn(),
};

const mealPlan = {
  findFirst: vi.fn(),
};

const mealPlanRecipe = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../server/lib/rls-context.ts', () => ({
  getDb: () => ({ recipe, recipeIngredient, mealPlan, mealPlanRecipe }),
  withAdminRLS: async (fn: () => Promise<unknown>) => fn(),
  withNutritionistRLS: async (_id: string, fn: () => Promise<unknown>) => fn(),
}));

import { createRecipesService } from '../../server/services/recipes.service.ts';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function criarIngredienteBase(overrides = {}) {
  return { name: 'Ovo', quantity: '2', unit: 'unidade', ...overrides };
}

function criarReceitaBase(overrides = {}) {
  return {
    id: 'rec-1',
    nutritionistId: 'nutri-1',
    name: 'Omelete',
    description: 'Omelete simples',
    prepMode: 'Bater e fritar',
    isSuggested: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingredients: [criarIngredienteBase()],
    ...overrides,
  };
}

function criarReceitaSugeridaBase(overrides = {}) {
  return criarReceitaBase({ id: 'sug-1', nutritionistId: null, isSuggested: true, ...overrides });
}

function criarPlanoBase(overrides = {}) {
  return {
    id: 'plan-1',
    nutritionistId: 'nutri-1',
    deletedAt: null,
    ...overrides,
  };
}

// ── Testes ─────────────────────────────────────────────────────────────────────

describe('createRecipesService', () => {
  let service: ReturnType<typeof createRecipesService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createRecipesService();
  });

  // ── list ────────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('retorna apenas receitas próprias para usuário free', async () => {
      const receitas = [criarReceitaBase()];
      recipe.findMany.mockResolvedValue(receitas);

      const resultado = await service.list('nutri-1', false);

      expect(recipe.findMany).toHaveBeenCalledTimes(1);
      expect(recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { nutritionistId: 'nutri-1', deletedAt: null },
        })
      );
      expect(resultado).toEqual(receitas);
    });

    it('retorna próprias + sugeridas para usuário premium', async () => {
      const proprias = [criarReceitaBase()];
      const sugeridas = [criarReceitaSugeridaBase()];
      recipe.findMany
        .mockResolvedValueOnce(proprias)
        .mockResolvedValueOnce(sugeridas);

      const resultado = await service.list('nutri-1', true);

      expect(recipe.findMany).toHaveBeenCalledTimes(2);
      expect(resultado).toEqual([...proprias, ...sugeridas]);
    });

    it('não busca sugeridas quando free', async () => {
      recipe.findMany.mockResolvedValue([]);
      await service.list('nutri-1', false);
      expect(recipe.findMany).toHaveBeenCalledTimes(1);
    });
  });

  // ── getOne ──────────────────────────────────────────────────────────────────

  describe('getOne()', () => {
    it('retorna receita própria existente', async () => {
      const receita = criarReceitaBase();
      recipe.findFirst.mockResolvedValueOnce(receita);

      const resultado = await service.getOne('nutri-1', 'rec-1', true);

      expect(resultado).toEqual(receita);
    });

    it('fallback para receita sugerida quando própria não encontrada (premium)', async () => {
      const sugerida = criarReceitaSugeridaBase();
      recipe.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(sugerida);

      const resultado = await service.getOne('nutri-1', 'sug-1', true);

      expect(resultado).toEqual(sugerida);
    });

    it('lança 403 quando free tenta acessar receita sugerida', async () => {
      const sugerida = criarReceitaSugeridaBase();
      recipe.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(sugerida);

      await expect(service.getOne('nutri-1', 'sug-1', false)).rejects.toMatchObject({
        status: 403,
      });
    });

    it('lança 404 quando nem própria nem sugerida encontrada', async () => {
      recipe.findFirst.mockResolvedValue(null);

      await expect(service.getOne('nutri-1', 'inexistente', true)).rejects.toMatchObject({
        message: 'Receita não encontrada',
        status: 404,
      });
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('cria receita normalmente para usuário premium', async () => {
      const nova = criarReceitaBase();
      recipe.create.mockResolvedValue(nova);

      const resultado = await service.create('nutri-1', true, {
        name: 'Omelete',
        ingredients: [criarIngredienteBase()],
      });

      expect(recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nutritionistId: 'nutri-1',
            name: 'Omelete',
          }),
        })
      );
      expect(resultado).toEqual(nova);
    });

    it('cria receita para free quando abaixo do limite', async () => {
      recipe.count.mockResolvedValue(2);
      recipe.create.mockResolvedValue(criarReceitaBase());

      await service.create('nutri-1', false, {
        name: 'Salada',
        ingredients: [criarIngredienteBase()],
      });

      expect(recipe.create).toHaveBeenCalled();
    });

    it('lança 403 quando free atingiu limite de 3 receitas', async () => {
      recipe.count.mockResolvedValue(3);

      await expect(
        service.create('nutri-1', false, {
          name: 'Quarta Receita',
          ingredients: [criarIngredienteBase()],
        })
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining('Limite'),
      });

      expect(recipe.create).not.toHaveBeenCalled();
    });

    it('não verifica contagem quando isPremium', async () => {
      recipe.create.mockResolvedValue(criarReceitaBase());

      await service.create('nutri-1', true, {
        name: 'Receita Premium',
        ingredients: [criarIngredienteBase()],
      });

      expect(recipe.count).not.toHaveBeenCalled();
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('atualiza receita própria existente', async () => {
      const existente = criarReceitaBase();
      const atualizada = { ...existente, name: 'Omelete Especial' };
      recipe.findFirst.mockResolvedValue(existente);
      recipe.update.mockResolvedValue(atualizada);

      const resultado = await service.update('nutri-1', 'rec-1', { name: 'Omelete Especial' });

      expect(resultado).toEqual(atualizada);
    });

    it('substitui ingredientes quando fornecidos', async () => {
      recipe.findFirst.mockResolvedValue(criarReceitaBase());
      recipe.update.mockResolvedValue(criarReceitaBase());

      await service.update('nutri-1', 'rec-1', {
        ingredients: [criarIngredienteBase({ name: 'Queijo' })],
      });

      expect(recipeIngredient.deleteMany).toHaveBeenCalledWith({ where: { recipeId: 'rec-1' } });
    });

    it('não deleta ingredientes quando não fornecidos no update', async () => {
      recipe.findFirst.mockResolvedValue(criarReceitaBase());
      recipe.update.mockResolvedValue(criarReceitaBase());

      await service.update('nutri-1', 'rec-1', { name: 'Novo Nome' });

      expect(recipeIngredient.deleteMany).not.toHaveBeenCalled();
    });

    it('lança 404 ao tentar atualizar receita inexistente ou de outro nutricionista', async () => {
      recipe.findFirst.mockResolvedValue(null);

      await expect(service.update('nutri-1', 'rec-outro', { name: 'X' })).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('faz soft-delete da receita', async () => {
      recipe.findFirst.mockResolvedValue(criarReceitaBase());
      recipe.update.mockResolvedValue({});

      await service.remove('nutri-1', 'rec-1');

      expect(recipe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rec-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        })
      );
    });

    it('lança 404 ao tentar remover receita inexistente', async () => {
      recipe.findFirst.mockResolvedValue(null);

      await expect(service.remove('nutri-1', 'inexistente')).rejects.toMatchObject({
        status: 404,
      });
    });

    it('não permite remover receita de outro nutricionista', async () => {
      recipe.findFirst.mockResolvedValue(null); // WHERE nutritionistId: 'nutri-1' não bate

      await expect(service.remove('nutri-1', 'rec-de-outro')).rejects.toMatchObject({
        status: 404,
        message: expect.stringContaining('permissão'),
      });
    });
  });

  // ── clone ───────────────────────────────────────────────────────────────────

  describe('clone()', () => {
    it('lança 403 quando usuário free tenta clonar', async () => {
      await expect(service.clone('nutri-1', false, 'sug-1')).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining('premium'),
      });

      expect(recipe.findFirst).not.toHaveBeenCalled();
      expect(recipe.create).not.toHaveBeenCalled();
    });

    it('clona receita sugerida para usuário premium', async () => {
      const original = criarReceitaSugeridaBase();
      const clonada = criarReceitaBase({ name: original.name, isSuggested: false });
      recipe.findFirst.mockResolvedValue(original);
      recipe.create.mockResolvedValue(clonada);

      const resultado = await service.clone('nutri-1', true, 'sug-1');

      expect(recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nutritionistId: 'nutri-1',
            isSuggested: false,
            name: original.name,
          }),
        })
      );
      expect(resultado).toEqual(clonada);
    });

    it('lança 404 quando receita sugerida não encontrada', async () => {
      recipe.findFirst.mockResolvedValue(null);

      await expect(service.clone('nutri-1', true, 'inexistente')).rejects.toMatchObject({
        status: 404,
        message: expect.stringContaining('sugerida'),
      });
    });

    it('copia apenas os campos de ingrediente (sem id/recipeId)', async () => {
      const original = criarReceitaSugeridaBase({
        ingredients: [
          { id: 'ing-1', recipeId: 'sug-1', name: 'Ovo', quantity: '2', unit: 'unidade' },
        ],
      });
      recipe.findFirst.mockResolvedValue(original);
      recipe.create.mockResolvedValue(criarReceitaBase());

      await service.clone('nutri-1', true, 'sug-1');

      const createCall = recipe.create.mock.calls[0][0];
      const ingredientsCreated = createCall.data.ingredients.create;
      expect(ingredientsCreated[0]).toEqual({ name: 'Ovo', quantity: '2', unit: 'unidade' });
      expect(ingredientsCreated[0]).not.toHaveProperty('id');
      expect(ingredientsCreated[0]).not.toHaveProperty('recipeId');
    });
  });

  // ── listMealPlanRecipes ──────────────────────────────────────────────────────

  describe('listMealPlanRecipes()', () => {
    it('retorna vínculos do plano em ordem de refeição e posição', async () => {
      const plano = criarPlanoBase();
      const links = [{ id: 'link-1', meal: 'almoco', position: 0, recipe: criarReceitaBase() }];
      mealPlan.findFirst.mockResolvedValue(plano);
      mealPlanRecipe.findMany.mockResolvedValue(links);

      const resultado = await service.listMealPlanRecipes('nutri-1', 'plan-1');

      expect(mealPlanRecipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ meal: 'asc' }, { position: 'asc' }],
        })
      );
      expect(resultado).toEqual(links);
    });

    it('lança 404 quando plano não pertence ao nutricionista', async () => {
      mealPlan.findFirst.mockResolvedValue(null);

      await expect(service.listMealPlanRecipes('nutri-1', 'plan-outro')).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  // ── linkRecipe ───────────────────────────────────────────────────────────────

  describe('linkRecipe()', () => {
    it('vincula receita a refeição do plano', async () => {
      const plano = criarPlanoBase();
      const receita = criarReceitaBase();
      const link = { id: 'link-1', mealPlanId: 'plan-1', recipeId: 'rec-1', meal: 'cafe', position: 0, recipe: receita };
      mealPlan.findFirst.mockResolvedValue(plano);
      recipe.findFirst.mockResolvedValue(receita);
      mealPlanRecipe.create.mockResolvedValue(link);

      const resultado = await service.linkRecipe('nutri-1', 'plan-1', {
        recipeId: 'rec-1',
        meal: 'cafe',
      }, true);

      expect(mealPlanRecipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mealPlanId: 'plan-1',
            recipeId: 'rec-1',
            meal: 'cafe',
          }),
        })
      );
      expect(resultado).toEqual(link);
    });

    it('usa position 0 como padrão quando não fornecido', async () => {
      mealPlan.findFirst.mockResolvedValue(criarPlanoBase());
      recipe.findFirst.mockResolvedValue(criarReceitaBase());
      mealPlanRecipe.create.mockResolvedValue({});

      await service.linkRecipe('nutri-1', 'plan-1', { recipeId: 'rec-1', meal: 'cafe' }, true);

      expect(mealPlanRecipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ position: 0 }),
        })
      );
    });

    it('lança 404 quando plano não existe ou não pertence ao nutricionista', async () => {
      mealPlan.findFirst.mockResolvedValue(null);

      await expect(
        service.linkRecipe('nutri-1', 'plan-outro', { recipeId: 'rec-1', meal: 'cafe' }, true)
      ).rejects.toMatchObject({ status: 404 });
    });

    it('lança 404 quando receita não existe', async () => {
      mealPlan.findFirst.mockResolvedValue(criarPlanoBase());
      recipe.findFirst.mockResolvedValue(null);

      await expect(
        service.linkRecipe('nutri-1', 'plan-1', { recipeId: 'inexistente', meal: 'cafe' }, true)
      ).rejects.toMatchObject({ status: 404 });
    });

    it('lança 403 quando free tenta vincular receita sugerida', async () => {
      mealPlan.findFirst.mockResolvedValue(criarPlanoBase());
      recipe.findFirst.mockResolvedValue({ ...criarReceitaSugeridaBase(), isSuggested: true });

      await expect(
        service.linkRecipe('nutri-1', 'plan-1', { recipeId: 'sug-1', meal: 'cafe' }, false)
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  // ── unlinkRecipe ─────────────────────────────────────────────────────────────

  describe('unlinkRecipe()', () => {
    it('remove vínculo existente', async () => {
      mealPlan.findFirst.mockResolvedValue(criarPlanoBase());
      mealPlanRecipe.findFirst.mockResolvedValue({ id: 'link-1', mealPlanId: 'plan-1' });
      mealPlanRecipe.delete.mockResolvedValue({});

      await service.unlinkRecipe('nutri-1', 'plan-1', 'link-1');

      expect(mealPlanRecipe.delete).toHaveBeenCalledWith({ where: { id: 'link-1' } });
    });

    it('lança 404 quando plano não pertence ao nutricionista', async () => {
      mealPlan.findFirst.mockResolvedValue(null);

      await expect(service.unlinkRecipe('nutri-1', 'plan-outro', 'link-1')).rejects.toMatchObject({
        status: 404,
      });
    });

    it('lança 404 quando vínculo não existe no plano', async () => {
      mealPlan.findFirst.mockResolvedValue(criarPlanoBase());
      mealPlanRecipe.findFirst.mockResolvedValue(null);

      await expect(service.unlinkRecipe('nutri-1', 'plan-1', 'link-inexistente')).rejects.toMatchObject({
        status: 404,
        message: expect.stringContaining('Vínculo'),
      });

      expect(mealPlanRecipe.delete).not.toHaveBeenCalled();
    });
  });
});
