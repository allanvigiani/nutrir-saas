import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Patient, MealPlan, MealPlanItem, NutritionCalculation } from '../types';
import { MealPlanEditor } from '../components/MealPlanEditor';
import { ReceitasVinculadasPanel } from '../components/ReceitasVinculadasPanel';
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

            // Busca o cálculo nutricional vinculado para exibir as metas de macros
            if (planData.calculation_id) {
              const calcs = await apiRequest<NutritionCalculation[]>(`/api/patients/${patientId}/calculations`, 'GET');
              const linked = calcs?.find(c => c.id === planData.calculation_id) ?? null;
              setCalculation(linked);
            }
          }
        } else if (stateCalculation) {
          setCalculation(stateCalculation);
        }

      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Não foi possível carregar o plano alimentar. Verifique sua conexão e tente novamente.");
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
  }): Promise<boolean> => {
    if (!user || !patientId) return false;

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
      return true;
    } catch (error) {
      console.error("Error saving meal plan:", error);
      toast.error("Não foi possível salvar o plano alimentar. Verifique sua conexão e tente novamente.");
      return false;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">Carregando plano alimentar...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Paciente não encontrado.</p>
      </div>
    );
  }

  const safeCustomMeals = Array.isArray(mealPlan?.customMeals) ? mealPlan.customMeals : [];
  const safeMealObservations = (mealPlan?.mealObservations && typeof mealPlan.mealObservations === 'object' && !Array.isArray(mealPlan.mealObservations))
    ? mealPlan.mealObservations as Record<string, string>
    : {};

  // Tipos de refeição para o painel de receitas vinculadas
  const mealTypesForPanel = safeCustomMeals.length > 0
    ? safeCustomMeals.map((m: any) => ({ id: m.id, label: m.label || m.id }))
    : [];

  return (
    <div className="h-screen overflow-hidden">
      <MealPlanEditor
        initialName={mealPlan?.name || (calculation ? `Plano - ${calculation.result.getAjustado} kcal` : '')}
        initialItems={mealItems}
        initialGeneralInstructions={mealPlan?.generalInstructions || ''}
        initialWaterIntake={mealPlan?.waterIntake || ''}
        initialMealObservations={safeMealObservations}
        initialCustomMeals={safeCustomMeals}
        selectedCalculation={calculation}
        foodDataSource="Todas"
        isNew={!planId || planId === 'new'}
        onSave={handleSave}
        onClose={() => navigate(`/patients/${patientId}`)}
      >
        {planId && planId !== 'new' && (
          <ReceitasVinculadasPanel
            planId={planId}
            mealTypes={mealTypesForPanel}
          />
        )}
      </MealPlanEditor>
    </div>
  );
}
