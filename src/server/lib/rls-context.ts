import { AsyncLocalStorage } from 'async_hooks';
import { PrismaClient } from '@prisma/client';
import { prisma } from './prisma.ts';

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

const txStorage = new AsyncLocalStorage<TxClient>();

export function getDb(): PrismaClient | TxClient {
  return txStorage.getStore() ?? prisma;
}

async function applyConfig(tx: any, opts: {
  nutritionistId?: string;
  patientId?: string;
  bypass?: boolean;
}): Promise<void> {
  if (typeof tx.$executeRaw !== 'function') return;
  // is_local=true equivale a SET LOCAL — configuração válida apenas na transação atual
  await tx.$executeRaw`
    SELECT
      set_config('app.current_nutritionist_id', ${opts.nutritionistId ?? ''}, true),
      set_config('app.current_patient_id',      ${opts.patientId ?? ''},      true),
      set_config('app.rls_bypass',              ${opts.bypass ? 'true' : ''}, true)
  `;
}

export async function withNutritionistRLS<T>(
  nutritionistId: string,
  fn: () => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await applyConfig(tx, { nutritionistId });
    return txStorage.run(tx as TxClient, fn);
  });
}

export async function withPatientRLS<T>(
  patientId: string,
  fn: () => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await applyConfig(tx, { patientId });
    return txStorage.run(tx as TxClient, fn);
  });
}

export async function withAdminRLS<T>(fn: () => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await applyConfig(tx, { bypass: true });
    return txStorage.run(tx as TxClient, fn);
  });
}

export async function withPortalAuth<T>(
  patientId: string,
  accessToken: string,
  fn: (patient: any) => Promise<T>
): Promise<T> {
  const patient = await withAdminRLS(() =>
    (getDb() as any).patient.findFirst({
      where: { id: patientId, accessToken },
    })
  );
  if (!patient) throw Object.assign(new Error('Acesso negado'), { status: 401 });
  return withPatientRLS((patient as any).id, () => fn(patient));
}
