import type { BaseRouteDeps } from '../types.ts';
import { createMealPlansService } from '../services/meal-plans.service.ts';
import { prisma } from '../lib/prisma.ts';

export function registerMealPlansRoutes(deps: BaseRouteDeps) {
  const service = createMealPlansService({ prisma });

  deps.app.get('/api/patients/:patientId/meal-plans', deps.authenticate, async (req: any, res: any) => {
    return res.json(await service.list(req.user.uid, req.params.patientId));
  });

  deps.app.get('/api/meal-plans/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      return res.json(await service.getOne(req.user.uid, req.params.id));
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  });

  deps.app.post('/api/patients/:patientId/meal-plans', deps.authenticate, async (req: any, res: any) => {
    try {
      return res.status(201).json(await service.create(req.user.uid, req.params.patientId, req.body));
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/meal-plans/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      return res.json(await service.update(req.user.uid, req.params.id, req.body));
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/meal-plans/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await service.remove(req.user.uid, req.params.id);
      return res.status(204).send();
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  // Items
  deps.app.get('/api/meal-plans/:mealPlanId/items', deps.authenticate, async (req: any, res: any) => {
    try {
      return res.json(await service.listItems(req.user.uid, req.params.mealPlanId));
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.post('/api/meal-plans/:mealPlanId/items', deps.authenticate, async (req: any, res: any) => {
    try {
      return res.status(201).json(await service.createItem(req.user.uid, req.params.mealPlanId, req.body));
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  deps.app.patch('/api/meal-plan-items/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      return res.json(await service.updateItem(req.user.uid, req.params.id, req.body));
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  deps.app.delete('/api/meal-plan-items/:id', deps.authenticate, async (req: any, res: any) => {
    try {
      await service.removeItem(req.user.uid, req.params.id);
      return res.status(204).send();
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  // Replace all items of a meal plan atomically
  deps.app.put('/api/meal-plans/:id/items', deps.authenticate, async (req: any, res: any) => {
    try {
      const items = Array.isArray(req.body) ? req.body : [];
      return res.json(await service.replaceItems(req.user.uid, req.params.id, items));
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });
}
