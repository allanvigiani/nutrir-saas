import type { BaseRouteDeps } from '../types.ts';
import { createRecipesService } from '../services/recipes.service.ts';
import { createRecipesController } from '../controllers/recipes.controller.ts';

export function registerRecipesRoutes(deps: BaseRouteDeps) {
  const recipesService = createRecipesService();
  const ctrl = createRecipesController({ recipesService });

  deps.app.get('/api/recipes', deps.authenticate, ctrl.list);
  deps.app.post('/api/recipes', deps.authenticate, ctrl.create);
  deps.app.get('/api/recipes/:id', deps.authenticate, ctrl.getOne);
  deps.app.put('/api/recipes/:id', deps.authenticate, ctrl.update);
  deps.app.delete('/api/recipes/:id', deps.authenticate, ctrl.remove);
  deps.app.post('/api/recipes/:id/clone', deps.authenticate, ctrl.clone);

  deps.app.get('/api/meal-plans/:id/recipes', deps.authenticate, ctrl.listMealPlanRecipes);
  deps.app.post('/api/meal-plans/:id/recipes', deps.authenticate, ctrl.linkRecipe);
  deps.app.delete('/api/meal-plans/:planId/recipes/:linkId', deps.authenticate, ctrl.unlinkRecipe);
}
