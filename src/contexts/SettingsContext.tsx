import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

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
    if (!isAuthReady) return;
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setSettings({ ...defaultSettings, ...data });
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching global settings:', err);
        setLoading(false);
      });
  }, [isAuthReady]);

  const updateSettings = async (newSettings: GlobalSettings) => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newSettings,
          updatedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSettings(data);
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
