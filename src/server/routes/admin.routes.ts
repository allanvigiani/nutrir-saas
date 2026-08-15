/**
 * Rotas do painel administrativo — requer role=admin.
 */
import { z } from 'zod';
import type { BaseRouteDeps } from '../types.ts';
import { withAdminRLS, getDb } from '../lib/rls-context.ts'; // getDb usado nos handlers de patients e patch
import { validateBody, validateQuery } from '../lib/validate.ts';
import { createRetentionService } from '../services/retention.service.ts';
import { createAdminService } from '../services/admin.service.ts';
import { createAdminStatsService } from '../services/admin-stats.service.ts';
import { createAdminClinicalViewService } from '../services/admin-clinical-view.service.ts';

function assertAdmin(req: any, res: any): boolean {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Acesso negado.' });
    return false;
  }
  return true;
}

// Allowlist explícita dos campos editáveis na tela admin de detalhe do nutricionista.
// email/id/role/cpf/cnpj nunca aparecem aqui de propósito — schema Zod descarta
// qualquer chave não declarada, então isso também é a defesa contra mass assignment.
// Limites de tamanho calibrados no maior valor real já armazenado (name=31, crn=10,
// phone=15 chars hoje), com margem — mesmo padrão de patients.routes.ts.
const nutritionistProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    crn: z.string().trim().max(20).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    plan: z.enum(['free', 'premium']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nenhum campo para atualizar.' });

// Range de data livre usado pelos gráficos de série temporal (1–5). Limitado a 24 meses
// para evitar queries sem limite superior.
const MAX_STATS_RANGE_MONTHS = 24;

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
}

const statsDateRangeSchema = z
  .object({
    from: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Data inicial inválida.' }),
    to: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Data final inválida.' }),
  })
  .refine((data) => new Date(data.from) <= new Date(data.to), {
    message: 'Data inicial deve ser anterior ou igual à data final.',
    path: ['from'],
  })
  .refine((data) => monthsBetween(new Date(data.from), new Date(data.to)) <= MAX_STATS_RANGE_MONTHS, {
    message: `Intervalo máximo de ${MAX_STATS_RANGE_MONTHS} meses.`,
    path: ['to'],
  });

const patientsPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export function registerAdminRoutes(deps: BaseRouteDeps) {
  const adminService = createAdminService();
  const adminStatsService = createAdminStatsService();
  const adminClinicalViewService = createAdminClinicalViewService();

  // Lista todos os nutricionistas (paginado)
  deps.app.get('/api/admin/nutritionists', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const filter = ['atLimit', 'churnRisk'].includes(req.query.filter as string)
        ? (req.query.filter as 'atLimit' | 'churnRisk')
        : undefined;
      await withAdminRLS(async () => {
        res.json(await adminService.listNutritionists({ page, limit, filter }));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Conta total de pacientes
  deps.app.get('/api/admin/patients/count', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        const count = await getDb().patient.count();
        res.json({ count });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Busca um nutricionista específico por id — usado pela tela de detalhe admin em
  // acesso direto por URL/refresh, sem depender de location.state nem de paginar a
  // lista inteira (limit alto) no cliente pra filtrar localmente.
  deps.app.get('/api/admin/nutritionists/:id', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const { id } = req.params;
    try {
      await withAdminRLS(async () => {
        const nutritionist = await adminService.getNutritionistById(id);
        if (!nutritionist) {
          return res.status(404).json({ error: 'Nutricionista não encontrado.' });
        }
        res.json(nutritionist);
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Retorna stats ricas do painel admin
  deps.app.get('/api/admin/stats', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        res.json(await adminService.getStats());
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Retorna stats expandidas com métricas mensais de negócio
  deps.app.get('/api/admin/stats/expanded', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        res.json(await adminService.getExpandedStats());
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Atualiza cadastro de um nutricionista (nome, CRN, telefone, plano). Role/email/cpf/cnpj/id
  // nunca são aceitos — allowlist garantida pelo schema Zod (mass assignment fechado).
  deps.app.patch('/api/admin/nutritionists/:id', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const body = validateBody(nutritionistProfileUpdateSchema, req, res);
    if (!body) return;

    const { id } = req.params;
    try {
      await withAdminRLS(async () => {
        const result = await adminService.updateNutritionistProfile(id, body);
        if (!result) {
          return res.status(404).json({ error: 'Nutricionista não encontrado.' });
        }

        // Aguarda todas as escritas de audit log antes de responder — em ambiente
        // serverless (Vercel), o congelamento do contexto de execução logo após o
        // res.json() pode cortar uma escrita fire-and-forget em andamento. O .catch
        // evita que uma falha só do log (a atualização do cadastro já foi commitada)
        // vire um 500 pro admin, mesmo assim.
        await Promise.all(
          result.changes.map((change) => {
            // Mantém a action 'set_plan' para o campo plan (compatibilidade com o log já
            // existente); demais campos usam 'update_profile:<campo>'.
            const action = change.field === 'plan' ? 'set_plan' : `update_profile:${change.field}`;
            return adminService.logAudit({
              adminId: req.user.uid,
              adminEmail: req.user.email || '',
              action,
              targetId: id,
              targetEmail: result.email,
              previousValue: change.previousValue,
              newValue: change.newValue,
            });
          })
        ).catch(() => {});

        res.json(result.nutritionist);
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Remove permanentemente pacientes com soft delete há mais de 30 dias (LGPD)
  const retentionService = createRetentionService();

  deps.app.post('/api/admin/retention-cleanup', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        const result = await retentionService.cleanupSoftDeleted(30);

        adminService.logAudit({
          adminId: req.user.uid,
          adminEmail: req.user.email || '',
          action: 'retention_cleanup',
          newValue: `${result.deletedCount} pacientes removidos`,
        }).catch(() => {});

        res.json({ message: `${result.deletedCount} pacientes removidos permanentemente.`, ...result });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Retorna logs de auditoria das ações admin
  deps.app.get('/api/admin/audit-logs', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        res.json(await adminService.getAuditLogs(50));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Conta pacientes pendentes de remoção permanente (LGPD)
  deps.app.get('/api/admin/retention/pending', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        const count = await retentionService.countPendingDeletion(30);
        res.json({ count });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Retorna dados operacionais: incomplete profiles, sem pacientes, planos manuais
  deps.app.get('/api/admin/operational', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        res.json(await adminService.getOperationalData());
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------------
  // Gráficos de negócio (somente leitura) — série temporal 1–5 com date range livre,
  // distribuição de planos (6) sem período.
  // ---------------------------------------------------------------------------------

  deps.app.get('/api/admin/stats/revenue', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const query = validateQuery(statsDateRangeSchema, req, res);
    if (!query) return;
    try {
      await withAdminRLS(async () => {
        const data = await adminStatsService.getRevenueByMonth(new Date(query.from), new Date(query.to));
        res.json({ data });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.get('/api/admin/stats/patients-growth', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const query = validateQuery(statsDateRangeSchema, req, res);
    if (!query) return;
    try {
      await withAdminRLS(async () => {
        const data = await adminStatsService.getPatientsGrowthByMonth(new Date(query.from), new Date(query.to));
        res.json({ data });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.get('/api/admin/stats/new-subscribers', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const query = validateQuery(statsDateRangeSchema, req, res);
    if (!query) return;
    try {
      await withAdminRLS(async () => {
        const data = await adminStatsService.getNewSubscribersByMonth(new Date(query.from), new Date(query.to));
        res.json({ data });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.get('/api/admin/stats/consultations', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const query = validateQuery(statsDateRangeSchema, req, res);
    if (!query) return;
    try {
      await withAdminRLS(async () => {
        const data = await adminStatsService.getConsultationsByMonth(new Date(query.from), new Date(query.to));
        res.json({ data });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.get('/api/admin/stats/meal-plans', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const query = validateQuery(statsDateRangeSchema, req, res);
    if (!query) return;
    try {
      await withAdminRLS(async () => {
        const data = await adminStatsService.getMealPlansByMonth(new Date(query.from), new Date(query.to));
        res.json({ data });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Sem período — foto do momento (não é série temporal).
  deps.app.get('/api/admin/stats/plan-distribution', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    try {
      await withAdminRLS(async () => {
        res.json(await adminStatsService.getPlanDistribution());
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------------
  // Navegação cross-tenant somente leitura: nutricionista → pacientes → paciente →
  // consultas/planos alimentares. Sem audit log (decisão explícita da spec — só
  // edições de cadastro são logadas). Nenhum verbo de escrita aqui.
  // ---------------------------------------------------------------------------------

  deps.app.get('/api/admin/nutritionists/:id/patients', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const query = validateQuery(patientsPageQuerySchema, req, res);
    if (!query) return;
    const { id } = req.params;
    try {
      await withAdminRLS(async () => {
        const result = await adminClinicalViewService.getNutritionistPatients(id, {
          page: query.page ?? 1,
          limit: query.limit ?? 20,
        });
        res.json(result);
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.get('/api/admin/patients/:id', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const { id } = req.params;
    try {
      await withAdminRLS(async () => {
        const patient = await adminClinicalViewService.getPatientDetail(id);
        if (!patient) {
          return res.status(404).json({ error: 'Paciente não encontrado.' });
        }
        res.json(patient);
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.get('/api/admin/patients/:id/consultations', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const { id } = req.params;
    try {
      await withAdminRLS(async () => {
        const exists = await adminClinicalViewService.patientExists(id);
        if (!exists) {
          return res.status(404).json({ error: 'Paciente não encontrado.' });
        }
        res.json(await adminClinicalViewService.getPatientConsultations(id));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  deps.app.get('/api/admin/patients/:id/meal-plans', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const { id } = req.params;
    try {
      await withAdminRLS(async () => {
        const exists = await adminClinicalViewService.patientExists(id);
        if (!exists) {
          return res.status(404).json({ error: 'Paciente não encontrado.' });
        }
        res.json(await adminClinicalViewService.getPatientMealPlans(id));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Itens (alimentos) de um plano alimentar tipo "blocks" — planos "free" já trazem
  // todo o conteúdo em freeTextContent na resposta de /meal-plans, sem precisar disso.
  deps.app.get('/api/admin/meal-plans/:id/items', deps.authenticate, async (req: any, res: any) => {
    if (!assertAdmin(req, res)) return;
    const { id } = req.params;
    try {
      await withAdminRLS(async () => {
        const exists = await adminClinicalViewService.mealPlanExists(id);
        if (!exists) {
          return res.status(404).json({ error: 'Plano alimentar não encontrado.' });
        }
        res.json(await adminClinicalViewService.getMealPlanItems(id));
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
