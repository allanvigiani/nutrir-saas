import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, onSnapshot, updateDoc, getDocFromServer, query, collection, where } from 'firebase/firestore';
import { Nutritionist, Patient } from '../types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  nutritionist: Nutritionist | null;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  nutritionist: null,
  loading: true,
  isAuthReady: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [nutritionist, setNutritionist] = useState<Nutritionist | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    // Test Firestore connection on boot
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
    let unsubPatient: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (unsubNutritionist) {
        unsubNutritionist();
        unsubNutritionist = null;
      }

      if (user) {
        // 1. Buscar perfil de Nutricionista
        unsubNutritionist = onSnapshot(doc(db, 'nutritionists', user.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as Nutritionist;
            
            // Self-healing: ensure the main admin always has the admin role
            if (user.email === 'vigianiallan@gmail.com' && data.role !== 'admin') {
              try {
                await updateDoc(doc(db, 'nutritionists', user.uid), { 
                  role: 'admin',
                  updatedAt: new Date().toISOString()
                });
              } catch (error) {
                console.error("Error auto-promoting admin:", error);
              }
            }

            setNutritionist({ id: docSnap.id, ...data } as Nutritionist);

            // Proactive subscription verification:
            const lastCheck = (data as any).lastSubscriptionCheck;
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            
            if (!lastCheck || lastCheck < oneDayAgo) {
              user.getIdToken().then(token => {
                fetch('/api/verify-subscription', {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ email: user.email }),
                })
                .then(res => res.json())
                .then(async (asaasData) => {
                  const planChanged = asaasData.plan && asaasData.plan !== data.plan;
                  const cancelStatusChanged = asaasData.cancelAtPeriodEnd !== undefined && asaasData.cancelAtPeriodEnd !== data.cancelAtPeriodEnd;
                  
                  if (planChanged || cancelStatusChanged) {
                    await updateDoc(doc(db, 'nutritionists', user.uid), {
                      plan: asaasData.plan || 'free',
                      subscriptionId: asaasData.subscriptionId || null,
                      subscriptionStatus: asaasData.subscriptionStatus || null,
                      cancelAtPeriodEnd: asaasData.cancelAtPeriodEnd || false,
                      currentPeriodEnd: asaasData.currentPeriodEnd || null,
                      lastSubscriptionCheck: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    });
                  } else {
                    await updateDoc(doc(db, 'nutritionists', user.uid), {
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

    return () => {
      unsubscribe();
      if (unsubNutritionist) unsubNutritionist();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, nutritionist, loading, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
