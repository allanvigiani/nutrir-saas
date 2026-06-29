import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Patient, MealPlan, MealPlanItem, NutritionCalculation } from '../types';
import { MealPlanEditor, MealType } from '../components/MealPlanEditor';
import { ReceitasVinculadasPanel } from '../components/ReceitasVinculadasPanel';
import { toast } from 'sonner';
import { logEvent } from '../lib/firebase';
import { apiRequest } from '../hooks/useApi';
import { Loader2 } from 'lucide-react';
import { generateMealPlanPDF } from '../lib/meal-plan-pdf';
import { format } from 'date-fns';

export function MealPlanEdit() {
  const { patientId, planId } = useParams<{ patientId: string; planId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, nutritionist } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [mealItems, setMealItems] = useState<any[]>([]);
  const [calculation, setCalculation] = useState<NutritionCalculation | null>(null);

  // Get calculation from location state if we're creating from one
  const stateCalculation = location.state?.calculation as NutritionCalculation | undefined;

  // Plano copiado de consulta anterior (deep clone enviado por PatientProfile)
  const copiedMealPlan = location.state?.copiedMealPlan as {
    generalInstructions: string;
    waterIntake: string;
    mealObservations: Record<string, string>;
    customMeals: MealType[];
    items: MealPlanItem[];
  } | undefined;

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
            // Ordena por meal e depois por position para respeitar a ordem salva
            const sortedItems = (items || []).slice().sort((a: any, b: any) => {
              if (a.meal < b.meal) return -1;
              if (a.meal > b.meal) return 1;
              return (a.position ?? 0) - (b.position ?? 0);
            });
            setMealItems(sortedItems);

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

      // Calcula position relativo ao grupo (meal) antes de limpar os itens
      const mealPositionCounters: Record<string, number> = {};
      const cleanItems = data.items.map(({ id: _id, position: _pos, ...item }: any) => {
        const mealId = item.meal as string;
        if (mealPositionCounters[mealId] === undefined) mealPositionCounters[mealId] = 0;
        const position = mealPositionCounters[mealId]++;
        const clean: Record<string, any> = {};
        Object.entries(item).forEach(([k, v]) => { clean[k] = v === undefined ? null : v; });
        clean.position = position;
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
      if ((!planId || planId === 'new') && currentPlanId) {
        navigate(`/patients/${patientId}/meal-plan/${currentPlanId}`, { replace: true });
      }
      return true;
    } catch (error) {
      console.error("Error saving meal plan:", error);
      toast.error("Não foi possível salvar o plano alimentar. Verifique sua conexão e tente novamente.");
      return false;
    }
  };

  const handlePrint = async () => {
    if (!mealPlan || !patient || !planId || planId === 'new') return;
    const toastId = toast.loading('Gerando PDF do plano alimentar...');
    try {
      const receitasVinculadas = await apiRequest<any[]>(`/api/meal-plans/${planId}/recipes`, 'GET') ?? [];
      const doc = generateMealPlanPDF(mealPlan, mealItems as MealPlanItem[], patient.name, nutritionist, receitasVinculadas);
      doc.save(`Plano_Alimentar_${patient.name.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`);
      void logEvent('exportar_pdf_plano_alimentar');
      toast.success('PDF gerado com sucesso!', { id: toastId });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF.', { id: toastId });
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

  const safeCustomMeals = (Array.isArray(mealPlan?.customMeals) ? mealPlan.customMeals : []) as import('../components/MealPlanEditor').MealType[];
  const safeMealObservations = (mealPlan?.mealObservations && typeof mealPlan.mealObservations === 'object' && !Array.isArray(mealPlan.mealObservations))
    ? mealPlan.mealObservations as Record<string, string>
    : {};

  // Tipos de refeição para o painel de receitas vinculadas
  const mealTypesForPanel = safeCustomMeals.length > 0
    ? safeCustomMeals.map((m: any) => ({ id: m.id, label: m.label || m.id }))
    : [];

  // Chave de rascunho: edit:{planId} ou new:{patientId}
  const draftKey = planId && planId !== 'new'
    ? `nutrir:draft:mealplan:edit:${planId}`
    : patientId
    ? `nutrir:draft:mealplan:new:${patientId}`
    : 'nutrir:draft:mealplan:new';

  return (
    <div className="h-screen overflow-hidden">
      <MealPlanEditor
        initialName={copiedMealPlan ? '' : (mealPlan?.name || (calculation ? `Plano - ${calculation.result.getAjustado} kcal` : ''))}
        initialItems={copiedMealPlan ? copiedMealPlan.items : mealItems}
        initialGeneralInstructions={copiedMealPlan ? copiedMealPlan.generalInstructions : (mealPlan?.generalInstructions || '')}
        initialWaterIntake={copiedMealPlan ? copiedMealPlan.waterIntake : (mealPlan?.waterIntake || '')}
        initialMealObservations={copiedMealPlan ? copiedMealPlan.mealObservations : safeMealObservations}
        initialCustomMeals={copiedMealPlan ? copiedMealPlan.customMeals : safeCustomMeals}
        selectedCalculation={calculation}
        foodDataSource="Todas"
        isNew={!planId || planId === 'new'}
        draftKey={draftKey}
        onSave={handleSave}
        onPrint={planId && planId !== 'new' ? handlePrint : undefined}
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
