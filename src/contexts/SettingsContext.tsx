import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from './AuthContext';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface GlobalSettings {
  free: {
    maxPatients: number;
    maxConsultationsPerMonth: number;
    maxConsultationsPerPatientPerMonth: number;
    maxMealPlans: number;
    maxExams: number;
    historyMonths: number;
  };
}

interface SettingsContextType {
  settings: GlobalSettings;
  loading: boolean;
  updateSettings: (newSettings: GlobalSettings) => Promise<void>;
}

const defaultSettings: GlobalSettings = {
  free: {
    maxPatients: 2,
    maxConsultationsPerMonth: 2,
    maxConsultationsPerPatientPerMonth: 1,
    maxMealPlans: 1,
    maxExams: 1,
    historyMonths: 3,
  }
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loading: true,
  updateSettings: async () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthReady, user } = useAuth();
  const [settings, setSettings] = useState<GlobalSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady || !user) {
      if (isAuthReady && !user) setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          free: {
            ...defaultSettings.free,
            ...data.free,
          },
        });
      } else {
        // If it doesn't exist, we use defaults but don't create it here 
        // to avoid permission issues if not admin.
        // Admins will create it when they first save.
        setSettings(defaultSettings);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching global settings:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [isAuthReady, user]);

  const updateSettings = async (newSettings: GlobalSettings) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        ...newSettings,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
