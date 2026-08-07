import type { Request, Response } from 'express';
import type { createRecipesService } from '../services/recipes.service.ts';
import { withNutritionistRLS } from '../lib/rls-context.ts';

export function createRecipesController({
  recipesService,
}: {
  recipesService: ReturnType<typeof createRecipesService>;
}) {
  async function list(req: Request, res: Response) {
    try {
      await withNutritionistRLS((req as any).user.uid, async () => {
        const receitas = await recipesService.list(
          (req as any).user.uid,
          (req as any).user.isPremium
        );
        res.json(receitas);
      });
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }

  async function create(req: Request, res: Response) {
    const { name, description, prepMode, ingredients } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nome da receita é obrigatório' });
    }
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Ingredientes são obrigatórios' });
    }
    try {
      await withNutritionistRLS((req as any).user.uid, async () => {
        const receita = await recipesService.create(
          (req as any).user.uid,
          (req as any).user.isPremium,
          { name, description, prepMode, ingredients }
        );
        res.status(201).json(receita);
      });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ error: err.message });
    }
  }

  async function getOne(req: Request, res: Response) {
    try {
      await withNutritionistRLS((req as any).user.uid, async () => {
        const receita = await recipesService.getOne(
          (req as any).user.uid,
          req.params.id,
          (req as any).user.isPremium
        );
        res.json(receita);
      });
    } catch (err: any) {
      res.status(err.status ?? 404).json({ error: err.message });
    }
  }

  async function update(req: Request, res: Response) {
    try {
      await withNutritionistRLS((req as any).user.uid, async () => {
        const receita = await recipesService.update(
          (req as any).user.uid,
          req.params.id,
          req.body
        );
        res.json(receita);
      });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ error: err.message });
    }
  }

  async function remove(req: Request, res: Response) {
    try {
      await withNutritionistRLS((req as any).user.uid, async () => {
        await recipesService.remove((req as any).user.uid, req.params.id);
        res.status(204).send();
      });
    } catch (err: any) {
      res.status(err.status ?? 404).json({ error: err.message });
    }
  }

  async function clone(req: Request, res: Response) {
    try {
      await withNutritionistRLS((req as any).user.uid, async () => {
        const receita = await recipesService.clone(
          (req as any).user.uid,
          (req as any).user.isPremium,
          req.params.id
        );
        res.status(201).json(receita);
      });
    } catch (err: any) {
      res.status(err.status ?? 403).json({ error: err.message });
    }
  }

  async function listMealPlanRecipes(req: Request, res: Response) {
    try {
      await withNutritionistRLS((req as any).user.uid, async () => {
        const links = await recipesService.listMealPlanRecipes(
          (req as any).user.uid,
          req.params.id
        );
        res.json(links);
      });
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  }

  async function linkRecipe(req: Request, res: Response) {
    const { recipeId, meal, position } = req.body;
    if (!recipeId || !meal) {
      return res.status(400).json({ error: 'recipeId e meal são obrigatórios' });
    }
    try {
      await withNutritionistRLS((req as any).user.uid, async () => {
        const link = await recipesService.linkRecipe(
          (req as any).user.uid,
          req.params.id,
          { recipeId, meal, position },
          (req as any).user.isPremium
        );
        res.status(201).json(link);
      });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ error: err.message });
    }
  }

  async function unlinkRecipe(req: Request, res: Response) {
    try {
      await withNutritionistRLS((req as any).user.uid, async () => {
        await recipesService.unlinkRecipe(
          (req as any).user.uid,
          req.params.planId,
          req.params.linkId
        );
        res.status(204).send();
      });
    } catch (err: any) {
      res.status(err.status ?? 403).json({ error: err.message });
    }
  }

  return { list, create, getOne, update, remove, clone, listMealPlanRecipes, linkRecipe, unlinkRecipe };
}
