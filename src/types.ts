export interface Nutritionist {
  id: string;
  name: string;
  crn: string;
  cpf?: string;
  cnpj?: string;
  email: string;
  phone?: string;
  specialties?: string[];
  photoUrl?: string;
  role?: 'nutritionist' | 'admin';
  plan?: 'free' | 'premium';
  subscriptionId?: string;
  subscriptionStatus?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
  lastSubscriptionCheck?: string;
  firstSubscriptionDate?: string;
  hadRefundBefore?: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  googleCalendarConnected?: boolean;
  googleCalendarTokens?: any;
}

export interface Patient {
  id: string;
  nutritionist_id: string;
  name: string;
  birthDate: string;
  gender: 'male' | 'female' | 'other';
  cpf: string;
  access_token?: string; // Token para acesso via link único
  phone: string;
  email: string;
  address: string;
  objective: string;
  activityLevel: string;
  diseases?: string;
  medications?: string;
  allergies?: string;
  photoUrl?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Consultation {
  id: string;
  patient_id: string;
  nutritionist_id: string;
  date: string;
  weight: number;
  height: number;
  imc: number;
  fatPercentage?: number;
  waist?: number;
  hip?: number;
  abdomen?: number;
  arm?: number;
  anamnesis: string;
  observations?: string;
  complaints?: string;
  objectives?: string;
  access_token?: string;
  status: 'realized' | 'cancelled' | 'missed';
  createdAt: string;
  updatedAt: string;
}

export interface MealPlan {
  id: string;
  patient_id: string;
  consultation_id?: string;
  calculation_id?: string;
  nutritionist_id: string;
  name: string;
  generalInstructions?: string;
  waterIntake?: string;
  mealObservations?: Record<string, string>;
  customMeals?: { id: string; label: string; time?: string; icon?: string }[];
  access_token?: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface MealPlanItem {
  id: string;
  meal_plan_id: string;
  nutritionist_id: string;
  meal: string;
  food: string;
  quantity: string;
  unit: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  base_kcal?: number;
  base_protein?: number;
  base_carbs?: number;
  base_fat?: number;
  base_quantity?: number;
  serving_name?: string;
  serving_weight?: number;
}

export interface CustomFood {
  id: string;
  nutritionist_id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  baseUnit: string;
  baseQuantity: number;
  serving?: {
    name: string;
    weight: number;
  };
}

export interface LabExamMarker {
  id: string;
  type: string;
  name: string;
  result: string;
  unit: string;
  reference: string;
  status: 'normal' | 'alto' | 'baixo' | 'atencao';
}

export interface LabExam {
  id: string;
  patient_id: string;
  nutritionist_id: string;
  date: string;
  title: string;
  observations?: string;
  access_token?: string;
  markers: LabExamMarker[];
  reportUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  nutritionist_id: string;
  access_token?: string;
  date: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'realized';
  googleEventId?: string;
  meetLink?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  patient_id: string;
  nutritionist_id: string;
  amount: number;
  date: string;
  method: 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'bank_transfer';
  status: 'paid' | 'pending' | 'cancelled';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionCalculation {
  id: string;
  patient_id: string;
  consultation_id: string;
  nutritionist_id: string;
  name: string;
  input: any; // We'll keep it flexible or use NutritionCalculationInput if imported
  result: any; // We'll keep it flexible or use NutritionCalculationOutput if imported
  createdAt: string;
}
