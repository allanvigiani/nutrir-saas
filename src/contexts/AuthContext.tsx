import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, getDocFromServer } from 'firebase/firestore';
import { Nutritionist } from '../types';

const SESSION_KEY = 'nutrir_session_start';
const SESSION_MAX_MS = 3 * 24 * 60 * 60 * 1000;  // 3 dias
const SESSION_CHECK_INTERVAL_MS = 30 * 60 * 1000; // verifica a cada 30 min
const INACTIVITY_MAX_MS = 2 * 60 * 60 * 1000;     // 2 horas sem atividade

let lastActivityAt = Date.now();

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

// Atualiza apenas o timestamp — não fecha o modal, isso é responsabilidade dos botões
function resetActivity() {
  lastActivityAt = Date.now();
}

function isInactive(): boolean {
  return Date.now() - lastActivityAt > INACTIVITY_MAX_MS;
}

export function recordSessionStart() {
  localStorage.setItem(SESSION_KEY, Date.now().toString());
}

function isSessionExpired(): boolean {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return true;
  return Date.now() - parseInt(raw, 10) > SESSION_MAX_MS;
}

async function forceSignOut() {
  localStorage.removeItem(SESSION_KEY);
  await signOut(auth);
}

interface AuthContextType {
  user: User | null;
  nutritionist: Nutritionist | null;
  loading: boolean;
  isAuthReady: boolean;
  showInactivityWarning: boolean;
  dismissInactivityWarning: () => void;
  confirmSignOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  nutritionist: null,
  loading: true,
  isAuthReady: false,
  showInactivityWarning: false,
  dismissInactivityWarning: () => {},
  confirmSignOut: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [nutritionist, setNutritionist] = useState<Nutritionist | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);

  function dismissInactivityWarning() {
    setShowInactivityWarning(false);
    resetActivity();
  }

  function confirmSignOut() {
    setShowInactivityWarning(false);
    forceSignOut();
  }

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, '_connection_test_', 'ping'));
      } catch (error: any) {
        if (error.message?.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    testConnection();

    let unsubNutritionist: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubNutritionist) {
        unsubNutritionist();
        unsubNutritionist = null;
      }

      if (firebaseUser && isSessionExpired()) {
        await forceSignOut();
        setUser(null);
        setNutritionist(null);
        setLoading(false);
        setIsAuthReady(true);
        return;
      }

      setUser(firebaseUser);

      if (firebaseUser) {
        unsubNutritionist = onSnapshot(doc(db, 'nutritionists', firebaseUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as Nutritionist;
            setNutritionist({ id: docSnap.id, ...data } as Nutritionist);

            const lastCheck = (data as any).lastSubscriptionCheck;
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

            if (!lastCheck || lastCheck < oneHourAgo) {
              firebaseUser.getIdToken().then(token => {
                fetch('/api/verify-subscription', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ email: firebaseUser.email }),
                })
                .then(res => res.json())
                .then(async (asaasData) => {
                  const planChanged = asaasData.plan && asaasData.plan !== data.plan;
                  const cancelStatusChanged = asaasData.cancelAtPeriodEnd !== undefined && asaasData.cancelAtPeriodEnd !== data.cancelAtPeriodEnd;

                  if (planChanged || cancelStatusChanged) {
                    await updateDoc(doc(db, 'nutritionists', firebaseUser.uid), {
                      plan: asaasData.plan || 'free',
                      subscriptionId: asaasData.subscriptionId || null,
                      subscriptionStatus: asaasData.subscriptionStatus || null,
                      cancelAtPeriodEnd: asaasData.cancelAtPeriodEnd || false,
                      currentPeriodEnd: asaasData.currentPeriodEnd || null,
                      lastSubscriptionCheck: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    });
                  } else {
                    await updateDoc(doc(db, 'nutritionists', firebaseUser.uid), {
                      lastSubscriptionCheck: new Date().toISOString()
                    });
                  }
                })
                .catch(err => console.error("Error in proactive subscription check:", err));
              }).catch(err => console.error("Error getting token for subscription check:", err));
            }
          } else {
            setNutritionist(null);
          }

          setLoading(false);
          setIsAuthReady(true);
        }, (error) => {
          console.error("Error fetching nutritionist data:", error);
          setNutritionist(null);
          setLoading(false);
          setIsAuthReady(true);
        });
      } else {
        setNutritionist(null);
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    ACTIVITY_EVENTS.forEach(event => window.addEventListener(event, resetActivity, { passive: true }));

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (isSessionExpired()) {
          forceSignOut();
        } else if (isInactive()) {
          setShowInactivityWarning(true);
        } else {
          resetActivity();
        }
      }
    };

    // Sessão expirada → desconexão imediata (hard limit de segurança)
    // Inatividade → mostra aviso com countdown; o modal decide o signout
    const sessionCheckInterval = setInterval(() => {
      if (isSessionExpired()) {
        forceSignOut();
      } else if (isInactive()) {
        setShowInactivityWarning(true);
      }
    }, SESSION_CHECK_INTERVAL_MS);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      if (unsubNutritionist) unsubNutritionist();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(sessionCheckInterval);
      ACTIVITY_EVENTS.forEach(event => window.removeEventListener(event, resetActivity));
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      nutritionist,
      loading,
      isAuthReady,
      showInactivityWarning,
      dismissInactivityWarning,
      confirmSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
