import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
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
  if (!raw) return false; // sem chave = login novo, não expirado
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
  reloadNutritionist: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  nutritionist: null,
  loading: true,
  isAuthReady: false,
  showInactivityWarning: false,
  dismissInactivityWarning: () => {},
  confirmSignOut: () => {},
  reloadNutritionist: async () => {},
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

  const reloadNutritionist = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setNutritionist(await res.json());
    } catch (err) {
      console.error('Error reloading nutritionist:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
      setLoading(true);
      const loadNutritionist = async () => {
        const MAX_ATTEMPTS = 2;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          if (attempt > 0) {
            await new Promise(r => setTimeout(r, 1500));
          }
          try {
            // Força refresh do token na segunda tentativa para descartar token expirado
            const token = await firebaseUser.getIdToken(attempt > 0);
            const res = await fetch('/api/me', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) continue; // tenta novamente na próxima iteração

            const data = await res.json();
            setNutritionist(data);

            // Verifica assinatura se já passou 1 hora desde o último check
            const lastCheck = data.subscription?.lastCheckedAt;
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

            if (!lastCheck || lastCheck < oneHourAgo) {
              try {
                // Marca imediatamente para evitar chamadas duplicadas
                await fetch('/api/subscription/check', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                });

                const subRes = await fetch('/api/verify-subscription', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ email: firebaseUser.email }),
                });
                const asaasData = await subRes.json();

                const planChanged = asaasData.plan && asaasData.plan !== data.plan;
                const cancelStatusChanged =
                  asaasData.cancelAtPeriodEnd !== undefined &&
                  asaasData.cancelAtPeriodEnd !== data.subscription?.cancelAtPeriodEnd;

                if (planChanged || cancelStatusChanged) {
                  const patchRes = await fetch('/api/subscription', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                      plan: asaasData.plan || 'free',
                      asaasSubscriptionId: asaasData.subscriptionId || null,
                      asaasStatus: asaasData.subscriptionStatus || null,
                      cancelAtPeriodEnd: asaasData.cancelAtPeriodEnd || false,
                      currentPeriodEnd: asaasData.currentPeriodEnd || null,
                    }),
                  });
                  if (patchRes.ok) {
                    const meRes = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } });
                    if (meRes.ok) setNutritionist(await meRes.json());
                  }
                }
              } catch (err) {
                console.error('Error in proactive subscription check:', err);
              }
            }

            // Sucesso — sai do loop sem passar pelo fallback de erro
            setLoading(false);
            setIsAuthReady(true);
            return;
          } catch (err) {
            console.error(`Error fetching nutritionist data (attempt ${attempt + 1}):`, err);
          }
        }

        // Todas as tentativas falharam
        setNutritionist(null);
        setLoading(false);
        setIsAuthReady(true);
      };

      loadNutritionist();
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
      reloadNutritionist,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
