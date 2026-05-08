import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FREE_PLAN_LIMITS } from '../lib/planLimits';

interface FreePlanLimits {
  consultationsThisMonth: number;
  canAddConsultation: boolean;
  patientAlreadyHasConsultationThisMonth: boolean;
  isLoading: boolean;
}

export function useFreeplanLimits(patientId?: string): FreePlanLimits {
  const { user, nutritionist } = useAuth();
  const [consultationsThisMonth, setConsultationsThisMonth] = useState(0);
  const [patientConsultationsThisMonth, setPatientConsultationsThisMonth] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const isPremium = nutritionist?.plan === 'premium';

  useEffect(() => {
    if (isPremium || !user) return;

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    setIsLoading(true);

    const q = query(
      collection(db, 'consultations'),
      where('nutritionist_id', '==', user.uid),
      where('date', '>=', startOfMonth.toISOString()),
      where('date', '<=', endOfMonth.toISOString())
    );

    getDocs(q)
      .then((snap) => {
        const docs = snap.docs.map(d => d.data());
        setConsultationsThisMonth(docs.length);
        if (patientId) {
          setPatientConsultationsThisMonth(docs.filter(d => d.patient_id === patientId).length);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isPremium, user, patientId]);

  if (isPremium) {
    return {
      consultationsThisMonth: 0,
      canAddConsultation: true,
      patientAlreadyHasConsultationThisMonth: false,
      isLoading: false,
    };
  }

  return {
    consultationsThisMonth,
    canAddConsultation: consultationsThisMonth < FREE_PLAN_LIMITS.maxConsultationsPerMonth,
    patientAlreadyHasConsultationThisMonth: patientConsultationsThisMonth >= FREE_PLAN_LIMITS.maxConsultationsPerPatientPerMonth,
    isLoading,
  };
}
