import React, { createContext, useContext, useState, useEffect } from 'react';
import { initAnalytics } from '../lib/firebase';

type CookieConsent = 'all' | 'essential' | null;

interface CookieConsentContextValue {
  consent: CookieConsent;
  acceptAll: () => void;
  acceptEssentialOnly: () => void;
  resetConsent: () => void;
}

const STORAGE_KEY = 'nutrir_cookie_consent';

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<CookieConsent>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'all' || stored === 'essential') return stored;
    return null;
  });

  // Inicializa Analytics se consentimento já existe ao carregar
  useEffect(() => {
    if (consent === 'all') {
      initAnalytics();
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem(STORAGE_KEY, 'all');
    setConsent('all');
    initAnalytics(); // Ativa Analytics imediatamente ao aceitar
  };

  const acceptEssentialOnly = () => {
    localStorage.setItem(STORAGE_KEY, 'essential');
    setConsent('essential');
  };

  const resetConsent = () => {
    localStorage.removeItem(STORAGE_KEY);
    setConsent(null);
  };

  return (
    <CookieConsentContext.Provider value={{ consent, acceptAll, acceptEssentialOnly, resetConsent }}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used inside CookieConsentProvider');
  return ctx;
}
