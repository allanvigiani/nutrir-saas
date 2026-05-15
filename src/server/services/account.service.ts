import { logger } from "../logger.ts";
import { createAsaasClient } from "../integrations/asaas.client.ts";

interface AccountServiceDeps {
  admin: any;
  adminDb: any;
  asaasApiUrl: string;
  asaasApiKey: string;
  firestoreProjectId: string;
  firestoreDatabaseId: string;
}

const COLLECTIONS_BY_NUTRITIONIST = [
  'meal_plan_items',
  'meal_plans',
  'consultations',
  'lab_exams',
  'appointments',
  'payments',
  'nutrition_calculations',
  'custom_foods',
  'patients',
];

export function createAccountService({
  admin,
  adminDb,
  asaasApiUrl,
  asaasApiKey,
  firestoreProjectId,
  firestoreDatabaseId,
}: AccountServiceDeps) {
  const asaasClient = createAsaasClient({ asaasApiUrl, asaasApiKey });

  // Base URL da REST API do Firestore — usa HTTPS, sem gRPC
  const fsBase = `https://firestore.googleapis.com/v1/projects/${firestoreProjectId}/databases/${firestoreDatabaseId}/documents`;

  async function fsGet(path: string, idToken: string): Promise<any> {
    const res = await fetch(`${fsBase}/${path}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore GET ${path} → ${res.status}`);
    return res.json();
  }

  async function fsQuery(
    collectionId: string,
    field: string,
    value: string,
    idToken: string,
  ): Promise<string[]> {
    const res = await fetch(`${fsBase}:runQuery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath: field },
              op: 'EQUAL',
              value: { stringValue: value },
            },
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`Firestore query ${collectionId} → ${res.status}`);
    const rows: any[] = await res.json();
    return rows.filter(r => r.document).map(r => r.document.name as string);
  }

  async function fsBatchDelete(docNames: string[], idToken: string): Promise<void> {
    if (docNames.length === 0) return;
    // batchWrite aceita até 500 por requisição
    for (let i = 0; i < docNames.length; i += 500) {
      const writes = docNames.slice(i, i + 500).map(name => ({ delete: name }));
      const res = await fetch(`${fsBase}:batchWrite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`Firestore batchWrite → ${res.status}: ${JSON.stringify(body)}`);
      }
    }
  }

  async function cancelAsaasSubscription(uid: string, idToken: string): Promise<void> {
    const doc = await fsGet(`nutritionists/${uid}`, idToken);
    const fields = doc?.fields;
    const subscriptionId = fields?.subscriptionId?.stringValue;
    const plan = fields?.plan?.stringValue;

    if (!subscriptionId || plan !== 'premium') return;

    logger.info('Cancelando assinatura Asaas antes de excluir conta', { uid, subscriptionId });
    try {
      await asaasClient.request(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
      logger.info('Assinatura Asaas cancelada com sucesso', { uid, subscriptionId });
    } catch (err: any) {
      logger.error('Falha ao cancelar assinatura Asaas', { uid, err: err.message });
      throw new Error(
        'Não foi possível cancelar sua assinatura premium. ' +
        'Tente novamente ou contate suporte@nutrir.app antes de excluir a conta.'
      );
    }
  }

  async function deleteAccount(
    uid: string,
    idToken: string,
  ): Promise<{ deleted: Record<string, number> }> {
    logger.info('Iniciando exclusão de conta em cascata (LGPD)', { uid });

    // 1. Cancelar assinatura Asaas se premium
    await cancelAsaasSubscription(uid, idToken);

    // 2. Deletar dados em cascata via REST API (satisfaz regras do Firestore com o token do usuário)
    const deleted: Record<string, number> = {};
    for (const col of COLLECTIONS_BY_NUTRITIONIST) {
      const docNames = await fsQuery(col, 'nutritionist_id', uid, idToken);
      await fsBatchDelete(docNames, idToken);
      deleted[col] = docNames.length;
      logger.info('Coleção deletada', { collection: col, count: deleted[col], uid });
    }

    // 3. Deletar documento do nutricionista via Admin SDK (ignora regras do Firestore)
    await adminDb.collection('nutritionists').doc(uid).delete();
    deleted['nutritionists'] = 1;
    logger.info('Documento do nutricionista deletado', { uid });

    // 4. Deletar usuário do Firebase Auth (Admin SDK Auth — não usa Firestore)
    await admin.auth().deleteUser(uid);
    logger.info('Conta excluída com sucesso (LGPD Art. 18)', { uid, deleted });

    return { deleted };
  }

  return { deleteAccount };
}
