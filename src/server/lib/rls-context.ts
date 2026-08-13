import { AsyncLocalStorage } from 'async_hooks';
import { timingSafeEqual } from 'node:crypto';
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

// Compara em tempo constante — evita vazar, pelo tempo de resposta, quantos
// caracteres do token estão corretos. Tokens de tamanho diferente nunca batem.
function tokensMatch(provided: string, stored: string): boolean {
  const providedBuf = Buffer.from(provided);
  const storedBuf = Buffer.from(stored);
  if (providedBuf.length !== storedBuf.length) return false;
  return timingSafeEqual(providedBuf, storedBuf);
}

export async function withPortalAuth<T>(
  patientId: string,
  accessToken: string,
  fn: (patient: any) => Promise<T>
): Promise<T> {
  const denied = () => Object.assign(new Error('Acesso negado'), { status: 401 });
  if (!accessToken) throw denied();

  // Busca só por id (nunca por accessToken na query) — a comparação do token
  // acontece em código, em tempo constante, nunca delegada ao operador `=` do SQL.
  const patient: any = await withAdminRLS(() =>
    (getDb() as any).patient.findFirst({ where: { id: patientId } })
  );
  if (!patient || !patient.accessToken || !tokensMatch(accessToken, patient.accessToken)) {
    throw denied();
  }
  return withPatientRLS((patient as any).id, () => fn(patient));
}
