import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

type TutorialContextValue = {
  isOpen: boolean;
  openTutorial: () => void;
  closeTutorial: () => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { nutritionist, isAuthReady } = useAuth();
  const wasLoggedOutRef = useRef(true);

  const openTutorial = useCallback(() => setIsOpen(true), []);
  const closeTutorial = useCallback(() => setIsOpen(false), []);

  // Auto-trigger: abre na primeira carga pós-login se o usuário ainda não viu.
  // Escreve hasSeenTutorial:true imediatamente ao abrir, para que recarregar a página
  // não mostre o tutorial novamente mesmo que o usuário feche a aba sem interagir.
  useEffect(() => {
    if (!isAuthReady) return;

    if (!nutritionist) {
      wasLoggedOutRef.current = true;
      return;
    }

    if (wasLoggedOutRef.current) {
      wasLoggedOutRef.current = false;
      if (nutritionist.hasSeenTutorial !== true) {
        setIsOpen(true);
        updateDoc(doc(db, 'nutritionists', nutritionist.id), {
          hasSeenTutorial: true,
          updatedAt: new Date().toISOString(),
        }).catch((err) =>
          console.error('[TutorialContext] Erro ao salvar hasSeenTutorial', err),
        );
      }
    }
  }, [isAuthReady, nutritionist?.id, nutritionist?.hasSeenTutorial]);

  return (
    <TutorialContext.Provider value={{ isOpen, openTutorial, closeTutorial }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  return ctx;
}
