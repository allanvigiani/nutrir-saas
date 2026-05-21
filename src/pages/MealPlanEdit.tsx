import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Patient, MealPlan, MealPlanItem, NutritionCalculation } from '../types';
import { MealPlanEditor } from '../components/MealPlanEditor';
import { toast } from 'sonner';
import { logEvent } from '../lib/firebase';
import { apiRequest } from '../hooks/useApi';
import { Loader2 } from 'lucide-react';

export function MealPlanEdit() {
  const { patientId, planId } = useParams<{ patientId: string; planId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [mealItems, setMealItems] = useState<any[]>([]);
  const [calculation, setCalculation] = useState<NutritionCalculation | null>(null);

  // Get calculation from location state if we're creating from one
  const stateCalculation = location.state?.calculation as NutritionCalculation | undefined;

  useEffect(() => {
    async function fetchData() {
      if (!user || !patientId) return;

      try {
        setLoading(true);

        // Fetch Patient
        const patientData = await apiRequest<Patient>(`/api/patients/${patientId}`, 'GET');
        if (patientData) {
          setPatient(patientData);
        } else {
          toast.error("Paciente não encontrado.");
          navigate('/patients');
          return;
        }

        // If editing, fetch Meal Plan and Items
        if (planId && planId !== 'new') {
          const planData = await apiRequest<MealPlan & { items: any[] }>(`/api/meal-plans/${planId}`, 'GET');
          if (planData) {
            const { items, ...plan } = planData;
            setMealPlan(plan as MealPlan);
            setMealItems(items || []);
          }
        } else if (stateCalculation) {
          setCalculation(stateCalculation);
        }

      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user, patientId, planId, stateCalculation, navigate]);

  const handleSave = async (data: {
    name: string;
    items: any[];
    generalInstructions: string;
    waterIntake: string;
    mealObservations: Record<string, string>;
    customMeals: any[];
  }) => {
    if (!user || !patientId) return;

    try {
      const planPayload = {
        name: data.name || '',
        generalInstructions: data.generalInstructions || '',
        waterIntake: data.waterIntake || '',
        mealObservations: data.mealObservations || {},
        customMeals: data.customMeals.map(m => ({
          id: m.id,
          label: m.label || '',
          time: m.time || null
        })),
        consultation_id: stateCalculation?.consultation_id || location.state?.consultationId || mealPlan?.consultation_id || null,
        calculation_id: stateCalculation?.id || mealPlan?.calculation_id || null,
      };

      const cleanItems = data.items.map(({ id: _id, ...item }: any) => {
        const clean: Record<string, any> = {};
        Object.entries(item).forEach(([k, v]) => { clean[k] = v === undefined ? null : v; });
        return clean;
      });

      let currentPlanId: string | undefined = planId;

      if (planId && planId !== 'new') {
        // Update existing plan metadata, then replace items atomically
        await apiRequest(`/api/meal-plans/${planId}`, 'PATCH', planPayload);
        await apiRequest(`/api/meal-plans/${planId}/items`, 'PUT', cleanItems);
      } else {
        // Create new plan
        const created = await apiRequest<{ id: string }>(`/api/patients/${patientId}/meal-plans`, 'POST', planPayload);
        currentPlanId = created?.id;
        if (currentPlanId) {
          await apiRequest(`/api/meal-plans/${currentPlanId}/items`, 'PUT', cleanItems);
        }
      }

      void logEvent(planId && planId !== 'new' ? 'plano_alimentar_atualizado' : 'novo_plano_alimentar');
      toast.success(planId && planId !== 'new' ? "Plano alimentar atualizado!" : "Plano alimentar criado!");
      navigate(`/patients/${patientId}`);
    } catch (error) {
      console.error("Error saving meal plan:", error);
      toast.error("Erro ao salvar plano alimentar.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">Carregando editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <MealPlanEditor 
        initialName={mealPlan?.name || (calculation ? `Plano - ${calculation.result.getAjustado} kcal` : '')}
        initialItems={mealItems}
        initialGeneralInstructions={mealPlan?.generalInstructions || ''}
        initialWaterIntake={mealPlan?.waterIntake || ''}
        initialMealObservations={mealPlan?.mealObservations || {}}
        initialCustomMeals={mealPlan?.customMeals || []}
        selectedCalculation={calculation}
        foodDataSource="Todas"
        onSave={handleSave}
        onClose={() => navigate(`/patients/${patientId}`)}
      />
    </div>
  );
}
