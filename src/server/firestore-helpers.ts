import admin from "firebase-admin";
import { logger } from "./logger.ts";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp, deleteApp } from "firebase/app";
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  getFirestore as getClientFirestore,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getAuth, signInWithCustomToken } from "firebase/auth";

function isPermissionDeniedError(err: any) {
  if (!err) return false;
  const message = (err.message || String(err)).toUpperCase();
  const code = err.code;
  return (
    message.includes("PERMISSION_DENIED") ||
    message.includes("INSUFFICIENT PERMISSIONS") ||
    message.includes("DEFAULT CREDENTIALS") ||  // Admin SDK sem credenciais ADC
    message.includes("COULD NOT LOAD") ||
    code === 7 ||
    code === "permission-denied"
  );
}

export function createFirestoreHelpers(firebaseConfig: any) {
  if (!admin.apps.length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      throw new Error(
        'Variável de ambiente FIREBASE_SERVICE_ACCOUNT não definida. ' +
        'Cole o conteúdo do JSON do service account nessa variável.'
      );
    }
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: firebaseConfig.projectId,
    });
  }

  const adminDb = getAdminFirestore(admin.app(), (firebaseConfig as any).firestoreDatabaseId);
  const clientApp = initializeClientApp(firebaseConfig);
  const clientDb = getClientFirestore(clientApp, (firebaseConfig as any).firestoreDatabaseId);

  async function getDocWithFallback(collectionName: string, docId: string) {
    try {
      const adminDoc = await adminDb.collection(collectionName).doc(docId).get();
      if (adminDoc.exists) return { data: adminDoc.data(), id: adminDoc.id, ref: adminDoc.ref, exists: true };
      return { exists: false };
    } catch (err: any) {
      if (isPermissionDeniedError(err)) {
        logger.warn(
          `[Firestore] Admin SDK PERMISSION_DENIED on read ${collectionName}/${docId}, trying Client SDK...`,
        );
        const clientDoc = await getDoc(doc(clientDb, collectionName, docId));
        if (clientDoc.exists()) return { data: clientDoc.data(), id: clientDoc.id, ref: clientDoc.ref, exists: true };
        return { exists: false };
      }
      throw err;
    }
  }

  async function updateDocWithFallback(collectionName: string, docId: string, data: any) {
    try {
      await adminDb.collection(collectionName).doc(docId).update(data);
    } catch (err: any) {
      if (isPermissionDeniedError(err)) {
        logger.warn(
          `[Firestore] Admin SDK PERMISSION_DENIED on update ${collectionName}/${docId}, trying Client SDK...`,
        );
        await updateDoc(doc(clientDb, collectionName, docId), data);
      } else {
        throw err;
      }
    }
  }

  async function queryWithFallback(collectionName: string, field: string, operator: any, value: any) {
    try {
      const snapshot = await adminDb.collection(collectionName).where(field, operator, value).get();
      return snapshot;
    } catch (err: any) {
      if (isPermissionDeniedError(err)) {
        logger.warn(`[Firestore] Admin SDK PERMISSION_DENIED on query ${collectionName}, trying Client SDK...`);
        const q = query(collection(clientDb, collectionName), where(field, operator, value));
        const snapshot = await getDocs(q);
        return snapshot;
      }
      throw err;
    }
  }

  // Cria uma instância temporária autenticada como o usuário — necessário quando
  // Admin SDK não tem service account e Client SDK não tem auth do usuário.
  async function createAuthenticatedSession(uid: string): Promise<{
    db: any;
    cleanup: () => Promise<void>;
  }> {
    const customToken = await admin.auth().createCustomToken(uid);
    const tempApp = initializeClientApp(
      firebaseConfig,
      `nutrir-temp-${uid}-${Date.now()}`
    );
    const tempAuth = getAuth(tempApp);
    await signInWithCustomToken(tempAuth, customToken);
    const tempDb = getClientFirestore(tempApp, (firebaseConfig as any).firestoreDatabaseId);
    return {
      db: tempDb,
      cleanup: async () => {
        try { await tempAuth.signOut(); } catch {}
        try { await deleteApp(tempApp); } catch {}
      },
    };
  }

  async function deleteDocWithFallback(collectionName: string, docId: string) {
    try {
      await adminDb.collection(collectionName).doc(docId).delete();
    } catch (err: any) {
      if (isPermissionDeniedError(err)) {
        logger.warn(`[Firestore] Admin SDK fallback on delete ${collectionName}/${docId}`);
        await deleteDoc(doc(clientDb, collectionName, docId));
      } else {
        throw err;
      }
    }
  }

  // Deleta todos os docs de uma coleção onde field == value, em batches de 500
  async function deleteBatchWithFallback(
    collectionName: string,
    field: string,
    value: any,
  ): Promise<number> {
    const snap = await queryWithFallback(collectionName, field, '==', value);
    const docs = (snap?.docs ?? []) as any[];
    if (docs.length === 0) return 0;

    const chunks: any[][] = [];
    for (let i = 0; i < docs.length; i += 500) {
      chunks.push(docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      try {
        // Tenta Admin SDK batch
        const batch = adminDb.batch();
        chunk.forEach((d: any) => batch.delete(d.ref));
        await batch.commit();
      } catch (err: any) {
        if (isPermissionDeniedError(err)) {
          // Fallback: Client SDK writeBatch
          logger.warn(`[Firestore] Admin SDK batch fallback on delete ${collectionName}`);
          const clientBatch = writeBatch(clientDb);
          chunk.forEach((d: any) => {
            const ref = doc(clientDb, collectionName, d.id);
            clientBatch.delete(ref);
          });
          await clientBatch.commit();
        } else {
          throw err;
        }
      }
    }

    return docs.length;
  }

  return {
    admin,
    adminDb,
    clientDb,
    getDocWithFallback,
    updateDocWithFallback,
    queryWithFallback,
    deleteDocWithFallback,
    deleteBatchWithFallback,
    createAuthenticatedSession,
  };
}
