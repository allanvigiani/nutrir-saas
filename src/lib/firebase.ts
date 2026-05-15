import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, getDocFromServer, doc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported, logEvent as firebaseLogEvent, type Analytics } from 'firebase/analytics';

// Import the Firebase configuration from the root
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize Firestore with experimentalForceLongPolling to improve stability in proxied environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Analytics — inicializado só com consentimento explícito (LGPD)
const CONSENT_KEY = 'nutrir_cookie_consent';
let analyticsInstance: Analytics | null = null;

export async function initAnalytics(): Promise<Analytics | null> {
  if (analyticsInstance) return analyticsInstance;
  if (localStorage.getItem(CONSENT_KEY) !== 'all') return null;
  const supported = await isSupported();
  if (!supported) return null;
  analyticsInstance = getAnalytics(app);
  return analyticsInstance;
}

// Wrapper de logEvent que respeita consentimento
export async function logEvent(eventName: string, params?: Record<string, any>) {
  const analytics = await initAnalytics();
  if (!analytics) return;
  firebaseLogEvent(analytics, eventName, params);
}

// Connection test to diagnose configuration issues
async function testConnection() {
  try {
    // Attempt to fetch a non-existent document from a 'test' collection to verify connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test successful.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firestore connection failed: The client is offline. Please check your Firebase configuration and network.");
    } else {
      // Ignore other errors (like 403) as they might be expected if rules are strict
      console.log("Firestore connection test completed (ignoring non-connectivity errors).");
    }
  }
}

testConnection();
