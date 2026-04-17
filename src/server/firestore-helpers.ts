import admin from "firebase-admin";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore as getClientFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

function isPermissionDeniedError(err: any) {
  if (!err) return false;
  const message = (err.message || String(err)).toUpperCase();
  const code = err.code;
  return (
    message.includes("PERMISSION_DENIED") ||
    message.includes("INSUFFICIENT PERMISSIONS") ||
    code === 7 ||
    code === "permission-denied"
  );
}

export function createFirestoreHelpers(firebaseConfig: any) {
  if (!admin.apps.length) {
    admin.initializeApp({
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
        console.warn(
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
        console.warn(
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
        console.warn(`[Firestore] Admin SDK PERMISSION_DENIED on query ${collectionName}, trying Client SDK...`);
        const q = query(collection(clientDb, collectionName), where(field, operator, value));
        const snapshot = await getDocs(q);
        return snapshot;
      }
      throw err;
    }
  }

  return {
    admin,
    adminDb,
    clientDb,
    getDocWithFallback,
    updateDocWithFallback,
    queryWithFallback,
  };
}
