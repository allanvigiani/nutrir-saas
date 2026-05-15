import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported, logEvent as firebaseLogEvent, type Analytics } from 'firebase/analytics';

// Import the Firebase configuration from the root
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

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


