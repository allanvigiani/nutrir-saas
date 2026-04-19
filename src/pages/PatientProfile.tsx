import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { 
  User, 
  Calendar, 
  FileText, 
  Beaker, 
  TrendingUp, 
  FileSpreadsheet,
  Download,
  ArrowLeft,
  Plus,
  Mail,
  Phone,
  MapPin,
  Activity,
  Trash2,
  Edit,
  AlertCircle,
  Printer,
  Clock,
  Coffee,
  Apple,
  Utensils,
  Moon,
  Sun,
  Save,
  CloudMoon,
  Dna,
  Zap,
  Droplets,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  MessageSquare,
  CheckCircle2,
  Key,
  Share2,
  ExternalLink
} from 'lucide-react';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '../components/ui/tabs';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '../components/ui/card';
import { Button, buttonVariants } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  deleteDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../lib/firebase';
import { Patient, Consultation, MealPlan, MealPlanItem, LabExam, LabExamMarker, CustomFood } from '../types';
import { format, differenceInYears, parseISO, subMonths, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PremiumFeature } from '../components/PremiumFeature';
import { UpgradeModal } from '../components/UpgradeModal';
import { maskCPF, maskPhone } from '../lib/masks';
import { generateSecureToken } from '../lib/utils';
import { FoodAutocomplete } from '../components/FoodAutocomplete';
import { TacoFood } from '../data/taco';
import { CustomFoodDialog } from '../components/CustomFoodDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

type DraftMealItem = {
  meal: string;
  food: string;
  quantity: string;
  unit: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  base_kcal?: number | null;
  base_protein?: number | null;
  base_carbs?: number | null;
  base_fat?: number | null;
  base_quantity?: number | null;
  serving_name?: string | null;
  serving_weight?: number | null;
};

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
import { toast } from 'sonner';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const consultationSchema = z.object({
  date: z.string().min(1, 'Data é obrigatória'),
  weight: z.coerce.number().min(0, 'Peso deve ser positivo'),
  height: z.coerce.number().min(0, 'Altura deve ser positiva'),
  fatPercentage: z.coerce.number().optional(),
  waist: z.coerce.number().optional(),
  hip: z.coerce.number().optional(),
  abdomen: z.coerce.number().optional(),
  arm: z.coerce.number().optional(),
  anamnesis: z.string().min(1, 'Anamnese é obrigatória'),
  observations: z.string().optional(),
  complaints: z.string().optional(),
  objectives: z.string().optional(),
});

type ConsultationFormValues = z.infer<typeof consultationSchema>;

