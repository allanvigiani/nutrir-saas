import { getDb } from '../lib/rls-context.ts';
import { FREE_PLAN_LIMITS } from '../../lib/planLimits.ts';

// Campos que nunca podem vir do body do cliente: accessToken é a credencial que autoriza o
// portal do paciente (deve ser sempre gerada no servidor, nunca escolhida pelo cliente);
// id/nutritionistId/deletedAt/createdAt/updatedAt controlam identidade e posse do registro.
const PROTECTED_PATIENT_FIELDS = ['id', 'nutritionistId', 'accessToken', 'deletedAt', 'createdAt', 'updatedAt'] as const;

function stripProtectedFields(data: Record<string, unknown>): Record<string, unknown> {
  const clean = { ...data };
  for (const field of PROTECTED_PATIENT_FIELDS) delete clean[field];
  return clean;
}

export function createPatientsService() {
  async function list(nutritionistId: string, gracePeriodOver: boolean) {
    const patients = await getDb().patient.findMany({
      where: { nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!gracePeriodOver) return patients;

    return patients.map((p, index) => ({
      ...p,
      isReadOnly: index >= FREE_PLAN_LIMITS.maxPatients,
    }));
  }

  async function getOne(nutritionistId: string, id: string) {
    const patient = await getDb().patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!patient) throw new Error('Paciente não encontrado');
    return patient;
  }

  async function isPatientReadOnly(nutritionistId: string, patientId: string, gracePeriodOver: boolean): Promise<boolean> {
    if (!gracePeriodOver) return false;
    const activePatients = await getDb().patient.findMany({
      where: { nutritionistId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
      take: FREE_PLAN_LIMITS.maxPatients,
    });
    return !activePatients.some(p => p.id === patientId);
  }

  async function create(nutritionistId: string, data: Record<string, unknown>, isPremium: boolean) {
    if (!isPremium) {
      const count = await getDb().patient.count({
        where: { nutritionistId, deletedAt: null },
      });
      if (count >= FREE_PLAN_LIMITS.maxPatients) {
        throw new Error(`Limite de ${FREE_PLAN_LIMITS.maxPatients} pacientes atingido no plano gratuito.`);
      }
    }
    return getDb().patient.create({ data: { ...stripProtectedFields(data), nutritionistId } as any });
  }

  async function update(nutritionistId: string, id: string, data: Record<string, unknown>, _isPremium: boolean) {
    const existing = await getDb().patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().patient.update({ where: { id }, data: stripProtectedFields(data) as any });
  }

  async function remove(nutritionistId: string, id: string) {
    const existing = await getDb().patient.findFirst({ where: { id, nutritionistId, deletedAt: null } });
    if (!existing) throw new Error('Não autorizado');
    return getDb().patient.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  return { list, getOne, create, update, remove, isPatientReadOnly };
}
