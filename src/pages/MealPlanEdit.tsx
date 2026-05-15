import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where,
  addDoc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Patient, MealPlan, MealPlanItem, NutritionCalculation } from '../types';
import { MealPlanEditor } from '../components/MealPlanEditor';
import { toast } from 'sonner';
import { logEvent } from '../lib/firebase';
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
        const patientDoc = await getDoc(doc(db, 'patients', patientId));
        if (patientDoc.exists()) {
          setPatient({ id: patientDoc.id, ...patientDoc.data() } as Patient);
        } else {
          toast.error("Paciente não encontrado.");
          navigate('/patients');
          return;
        }

        // If editing, fetch Meal Plan and Items
        if (planId && planId !== 'new') {
          const planDoc = await getDoc(doc(db, 'meal_plans', planId));
          if (planDoc.exists()) {
            const planData = { id: planDoc.id, ...planDoc.data() } as MealPlan;
            setMealPlan(planData);

            // Fetch Items
            const itemsQuery = query(
              collection(db, 'meal_plan_items'),
              where('meal_plan_id', '==', planId)
            );
            const itemsSnapshot = await getDocs(itemsQuery);
            const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMealItems(items);
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
      const batch = writeBatch(db);
      let currentPlanId = planId;

      const planData = {
        patient_id: patientId,
        nutritionist_id: user.uid,
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
        updatedAt: serverTimestamp(),
      };

      if (planId && planId !== 'new') {
        // Update existing plan
        const planRef = doc(db, 'meal_plans', planId);
        batch.update(planRef, planData);

        // Delete old items
        const oldItemsQuery = query(collection(db, 'meal_plan_items'), where('meal_plan_id', '==', planId));
        const oldItemsSnapshot = await getDocs(oldItemsQuery);
        oldItemsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      } else {
        // Create new plan
        const plansCol = collection(db, 'meal_plans');
        const newPlanRef = doc(plansCol);
        currentPlanId = newPlanRef.id;
        batch.set(newPlanRef, {
          ...planData,
          createdAt: serverTimestamp(),
        });
      }

      // Add new items
      data.items.forEach(item => {
        const itemRef = doc(collection(db, 'meal_plan_items'));
        
        // Remove undefined fields and the 'id' field if it exists
        const { id, ...cleanItem } = item;
        Object.keys(cleanItem).forEach(key => {
          if (cleanItem[key] === undefined) {
            cleanItem[key] = null;
          }
        });

        batch.set(itemRef, {
          ...cleanItem,
          meal_plan_id: currentPlanId,
          patient_id: patientId,
          nutritionist_id: user.uid,
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
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
