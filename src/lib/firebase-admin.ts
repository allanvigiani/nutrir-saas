import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

const app = admin.app();
export const db = admin.firestore(app);
db.settings({ databaseId: (firebaseConfig as any).firestoreDatabaseId });
export const auth = admin.auth(app);
