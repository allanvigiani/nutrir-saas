import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FREE_PLAN_LIMITS, isAdminOrPremium } from '../lib/planLimits';
import { apiRequest } from './useApi';

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

  const isPremium = isAdminOrPremium(nutritionist);

  useEffect(() => {
    if (isPremium || !user) return;

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59).toISOString();

    setIsLoading(true);

    apiRequest<any>('/api/dashboard', 'GET')
      .then(async (stats) => {
        const count = stats?.consultationsThisMonth ?? 0;
        setConsultationsThisMonth(count);
        if (patientId) {
          const consultations = await apiRequest<any[]>(`/api/patients/${patientId}/consultations`, 'GET');
          const filtered = (consultations || []).filter((c: any) => {
            const d = c.date || c.createdAt;
            return d >= startOfMonth && d <= endOfMonth;
          });
          setPatientConsultationsThisMonth(filtered.length);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
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
