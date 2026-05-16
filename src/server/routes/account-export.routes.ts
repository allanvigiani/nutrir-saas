import type { BaseRouteDeps } from '../types.ts';
import { createAccountExportService } from '../services/account-export.service.ts';

export function registerAccountExportRoutes(deps: BaseRouteDeps) {
  const service = createAccountExportService();

  deps.app.get('/api/account/export', deps.authenticate, async (req: any, res: any) => {
    try {
      const data = await service.exportData(req.user.uid);
      const json = JSON.stringify(data, null, 2);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="meus-dados-nutrir.json"');
      return res.send(json);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
