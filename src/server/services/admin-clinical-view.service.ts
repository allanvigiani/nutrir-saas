import { getDb } from '../lib/rls-context.ts';

/**
 * Leitura cross-tenant para suporte administrativo (nutricionista → pacientes → paciente
 * → consultas/planos alimentares). Somente leitura — nenhuma função aqui escreve no banco.
 * Sempre chamado dentro de withAdminRLS (bypass=true), então não precisa checar
 * nutritionistId do caller: a posse já foi resolvida pelo próprio registro buscado.
 */
export function createAdminClinicalViewService() {
  async function getNutritionistPatients(
    nutritionistId: string,
    { page = 1, limit = 20 }: { page?: number; limit?: number }
  ) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      getDb().patient.findMany({
        where: { nutritionistId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      getDb().patient.count({ where: { nutritionistId, deletedAt: null } }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async function getPatientDetail(patientId: string) {
    return getDb().patient.findFirst({
      where: { id: patientId, deletedAt: null },
      include: {
        nutritionist: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // Checagem leve de existência (sem o join com nutricionista do detail completo) —
  // usada pelos endpoints de consultas/planos alimentares só para decidir 404, sem
  // pagar o custo de buscar/serializar o paciente inteiro de novo.
  async function patientExists(patientId: string): Promise<boolean> {
    const found = await getDb().patient.findFirst({
      where: { id: patientId, deletedAt: null },
      select: { id: true },
    });
    return !!found;
  }

  async function getPatientConsultations(patientId: string) {
    return getDb().consultation.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { date: 'desc' },
    });
  }

  async function getPatientMealPlans(patientId: string) {
    return getDb().mealPlan.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  return {
    getNutritionistPatients,
    getPatientDetail,
    patientExists,
    getPatientConsultations,
    getPatientMealPlans,
  };
}