export const PatientProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, nutritionist, isAuthReady } = useAuth();
  const { settings } = useSettings();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [gender, setGender] = useState<string>('');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [exams, setExams] = useState<LabExam[]>([]);
  const [hasHiddenHistory, setHasHiddenHistory] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isConsultationModalOpen, setIsConsultationModalOpen] = useState(false);
  const [isMealPlanModalOpen, setIsMealPlanModalOpen] = useState(false);
  const [isCustomFoodDialogOpen, setIsCustomFoodDialogOpen] = useState(false);
  const [initialFoodName, setInitialFoodName] = useState('');
  const [activeMealItemIndex, setActiveMealItemIndex] = useState<number | null>(null);
  const [isLabExamModalOpen, setIsLabExamModalOpen] = useState(false);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
  const [editCpf, setEditCpf] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [selectedExamFile, setSelectedExamFile] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('edit') === 'true') {
      setIsEditPatientModalOpen(true);
      // Remove the param after opening so it doesn't reopen on refresh
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('edit');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams]);
  const [isViewMealPlanModalOpen, setIsViewMealPlanModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<LabExam | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [examMarkers, setExamMarkers] = useState<LabExamMarker[]>([]);
  const [expandedExams, setExpandedExams] = useState<Record<string, boolean>>({});
  const [expandedConsultations, setExpandedConsultations] = useState<Record<string, boolean>>({});
  const [evolutionMetric, setEvolutionMetric] = useState<'weight' | 'fatPercentage' | 'imc' | 'measurements'>('weight');
  const [isDeleteMealPlanConfirmOpen, setIsDeleteMealPlanConfirmOpen] = useState(false);
  const [mealPlanToDelete, setMealPlanToDelete] = useState<string | null>(null);
  const [isDeleteLabExamConfirmOpen, setIsDeleteLabExamConfirmOpen] = useState(false);
  const [labExamToDelete, setLabExamToDelete] = useState<string | null>(null);
  const [isDeleteConsultationConfirmOpen, setIsDeleteConsultationConfirmOpen] = useState(false);
  const [consultationToDelete, setConsultationToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlan | null>(null);
  const [selectedMealPlanItems, setSelectedMealPlanItems] = useState<MealPlanItem[]>([]);
  const [mealItems, setMealItems] = useState<DraftMealItem[]>([]);
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [waterIntake, setWaterIntake] = useState('');
  const [mealObservations, setMealObservations] = useState<Record<string, string>>({});
  const [mealPlanName, setMealPlanName] = useState('');
  
  const isMealPlanLimitReached = nutritionist?.plan === 'free' && mealPlans.filter(p => p.status === 'active').length >= settings.free.maxMealPlans;
  const isLabExamLimitReached = nutritionist?.plan === 'free' && exams.length >= settings.free.maxExams;

  const mealTotals = mealItems.reduce((acc, item) => ({
    kcal: acc.kcal + (Number(item.kcal) || 0),
    protein: acc.protein + (Number(item.protein) || 0),
    carbs: acc.carbs + (Number(item.carbs) || 0),
    fat: acc.fat + (Number(item.fat) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const viewMealTotals = selectedMealPlanItems.reduce((acc, item) => ({
    kcal: acc.kcal + (Number(item.kcal) || 0),
    protein: acc.protein + (Number(item.protein) || 0),
    carbs: acc.carbs + (Number(item.carbs) || 0),
    fat: acc.fat + (Number(item.fat) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const mealTypes = [
    { id: 'breakfast', label: 'Café da Manhã', icon: Sun, color: 'bg-amber-50 border-amber-100 text-amber-700' },
    { id: 'morning_snack', label: 'Lanche da Manhã', icon: Apple, color: 'bg-rose-50 border-rose-100 text-rose-700' },
    { id: 'lunch', label: 'Almoço', icon: Utensils, color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
    { id: 'afternoon_snack', label: 'Lanche da Tarde', icon: Coffee, color: 'bg-orange-50 border-orange-100 text-orange-700' },
    { id: 'dinner', label: 'Jantar', icon: Moon, color: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
    { id: 'supper', label: 'Ceia', icon: CloudMoon, color: 'bg-slate-50 border-slate-100 text-slate-700' },
  ];

  const generateMealPlanPDF = (plan: MealPlan, items: MealPlanItem[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header background
    doc.setFillColor(5, 150, 105); // emerald-600
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PLANO ALIMENTAR', pageWidth / 2, 20, { align: 'center' });
    
    // Nutritionist Info in Header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nutricionista: ${nutritionist?.name || 'Não informado'}`, pageWidth / 2, 28, { align: 'center' });
    
    let headerY = 33;
    if (nutritionist?.crn) {
      doc.text(`CRN: ${nutritionist.crn}`, pageWidth / 2, headerY, { align: 'center' });
      headerY += 5;
    }
    if (nutritionist?.phone) {
      doc.text(`Tel: ${nutritionist.phone}`, pageWidth / 2, headerY, { align: 'center' });
    }

    // Patient Info Section
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO PACIENTE', 14, 60);
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(14, 62, pageWidth - 14, 62);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Paciente:', 14, 70);
    doc.setFont('helvetica', 'normal');
    doc.text(patient?.name || 'Não informado', 35, 70);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Data:', 14, 77);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(), 'dd/MM/yyyy'), 28, 77);

    doc.setFont('helvetica', 'bold');
    doc.text('Plano:', 14, 84);
    doc.setFont('helvetica', 'normal');
    doc.text(plan.name || 'Plano Alimentar', 30, 84);

    let currentY = 95;
    if (plan.waterIntake) {
      doc.setFont('helvetica', 'bold');
      doc.text('Meta de Água:', 14, 91);
      doc.setFont('helvetica', 'normal');
      doc.text(plan.waterIntake, 43, 91);
      currentY = 102;
    }

    // Group items by meal
    const order = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'];
    
    order.forEach((mealId) => {
      const mealItems = items.filter(i => i.meal === mealId);
      if (mealItems.length === 0) return;

      const mealLabel = mealTypes.find(m => m.id === mealId)?.label || mealId;
      const observation = plan.mealObservations?.[mealId];

      // Meal Header
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(14, currentY, pageWidth - 28, 10, 'F');
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(mealLabel.toUpperCase(), 18, currentY + 7);
      
      currentY += 12;

      // Table for this meal
      const tableData = mealItems.map(item => [
        item.food,
        `${item.quantity} ${item.unit}`,
        `${item.kcal || 0} kcal`
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Alimento', 'Quantidade', 'Calorias']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [5, 150, 105], fontSize: 9, halign: 'center' },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'left' },
          1: { cellWidth: 40, halign: 'center' },
          2: { cellWidth: 30, halign: 'center' }
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.section === 'head' && data.column.index === 0) {
            data.cell.styles.halign = 'left';
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;

      // Observation for this meal
      if (observation) {
        doc.setFillColor(255, 251, 235); // amber-50
        doc.setDrawColor(251, 191, 36); // amber-400
        
        const splitObs = doc.splitTextToSize(observation, pageWidth - 36);
        const obsHeight = (splitObs.length * 5) + 6;

        // Check if we need a new page
        if (currentY + obsHeight > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          currentY = 20;
        }

        doc.rect(14, currentY, pageWidth - 28, obsHeight, 'F');
        doc.line(14, currentY, 14, currentY + obsHeight); // Left border accent
        
        doc.setTextColor(146, 64, 14); // amber-800
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(splitObs, 18, currentY + 5);
        
        currentY += obsHeight + 10;
      } else {
        currentY += 5;
      }

      // Check if next meal needs a new page
      if (currentY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        currentY = 20;
      }
    });

    // General Instructions at the end
    if (plan.generalInstructions) {
      if (currentY > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        currentY = 20;
      }

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ORIENTAÇÕES GERAIS', 14, currentY + 10);
      doc.line(14, currentY + 12, pageWidth - 14, currentY + 12);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const splitInstructions = doc.splitTextToSize(plan.generalInstructions, pageWidth - 28);
      doc.text(splitInstructions, 14, currentY + 20);
      currentY += 20 + (splitInstructions.length * 5) + 15;
    }

    // Household Measurements Table
    if (currentY > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('EQUIVALÊNCIA DE MEDIDAS CASEIRAS', 14, currentY);
    currentY += 5;

    const householdMeasures = [
      ['1 copo americano', '200 ml'],
      ['1 xícara de chá', '200 ml'],
      ['1 copo de requeijão', '250 ml'],
      ['1 concha média', '100 g / 150 ml'],
      ['1 colher de sopa', '15 g / 15 ml'],
      ['1 colher de sobremesa', '10 g / 10 ml'],
      ['1 colher de chá', '5 g / 5 ml'],
      ['1 colher de café', '2.5 g / 2.5 ml'],
      ['1 escumadeira média', '60 g']
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Medida Caseira', 'Equivalência Aproximada']],
      body: householdMeasures,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { cellWidth: 60, halign: 'center' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Signature and Stamp Area
    if (currentY > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      currentY = 30;
    } else {
      currentY += 30;
    }

    doc.setDrawColor(148, 163, 184); // slate-400
    doc.line(pageWidth / 2 - 40, currentY, pageWidth / 2 + 40, currentY);
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text('Assinatura do Profissional', pageWidth / 2, currentY + 5, { align: 'center' });
    
    // Stamp Box
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.rect(pageWidth - 54, currentY - 15, 40, 25);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('ESPAÇO PARA CARIMBO', pageWidth - 34, currentY - 2, { align: 'center' });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Gerado por NutriCare Pro em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    return doc;
  };

  const handleExportPDF = (plan: MealPlan, items: MealPlanItem[]) => {
    const doc = generateMealPlanPDF(plan, items);
    doc.save(`Plano_Alimentar_${patient?.name.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`);
  };

  const sendMealPlanByEmail = async (plan: MealPlan) => {
    if (!user || !patient) return;
    const toastId = toast.loading("Preparando e-mail com plano alimentar...");
    
    try {
      const q = query(
        collection(db, 'meal_plan_items'),
        where('meal_plan_id', '==', plan.id),
        where('nutritionist_id', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MealPlanItem));
      
      const doc = generateMealPlanPDF(plan, items);
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const fileName = `Plano_Alimentar_${patient.name.replace(/\s+/g, '_')}.pdf`;

      const token = await user.getIdToken();
      const response = await fetch('/api/send-meal-plan', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientEmail: patient.email,
          patientName: patient.name,
          nutritionistName: nutritionist?.name || user.displayName || 'Seu Nutricionista',
          pdfBase64,
          fileName
        })
      });

      if (!response.ok) throw new Error('Falha ao enviar e-mail');

      toast.success("Plano alimentar enviado para o e-mail do paciente!", { id: toastId });
    } catch (error) {
      console.error("Error sending meal plan email:", error);
      toast.error("Erro ao enviar plano por e-mail.", { id: toastId });
    }
  };

  const exportMealPlanPDF = async (plan: MealPlan) => {
    if (!user) return;
    const toastId = toast.loading("Gerando PDF do plano alimentar...");
    setSelectedMealPlan(plan);
    try {
      const q = query(
        collection(db, 'meal_plan_items'),
        where('meal_plan_id', '==', plan.id),
        where('nutritionist_id', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MealPlanItem));
      
      handleExportPDF(plan, items);
      toast.success("PDF gerado com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF.", { id: toastId });
    }
  };

  const addMealItem = (mealType: string = 'breakfast') => {
    setMealItems([...mealItems, { 
      meal: mealType, 
      food: '', 
      quantity: '', 
      unit: 'g',
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    }]);
  };

  const removeMealItem = (index: number) => {
    setMealItems(mealItems.filter((_, i) => i !== index));
  };

  const updateMealItem = (index: number, field: string, value: any) => {
    const newItems = [...mealItems];
    const item = { ...newItems[index] };
    
    if (field === 'food_object') {
      const food = value as TacoFood | CustomFood;
      item.food = food.name;
      
      // If the food has a serving option (slice, spoon, etc.), use it as default
      if (food.serving) {
        item.unit = food.serving.name;
        item.quantity = "1";
        
        // Calculate macros for 1 serving
        const ratio = food.serving.weight / (food.baseQuantity || 100);
        item.kcal = Math.round(food.kcal * ratio);
        item.protein = Math.round(food.protein * ratio);
        item.carbs = Math.round(food.carbs * ratio);
        item.fat = Math.round(food.fat * ratio);
      } else {
        item.unit = food.baseUnit;
        item.quantity = food.baseQuantity.toString();
        item.kcal = Math.round(food.kcal);
        item.protein = Math.round(food.protein);
        item.carbs = Math.round(food.carbs);
        item.fat = Math.round(food.fat);
      }
      
      item.base_kcal = food.kcal;
      item.base_protein = food.protein;
      item.base_carbs = food.carbs;
      item.base_fat = food.fat;
      item.base_quantity = food.baseQuantity;
      item.serving_name = food.serving?.name;
      item.serving_weight = food.serving?.weight;
    } else if (field === 'food') {
      item.food = value;
      item.base_kcal = null;
      item.base_protein = null;
      item.base_carbs = null;
      item.base_fat = null;
      item.base_quantity = null;
      item.serving_name = null;
      item.serving_weight = null;
    } else if (field === 'quantity' || field === 'unit') {
      if (field === 'quantity') item.quantity = value;
      if (field === 'unit') item.unit = value;
      
      const newQty = parseFloat(item.quantity);
      if (!isNaN(newQty) && item.base_quantity && item.base_quantity > 0) {
        let effectiveWeight = newQty;
        
        // Normalize unit comparison (e.g., 'un' vs 'unidade')
        const isServingUnit = item.unit === item.serving_name || 
                            (item.unit === 'un' && item.serving_name === 'unidade') ||
                            (item.unit === 'unidade' && item.serving_name === 'un');

        if (isServingUnit && item.serving_weight) {
          effectiveWeight = newQty * item.serving_weight;
        }
        
        const ratio = effectiveWeight / item.base_quantity;
        item.kcal = Math.round((item.base_kcal || 0) * ratio);
        item.protein = Math.round((item.base_protein || 0) * ratio);
        item.carbs = Math.round((item.base_carbs || 0) * ratio);
        item.fat = Math.round((item.base_fat || 0) * ratio);
      }
    } else {
      (item as any)[field] = value;
    }
    
    newItems[index] = item;
    setMealItems(newItems);
  };

  const { register: regConsultation, handleSubmit: handleConsultationSubmit, reset: resetConsultation, formState: { isSubmitting: isConsultationSubmitting } } = useForm<any>({
    resolver: zodResolver(consultationSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
    }
  });

  const formatDateSafely = (dateStr: string, formatStr: string) => {
    try {
      // If it's just a date string (YYYY-MM-DD), parse it as local time
      if (dateStr.length === 10) {
        return format(parseISO(dateStr), formatStr, { locale: ptBR });
      }
      // Otherwise parse as full date
      return format(new Date(dateStr), formatStr, { locale: ptBR });
    } catch (e) {
      return dateStr;
    }
  };

  const onConsultationSubmit = async (data: any) => {
    if (!user || !id) return;
    try {
      const imc = data.height > 0 ? data.weight / ((data.height / 100) * (data.height / 100)) : 0;
      
      // Clean up optional numbers to ensure they are finite or null
      const cleanData = { ...data };
      const optionalNumberFields = ['fatPercentage', 'waist', 'hip', 'abdomen', 'arm'];
      optionalNumberFields.forEach(field => {
        if (cleanData[field] === '' || cleanData[field] === undefined || isNaN(Number(cleanData[field]))) {
          delete cleanData[field];
        } else {
          cleanData[field] = Number(cleanData[field]);
        }
      });

      if (selectedConsultation) {
        // Update existing
        const updatePath = `consultations/${selectedConsultation.id}`;
        try {
          await updateDoc(doc(db, 'consultations', selectedConsultation.id), {
            ...cleanData,
            imc,
            updatedAt: new Date().toISOString(),
          });
          toast.success('Consulta atualizada com sucesso!');
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, updatePath);
        }
      } else {
        // Add new
        const createPath = 'consultations';
        try {
          await addDoc(collection(db, 'consultations'), {
            ...cleanData,
            imc,
            patient_id: id,
            nutritionist_id: user.uid,
            access_token: patient.access_token || null,
            status: 'realized',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          toast.success('Consulta registrada com sucesso!');
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, createPath);
        }
      }
      
      setIsConsultationModalOpen(false);
      setSelectedConsultation(null);
      resetConsultation();
      
      // Refresh data
      const consultationsQuery = query(
        collection(db, 'consultations'),
        where('patient_id', '==', id),
        where('nutritionist_id', '==', user.uid),
        orderBy('date', 'desc')
      );
      const consultationsSnap = await getDocs(consultationsQuery);
      setConsultations(consultationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation)).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()));
    } catch (error) {
      console.error("Error saving consultation:", error);
      // Error is already handled by handleFirestoreError inside the try blocks if it's a permission error
      if (!(error instanceof Error && error.message.includes('operationType'))) {
        toast.error('Erro ao salvar consulta.');
      }
    }
  };

  const onDeleteConsultation = async () => {
    if (!consultationToDelete) return;
    try {
      await deleteDoc(doc(db, 'consultations', consultationToDelete));
      toast.success('Consulta excluída com sucesso!');
      setIsDeleteConsultationConfirmOpen(false);
      setConsultationToDelete(null);
      
      // Refresh data
      const consultationsQuery = query(
        collection(db, 'consultations'),
        where('patient_id', '==', id),
        where('nutritionist_id', '==', user.uid),
        orderBy('date', 'desc')
      );
      const consultationsSnap = await getDocs(consultationsQuery);
      setConsultations(consultationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation)).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()));
    } catch (error) {
      console.error("Error deleting consultation:", error);
      toast.error('Erro ao excluir consulta.');
    }
  };

  const onMealPlanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !id) return;

    // Premium check: Free plan allows only a limited number of active meal plans
    if (!selectedMealPlan && nutritionist?.plan === 'free') {
      const activePlans = mealPlans.filter(p => p.status === 'active');
      const maxMealPlans = settings.free.maxMealPlans;
      if (activePlans.length >= maxMealPlans) {
        toast.error(`O plano gratuito permite apenas ${maxMealPlans} plano(s) alimentar(es) ativo(s) por paciente.`);
        return;
      }
    }
    try {
      let mealPlanId = selectedMealPlan?.id;

      if (selectedMealPlan) {
        // Update existing
        await updateDoc(doc(db, 'meal_plans', selectedMealPlan.id), {
          name: mealPlanName,
          generalInstructions,
          waterIntake,
          mealObservations,
          access_token: patient.access_token || null,
          updatedAt: new Date().toISOString(),
        });
        
        // Delete old items
        const itemsQuery = query(
          collection(db, 'meal_plan_items'), 
          where('meal_plan_id', '==', selectedMealPlan.id),
          where('nutritionist_id', '==', user.uid)
        );
        const itemsSnap = await getDocs(itemsQuery);
        for (const itemDoc of itemsSnap.docs) {
          await deleteDoc(doc(db, 'meal_plan_items', itemDoc.id));
        }
      } else {
        // Create new
        const mealPlanRef = await addDoc(collection(db, 'meal_plans'), {
          patient_id: id,
          nutritionist_id: user.uid,
          access_token: patient.access_token || null,
          name: mealPlanName,
          generalInstructions,
          waterIntake,
          mealObservations,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        mealPlanId = mealPlanRef.id;
      }

      // Add items
      for (const item of mealItems) {
        // Sanitize item to remove undefined values
        const sanitizedItem = Object.fromEntries(
          Object.entries(item).filter(([_, v]) => v !== undefined)
        );
        
        await addDoc(collection(db, 'meal_plan_items'), {
          ...sanitizedItem,
          meal_plan_id: mealPlanId,
          nutritionist_id: user.uid,
          access_token: patient.access_token || null,
        });
      }

      toast.success(selectedMealPlan ? 'Plano alimentar atualizado!' : 'Plano alimentar criado com sucesso!');
      setIsMealPlanModalOpen(false);
      setMealItems([]);
      setGeneralInstructions('');
      setWaterIntake('');
      setMealObservations({});
      setMealPlanName('');
      setSelectedMealPlan(null);
      
      // Refresh data
      const mealPlansQuery = query(
        collection(db, 'meal_plans'),
        where('patient_id', '==', id),
        where('nutritionist_id', '==', user.uid)
      );
      const mealPlansSnap = await getDocs(mealPlansQuery);
      const fetchedPlans = mealPlansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MealPlan));
      setMealPlans(fetchedPlans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error("Error saving meal plan:", error);
      toast.error('Erro ao salvar plano alimentar.');
      handleFirestoreError(error, OperationType.WRITE, 'meal_plans');
    }
  };

  const viewMealPlan = async (plan: MealPlan) => {
    if (!user) return;
    setSelectedMealPlan(plan);
    try {
      const q = query(
        collection(db, 'meal_plan_items'),
        where('meal_plan_id', '==', plan.id),
        where('nutritionist_id', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MealPlanItem));
      setSelectedMealPlanItems(items);
      setIsViewMealPlanModalOpen(true);
    } catch (error) {
      console.error("Error fetching meal plan items:", error);
      toast.error("Erro ao carregar itens do plano alimentar.");
      handleFirestoreError(error, OperationType.GET, `meal_plan_items`);
    }
  };

  const editMealPlan = async (plan: MealPlan) => {
    if (!user) return;
    setSelectedMealPlan(plan);
    setMealPlanName(plan.name || '');
    setGeneralInstructions(plan.generalInstructions || '');
    setWaterIntake(plan.waterIntake || '');
    setMealObservations(plan.mealObservations || {});
    try {
      const q = query(
        collection(db, 'meal_plan_items'),
        where('meal_plan_id', '==', plan.id),
        where('nutritionist_id', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          meal: data.meal,
          food: data.food,
          quantity: data.quantity,
          unit: data.unit,
          kcal: data.kcal || 0,
          protein: data.protein || 0,
          carbs: data.carbs || 0,
          fat: data.fat || 0
        };
      });
      setMealItems(items as any);
      setIsMealPlanModalOpen(true);
    } catch (error) {
      console.error("Error fetching meal plan items for edit:", error);
      toast.error("Erro ao carregar plano para edição.");
      handleFirestoreError(error, OperationType.GET, `meal_plan_items`);
    }
  };

  const deleteMealPlan = async (planId: string) => {
    if (!user) return;
    setMealPlanToDelete(planId);
    setIsDeleteMealPlanConfirmOpen(true);
  };

  const confirmDeleteMealPlan = async () => {
    if (!user || !mealPlanToDelete) return;
    try {
      // Delete items first
      const itemsQuery = query(
        collection(db, 'meal_plan_items'), 
        where('meal_plan_id', '==', mealPlanToDelete),
        where('nutritionist_id', '==', user.uid)
      );
      const itemsSnap = await getDocs(itemsQuery);
      for (const itemDoc of itemsSnap.docs) {
        await deleteDoc(doc(db, 'meal_plan_items', itemDoc.id));
      }
      // Delete plan
      await deleteDoc(doc(db, 'meal_plans', mealPlanToDelete));
      toast.success('Plano alimentar excluído!');
      // Refresh meal plans
      setMealPlans(mealPlans.filter(p => p.id !== mealPlanToDelete));
      setIsDeleteMealPlanConfirmOpen(false);
      setMealPlanToDelete(null);
    } catch (error) {
      console.error("Error deleting meal plan:", error);
      toast.error('Erro ao excluir plano alimentar.');
      handleFirestoreError(error, OperationType.DELETE, `meal_plans/${mealPlanToDelete}`);
    }
  };

  const duplicateMealPlan = async (plan: MealPlan) => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'meal_plan_items'),
        where('meal_plan_id', '==', plan.id),
        where('nutritionist_id', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          meal: data.meal,
          food: data.food,
          quantity: data.quantity,
          unit: data.unit,
          kcal: data.kcal || 0,
          protein: data.protein || 0,
          carbs: data.carbs || 0,
          fat: data.fat || 0
        };
      });
      setMealItems(items as any);
      setMealPlanName(plan.name ? `${plan.name} (Cópia)` : '');
      setGeneralInstructions(plan.generalInstructions || '');
      setWaterIntake(plan.waterIntake || '');
      setMealObservations(plan.mealObservations || {});
      setSelectedMealPlan(null); // Ensure it's treated as a new plan
      setIsMealPlanModalOpen(true);
      toast.info("Plano duplicado. Ajuste e salve para criar um novo.");
    } catch (error) {
      console.error("Error duplicating meal plan:", error);
      toast.error("Erro ao duplicar plano.");
      handleFirestoreError(error, OperationType.GET, `meal_plan_items`);
    }
  };

  const toggleExamExpansion = (examId: string) => {
    setExpandedExams(prev => ({ ...prev, [examId]: !prev[examId] }));
  };

  const handleImportPDFExam = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingFile(true);
    const toastId = toast.loading("Fazendo upload do arquivo...");

    try {
      const storagePath = `nutritionists/${user.uid}/exams/${id}/${Date.now()}_${file.name}`;
      console.log("Tentando upload para:", storagePath);
      console.log("Seu UID atual:", user.uid);
      
      const storageRef = ref(storage, storagePath);
      
      // Upload simples para evitar problemas com sessões resumíveis
      const snapshot = await uploadBytes(storageRef, file);
      console.log("Upload concluído com sucesso!");
      
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log("URL gerada:", downloadURL);
      
      setSelectedExamFile(downloadURL);
      toast.success("Arquivo anexado com sucesso!", { id: toastId });
      setIsUploadingFile(false);
    } catch (error: any) {
      console.error("Erro detalhado no upload:", error);
      let msg = "Erro desconhecido";
      
      if (error.code === 'storage/unauthorized') {
        msg = "Sem permissão. Verifique se o Storage está ativado no Console do Firebase.";
      } else if (error.code === 'storage/canceled') {
        msg = "Upload cancelado.";
      }
      
      toast.error(`Falha no upload: ${msg}`, { id: toastId });
      setIsUploadingFile(false);
    } finally {
      e.target.value = '';
    }
  };
  const addExamMarker = () => {
    const newMarker: LabExamMarker = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'Outros',
      name: '',
      result: '',
      unit: '',
      reference: '',
      status: 'normal'
    };
    setExamMarkers([...examMarkers, newMarker]);
  };

  const removeExamMarker = (markerId: string) => {
    setExamMarkers(examMarkers.filter(m => m.id !== markerId));
  };

  const updateExamMarker = (markerId: string, field: keyof LabExamMarker, value: string) => {
    setExamMarkers(examMarkers.map(m => m.id === markerId ? { ...m, [field]: value } : m));
  };

  const onLabExamSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !id) return;

    if (!selectedExam && isLabExamLimitReached) {
      toast.error('Limite de exames atingido no plano gratuito.');
      return;
    }

    const formData = new FormData(e.currentTarget);
    
    try {
      const examData = {
        date: formData.get('date') as string,
        title: formData.get('title') as string,
        observations: formData.get('observations') as string,
        markers: examMarkers,
        reportUrl: selectedExamFile,
        patient_id: id,
        nutritionist_id: user.uid,
        access_token: patient.access_token || null,
        createdAt: selectedExam ? selectedExam.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (selectedExam) {
        await updateDoc(doc(db, 'lab_exams', selectedExam.id), examData);
        toast.success('Exame atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'lab_exams'), examData);
        toast.success('Exame registrado com sucesso!');
      }
      
      setIsLabExamModalOpen(false);
      setExamMarkers([]);
      setSelectedExam(null);
      setSelectedExamFile(null);
      
      // Refresh exams
      const examsQuery = query(
        collection(db, 'lab_exams'),
        where('patient_id', '==', id),
        where('nutritionist_id', '==', user.uid),
        orderBy('date', 'desc')
      );
      const examsSnap = await getDocs(examsQuery);
      setExams(examsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LabExam)));
    } catch (error) {
      console.error("Error saving exam:", error);
      toast.error('Erro ao salvar exame.');
      handleFirestoreError(error, OperationType.WRITE, 'lab_exams');
    }
  };

  const deleteLabExam = (examId: string) => {
    if (!user) return;
    setLabExamToDelete(examId);
    setIsDeleteLabExamConfirmOpen(true);
  };

  const confirmDeleteLabExam = async () => {
    if (!user || !labExamToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'lab_exams', labExamToDelete));
      toast.success('Exame excluído com sucesso!');
      setExams(exams.filter(e => e.id !== labExamToDelete));
      setIsDeleteLabExamConfirmOpen(false);
      setLabExamToDelete(null);
    } catch (error) {
      console.error("Error deleting exam:", error);
      toast.error('Erro ao excluir exame.');
      handleFirestoreError(error, OperationType.DELETE, `lab_exams/${labExamToDelete}`);
    }
  };

  useEffect(() => {
    if (isEditPatientModalOpen && patient) {
      setEditCpf(maskCPF(patient.cpf));
      setEditPhone(maskPhone(patient.phone));
    }
  }, [isEditPatientModalOpen, patient]);

  const onEditPatientSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !id || !patient) return;
    const formData = new FormData(e.currentTarget);
    const birthDate = formData.get('birthDate') as string;
    const today = new Date();
    if (new Date(birthDate) > today) {
      toast.error('Data de nascimento não pode ser no futuro.');
      return;
    }

    const cpf = (formData.get('cpf') as string).replace(/\D/g, '');
    if (cpf.length !== 11) {
      toast.error('O CPF deve conter 11 dígitos.');
      return;
    }

    const email = formData.get('email') as string;
    const phone = (formData.get('phone') as string).replace(/\D/g, '');
    if (phone.length < 10) {
      toast.error('Telefone deve conter pelo menos 10 dígitos.');
      return;
    }

    const data: Pick<Patient, 'name' | 'email' | 'phone' | 'cpf' | 'birthDate' | 'gender' | 'address' | 'diseases' | 'medications' | 'allergies' | 'updatedAt'> = {
      name: formData.get('name') as string,
      email,
      phone,
      cpf,
      birthDate,
      gender: formData.get('gender') as Patient['gender'],
      address: formData.get('address') as string,
      diseases: formData.get('diseases') as string,
      medications: formData.get('medications') as string,
      allergies: formData.get('allergies') as string,
      updatedAt: new Date().toISOString(),
    };

    try {
      // Duplicate check: CPF and Email must be unique for the same nutritionist
      const patientsRef = collection(db, 'patients');
      
      // Check CPF
      const cpfQuery = query(
        patientsRef, 
        where('nutritionist_id', '==', user.uid),
        where('cpf', '==', cpf)
      );
      const cpfSnapshot = await getDocs(cpfQuery);
      const duplicateCpf = cpfSnapshot.docs.find(doc => doc.id !== id);
      
      if (duplicateCpf) {
        toast.error('Já existe um paciente cadastrado com este CPF.');
        return;
      }

      // Check Email
      const emailQuery = query(
        patientsRef, 
        where('nutritionist_id', '==', user.uid),
        where('email', '==', email)
      );
      const emailSnapshot = await getDocs(emailQuery);
      const duplicateEmail = emailSnapshot.docs.find(doc => doc.id !== id);

      if (duplicateEmail) {
        toast.error('Já existe um paciente cadastrado com este E-mail.');
        return;
      }

      await updateDoc(doc(db, 'patients', id), data);
      toast.success('Dados do paciente atualizados com sucesso!');
      setIsEditPatientModalOpen(false);
      setPatient({ ...patient, ...data });
    } catch (error) {
      console.error("Error updating patient:", error);
      toast.error('Erro ao atualizar dados do paciente.');
    }
  };

  useEffect(() => {
    if (!isAuthReady || !id || !user) return;

    const fetchPatientData = () => {
      setLoading(true);
      const docRef = doc(db, 'patients', id);
      
      const unsubscribe = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Patient;
          setPatient(data);
          setGender(data.gender);

          try {
            // Fetch consultations
            const consultationsQuery = query(
              collection(db, 'consultations'),
              where('patient_id', '==', id),
              where('nutritionist_id', '==', user.uid)
            );
            const consultationsSnap = await getDocs(consultationsQuery);
            let fetchedConsultations = consultationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation));
            
            // Fetch meal plans
            const mealPlansQuery = query(
              collection(db, 'meal_plans'),
              where('patient_id', '==', id),
              where('nutritionist_id', '==', user.uid)
            );
            const mealPlansSnap = await getDocs(mealPlansQuery);
            const fetchedPlans = mealPlansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MealPlan));
            setMealPlans(fetchedPlans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

            // Fetch exams
            const examsQuery = query(
              collection(db, 'lab_exams'),
              where('patient_id', '==', id),
              where('nutritionist_id', '==', user.uid)
            );
            const examsSnap = await getDocs(examsQuery);
            let fetchedExams = examsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LabExam));

            // Apply premium restrictions: history limit for free plan
            if (nutritionist?.plan === 'free') {
              const historyMonths = settings.free.historyMonths;
              const historyLimitDate = subMonths(new Date(), historyMonths);
              
              const originalConsultationsCount = fetchedConsultations.length;
              const originalExamsCount = fetchedExams.length;

              fetchedConsultations = fetchedConsultations.filter(c => {
                return isAfter(new Date(c.date), historyLimitDate);
              });

              fetchedExams = fetchedExams.filter(e => {
                return isAfter(new Date(e.date), historyLimitDate);
              });

              if (fetchedConsultations.length < originalConsultationsCount || fetchedExams.length < originalExamsCount) {
                setHasHiddenHistory(true);
              }
            }

            setConsultations(fetchedConsultations.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()));
            setExams(fetchedExams.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()));
          } catch (error) {
            console.error("Error fetching related patient data:", error);
            handleFirestoreError(error, OperationType.GET, 'related_data');
          }
        } else {
          toast.error("Paciente não encontrado.");
          navigate('/patients');
        }
        setLoading(false);
      }, (error) => {
        console.error("Error fetching patient data:", error);
        toast.error("Erro ao carregar dados do paciente.");
        setLoading(false);
        handleFirestoreError(error, OperationType.GET, `patients/${id}`);
      });

      return unsubscribe;
    };

    const unsubscribe = fetchPatientData();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [id, user, navigate, isAuthReady]);

  const generateAccessToken = async () => {
    if (!patient || !id) return;
    
    setIsGeneratingToken(true);
    const toastId = toast.loading('Gerando link de acesso e atualizando registros...');
    
    try {
      const token = generateSecureToken();
      
      // 1. Atualizar o paciente
      await updateDoc(doc(db, 'patients', id), {
        access_token: token,
        updatedAt: new Date().toISOString()
      });

      // 2. Propagar o token para registros existentes (Consultas, Planos, Exames, Agendamentos)
      const collectionsToUpdate = ['consultations', 'meal_plans', 'lab_exams', 'appointments'];
      let totalUpdated = 0;
      
      for (const colName of collectionsToUpdate) {
        const q = query(collection(db, colName), where('patient_id', '==', id));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.docs.forEach((docSnap) => {
            batch.update(doc(db, colName, docSnap.id), { access_token: token });
            totalUpdated++;
          });
          await batch.commit();

          // Se for plano alimentar, atualizar também os itens
          if (colName === 'meal_plans') {
            for (const planDoc of snapshot.docs) {
              const itemsQ = query(collection(db, 'meal_plan_items'), where('meal_plan_id', '==', planDoc.id));
              const itemsSnap = await getDocs(itemsQ);
              if (!itemsSnap.empty) {
                const itemsBatch = writeBatch(db);
                itemsSnap.docs.forEach((itemDoc) => {
                  itemsBatch.update(doc(db, 'meal_plan_items', itemDoc.id), { access_token: token });
                  totalUpdated++;
                });
                await itemsBatch.commit();
              }
            }
          }
        }
      }

      toast.success(`Link gerado e ${totalUpdated} registros atualizados!`, { id: toastId });
    } catch (error) {
      console.error("Error generating access token:", error);
      toast.error('Erro ao gerar link de acesso ou atualizar registros.', { id: toastId });
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const shareAccessLink = () => {
    if (!patient?.access_token) return;
    const whatsappBaseUrl = import.meta.env.VITE_WHATSAPP_BASE_URL || '';
    if (!whatsappBaseUrl) {
      toast.error('VITE_WHATSAPP_BASE_URL não configurada.');
      return;
    }
    
    const baseUrl = window.location.origin;
    const accessUrl = `${baseUrl}/patient-access/${id}?token=${patient.access_token}`;
    
    const message = `Olá ${patient.name}! Aqui está seu link exclusivo para acessar seu plano alimentar e evolução no Nutrir: ${accessUrl}\n\nPara sua segurança, ao acessar, digite os 3 últimos dígitos do seu CPF.`;
    
    const whatsappUrl = `${whatsappBaseUrl}/55${patient.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!patient) return null;

  const age = differenceInYears(new Date(), new Date(patient.birthDate));

  return (
    <div className="space-y-8">
      {patient.status === 'inactive' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">Paciente Inativo</p>
            <p>Este paciente está desativado. Edições e novos registros estão bloqueados até que o paciente seja reativado na lista de pacientes.</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button nativeButton={false} variant="ghost" size="icon" render={<Link to="/patients" />}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-2xl">
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-slate-900">{patient.name}</h1>
                <Button 
                  variant="ghost" 
                  size="icon-sm" 
                  className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                  onClick={() => setIsEditPatientModalOpen(true)}
                  disabled={patient.status === 'inactive'}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3 text-slate-500 text-sm">
                <span>{age} anos</span>
                <span>•</span>
                <span>{patient.cpf}</span>
                <span>•</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                  patient.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                )}>
                  {patient.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!patient.access_token ? (
            <Button 
              variant="outline" 
              className="h-8 text-sm font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-4"
              onClick={generateAccessToken}
              disabled={isGeneratingToken || patient.status === 'inactive'}
            >
              {isGeneratingToken ? 'GERANDO...' : 'GERAR LINK DE ACESSO'}
            </Button>
          ) : (
            <Button 
              variant="outline" 
              className="h-8 text-sm font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-4"
              onClick={shareAccessLink}
              disabled={patient.status === 'inactive'}
            >
              ENVIAR ACESSO WHATSAPP
            </Button>
          )}
          <Dialog open={isConsultationModalOpen} onOpenChange={(open) => {
            setIsConsultationModalOpen(open);
            if (!open) {
              setSelectedConsultation(null);
              resetConsultation({
                date: new Date().toISOString().split('T')[0],
                weight: 0,
                height: 0,
                fatPercentage: undefined,
                waist: undefined,
                hip: undefined,
                abdomen: undefined,
                arm: undefined,
                anamnesis: '',
                complaints: '',
                objectives: '',
                observations: ''
              });
            }
          }}>
            <DialogTrigger 
              render={<Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-4 gap-2 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50" disabled={patient.status === 'inactive'} onClick={() => {
                setSelectedConsultation(null);
                resetConsultation({
                  date: new Date().toISOString().split('T')[0],
                  weight: 0,
                  height: 0,
                  fatPercentage: undefined,
                  waist: undefined,
                  hip: undefined,
                  abdomen: undefined,
                  arm: undefined,
                  anamnesis: '',
                  complaints: '',
                  objectives: '',
                  observations: ''
                });
              }} />}
              nativeButton={true}
            >
              <Plus className="w-4 h-4" /> Nova Consulta
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle>{selectedConsultation ? 'Editar Consulta' : 'Registrar Nova Consulta'}</DialogTitle>
                <DialogDescription>Preencha os dados antropométricos e clínicos do atendimento.</DialogDescription>
              </DialogHeader>
              <form key={isConsultationModalOpen ? 'open' : 'closed'} onSubmit={handleConsultationSubmit(onConsultationSubmit)} className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data da Consulta</Label>
                    <Input id="date" type="date" {...regConsultation('date')} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Peso (kg)</Label>
                    <Input id="weight" type="number" step="0.1" {...regConsultation('weight')} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Altura (cm)</Label>
                    <Input id="height" type="number" {...regConsultation('height')} className="h-8 text-sm" />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-4">Medidas e Circunferências (cm)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fatPercentage">% Gordura</Label>
                      <Input id="fatPercentage" type="number" step="0.1" {...regConsultation('fatPercentage')} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="waist">Cintura</Label>
                      <Input id="waist" type="number" step="0.1" {...regConsultation('waist')} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hip">Quadril</Label>
                      <Input id="hip" type="number" step="0.1" {...regConsultation('hip')} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="abdomen">Abdômen</Label>
                      <Input id="abdomen" type="number" step="0.1" {...regConsultation('abdomen')} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="arm">Braço</Label>
                      <Input id="arm" type="number" step="0.1" {...regConsultation('arm')} className="h-8 text-sm" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="anamnesis">Anamnese / Evolução Clínica</Label>
                    <Textarea id="anamnesis" rows={4} {...regConsultation('anamnesis')} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="complaints">Queixas</Label>
                      <Textarea id="complaints" rows={2} {...regConsultation('complaints')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="objectives">Objetivos da Consulta</Label>
                      <Textarea id="objectives" rows={2} {...regConsultation('objectives')} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="observations">Observações Adicionais (Privado)</Label>
                    <Textarea id="observations" rows={2} placeholder="Notas internas que não aparecem no plano impresso..." {...regConsultation('observations')} />
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsConsultationModalOpen(false)}
                    className="rounded-xl h-8 px-4 border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-all active:scale-95"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-5 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50" 
                    disabled={isConsultationSubmitting}
                  >
                    {isConsultationSubmitting ? 'Salvando...' : (selectedConsultation ? 'Salvar Alterações' : 'Finalizar Consulta')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full items-center justify-start gap-2 bg-transparent border-b border-slate-200 p-0 rounded-none h-auto mb-8 overflow-x-auto">
          <TabsTrigger value="personal" className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:text-emerald-700 transition-all whitespace-nowrap">
            <User className="w-4 h-4" /> Dados Pessoais
          </TabsTrigger>
          <TabsTrigger value="consultations" className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:text-emerald-700 transition-all whitespace-nowrap">
            <Calendar className="w-4 h-4" /> Consultas
          </TabsTrigger>
          <TabsTrigger value="mealplans" className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:text-emerald-700 transition-all whitespace-nowrap">
            <FileText className="w-4 h-4" /> Planos Alimentares
          </TabsTrigger>
          <TabsTrigger value="exams" className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:text-emerald-700 transition-all whitespace-nowrap">
            <Beaker className="w-4 h-4" /> Exames
          </TabsTrigger>
          <TabsTrigger value="evolution" className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:text-emerald-700 transition-all whitespace-nowrap">
            <TrendingUp className="w-4 h-4" /> Evolução
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Informações de Contato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                    <Mail className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">E-mail</p>
                      <p className="font-medium text-slate-900">{patient.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                    <Phone className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Telefone</p>
                      <p className="font-medium text-slate-900">{patient.phone}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Endereço</p>
                    <p className="font-medium text-slate-900">{patient.address}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dados Clínicos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Objetivo</p>
                  <p className="font-medium text-slate-900">{patient.objective}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Atividade Física</p>
                  <p className="font-medium text-slate-900">{patient.activityLevel}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="text-lg">Histórico de Saúde</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-red-500" /> Doenças
                    </p>
                    <p className="text-slate-600 text-sm">{patient.diseases || 'Nenhuma informada'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Beaker className="w-4 h-4 text-blue-500" /> Medicamentos
                    </p>
                    <p className="text-slate-600 text-sm">{patient.medications || 'Nenhum informado'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" /> Alergias
                    </p>
                    <p className="text-slate-600 text-sm">{patient.allergies || 'Nenhuma informada'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="consultations" className="mt-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 pb-6">
              <div>
                <CardTitle className="text-lg font-bold">Histórico de Consultas</CardTitle>
                <CardDescription>Visualize todos os atendimentos realizados.</CardDescription>
              </div>
              <Button 
                size="sm" 
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-4 gap-2 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50" 
                onClick={() => setIsConsultationModalOpen(true)}
                disabled={patient.status === 'inactive'}
              >
                <Plus className="w-4 h-4" /> Nova Consulta
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              {consultations.length > 0 ? (
                <div className="space-y-4">
                  {consultations.map((consultation) => (
                    <div key={consultation.id} className="border border-slate-100 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-sm">
                      <div 
                        className={cn(
                          "flex items-center justify-between p-4 cursor-pointer transition-colors",
                          expandedConsultations[consultation.id] ? "bg-slate-50 border-b border-slate-100" : "bg-white hover:bg-slate-50"
                        )}
                        onClick={() => setExpandedConsultations(prev => ({ ...prev, [consultation.id]: !prev[consultation.id] }))}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex flex-col items-center justify-center text-slate-600">
                            <span className="text-[10px] font-bold uppercase">{formatDateSafely(consultation.date, 'MMM')}</span>
                            <span className="text-lg font-bold leading-none">{formatDateSafely(consultation.date, 'dd')}</span>
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">Consulta de Rotina</p>
                            <p className="text-sm text-slate-500">Peso: {consultation.weight}kg • IMC: {consultation.imc.toFixed(1)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                            consultation.status === 'realized' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          )}>
                            {consultation.status === 'realized' ? 'Realizada' : 'Cancelada'}
                          </span>
                          
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon-sm" className="text-slate-400 hover:text-emerald-600 disabled:opacity-30" disabled={patient.status === 'inactive'} onClick={(e) => {
                              e.stopPropagation();
                              setSelectedConsultation(consultation);
                              resetConsultation({
                                date: consultation.date,
                                weight: consultation.weight,
                                height: consultation.height,
                                fatPercentage: consultation.fatPercentage,
                                waist: consultation.waist,
                                hip: consultation.hip,
                                abdomen: consultation.abdomen,
                                arm: consultation.arm,
                                anamnesis: consultation.anamnesis,
                                complaints: consultation.complaints,
                                objectives: consultation.objectives,
                                observations: consultation.observations
                              });
                              setIsConsultationModalOpen(true);
                            }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" className="text-red-400 hover:text-red-600 disabled:opacity-30" disabled={patient.status === 'inactive'} onClick={(e) => {
                              e.stopPropagation();
                              setConsultationToDelete(consultation.id);
                              setIsDeleteConsultationConfirmOpen(true);
                            }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          {expandedConsultations[consultation.id] ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>
                      
                      {expandedConsultations[consultation.id] && (
                        <div className="p-6 bg-white space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Altura</p>
                              <p className="font-bold text-slate-900">{consultation.height}m</p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Gordura</p>
                              <p className="font-bold text-slate-900">{consultation.fatPercentage || '--'}%</p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cintura</p>
                              <p className="font-bold text-slate-900">{consultation.waist || '--'}cm</p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quadril</p>
                              <p className="font-bold text-slate-900">{consultation.hip || '--'}cm</p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Braço</p>
                              <p className="font-bold text-slate-900">{consultation.arm || '--'}cm</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                  <AlertCircle className="w-3 h-3 text-emerald-500" /> Queixas Principais
                                </h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[80px]">
                                  {consultation.complaints || 'Nenhuma queixa registrada.'}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                  <TrendingUp className="w-3 h-3 text-emerald-500" /> Objetivos
                                </h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[80px]">
                                  {consultation.objectives || 'Nenhum objetivo registrado.'}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                  <FileText className="w-3 h-3 text-emerald-500" /> Anamnese / Evolução
                                </h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[180px] whitespace-pre-wrap">
                                  {consultation.anamnesis || 'Nenhuma anamnese registrada.'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {consultation.observations && (
                            <div className="pt-4 border-t border-slate-100">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Observações Adicionais</h4>
                              <p className="text-sm text-slate-500 italic">{consultation.observations}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  Nenhuma consulta registrada para este paciente.
                </div>
              )}

              {hasHiddenHistory && (
                <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-900">Histórico Oculto</p>
                      <p className="text-xs text-emerald-700">Existem consultas mais antigas que não estão visíveis no plano gratuito.</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setIsUpgradeModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-8 px-4 text-xs gap-2 shrink-0"
                  >
                    Ver Tudo com Premium
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mealplans" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Planos Alimentares</CardTitle>
                <CardDescription>Gerencie as dietas prescritas.</CardDescription>
              </div>
              <Dialog open={isMealPlanModalOpen} onOpenChange={(open) => {
                setIsMealPlanModalOpen(open);
                if (!open) {
                  setSelectedMealPlan(null);
                  setGeneralInstructions('');
                  setWaterIntake('');
                  setMealObservations({});
                  setMealPlanName('');
                  setMealItems([]);
                }
              }}>
                <PremiumFeature active={isMealPlanLimitReached}>
                  <DialogTrigger 
                    render={<Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-4 gap-2 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50" size="sm" disabled={patient.status === 'inactive'} />}
                    nativeButton={true}
                  >
                    <Plus className="w-4 h-4" /> Novo Plano
                  </DialogTrigger>
                </PremiumFeature>
                <DialogContent className="max-w-6xl w-[98vw] h-[95vh] p-0 overflow-hidden flex flex-col rounded-2xl border-none shadow-2xl print-content-wrapper">
                  <div key={selectedMealPlan?.id || 'new'} className="flex flex-col h-full bg-slate-50 overflow-hidden">
                    {/* Header Bar */}
                    <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0 z-50 shadow-sm print:hidden">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <Button variant="ghost" size="icon" onClick={() => setIsMealPlanModalOpen(false)} className="shrink-0 hover:bg-slate-100 rounded-full">
                          <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-3 min-w-0">
                          <div className="flex-1 min-w-[150px] max-w-[400px]">
                            <Input 
                              value={mealPlanName}
                              onChange={(e) => setMealPlanName(e.target.value)}
                              className="text-lg font-bold border-slate-200 bg-white h-8 rounded-xl focus-visible:ring-emerald-500 transition-all placeholder:text-slate-300"
                              placeholder="Nome do Plano Alimentar"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <Button 
                          size="sm" 
                          onClick={onMealPlanSubmit} 
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-4 font-bold text-sm transition-all shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" /> <span className="hidden md:inline">Salvar Plano</span>
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8 print:p-0">
                      {/* Nutritional Summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
                        <Card className="border-none shadow-sm bg-white overflow-hidden print:border print:border-slate-100">
                          <div className="p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center print:bg-white print:border print:border-orange-100">
                              <Activity className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-slate-400">Calorias</p>
                              <p className="text-lg font-bold text-slate-900">{mealTotals.kcal} <span className="text-xs font-normal text-slate-400">kcal</span></p>
                            </div>
                          </div>
                        </Card>
                        <Card className="border-none shadow-sm bg-white overflow-hidden print:border print:border-slate-100">
                          <div className="p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center print:bg-white print:border print:border-blue-100">
                              <Dna className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-slate-400">Proteínas</p>
                              <p className="text-lg font-bold text-slate-900">{mealTotals.protein.toFixed(1)} <span className="text-xs font-normal text-slate-400">g</span></p>
                            </div>
                          </div>
                        </Card>
                        <Card className="border-none shadow-sm bg-white overflow-hidden print:border print:border-slate-100">
                          <div className="p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center print:bg-white print:border print:border-emerald-100">
                              <Zap className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-slate-400">Carbos</p>
                              <p className="text-lg font-bold text-slate-900">{mealTotals.carbs.toFixed(1)} <span className="text-xs font-normal text-slate-400">g</span></p>
                            </div>
                          </div>
                        </Card>
                        <Card className="border-none shadow-sm bg-white overflow-hidden print:border print:border-slate-100">
                          <div className="p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center print:bg-white print:border print:border-purple-100">
                              <Droplets className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-slate-400">Gorduras</p>
                              <p className="text-lg font-bold text-slate-900">{mealTotals.fat.toFixed(1)} <span className="text-xs font-normal text-slate-400">g</span></p>
                            </div>
                          </div>
                        </Card>
                      </div>

                      {/* Water Intake & General Instructions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Card className="border-none shadow-sm bg-white overflow-hidden p-6 space-y-4 h-full">
                            <div className="flex items-center gap-3 text-blue-600 mb-2">
                              <div className="p-2 rounded-xl bg-blue-50">
                                <Droplets className="w-5 h-5" />
                              </div>
                              <h4 className="font-bold uppercase tracking-wider text-xs">Meta de Água</h4>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-slate-500">Quantidade Diária</Label>
                              <Input 
                                placeholder="Ex: 2.5 Litros"
                                value={waterIntake}
                                onChange={(e) => setWaterIntake(e.target.value)}
                                className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                              />
                            </div>
                          </Card>
                        </div>
                        <div>
                          <Card className="border-none shadow-sm bg-white overflow-hidden p-6 space-y-4 h-full">
                            <div className="flex items-center gap-3 text-emerald-600 mb-2">
                              <div className="p-2 rounded-xl bg-emerald-50">
                                <Activity className="w-5 h-5" />
                              </div>
                              <h4 className="font-bold uppercase tracking-wider text-xs">Orientações Gerais</h4>
                            </div>
                            <Textarea 
                              placeholder="Orientações gerais para o paciente..."
                              className="min-h-[100px] rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 resize-none flex-1"
                              value={generalInstructions}
                              onChange={(e) => setGeneralInstructions(e.target.value)}
                            />
                          </Card>
                        </div>
                      </div>

                      {/* Meals */}
                      <div className="space-y-8">
                        {mealTypes.map((mealType) => {
                          const items = mealItems.filter(i => i.meal === mealType.id);
                          const Icon = mealType.icon;
                          
                          return (
                            <div key={mealType.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md print:border-emerald-100 print:shadow-none">
                              <div className={cn("px-6 py-4 flex items-center justify-between border-b print:bg-emerald-50 print:border-emerald-100", mealType.color)}>
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-white/20 print:bg-emerald-600 print:text-white">
                                    <Icon className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-lg print:text-emerald-900">{mealType.label}</span>
                                    <span className="ml-2 text-xs opacity-80 font-medium print:text-emerald-700">{items.length} {items.length === 1 ? 'alimento' : 'alimentos'}</span>
                                  </div>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-9 gap-2 rounded-xl bg-white/10 hover:bg-white/20 text-inherit border border-white/20 print:hidden"
                                  onClick={() => addMealItem(mealType.id)}
                                >
                                  <Plus className="w-4 h-4" /> Adicionar Alimento
                                </Button>
                              </div>
                              
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[800px]">
                                  <thead>
                                    <tr className="bg-slate-50/50 text-slate-500 text-left border-b print:bg-slate-50">
                                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Alimento</th>
                                      <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] w-28">Qtd</th>
                                      <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] w-28 print:hidden">Unidade</th>
                                      <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] w-20 text-center">Kcal</th>
                                      <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] w-20 text-center">P (g)</th>
                                      <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] w-20 text-center">C (g)</th>
                                      <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] w-20 text-center">G (g)</th>
                                      <th className="px-6 py-4 w-12 text-center print:hidden"></th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {items.length > 0 ? (
                                      items.map((item, idx) => {
                                        const globalIndex = mealItems.findIndex(i => i === item);
                                        return (
                                          <tr key={idx} className="hover:bg-slate-50/30 transition-colors group print:hover:bg-transparent">
                                            <td className="px-6 py-3">
                                              <FoodAutocomplete
                                                value={item.food}
                                                onChange={(v) => updateMealItem(globalIndex, 'food', v)}
                                                onSelect={(food) => updateMealItem(globalIndex, 'food_object', food)}
                                                onAddNew={(name) => {
                                                  setInitialFoodName(name);
                                                  setActiveMealItemIndex(globalIndex);
                                                  setIsCustomFoodDialogOpen(true);
                                                }}
                                                placeholder="Ex: Arroz Integral"
                                              />
                                            </td>
                                            <td className="px-4 py-3">
                                              <div className="flex items-center gap-1">
                                                <Input 
                                                  value={item.quantity} 
                                                  onChange={(e) => updateMealItem(globalIndex, 'quantity', e.target.value)}
                                                  className="border-none p-0 h-auto focus-visible:ring-0 bg-transparent text-slate-600 print:text-slate-700"
                                                  placeholder="0"
                                                />
                                                <span className="hidden print:inline text-slate-500">{item.unit}</span>
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 print:hidden">
                                              <Select 
                                                value={item.unit} 
                                                onValueChange={(v) => updateMealItem(globalIndex, 'unit', v)}
                                              >
                                                <SelectTrigger className="border-none p-0 h-auto focus:ring-0 bg-transparent shadow-none text-slate-600">
                                                  <SelectValue>
                                                    {item.unit}
                                                  </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="g">g</SelectItem>
                                                  <SelectItem value="un">un</SelectItem>
                                                  <SelectItem value="ml">ml</SelectItem>
                                                  <SelectItem value="colher">colher</SelectItem>
                                                  <SelectItem value="fatia">fatia</SelectItem>
                                                  {item.serving_name && !['g', 'un', 'ml', 'colher', 'fatia', 'unidade'].includes(item.serving_name) && (
                                                    <SelectItem value={item.serving_name}>{item.serving_name}</SelectItem>
                                                  )}
                                                  {item.serving_name === 'unidade' && (
                                                    <SelectItem value="unidade">unidade</SelectItem>
                                                  )}
                                                </SelectContent>
                                              </Select>
                                            </td>
                                            <td className="px-4 py-3">
                                              <Input 
                                                type="number"
                                                value={item.kcal} 
                                                onChange={(e) => updateMealItem(globalIndex, 'kcal', Number(e.target.value))}
                                                className="border-none p-0 h-auto focus-visible:ring-0 bg-transparent text-center text-slate-600 print:text-slate-700"
                                              />
                                            </td>
                                            <td className="px-4 py-3">
                                              <Input 
                                                type="number"
                                                value={item.protein} 
                                                onChange={(e) => updateMealItem(globalIndex, 'protein', Number(e.target.value))}
                                                className="border-none p-0 h-auto focus-visible:ring-0 bg-transparent text-center text-slate-600 print:text-slate-700"
                                              />
                                            </td>
                                            <td className="px-4 py-3">
                                              <Input 
                                                type="number"
                                                value={item.carbs} 
                                                onChange={(e) => updateMealItem(globalIndex, 'carbs', Number(e.target.value))}
                                                className="border-none p-0 h-auto focus-visible:ring-0 bg-transparent text-center text-slate-600 print:text-slate-700"
                                              />
                                            </td>
                                            <td className="px-4 py-3">
                                              <Input 
                                                type="number"
                                                value={item.fat} 
                                                onChange={(e) => updateMealItem(globalIndex, 'fat', Number(e.target.value))}
                                                className="border-none p-0 h-auto focus-visible:ring-0 bg-transparent text-center text-slate-600 print:text-slate-700"
                                              />
                                            </td>
                                            <td className="px-6 py-3 text-center print:hidden">
                                              <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="w-8 h-8 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                                onClick={() => removeMealItem(globalIndex)}
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </Button>
                                            </td>
                                          </tr>
                                        );
                                      })
                                    ) : (
                                      <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic bg-slate-50/20">
                                          Nenhum alimento adicionado a esta refeição.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                              
                              {/* Meal Observation */}
                              <div className="p-4 bg-slate-50/50 border-t border-slate-100 print:hidden">
                                <div className="flex items-start gap-3">
                                  <div className="mt-1 p-1.5 rounded-lg bg-amber-100 text-amber-600 shrink-0">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="flex-1">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Observações da Refeição</Label>
                                    <Textarea 
                                      placeholder="Ex: Beber 200ml de água antes desta refeição..."
                                      className="min-h-[60px] text-sm bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl resize-none"
                                      value={mealObservations[mealType.id] || ''}
                                      onChange={(e) => setMealObservations(prev => ({ ...prev, [mealType.id]: e.target.value }))}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <CustomFoodDialog 
                open={isCustomFoodDialogOpen}
                onOpenChange={setIsCustomFoodDialogOpen}
                initialName={initialFoodName}
                onSuccess={(food) => {
                  if (activeMealItemIndex !== null) {
                    updateMealItem(activeMealItemIndex, 'food_object', food);
                  }
                }}
              />
            </CardHeader>
            <CardContent>
              {mealPlans.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mealPlans.map((plan) => (
                    <div key={plan.id} className="p-4 rounded-xl border border-slate-100 hover:border-emerald-200 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-slate-900">{plan.name || `Plano Alimentar #${plan.id.slice(0, 4)}`}</p>
                          <p className="text-xs text-slate-500">Criado em {formatDateSafely(plan.createdAt, 'dd/MM/yyyy')}</p>
                        </div>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          plan.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        )}>
                          {plan.status === 'active' ? 'Ativo' : 'Arquivado'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => viewMealPlan(plan)}>Visualizar</Button>
                        <Button variant="outline" size="sm" className="flex-1 disabled:opacity-50" onClick={() => editMealPlan(plan)} disabled={patient.status === 'inactive'}>Editar</Button>
                        <PremiumFeature active={isMealPlanLimitReached}>
                          <Button variant="outline" size="sm" className="flex-1 disabled:opacity-50" onClick={() => duplicateMealPlan(plan)} disabled={patient.status === 'inactive'}>Duplicar</Button>
                        </PremiumFeature>
                        <Button variant="ghost" size="sm" className="px-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => sendMealPlanByEmail(plan)} title="Enviar por E-mail">
                          <Mail className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="px-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => exportMealPlanPDF(plan)} title="Imprimir PDF">
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="px-2 text-red-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30" onClick={() => deleteMealPlan(plan.id)} disabled={patient.status === 'inactive'}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  Nenhum plano alimentar cadastrado.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <Dialog open={isViewMealPlanModalOpen} onOpenChange={setIsViewMealPlanModalOpen}>
          <DialogContent className="max-w-6xl w-[98vw] max-h-[95vh] p-0 overflow-hidden flex flex-col rounded-2xl border-none shadow-2xl print-content-wrapper">
            <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
              {/* Header Bar */}
              <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0 z-50 shadow-sm print:hidden">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Button variant="ghost" size="icon" onClick={() => setIsViewMealPlanModalOpen(false)} className="shrink-0 hover:bg-slate-100 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="flex-1 flex flex-col md:flex-row md:items-center gap-3 min-w-0">
                    <div className="flex-1 min-w-[150px] max-w-[400px]">
                      <h2 className="text-lg font-bold text-slate-900 truncate">
                        {selectedMealPlan?.name || "Plano Alimentar"}
                      </h2>
                    </div>
                    <div className="flex-[2] min-w-[200px] max-w-[600px] hidden lg:block">
                      <p className="text-sm text-slate-500 truncate">
                        {selectedMealPlan?.generalInstructions || "Sem instruções gerais"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <Button variant="outline" size="sm" onClick={() => setIsViewMealPlanModalOpen(false)} className="rounded-xl h-8 px-4 text-sm font-bold">
                    Fechar
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 print:p-0">
                {/* Print Header (Only visible when printing) */}
                <div className="hidden print:flex items-center justify-between mb-8 pb-6 border-b border-emerald-200">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xl">
                      N
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 leading-none">NutriCare Pro</h2>
                      <p className="text-xs text-slate-500 mt-1">Gestão Nutricional de Excelência</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-lg font-bold text-emerald-700 uppercase tracking-wider">Plano Alimentar</h3>
                    <p className="text-xs text-slate-500">{selectedMealPlan && formatDateSafely(selectedMealPlan.createdAt, 'dd/MM/yyyy')}</p>
                  </div>
                </div>

                <div className="hidden print:grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-6 bg-white border border-emerald-100 rounded-2xl">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Paciente</p>
                    <p className="font-bold text-slate-800 text-lg">{patient?.name}</p>
                    <p className="text-sm text-slate-500">{patient?.email}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Nutricionista</p>
                    <p className="font-bold text-slate-800 text-lg">{user?.displayName || 'Nutricionista'}</p>
                    <p className="text-sm text-slate-500">CRN: 12345/P</p>
                  </div>
                </div>

                {/* Nutritional Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
                  <Card className="border-none shadow-sm bg-white overflow-hidden print:border print:border-slate-100">
                    <div className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center print:bg-white print:border print:border-orange-100">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Calorias</p>
                        <p className="text-lg font-bold text-slate-900">{viewMealTotals.kcal} <span className="text-xs font-normal text-slate-400">kcal</span></p>
                      </div>
                    </div>
                  </Card>
                  <Card className="border-none shadow-sm bg-white overflow-hidden print:border print:border-slate-100">
                    <div className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center print:bg-white print:border print:border-blue-100">
                        <Dna className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Proteínas</p>
                        <p className="text-lg font-bold text-slate-900">{viewMealTotals.protein.toFixed(1)} <span className="text-xs font-normal text-slate-400">g</span></p>
                      </div>
                    </div>
                  </Card>
                  <Card className="border-none shadow-sm bg-white overflow-hidden print:border print:border-slate-100">
                    <div className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center print:bg-white print:border print:border-emerald-100">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Carbos</p>
                        <p className="text-lg font-bold text-slate-900">{viewMealTotals.carbs.toFixed(1)} <span className="text-xs font-normal text-slate-400">g</span></p>
                      </div>
                    </div>
                  </Card>
                  <Card className="border-none shadow-sm bg-white overflow-hidden print:border print:border-slate-100">
                    <div className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center print:bg-white print:border print:border-purple-100">
                        <Droplets className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Gorduras</p>
                        <p className="text-lg font-bold text-slate-900">{viewMealTotals.fat.toFixed(1)} <span className="text-xs font-normal text-slate-400">g</span></p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Water Intake & General Instructions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
                  <div>
                    <Card className="border-none shadow-sm bg-white overflow-hidden p-6 space-y-4 h-full">
                      <div className="flex items-center gap-3 text-blue-600 mb-2">
                        <div className="p-2 rounded-xl bg-blue-50">
                          <Droplets className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold uppercase tracking-wider text-xs">Meta de Água</h4>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">Quantidade Diária</p>
                        <p className="text-lg font-bold text-slate-900">{selectedMealPlan?.waterIntake || 'Não informada'}</p>
                      </div>
                    </Card>
                  </div>
                  <div>
                    <Card className="border-none shadow-sm bg-white overflow-hidden p-6 space-y-4 h-full">
                      <div className="flex items-center gap-3 text-emerald-600 mb-2">
                        <div className="p-2 rounded-xl bg-emerald-50">
                          <Activity className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold uppercase tracking-wider text-xs">Orientações Gerais</h4>
                      </div>
                      <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {selectedMealPlan?.generalInstructions || 'Nenhuma orientação cadastrada.'}
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Meal Sections */}
                <div className="space-y-8">
                  {mealTypes.map((meal) => {
                    const items = selectedMealPlanItems.filter(item => item.meal === meal.id);
                    if (items.length === 0) return null;

                    return (
                      <Card key={meal.id} className="border-none shadow-sm bg-white overflow-hidden rounded-2xl print:shadow-none print:border print:border-slate-100 break-inside-avoid">
                        <div className={cn("px-6 py-4 flex items-center justify-between border-b print:bg-slate-50", meal.color)}>
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-white/50 backdrop-blur-sm shadow-sm print:bg-white">
                              <meal.icon className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-lg leading-none">{meal.label}</h4>
                              <p className="text-[10px] uppercase font-bold opacity-60 mt-1">{items.length} {items.length === 1 ? 'alimento' : 'alimentos'}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm min-w-[800px]">
                            <thead>
                              <tr className="bg-slate-50/50 text-slate-500 text-left border-b print:bg-slate-50">
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Alimento</th>
                                <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] text-center">Qtd</th>
                                <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] text-center">Unidade</th>
                                <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] text-center">Kcal</th>
                                <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] text-center">P (g)</th>
                                <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] text-center">C (g)</th>
                                <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] text-center">G (g)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-4 font-medium text-slate-800">{item.food}</td>
                                  <td className="px-4 py-4 text-slate-600 text-center">{item.quantity}</td>
                                  <td className="px-4 py-4 text-slate-600 text-center">{item.unit}</td>
                                  <td className="px-4 py-4 text-slate-600 text-center font-mono">{item.kcal || 0}</td>
                                  <td className="px-4 py-4 text-slate-600 text-center font-mono">{item.protein || 0}</td>
                                  <td className="px-4 py-4 text-slate-600 text-center font-mono">{item.carbs || 0}</td>
                                  <td className="px-4 py-4 text-slate-600 text-center font-mono">{item.fat || 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Meal Observation in View Modal */}
                        {selectedMealPlan?.mealObservations?.[meal.id] && (
                          <div className="p-4 bg-amber-50/30 border-t border-amber-100/50">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 p-1.5 rounded-lg bg-amber-100 text-amber-600 shrink-0">
                                <MessageSquare className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1">
                                <p className="text-[10px] uppercase font-bold text-amber-700/60 mb-1">Observações da Refeição</p>
                                <p className="text-sm text-slate-700 leading-relaxed italic">
                                  "{selectedMealPlan.mealObservations[meal.id]}"
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>

                {/* Print Signature */}
                <div className="hidden print:flex flex-col items-center mt-20 pt-10 border-t border-slate-100">
                  <div className="w-64 h-px bg-slate-300 mb-4"></div>
                  <p className="text-base font-bold text-slate-800">{user?.displayName || 'Nutricionista'}</p>
                  <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Assinatura do Profissional</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteMealPlanConfirmOpen} onOpenChange={setIsDeleteMealPlanConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Excluir Plano Alimentar</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir este plano alimentar? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setIsDeleteMealPlanConfirmOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDeleteMealPlan}>Excluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteLabExamConfirmOpen} onOpenChange={setIsDeleteLabExamConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Excluir Exame Laboratorial</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir este exame? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setIsDeleteLabExamConfirmOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDeleteLabExam}>Excluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteConsultationConfirmOpen} onOpenChange={setIsDeleteConsultationConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Excluir Consulta</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir esta consulta? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setIsDeleteConsultationConfirmOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={onDeleteConsultation}>Excluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hidden Print Container - Always in DOM for silent printing */}
        <div className="hidden print-content-wrapper pointer-events-none opacity-0 fixed -z-50">
          <div className="p-8 bg-white">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-emerald-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xl">
                  N
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 leading-none">NutriCare Pro</h2>
                  <p className="text-xs text-slate-500 mt-1">Gestão Nutricional de Excelência</p>
                </div>
              </div>
              <div className="text-right">
                <h3 className="text-lg font-bold text-emerald-700 uppercase tracking-wider">Plano Alimentar</h3>
                <p className="text-xs text-slate-500">{selectedMealPlan && formatDateSafely(selectedMealPlan.createdAt, 'dd/MM/yyyy')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8 p-6 bg-white border border-emerald-100 rounded-2xl">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Paciente</p>
                <p className="font-bold text-slate-800 text-lg">{patient?.name}</p>
                <p className="text-sm text-slate-500">{patient?.email}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Nutricionista</p>
                <p className="font-bold text-slate-800 text-lg">{user?.displayName || 'Nutricionista'}</p>
                <p className="text-sm text-slate-500">CRN: 12345/P</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="p-4 border border-slate-100 rounded-xl text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400">Calorias</p>
                <p className="text-lg font-bold text-slate-900">{viewMealTotals.kcal} kcal</p>
              </div>
              <div className="p-4 border border-slate-100 rounded-xl text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400">Proteínas</p>
                <p className="text-lg font-bold text-slate-900">{viewMealTotals.protein.toFixed(1)} g</p>
              </div>
              <div className="p-4 border border-slate-100 rounded-xl text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400">Carbos</p>
                <p className="text-lg font-bold text-slate-900">{viewMealTotals.carbs.toFixed(1)} g</p>
              </div>
              <div className="p-4 border border-slate-100 rounded-xl text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400">Gorduras</p>
                <p className="text-lg font-bold text-slate-900">{viewMealTotals.fat.toFixed(1)} g</p>
              </div>
            </div>
            
            {selectedMealPlan?.generalInstructions && (
              <div className="mb-8">
                <h4 className="font-bold text-emerald-800 text-sm uppercase tracking-widest mb-2">Orientações Gerais</h4>
                <div className="p-5 bg-white rounded-xl border border-slate-100 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedMealPlan.generalInstructions}
                </div>
              </div>
            )}

            <div className="space-y-8">
              {mealTypes.map((meal) => {
                const items = selectedMealPlanItems.filter(item => item.meal === meal.id);
                if (items.length === 0) return null;

                return (
                  <div key={meal.id} className="border border-slate-100 rounded-2xl overflow-hidden break-inside-avoid">
                    <div className={cn("px-6 py-3 border-b flex items-center gap-3", meal.color)}>
                      <meal.icon className="w-5 h-5" />
                      <h4 className="font-bold text-lg">{meal.label}</h4>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-left border-b">
                          <th className="px-6 py-3 font-bold uppercase text-[10px]">Alimento</th>
                          <th className="px-4 py-3 font-bold uppercase text-[10px] text-center">Qtd</th>
                          <th className="px-4 py-3 font-bold uppercase text-[10px] text-center">Unidade</th>
                          <th className="px-4 py-3 font-bold uppercase text-[10px] text-center">Kcal</th>
                          <th className="px-4 py-3 font-bold uppercase text-[10px] text-center">P (g)</th>
                          <th className="px-4 py-3 font-bold uppercase text-[10px] text-center">C (g)</th>
                          <th className="px-4 py-3 font-bold uppercase text-[10px] text-center">G (g)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-6 py-3 font-medium text-slate-800">{item.food}</td>
                            <td className="px-4 py-3 text-slate-600 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-slate-600 text-center">{item.unit}</td>
                            <td className="px-4 py-3 text-slate-600 text-center">{item.kcal || 0}</td>
                            <td className="px-4 py-3 text-slate-600 text-center">{item.protein || 0}</td>
                            <td className="px-4 py-3 text-slate-600 text-center">{item.carbs || 0}</td>
                            <td className="px-4 py-3 text-slate-600 text-center">{item.fat || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center mt-20 pt-10 border-t border-slate-100">
              <div className="w-64 h-px bg-slate-300 mb-4"></div>
              <p className="text-base font-bold text-slate-800">{user?.displayName || 'Nutricionista'}</p>
              <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Assinatura do Profissional</p>
            </div>
          </div>
        </div>

        <TabsContent value="exams" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Exames Laboratoriais</CardTitle>
                <CardDescription>Histórico de exames e laudos.</CardDescription>
              </div>
              <Dialog open={isLabExamModalOpen} onOpenChange={(open) => {
                setIsLabExamModalOpen(open);
                if (!open) {
                  setExamMarkers([]);
                  setSelectedExam(null);
                  setSelectedExamFile(null);
                }
              }}>
                <PremiumFeature active={isLabExamLimitReached}>
                  <DialogTrigger 
                    render={<Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-4 gap-2 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50" size="sm" disabled={patient.status === 'inactive'} />}
                    nativeButton={true}
                  >
                    <Plus className="w-4 h-4" /> Registrar Exame
                  </DialogTrigger>
                </PremiumFeature>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                  <DialogHeader className="p-6 pb-0">
                    <DialogTitle>{selectedExam ? 'Editar Exame' : 'Novo Exame'}</DialogTitle>
                    <DialogDescription>Insira os dados do exame laboratorial e seus marcadores.</DialogDescription>
                  </DialogHeader>
                  <form key={selectedExam?.id || 'new'} onSubmit={onLabExamSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-blue-900">Anexar PDF do Exame</p>
                            <p className="text-xs text-blue-700">O arquivo ficará salvo para consulta posterior.</p>
                          </div>
                        </div>
                        <div className="relative">
                          <Input 
                            type="file" 
                            accept=".pdf" 
                            className="hidden" 
                            id="pdf-exam-upload" 
                            onChange={handleImportPDFExam}
                            disabled={isUploadingFile}
                          />
                          <label 
                            htmlFor="pdf-exam-upload" 
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "bg-white border-blue-200 text-blue-600 hover:bg-blue-50 gap-2 cursor-pointer inline-flex items-center"
                            )}
                          >
                            {isUploadingFile ? (
                              <span className="flex items-center gap-2">
                                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></span>
                                Fazendo upload...
                              </span>
                            ) : (
                              <>
                                <Download className="w-4 h-4" /> {selectedExamFile || selectedExam?.reportUrl ? 'Alterar PDF' : 'Selecionar PDF'}
                              </>
                            )}
                          </label>
                        </div>
                      </div>

                      {(selectedExamFile || selectedExam?.reportUrl) && (
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-700">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-medium">Arquivo PDF anexado</span>
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="text-emerald-600 hover:text-emerald-700 h-7 text-xs"
                            onClick={() => window.open(selectedExamFile || selectedExam?.reportUrl, '_blank')}
                          >
                            Visualizar
                          </Button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="date">Data do Exame</Label>
                        <Input id="date" name="date" type="date" required defaultValue={selectedExam?.date || new Date().toISOString().split('T')[0]} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="title">Título</Label>
                        <Input id="title" name="title" placeholder="Ex: Exame laboratorial" required defaultValue={selectedExam?.title || ''} />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-800">Resultados</h3>
                        <Button type="button" variant="outline" size="sm" onClick={addExamMarker} className="gap-2">
                          <Plus className="w-4 h-4" /> Adicionar marcador
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {examMarkers.map((marker, index) => (
                          <div key={marker.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 space-y-4 relative">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Marcador {index + 1}</span>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon-sm" 
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => removeExamMarker(marker.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select value={marker.type} onValueChange={(val) => updateExamMarker(marker.id, 'type', val)}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o tipo">
                                      {marker.type}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Glicemia">Glicemia</SelectItem>
                                    <SelectItem value="Hormonal">Hormonal</SelectItem>
                                    <SelectItem value="Lipídico">Lipídico</SelectItem>
                                    <SelectItem value="Hepático">Hepático</SelectItem>
                                    <SelectItem value="Renal">Renal</SelectItem>
                                    <SelectItem value="Hemograma">Hemograma</SelectItem>
                                    <SelectItem value="Outros">Outros</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Nome do Marcador</Label>
                                <Input 
                                  placeholder="Ex: Glicemia em jejum" 
                                  value={marker.name} 
                                  onChange={(e) => updateExamMarker(marker.id, 'name', e.target.value)}
                                  required
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="space-y-2">
                                <Label>Resultado</Label>
                                <Input 
                                  placeholder="95" 
                                  value={marker.result} 
                                  onChange={(e) => updateExamMarker(marker.id, 'result', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Unidade</Label>
                                <Input 
                                  placeholder="mg/dL" 
                                  value={marker.unit} 
                                  onChange={(e) => updateExamMarker(marker.id, 'unit', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Referência</Label>
                                <Input 
                                  placeholder="70-99" 
                                  value={marker.reference} 
                                  onChange={(e) => updateExamMarker(marker.id, 'reference', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={marker.status} onValueChange={(val: any) => updateExamMarker(marker.id, 'status', val)}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Status">
                                      {marker.status === 'normal' ? 'Normal' : 
                                       marker.status === 'alto' ? 'Alto' : 
                                       marker.status === 'baixo' ? 'Baixo' : 
                                       marker.status === 'atencao' ? 'Atenção' : undefined}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="alto">Alto</SelectItem>
                                    <SelectItem value="baixo">Baixo</SelectItem>
                                    <SelectItem value="atencao">Atenção</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        ))}
                        {examMarkers.length === 0 && (
                          <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-xl text-slate-400 text-sm">
                            Nenhum marcador adicionado. Clique em "Adicionar marcador" para começar.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="observations">Observações</Label>
                      <Textarea 
                        id="observations" 
                        name="observations" 
                        placeholder="Observações gerais do exame..." 
                        className="min-h-[100px]" 
                        defaultValue={selectedExam?.observations || ''}
                      />
                    </div>
                  </div>
                  <DialogFooter className="p-6 bg-slate-50 border-t gap-2 sm:gap-0">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsLabExamModalOpen(false)}
                      className="rounded-xl h-8 px-4 border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-all active:scale-95"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-5 font-bold text-sm transition-all shadow-sm active:scale-95"
                    >
                      {selectedExam ? 'Atualizar Exame' : 'Salvar Exame'}
                    </Button>
                  </DialogFooter>
                </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {exams.length > 0 ? (
                <div className="space-y-4">
                  {exams.map((exam) => (
                    <div key={exam.id} className="rounded-xl border border-slate-100 overflow-hidden">
                      <div 
                        className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => toggleExamExpansion(exam.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-slate-400">
                            {expandedExams[exam.id] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{exam.title || 'Exame laboratorial'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-slate-500">{formatDateSafely(exam.date, "dd 'de' MMMM 'de' yyyy")}</p>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                                {exam.markers?.length || 0} marcadores
                              </span>
                              {exam.reportUrl && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                  <FileText className="w-3 h-3" /> PDF Anexado
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon-sm" 
                            className="text-slate-400 hover:text-emerald-600 disabled:opacity-30"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedExam(exam);
                              setExamMarkers(exam.markers || []);
                              setIsLabExamModalOpen(true);
                            }}
                            disabled={patient.status === 'inactive'}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon-sm" 
                            className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteLabExam(exam.id);
                            }}
                            disabled={patient.status === 'inactive'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {expandedExams[exam.id] && (
                        <div className="p-4 bg-slate-50/30 border-t border-slate-100">
                          {exam.reportUrl && (
                            <div className="mb-4 p-3 rounded-lg bg-white border border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-900">Arquivo do Exame</p>
                                  <p className="text-[10px] text-slate-500">Clique para visualizar ou baixar o PDF</p>
                                </div>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 gap-2 text-xs border-slate-200"
                                onClick={() => window.open(exam.reportUrl, '_blank')}
                              >
                                <Download className="w-3 h-3" /> Visualizar PDF
                              </Button>
                            </div>
                          )}
                          <div className="rounded-xl border border-slate-100 bg-white overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 text-slate-500 text-left border-b">
                                  <th className="px-4 py-3 font-bold uppercase text-[10px]">Marcador</th>
                                  <th className="px-4 py-3 font-bold uppercase text-[10px]">Tipo</th>
                                  <th className="px-4 py-3 font-bold uppercase text-[10px]">Resultado</th>
                                  <th className="px-4 py-3 font-bold uppercase text-[10px]">Referência</th>
                                  <th className="px-4 py-3 font-bold uppercase text-[10px]">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {exam.markers?.map((marker) => (
                                  <tr key={marker.id}>
                                    <td className="px-4 py-3 font-bold text-slate-800">{marker.name}</td>
                                    <td className="px-4 py-3">
                                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                                        {marker.type}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="font-bold text-slate-900">{marker.result}</span>
                                      <span className="text-slate-400 ml-1 text-xs">{marker.unit}</span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{marker.reference || '—'}</td>
                                    <td className="px-4 py-3">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                        marker.status === 'normal' ? "bg-emerald-50 text-emerald-600" :
                                        marker.status === 'alto' ? "bg-red-50 text-red-600" :
                                        marker.status === 'baixo' ? "bg-orange-50 text-orange-600" :
                                        "bg-blue-50 text-blue-600"
                                      )}>
                                        {marker.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {exam.observations && (
                            <div className="mt-4 p-3 bg-white rounded-lg border border-slate-100 italic text-slate-500 text-sm">
                              {exam.observations}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  Nenhum exame registrado.
                </div>
              )}

              {hasHiddenHistory && (
                <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-900">Histórico Oculto</p>
                      <p className="text-xs text-emerald-700">Existem exames mais antigos que não estão visíveis no plano gratuito.</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setIsUpgradeModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-8 px-4 text-xs gap-2 shrink-0"
                  >
                    Ver Tudo com Premium
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolution" className="mt-6">
          <PremiumFeature>
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Acompanhamento de Evolução</CardTitle>
                    <CardDescription>Visualize o progresso do paciente ao longo do tempo.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={evolutionMetric} onValueChange={(val: any) => setEvolutionMetric(val)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue>
                          {evolutionMetric === 'weight' ? 'Peso (kg)' : 
                           evolutionMetric === 'fatPercentage' ? 'Gordura Corporal (%)' : 
                           evolutionMetric === 'imc' ? 'IMC' : 
                           evolutionMetric === 'measurements' ? 'Medidas (cm)' : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weight">Peso (kg)</SelectItem>
                        <SelectItem value="fatPercentage">Gordura Corporal (%)</SelectItem>
                        <SelectItem value="imc">IMC</SelectItem>
                        <SelectItem value="measurements">Medidas (cm)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px] w-full min-w-0">
                    {consultations.length > 0 && activeTab === 'evolution' ? (
                      <ResponsiveContainer width="100%" height="100%" debounce={100}>
                        <LineChart data={[...consultations].reverse()}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(date) => formatDateSafely(date, 'dd/MM')}
                            stroke="#94a3b8"
                            fontSize={12}
                          />
                          <YAxis stroke="#94a3b8" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            labelFormatter={(date) => formatDateSafely(date, 'dd/MM/yyyy')}
                          />
                          <Legend verticalAlign="top" height={36}/>
                          
                          {evolutionMetric === 'weight' && (
                            <Line 
                              name="Peso (kg)"
                              type="monotone" 
                              dataKey="weight" 
                              stroke="#10b981" 
                              strokeWidth={3} 
                              dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                          )}
                          
                          {evolutionMetric === 'fatPercentage' && (
                            <Line 
                              name="Gordura (%)"
                              type="monotone" 
                              dataKey="fatPercentage" 
                              stroke="#f59e0b" 
                              strokeWidth={3} 
                              dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                          )}
  
                          {evolutionMetric === 'imc' && (
                            <Line 
                              name="IMC"
                              type="monotone" 
                              dataKey="imc" 
                              stroke="#3b82f6" 
                              strokeWidth={3} 
                              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                          )}
  
                          {evolutionMetric === 'measurements' && (
                            <>
                              <Line 
                                name="Cintura (cm)"
                                type="monotone" 
                                dataKey="waist" 
                                stroke="#6366f1" 
                                strokeWidth={2} 
                                dot={{ r: 3, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                              />
                              <Line 
                                name="Quadril (cm)"
                                type="monotone" 
                                dataKey="hip" 
                                stroke="#ec4899" 
                                strokeWidth={2} 
                                dot={{ r: 3, fill: '#ec4899', strokeWidth: 2, stroke: '#fff' }}
                              />
                              <Line 
                                name="Abdômen (cm)"
                                type="monotone" 
                                dataKey="abdomen" 
                                stroke="#8b5cf6" 
                                strokeWidth={2} 
                                dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                              />
                              <Line 
                                name="Braço (cm)"
                                type="monotone" 
                                dataKey="arm" 
                                stroke="#06b6d4" 
                                strokeWidth={2} 
                                dot={{ r: 3, fill: '#06b6d4', strokeWidth: 2, stroke: '#fff' }}
                              />
                            </>
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400">
                        Dados insuficientes para gerar o gráfico.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
  
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tabela Comparativa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                        <tr>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Peso</th>
                          <th className="px-4 py-3">IMC</th>
                          <th className="px-4 py-3">% Gordura</th>
                          <th className="px-4 py-3">Cintura</th>
                          <th className="px-4 py-3">Abdômen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {consultations.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium">{formatDateSafely(c.date, 'dd/MM/yyyy')}</td>
                            <td className="px-4 py-3">{c.weight}kg</td>
                            <td className="px-4 py-3">{c.imc.toFixed(1)}</td>
                            <td className="px-4 py-3">{c.fatPercentage || '-'}%</td>
                            <td className="px-4 py-3">{c.waist || '-'}cm</td>
                            <td className="px-4 py-3">{c.abdomen || '-'}cm</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </PremiumFeature>
        </TabsContent>
      </Tabs>

      {/* Edit Patient Modal */}
      <Dialog open={isEditPatientModalOpen} onOpenChange={setIsEditPatientModalOpen}>
        <DialogContent className="sm:max-w-3xl rounded-2xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle>Editar Perfil do Paciente</DialogTitle>
            <DialogDescription>Atualize as informações cadastrais do paciente.</DialogDescription>
          </DialogHeader>
          <form key={patient.id} onSubmit={onEditPatientSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input id="name" name="name" defaultValue={patient.name} required className="bg-slate-50 border-none rounded-xl h-8 text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" defaultValue={patient.email} required className="bg-slate-50 border-none rounded-xl h-8 text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input 
                  id="phone" 
                  name="phone" 
                  value={editPhone} 
                  onChange={(e) => setEditPhone(maskPhone(e.target.value))}
                  required 
                  className="bg-slate-50 border-none rounded-xl h-8 text-sm" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input 
                  id="cpf" 
                  name="cpf" 
                  value={editCpf} 
                  onChange={(e) => setEditCpf(maskCPF(e.target.value))}
                  required 
                  className="bg-slate-50 border-none rounded-xl h-8 text-sm" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de Nascimento</Label>
                <Input id="birthDate" name="birthDate" type="date" defaultValue={patient.birthDate} required className="bg-slate-50 border-none rounded-xl h-8 text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gênero</Label>
                <Select name="gender" value={gender} onValueChange={(v: any) => setGender(v)}>
                  <SelectTrigger className="bg-slate-50 border-none rounded-xl h-8 text-sm">
                    <SelectValue placeholder="Selecione o gênero">
                      {gender === 'male' ? 'Masculino' : 
                       gender === 'female' ? 'Feminino' : 
                       gender === 'other' ? 'Outro' : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="female">Feminino</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input id="address" name="address" defaultValue={patient.address} className="bg-slate-50 border-none rounded-xl h-8 text-sm" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="diseases">Doenças</Label>
                <Textarea id="diseases" name="diseases" defaultValue={patient.diseases} placeholder="Ex: Diabetes, Hipertensão..." className="bg-slate-50 border-none rounded-xl text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medications">Medicamentos</Label>
                <Textarea id="medications" name="medications" defaultValue={patient.medications} placeholder="Ex: Metformina, Losartana..." className="bg-slate-50 border-none rounded-xl text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allergies">Alergias</Label>
                <Textarea id="allergies" name="allergies" defaultValue={patient.allergies} placeholder="Ex: Lactose, Glúten, Amendoim..." className="bg-slate-50 border-none rounded-xl text-sm" />
              </div>
            </div>
            <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditPatientModalOpen(false)}
                className="rounded-xl h-8 px-4 border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-all active:scale-95"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-5 font-bold text-sm transition-all shadow-sm active:scale-95"
              >
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UpgradeModal 
        isOpen={isUpgradeModalOpen} 
        onClose={() => setIsUpgradeModalOpen(false)} 
      />
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
