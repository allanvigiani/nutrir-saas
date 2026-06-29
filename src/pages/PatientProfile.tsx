import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  User,
  Calendar,
  FileText,
  Beaker,
  TrendingUp,
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
  CloudMoon,
  Dna,
  Zap,
  Droplets,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Calculator,
  X
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
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { useAuth } from '../contexts/AuthContext';
import { FREE_PLAN_LIMITS, isAdminOrPremium } from '../lib/planLimits';
import { auth } from '../lib/firebase';
import { apiRequest } from '../hooks/useApi';
import { Patient, Consultation, MealPlan, MealPlanItem, LabExam, LabExamMarker, CustomFood, NutritionCalculation } from '../types';
import { format, differenceInYears, parseISO, subMonths, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PremiumFeature } from '../components/PremiumFeature';
import { PremiumBanner } from '../components/PremiumBanner';
import { UpgradeModal } from '../components/UpgradeModal';
import { useFreeplanLimits } from '../hooks/useFreeplanLimits';
import { maskCPF, maskPhone } from '../lib/masks';
import { cn } from '../lib/utils';
import { FoodAutocomplete } from '../components/FoodAutocomplete';
import { TacoFood } from '../data/taco';
import { CustomFoodDialog } from '../components/CustomFoodDialog';
import { NutritionalCalculator } from '../components/NutritionalCalculator';
import { MealPlanEditor } from '../components/MealPlanEditor';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

import { toast } from 'sonner';
import { logEvent } from '../lib/firebase';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
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


const SummaryCard = ({ label, value, total, unit, color, progressColor, icon: Icon }: any) => (
  <Card className="border-none shadow-sm bg-card overflow-hidden rounded-2xl ring-1 ring-border hover:shadow-md transition-all duration-300">
    <div className="p-4 flex items-center gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <p className="text-lg font-bold text-foreground leading-none">
          {Number(value).toFixed(1)}
          <span className="text-xs font-medium text-muted-foreground ml-1">
            {total ? `/ ${Number(total).toFixed(0)}` : ''} {unit}
          </span>
        </p>
        {total && (
          <div className="w-full bg-muted h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", progressColor)}
              style={{ width: `${Math.min((value / total) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  </Card>
);

const EvolutionTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const formattedLabel = typeof label === 'string' && label.length === 10
    ? format(parseISO(label), 'dd/MM/yyyy', { locale: ptBR })
    : format(new Date(label), 'dd/MM/yyyy', { locale: ptBR });
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-[13px]">
      <p className="font-semibold text-foreground mb-1">{formattedLabel}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.stroke }} />
          {entry.name}: <span className="font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

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
  const [patient, setPatient] = useState<Patient | null>(null);
  const [gender, setGender] = useState<string>('');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [exams, setExams] = useState<LabExam[]>([]);
  const [calculations, setCalculations] = useState<NutritionCalculation[]>([]);
  const [hasHiddenHistory, setHasHiddenHistory] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isConsultationModalOpen, setIsConsultationModalOpen] = useState(false);
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
  const [selectedConsultationForCalc, setSelectedConsultationForCalc] = useState<Consultation | null>(null);
  const [selectedExistingCalc, setSelectedExistingCalc] = useState<NutritionCalculation | null>(null);
  const [isCustomFoodDialogOpen, setIsCustomFoodDialogOpen] = useState(false);
  const [initialFoodName, setInitialFoodName] = useState('');
  const [activeMealItemIndex, setActiveMealItemIndex] = useState<number | null>(null);
  const [isLabExamModalOpen, setIsLabExamModalOpen] = useState(false);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);

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
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlan | null>(null);
  const [selectedMealPlanItems, setSelectedMealPlanItems] = useState<MealPlanItem[]>([]);

  const isPremium = isAdminOrPremium(nutritionist);
  const isPatientReadOnly = !isPremium && !!(patient as any)?.isReadOnly;
  const isMealPlanLimitReached = !isPremium && mealPlans.filter(p => p.status === 'active').length >= FREE_PLAN_LIMITS.maxMealPlans;
  const isLabExamLimitReached = !isPremium && exams.length >= FREE_PLAN_LIMITS.maxExams;
  const {
    canAddConsultation,
    patientAlreadyHasConsultationThisMonth,
    consultationsThisMonth,
    isLoading: limitsLoading,
  } = useFreeplanLimits(id);


  const viewMealTotals = selectedMealPlanItems.reduce((acc, item) => ({
    kcal: acc.kcal + (Number(item.kcal) || 0),
    protein: acc.protein + (Number(item.protein) || 0),
    carbs: acc.carbs + (Number(item.carbs) || 0),
    fat: acc.fat + (Number(item.fat) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const defaultMealTypes: any[] = [];

  const generateMealPlanPDF = (plan: MealPlan, items: MealPlanItem[], receitasVinculadas?: Array<{ meal: string; recipe: { name: string; ingredients: Array<{ name: string; quantity: string; unit: string }>; prepMode?: string } }>) => {
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
    const mealsToDisplay = plan.customMeals && plan.customMeals.length > 0 ? plan.customMeals : defaultMealTypes;

    mealsToDisplay.forEach((meal) => {
      const mealItems = items.filter(i => i.meal === meal.id);
      if (mealItems.length === 0) return;

      const mealLabel = meal.label;
      const mealTime = meal.time ? ` (${meal.time})` : '';
      const observation = plan.mealObservations?.[meal.id];

      // Meal Header
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(14, currentY, pageWidth - 28, 10, 'F');
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${mealLabel.toUpperCase()}${mealTime}`, 18, currentY + 7);

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

    // Receitas vinculadas ao plano — agrupadas por refeição
    if (receitasVinculadas && receitasVinculadas.length > 0) {
      // Agrupa mantendo a ordem de aparição, deduplicando receita dentro de cada grupo
      const grupos = new Map<string, typeof receitasVinculadas>();
      for (const link of receitasVinculadas) {
        if (!grupos.has(link.meal)) grupos.set(link.meal, []);
        const grupo = grupos.get(link.meal)!;
        const jaExiste = grupo.some((l) => l.recipe.name === link.recipe.name);
        if (!jaExiste) grupo.push(link);
      }

      if (currentY > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        currentY = 20;
      }

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('RECEITAS', 14, currentY + 10);
      doc.line(14, currentY + 12, pageWidth - 14, currentY + 12);
      currentY += 20;

      for (const [meal, links] of grupos) {
        if (currentY > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          currentY = 20;
        }

        // Cabeçalho da refeição
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(meal.toUpperCase(), 14, currentY);
        currentY += 3;
        doc.setDrawColor(203, 213, 225);
        doc.line(14, currentY, pageWidth - 14, currentY);
        currentY += 6;

        for (const { recipe } of links) {
          if (currentY > doc.internal.pageSize.getHeight() - 50) {
            doc.addPage();
            currentY = 20;
          }

          // Título da receita
          doc.setFillColor(241, 245, 249);
          doc.rect(14, currentY, pageWidth - 28, 10, 'F');
          doc.setTextColor(15, 23, 42);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(recipe.name, 18, currentY + 7);
          currentY += 14;

          // Ingredientes
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105);
          doc.text('Ingredientes:', 14, currentY);
          currentY += 5;

          recipe.ingredients.forEach((ing) => {
            if (currentY > doc.internal.pageSize.getHeight() - 20) {
              doc.addPage();
              currentY = 20;
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            doc.text(`• ${ing.quantity} ${ing.unit} de ${ing.name}`, 18, currentY);
            currentY += 5;
          });

          // Modo de preparo
          if (recipe.prepMode) {
            currentY += 3;
            if (currentY > doc.internal.pageSize.getHeight() - 30) {
              doc.addPage();
              currentY = 20;
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            doc.text('Modo de Preparo:', 14, currentY);
            currentY += 5;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            const splitPrepMode = doc.splitTextToSize(recipe.prepMode, pageWidth - 28);
            splitPrepMode.forEach((linha: string) => {
              if (currentY > doc.internal.pageSize.getHeight() - 15) {
                doc.addPage();
                currentY = 20;
              }
              doc.text(linha, 14, currentY);
              currentY += 5;
            });
          }

          currentY += 8;
        }

        currentY += 6;
      }
    }

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
        `Gerado por Nutrir em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    return doc;
  };

  const handleExportPDF = (plan: MealPlan, items: MealPlanItem[], receitasVinculadas?: Array<{ meal: string; recipe: { name: string; ingredients: Array<{ name: string; quantity: string; unit: string }>; prepMode?: string } }>) => {
    const doc = generateMealPlanPDF(plan, items, receitasVinculadas);
    doc.save(`Plano_Alimentar_${patient?.name.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`);
  };

  const sendMealPlanByEmail = async (plan: MealPlan) => {
    if (!user || !patient) return;
    const toastId = toast.loading("Preparando e-mail com plano alimentar...");

    try {
      const token = await auth.currentUser?.getIdToken();
      const [itemsRes, receitasEmailRes] = await Promise.all([
        fetch(`/api/meal-plans/${plan.id}/items`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/meal-plans/${plan.id}/recipes`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const items: MealPlanItem[] = itemsRes.ok ? await itemsRes.json() : [];
      const receitasEmail = receitasEmailRes.ok ? await receitasEmailRes.json() : [];

      const doc = generateMealPlanPDF(plan, items, receitasEmail);
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const fileName = `Plano_Alimentar_${patient.name.replace(/\s+/g, '_')}.pdf`;

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
      const token = await auth.currentUser?.getIdToken();
      const [itemsRes, receitasRes] = await Promise.all([
        fetch(`/api/meal-plans/${plan.id}/items`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/meal-plans/${plan.id}/recipes`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const items: MealPlanItem[] = itemsRes.ok ? await itemsRes.json() : [];
      const receitasVinculadas = receitasRes.ok ? await receitasRes.json() : [];

      handleExportPDF(plan, items, receitasVinculadas);
      void logEvent('exportar_pdf_plano_alimentar');
      toast.success("PDF gerado com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF.", { id: toastId });
    }
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

    if (!isPremium && !selectedConsultation) {
      if (!canAddConsultation) {
        toast.error(`Limite de ${FREE_PLAN_LIMITS.maxConsultationsPerMonth} consultas mensais atingido no plano gratuito.`);
        return;
      }
      if (patientAlreadyHasConsultationThisMonth) {
        toast.error('Este paciente já possui uma consulta este mês. O plano gratuito permite 1 por paciente por mês.');
        return;
      }
    }

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
        await apiRequest(`/api/consultations/${selectedConsultation.id}`, 'PATCH', {
          ...cleanData,
          imc,
          updatedAt: new Date().toISOString(),
        });
        toast.success('Consulta atualizada com sucesso!');
      } else {
        await apiRequest(`/api/patients/${id}/consultations`, 'POST', {
          ...cleanData,
          imc,
          patientId: id,
          nutritionistId: user.uid,
          accessToken: patient?.access_token || (patient as any)?.accessToken || null,
          status: 'realized',
        });
        void logEvent('nova_consulta');
        toast.success('Consulta registrada com sucesso!');
      }

      setIsConsultationModalOpen(false);
      setSelectedConsultation(null);
      resetConsultation();
      await refetchPatientData();
    } catch (error) {
      console.error("Error saving consultation:", error);
      toast.error('Erro ao salvar consulta.');
    }
  };

  const onDeleteConsultation = async () => {
    if (!consultationToDelete) return;
    try {
      await apiRequest(`/api/consultations/${consultationToDelete}`, 'DELETE');
      toast.success('Consulta excluída com sucesso!');
      setIsDeleteConsultationConfirmOpen(false);
      setConsultationToDelete(null);
      await refetchPatientData();
    } catch (error) {
      console.error("Error deleting consultation:", error);
      toast.error('Erro ao excluir consulta.');
    }
  };


  const viewMealPlan = async (plan: MealPlan) => {
    if (!user) return;
    setSelectedMealPlan(plan);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/meal-plans/${plan.id}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const items: MealPlanItem[] = res.ok ? await res.json() : [];
      setSelectedMealPlanItems(items);
      setIsViewMealPlanModalOpen(true);
    } catch (error) {
      console.error("Error fetching meal plan items:", error);
      toast.error("Erro ao carregar itens do plano alimentar.");
    }
  };

  const editMealPlan = (plan: MealPlan) => {
    navigate(`/patients/${id}/meal-plan/${plan.id}`);
  };

  const deleteMealPlan = async (planId: string) => {
    if (!user) return;
    setMealPlanToDelete(planId);
    setIsDeleteMealPlanConfirmOpen(true);
  };

  const confirmDeleteMealPlan = async () => {
    if (!user || !mealPlanToDelete) return;
    try {
      await apiRequest(`/api/meal-plans/${mealPlanToDelete}`, 'DELETE');
      toast.success('Plano alimentar excluído!');
      setMealPlans(mealPlans.filter(p => p.id !== mealPlanToDelete));
      setIsDeleteMealPlanConfirmOpen(false);
      setMealPlanToDelete(null);
    } catch (error) {
      console.error("Error deleting meal plan:", error);
      toast.error('Erro ao excluir plano alimentar.');
    }
  };



  const toggleExamExpansion = (examId: string) => {
    setExpandedExams(prev => ({ ...prev, [examId]: !prev[examId] }));
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
      const examPayload = {
        date: formData.get('date') as string,
        title: formData.get('title') as string,
        observations: formData.get('observations') as string,
        markers: examMarkers,
        patientId: id,
        nutritionistId: user.uid,
        accessToken: patient?.access_token || (patient as any)?.accessToken || null,
      };

      if (selectedExam) {
        await apiRequest(`/api/lab-exams/${selectedExam.id}`, 'PATCH', examPayload);
        toast.success('Exame atualizado com sucesso!');
      } else {
        await apiRequest(`/api/patients/${id}/lab-exams`, 'POST', examPayload);
        toast.success('Exame registrado com sucesso!');
      }

      setIsLabExamModalOpen(false);
      setExamMarkers([]);
      setSelectedExam(null);
      await refetchPatientData();
    } catch (error) {
      console.error("Error saving exam:", error);
      toast.error('Erro ao salvar exame.');
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
      await apiRequest(`/api/lab-exams/${labExamToDelete}`, 'DELETE');
      toast.success('Exame excluído com sucesso!');
      setExams(exams.filter(e => e.id !== labExamToDelete));
      setIsDeleteLabExamConfirmOpen(false);
      setLabExamToDelete(null);
    } catch (error) {
      console.error("Error deleting exam:", error);
      toast.error('Erro ao excluir exame.');
    }
  };

  const handleSaveCalculation = async (input: any, result: any, name: string) => {
    if (!selectedConsultationForCalc || !user || !id) return;
    try {
      if (selectedExistingCalc) {
        await apiRequest(`/api/calculations/${selectedExistingCalc.id}`, 'PUT', { input, result });
      } else {
        await apiRequest<NutritionCalculation>(`/api/patients/${id}/calculations`, 'POST', {
          patientId: id,
          consultationId: selectedConsultationForCalc.id,
          nutritionistId: user.uid,
          name,
          input,
          result,
        });
      }
      setIsCalculatorModalOpen(false);
      setSelectedExistingCalc(null);
      await refetchPatientData();
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  // editPhone e editCpf removidos — inputs usam defaultValue + masking direto no DOM

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
      await apiRequest(`/api/patients/${id}`, 'PATCH', data);
      toast.success('Dados do paciente atualizados com sucesso!');
      setIsEditPatientModalOpen(false);
      setPatient({ ...patient, ...data });
    } catch (error) {
      console.error("Error updating patient:", error);
      toast.error('Erro ao atualizar dados do paciente.');
    }
  };

  const refetchPatientData = async () => {
    if (!id || !user) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [consultationsRes, mealPlansRes, examsRes, calculationsRes] = await Promise.all([
        fetch(`/api/patients/${id}/consultations`, { headers }),
        fetch(`/api/patients/${id}/meal-plans`, { headers }),
        fetch(`/api/patients/${id}/lab-exams`, { headers }),
        fetch(`/api/patients/${id}/calculations`, { headers }),
      ]);
      if (consultationsRes.ok) setConsultations((await consultationsRes.json()).sort((a: Consultation, b: Consultation) => parseISO(b.date).getTime() - parseISO(a.date).getTime()));
      if (mealPlansRes.ok) setMealPlans((await mealPlansRes.json()).sort((a: MealPlan, b: MealPlan) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      if (examsRes.ok) setExams(await examsRes.json());
      if (calculationsRes.ok) setCalculations(await calculationsRes.json());
    } catch (err) {
      console.error('Error refetching patient data:', err);
    }
  };

  useEffect(() => {
    if (!isAuthReady || !id || !user) return;

    const loadPatientData = async () => {
      setLoading(true);
      try {
        const token = await auth.currentUser?.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [patientRes, consultationsRes, mealPlansRes, examsRes, calculationsRes] = await Promise.all([
          fetch(`/api/patients/${id}`, { headers }),
          fetch(`/api/patients/${id}/consultations`, { headers }),
          fetch(`/api/patients/${id}/meal-plans`, { headers }),
          fetch(`/api/patients/${id}/lab-exams`, { headers }),
          fetch(`/api/patients/${id}/calculations`, { headers }),
        ]);

        if (!patientRes.ok) {
          toast.error('Paciente não encontrado.');
          navigate('/patients');
          return;
        }

        const patientData: Patient = await patientRes.json();
        setPatient(patientData);
        setGender(patientData.gender);

        let fetchedConsultations: Consultation[] = consultationsRes.ok ? await consultationsRes.json() : [];
        let fetchedExams: LabExam[] = examsRes.ok ? await examsRes.json() : [];
        const fetchedPlans: MealPlan[] = mealPlansRes.ok ? await mealPlansRes.json() : [];
        const fetchedCalculations: NutritionCalculation[] = calculationsRes.ok ? await calculationsRes.json() : [];

        setMealPlans(fetchedPlans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setCalculations(fetchedCalculations.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        }));

        // Apply premium restrictions: history limit for free plan
        if (nutritionist?.plan === 'free') {
          const historyMonths = FREE_PLAN_LIMITS.historyMonths;
          const historyLimitDate = subMonths(new Date(), historyMonths);

          const originalConsultationsCount = fetchedConsultations.length;
          const originalExamsCount = fetchedExams.length;

          fetchedConsultations = fetchedConsultations.filter(c => isAfter(new Date(c.date), historyLimitDate));
          fetchedExams = fetchedExams.filter(e => isAfter(new Date(e.date), historyLimitDate));

          if (fetchedConsultations.length < originalConsultationsCount || fetchedExams.length < originalExamsCount) {
            setHasHiddenHistory(true);
          }
        }

        setConsultations(fetchedConsultations.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()));
        setExams(fetchedExams.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()));
      } catch (error) {
        console.error('Error fetching patient data:', error);
        toast.error('Erro ao carregar dados do paciente.');
      } finally {
        setLoading(false);
      }
    };

    loadPatientData();
  }, [id, user, navigate, isAuthReady, nutritionist?.plan]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!patient) return null;

  const age = differenceInYears(new Date(), new Date(patient.birthDate));

  return (
    <div className="space-y-8">

      {isPatientReadOnly && (
        <div className="bg-accent/30 border border-accent-foreground/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-accent-foreground shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-accent-foreground">Paciente em somente leitura</p>
            <p className="text-accent-foreground/80 mt-0.5">
              Este paciente excede o limite do plano gratuito. Você pode visualizar o histórico, mas novas consultas, planos e exames estão bloqueados.{' '}
              <Link to="/settings" className="underline font-medium">Fazer upgrade</Link>
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button nativeButton={false} variant="ghost" size="icon" render={<Link to="/patients" />} title="Voltar para lista de pacientes">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xl sm:text-2xl">
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-3xl font-bold text-foreground">{patient.name}</h1>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                  onClick={() => setIsEditPatientModalOpen(true)}
                                   title="Editar dados cadastrais"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground text-sm">
                <span>{age} anos</span>
                <span>•</span>
                <span>{patient.cpf}</span>
                <span>•</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
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
              render={<Button className="bg-primary hover:bg-primary/90 text-white rounded-xl h-8 px-4 gap-2 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50" onClick={() => {
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
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
              <DialogHeader>
                <DialogTitle>{selectedConsultation ? 'Editar Consulta' : 'Registrar Nova Consulta'}</DialogTitle>
                <DialogDescription>Preencha os dados antropométricos e clínicos do atendimento.</DialogDescription>
              </DialogHeader>
              <form key={isConsultationModalOpen ? 'open' : 'closed'} onSubmit={handleConsultationSubmit(onConsultationSubmit)} className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="date">Data da Consulta</Label>
                    <Input id="date" type="date" {...regConsultation('date')} className="bg-muted/30 rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="weight">Peso</Label>
                    <div className="relative">
                      <Input id="weight" type="number" step="0.1" {...regConsultation('weight')} className="bg-muted/30 rounded-lg pr-10" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none select-none">kg</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="height">Altura</Label>
                    <div className="relative">
                      <Input id="height" type="number" step="0.1" {...regConsultation('height')} className="bg-muted/30 rounded-lg pr-10" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none select-none">cm</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-4">Medidas e Circunferências</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="fatPercentage">Gordura Corp.</Label>
                      <div className="relative">
                        <Input id="fatPercentage" type="number" step="0.1" {...regConsultation('fatPercentage')} className="bg-muted/30 rounded-lg pr-7" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none select-none">%</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="waist">Cintura</Label>
                      <div className="relative">
                        <Input id="waist" type="number" step="0.1" {...regConsultation('waist')} className="bg-muted/30 rounded-lg pr-10" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none select-none">cm</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hip">Quadril</Label>
                      <div className="relative">
                        <Input id="hip" type="number" step="0.1" {...regConsultation('hip')} className="bg-muted/30 rounded-lg pr-10" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none select-none">cm</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="abdomen">Abdômen</Label>
                      <div className="relative">
                        <Input id="abdomen" type="number" step="0.1" {...regConsultation('abdomen')} className="bg-muted/30 rounded-lg pr-10" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none select-none">cm</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="arm">Braço</Label>
                      <div className="relative">
                        <Input id="arm" type="number" step="0.1" {...regConsultation('arm')} className="bg-muted/30 rounded-lg pr-10" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none select-none">cm</span>
                      </div>
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
                    className="rounded-xl h-8 px-4 border-border text-muted-foreground text-sm hover:bg-muted/30 transition-all active:scale-95"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary hover:bg-primary/90 text-white rounded-xl h-8 px-5 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50"
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
        <TabsList className="flex w-full items-center justify-start gap-2 bg-transparent border-b border-border p-0 rounded-none h-auto mb-8 overflow-x-auto">
          <TabsTrigger value="personal" className="relative gap-2 px-3 py-3 md:px-4 md:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap">
            <User className="w-4 h-4" /> Dados Pessoais
          </TabsTrigger>

          <TabsTrigger value="consultations" className="relative gap-2 px-3 py-3 md:px-4 md:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap">
            <Calendar className="w-4 h-4" /> Consultas
          </TabsTrigger>
          <TabsTrigger value="mealplans" className="relative gap-2 px-3 py-3 md:px-4 md:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap">
            <FileText className="w-4 h-4" /> Planos Alimentares
          </TabsTrigger>
          <TabsTrigger value="exams" className="relative gap-2 px-3 py-3 md:px-4 md:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap">
            <Beaker className="w-4 h-4" /> Exames
          </TabsTrigger>
          <TabsTrigger value="evolution" className="relative gap-2 px-3 py-3 md:px-4 md:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap">
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
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">E-mail</p>
                      <p className="font-medium text-foreground">{patient.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="font-medium text-foreground">{patient.phone}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Endereço</p>
                    <p className="font-medium text-foreground">{patient.address}</p>
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
                  <p className="text-xs text-muted-foreground font-medium">Objetivo</p>
                  <p className="font-medium text-foreground">{patient.objective}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Atividade Física</p>
                  <p className="font-medium text-foreground">{patient.activityLevel}</p>
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
                    <p className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Activity className="w-4 h-4 text-muted-foreground" /> Doenças
                    </p>
                    <p className="text-muted-foreground text-sm">{patient.diseases || 'Nenhuma informada'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Beaker className="w-4 h-4 text-muted-foreground" /> Medicamentos
                    </p>
                    <p className="text-muted-foreground text-sm">{patient.medications || 'Nenhum informado'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-foreground flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-muted-foreground" /> Alergias
                    </p>
                    <p className="text-muted-foreground text-sm">{patient.allergies || 'Nenhuma informada'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="consultations" className="mt-0">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-6">
              <div>
                <CardTitle className="text-lg font-bold">Histórico de Consultas</CardTitle>
                <CardDescription>Visualize todos os atendimentos realizados.</CardDescription>
              </div>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-white rounded-xl h-8 px-4 gap-2 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50"
                onClick={() => setIsConsultationModalOpen(true)}
                disabled={isPatientReadOnly || (!isPremium && (limitsLoading || !canAddConsultation || patientAlreadyHasConsultationThisMonth))}
              >
                <Plus className="w-4 h-4" /> Nova Consulta
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              {!isPremium && !limitsLoading && !canAddConsultation && (
                <PremiumBanner
                  className="mb-6"
                  title="Limite de consultas do mês atingido"
                  description={`Você usou ${consultationsThisMonth}/${FREE_PLAN_LIMITS.maxConsultationsPerMonth} consultas em ${format(new Date(), 'MMMM', { locale: ptBR })}. Assine o Premium para consultas ilimitadas.`}
                />
              )}
              {!isPremium && !limitsLoading && canAddConsultation && patientAlreadyHasConsultationThisMonth && (
                <PremiumBanner
                  className="mb-6"
                  title="Paciente já atendido este mês"
                  description={`Este paciente já possui uma consulta em ${format(new Date(), 'MMMM', { locale: ptBR })}. O plano gratuito permite 1 consulta por paciente por mês.`}
                />
              )}
              {consultations.length > 0 ? (
                <div className="space-y-4">
                  {consultations.map((consultation) => (
                    <div key={consultation.id} className="border border-border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-sm">
                      <div
                        className={cn(
                          "flex items-center justify-between p-4 cursor-pointer transition-colors",
                          expandedConsultations[consultation.id] ? "bg-muted/30 border-b border-border" : "bg-card hover:bg-muted/30"
                        )}
                        onClick={() => setExpandedConsultations(prev => ({ ...prev, [consultation.id]: !prev[consultation.id] }))}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-muted flex flex-col items-center justify-center text-muted-foreground">
                            <span className="text-[10px] font-medium capitalize">{formatDateSafely(consultation.date, 'MMM')}</span>
                            <span className="text-lg font-bold leading-none">{formatDateSafely(consultation.date, 'dd')}</span>
                          </div>
                          <div>
                            <p className="font-bold text-foreground">Consulta de Rotina</p>
                            <p className="text-sm text-muted-foreground">Peso: {consultation.weight}kg • IMC: {consultation.imc.toFixed(1)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            consultation.status === 'realized' ? "bg-primary/15 text-primary" : "bg-destructive/10 text-destructive"
                          )}>
                            {consultation.status === 'realized' ? 'Realizada' : 'Cancelada'}
                          </span>

                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-primary disabled:opacity-30" title="Editar consulta" onClick={(e) => {
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
                            <Button variant="ghost" size="icon-sm" className="text-destructive/70 hover:text-destructive disabled:opacity-30" title="Excluir consulta" onClick={(e) => {
                              e.stopPropagation();
                              setConsultationToDelete(consultation.id);
                              setIsDeleteConsultationConfirmOpen(true);
                            }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          {expandedConsultations[consultation.id] ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {expandedConsultations[consultation.id] && (
                        <div className="p-6 bg-card space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            <div className="p-3 rounded-xl bg-muted/30 border border-border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Altura</p>
                              <p className="font-bold text-foreground">{consultation.height}m</p>
                            </div>
                            <div className="p-3 rounded-xl bg-muted/30 border border-border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Gordura</p>
                              <p className="font-bold text-foreground">{consultation.fatPercentage || '--'}%</p>
                            </div>
                            <div className="p-3 rounded-xl bg-muted/30 border border-border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Cintura</p>
                              <p className="font-bold text-foreground">{consultation.waist || '--'}cm</p>
                            </div>
                            <div className="p-3 rounded-xl bg-muted/30 border border-border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Quadril</p>
                              <p className="font-bold text-foreground">{consultation.hip || '--'}cm</p>
                            </div>
                            <div className="p-3 rounded-xl bg-muted/30 border border-border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Braço</p>
                              <p className="font-bold text-foreground">{consultation.arm || '--'}cm</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                  <AlertCircle className="w-3 h-3 text-primary" /> Queixas Principais
                                </h4>
                                <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 p-4 rounded-xl border border-border min-h-[80px]">
                                  {consultation.complaints || 'Nenhuma queixa registrada.'}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                  <TrendingUp className="w-3 h-3 text-primary" /> Objetivos
                                </h4>
                                <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 p-4 rounded-xl border border-border min-h-[80px]">
                                  {consultation.objectives || 'Nenhum objetivo registrado.'}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                  <FileText className="w-3 h-3 text-primary" /> Anamnese / Evolução
                                </h4>
                                <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 p-4 rounded-xl border border-border min-h-[180px] whitespace-pre-wrap">
                                  {consultation.anamnesis || 'Nenhuma anamnese registrada.'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {consultation.observations && (
                            <div className="pt-4 border-t border-border">
                              <h4 className="text-xs font-medium text-muted-foreground mb-2">Observações Adicionais</h4>
                              <p className="text-sm text-muted-foreground italic">{consultation.observations}</p>
                            </div>
                          )}

                          <div className="pt-6 border-t border-border mt-6">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-sm font-bold text-muted-foreground">
                                Cálculos Nutricionais
                              </h4>
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const planDaConsulta = mealPlans.find(p => p.consultation_id === consultation.id);
                                    const calcDaConsulta = calculations.find(c => c.consultation_id === consultation.id);
                                    const semCalculo = !planDaConsulta && !calcDaConsulta;
                                    return (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger render={<span />}>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="text-primary border-primary/60 bg-primary/5 hover:bg-primary/15 hover:border-primary h-8 text-xs font-semibold gap-1.5 shadow-sm"
                                              disabled={isPatientReadOnly || semCalculo}
                                              onClick={() => {
                                                if (planDaConsulta) {
                                                  navigate(`/patients/${id}/meal-plan/${planDaConsulta.id}`);
                                                } else {
                                                  navigate(`/patients/${id}/meal-plan/new`, {
                                                    state: {
                                                      consultationId: consultation.id,
                                                      ...(calcDaConsulta ? { calculation: calcDaConsulta } : {}),
                                                    },
                                                  });
                                                }
                                              }}
                                            >
                                              <Plus className="w-3.5 h-3.5" />
                                              {planDaConsulta ? 'Editar Plano' : 'Criar Plano'}
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent side="bottom">
                                            {planDaConsulta
                                              ? 'Editar o plano alimentar desta consulta'
                                              : semCalculo
                                                ? 'Realize um cálculo nutricional para esta consulta antes de criar o plano alimentar'
                                                : 'Criar plano alimentar vinculado a esta consulta'}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  })()}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger render={<span />}>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-primary border-primary/60 bg-primary/5 hover:bg-primary/15 hover:border-primary h-8 text-xs font-semibold gap-1.5 shadow-sm"
                                          onClick={() => {
                                            const existing = calculations.find(c => c.consultation_id === consultation.id) ?? null;
                                            setSelectedConsultationForCalc(consultation);
                                            setSelectedExistingCalc(existing);
                                            setIsCalculatorModalOpen(true);
                                          }}
                                        >
                                          <Calculator className="w-3.5 h-3.5" />
                                          {calculations.some(c => c.consultation_id === consultation.id) ? 'Editar Cálculo' : 'Novo Cálculo'}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom">
                                        {calculations.some(c => c.consultation_id === consultation.id)
                                          ? 'Editar o cálculo nutricional desta consulta'
                                          : 'Calcular necessidades nutricionais do paciente'}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                            </div>

                            {calculations.filter(c => c.consultation_id === consultation.id).length > 0 ? (
                              <div className="grid gap-3">
                                {calculations.filter(c => c.consultation_id === consultation.id).map(calc => (
                                  <div key={calc.id} className="p-4 border border-border rounded-xl bg-muted/30 space-y-3">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="font-bold text-foreground text-sm">{calc.name}</p>
                                        <p className="text-xs text-muted-foreground">{formatDateSafely(calc.createdAt, "dd 'de' MMMM 'de' yyyy")}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-black text-primary">{calc.result.getAjustado} kcal</p>
                                        <p className="text-[10px] text-muted-foreground font-medium">{calc.result.formulaUtilizada.replace('_', '/')}</p>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="bg-card p-2 rounded-lg border border-border text-center">
                                        <p className="text-[10px] text-muted-foreground font-medium">Proteína</p>
                                        <p className="text-xs font-bold text-muted-foreground">{calc.result.macronutrientes.ptnG}g</p>
                                      </div>
                                      <div className="bg-card p-2 rounded-lg border border-border text-center">
                                        <p className="text-[10px] text-muted-foreground font-medium">Carboidratos</p>
                                        <p className="text-xs font-bold text-muted-foreground">{calc.result.macronutrientes.choG}g</p>
                                      </div>
                                      <div className="bg-card p-2 rounded-lg border border-border text-center">
                                        <p className="text-[10px] text-muted-foreground font-medium">Gorduras</p>
                                        <p className="text-xs font-bold text-muted-foreground">{calc.result.macronutrientes.lipG}g</p>
                                      </div>
                                    </div>

                                    <div className="pt-2 mt-2 border-t border-border grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Peso Utilizado:</span>
                                        <span className="font-bold text-muted-foreground">{calc.result.pesoUtilizado} kg</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Gasto Energético:</span>
                                        <span className="font-bold text-muted-foreground">{calc.result.get} kcal</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Nível Atividade:</span>
                                        <span className="font-bold text-muted-foreground">{calc.input.nivelAtividade}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Objetivo:</span>
                                        <span className="font-bold text-muted-foreground capitalize">{calc.input.objetivo}</span>
                                      </div>
                                    </div>

                                    {calc.result.alertas.length > 0 && (
                                      <div className="bg-accent/20 p-2 rounded-lg border border-accent-foreground/20 mt-2">
                                        <p className="text-[10px] font-medium text-accent-foreground mb-1 flex items-center gap-1">
                                          <AlertCircle className="w-3 h-3" /> Alertas
                                        </p>
                                        <ul className="space-y-1">
                                          {calc.result.alertas.map((alerta: string, i: number) => (
                                            <li key={i} className="text-xs text-accent-foreground/80 leading-tight">• {alerta}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic bg-muted/30 p-4 rounded-xl border border-border text-center">Nenhum cálculo realizado para esta consulta.</p>
                            )}
                          </div>

                          {/* Plano Alimentar da Consulta */}
                          {(() => {
                            const planDaConsulta = mealPlans.find(p => p.consultation_id === consultation.id);
                            if (!planDaConsulta) return null;
                            const refeicoes = planDaConsulta.customMeals ?? [];
                            return (
                              <div className="mt-4">
                                <div className="flex items-center mb-3">
                                  <h4 className="text-sm font-bold text-muted-foreground">Plano Alimentar</h4>
                                </div>
                                <div className="bg-muted/30 rounded-xl border border-border p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-foreground">{planDaConsulta.name}</p>
                                    <span className={cn(
                                      "text-[10px] font-medium px-2 py-0.5 rounded-md",
                                      planDaConsulta.status === 'active' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                    )}>
                                      {planDaConsulta.status === 'active' ? 'Ativo' : 'Arquivado'}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {refeicoes.length > 0 ? refeicoes.map((r: any) => (
                                      <span key={r.id} className="text-[11px] bg-card border border-border rounded-md px-2 py-0.5 text-muted-foreground">
                                        {r.label}{r.time ? ` · ${r.time}` : ''}
                                      </span>
                                    )) : (
                                      <span className="text-xs text-muted-foreground">Nenhuma refeição adicionada</span>
                                    )}
                                  </div>
                                  {planDaConsulta.waterIntake && (
                                    <p className="text-[11px] text-muted-foreground pt-1">💧 Ingestão de água: {planDaConsulta.waterIntake}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="w-10 h-10 opacity-20 mx-auto mb-3" />
                  <p className="font-medium text-sm">Nenhuma consulta registrada</p>
                  <p className="text-xs mt-1 max-w-xs mx-auto">Clique em "Nova Consulta" para registrar o primeiro atendimento.</p>
                </div>
              )}

              {hasHiddenHistory && (
                <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Histórico Oculto</p>
                      <p className="text-xs text-primary">Existem consultas mais antigas que não estão visíveis no plano gratuito.</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsUpgradeModalOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-8 px-4 text-xs gap-2 shrink-0"
                  >
                    Ver Tudo com Premium
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mealplans" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Planos Alimentares</CardTitle>
                <CardDescription>Gerencie as dietas prescritas.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {mealPlans.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mealPlans.map((plan) => (
                    <div key={plan.id} className="p-4 rounded-xl border border-border hover:border-primary/30 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-foreground">{plan.name || `Plano Alimentar #${plan.id.slice(0, 4)}`}</p>
                          <p className="text-xs text-muted-foreground">Criado em {formatDateSafely(plan.createdAt, 'dd/MM/yyyy')}</p>
                        </div>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          plan.status === 'active' ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {plan.status === 'active' ? 'Ativo' : 'Arquivado'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => viewMealPlan(plan)}>Visualizar</Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => editMealPlan(plan)}>Editar</Button>

                        <Button variant="ghost" size="sm" className="px-2 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => sendMealPlanByEmail(plan)} title="Enviar por E-mail">
                          <Mail className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="px-2 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => exportMealPlanPDF(plan)} title="Imprimir PDF">
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="px-2 text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-30" onClick={() => deleteMealPlan(plan.id)} title="Excluir plano">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-2 font-medium">Nenhum plano alimentar criado.</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    Os planos alimentares são criados vinculados a uma consulta ou a partir de um cálculo nutricional.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <Dialog open={isViewMealPlanModalOpen} onOpenChange={setIsViewMealPlanModalOpen}>
          <DialogContent className="max-w-6xl w-[98vw] max-h-[95vh] p-0 overflow-hidden flex flex-col rounded-2xl border-none shadow-2xl print-content-wrapper">
            <div className="flex flex-col h-full bg-muted/30 overflow-hidden">
              {/* Header Bar */}
              <div className="bg-card border-b px-6 py-4 flex items-center justify-between shrink-0 z-50 shadow-sm print:hidden">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Button variant="ghost" size="icon" onClick={() => setIsViewMealPlanModalOpen(false)} className="shrink-0 hover:bg-muted rounded-full" title="Fechar visualização">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="flex-1 flex flex-col md:flex-row md:items-center gap-3 min-w-0">
                    <div className="flex-1 min-w-[150px] max-w-[400px]">
                      <h2 className="text-lg font-bold text-foreground truncate">
                        {selectedMealPlan?.name || "Plano Alimentar"}
                      </h2>
                    </div>
                    <div className="flex-[2] min-w-[200px] max-w-[600px] hidden lg:block">
                      <p className="text-sm text-muted-foreground truncate">
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
                <div className="hidden print:flex items-center justify-between px-8 py-5 -mx-6 -mt-6 mb-6" style={{ backgroundColor: 'var(--primary, #16a34a)', color: 'white' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>N</div>
                    <div>
                      <div className="font-bold text-lg leading-none">Nutrir</div>
                      <div className="text-xs mt-0.5" style={{ opacity: 0.8 }}>Gestão Nutricional</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-base">Plano Alimentar</div>
                    <div className="text-xs mt-0.5" style={{ opacity: 0.8 }}>
                      {selectedMealPlan && formatDateSafely(selectedMealPlan.createdAt, 'dd/MM/yyyy')}
                    </div>
                  </div>
                </div>

                <div className="hidden print:grid grid-cols-2 gap-4 mb-6 p-5 border border-gray-200 rounded-xl">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Paciente</p>
                    <p className="font-bold text-gray-900 text-base">{patient?.name}</p>
                    {patient?.email && <p className="text-xs text-gray-500 mt-0.5">{patient.email}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nutricionista</p>
                    <p className="font-bold text-gray-900 text-base">{nutritionist?.name || user?.displayName || 'Nutricionista'}</p>
                    {nutritionist?.crn && <p className="text-xs text-gray-500 mt-0.5">CRN: {nutritionist.crn}</p>}
                  </div>
                </div>

                {/* Print: Macro totais */}
                <div className="hidden print:grid grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'Calorias', value: `${viewMealTotals.kcal}`, unit: 'kcal', accent: 'var(--primary, #16a34a)' },
                    { label: 'Proteínas', value: viewMealTotals.protein.toFixed(1), unit: 'g', accent: '#6b7280' },
                    { label: 'Carboidratos', value: viewMealTotals.carbs.toFixed(1), unit: 'g', accent: '#6b7280' },
                    { label: 'Gorduras', value: viewMealTotals.fat.toFixed(1), unit: 'g', accent: '#6b7280' },
                  ].map((macro) => (
                    <div key={macro.label} className="rounded-xl border border-gray-200 p-3 text-center" style={{ borderTop: `3px solid ${macro.accent}` }}>
                      <p className="text-[10px] text-gray-500 font-medium">{macro.label}</p>
                      <p className="font-bold text-lg text-gray-900 leading-tight mt-0.5">{macro.value}</p>
                      <p className="text-[10px] text-gray-400">{macro.unit}</p>
                    </div>
                  ))}
                </div>

                {/* Print: Orientações gerais */}
                {selectedMealPlan?.generalInstructions && (
                  <div className="hidden print:block mb-6 rounded-xl p-4" style={{ borderLeft: '4px solid var(--primary, #16a34a)', backgroundColor: '#f0fdf4' }}>
                    <p className="text-xs font-bold text-gray-700 mb-1">Orientações Gerais</p>
                    <p className="text-sm text-gray-600 italic whitespace-pre-wrap leading-relaxed">
                      {selectedMealPlan.generalInstructions}
                    </p>
                  </div>
                )}

                {/* Print: Refeições com subtotais e observações */}
                <div className="hidden print:block space-y-5 mb-6">
                  {(selectedMealPlan?.customMeals && selectedMealPlan.customMeals.length > 0
                    ? selectedMealPlan.customMeals
                    : defaultMealTypes
                  ).map((meal: any) => {
                    const items = selectedMealPlanItems.filter(item => item.meal === meal.id);
                    if (items.length === 0) return null;
                    const subtotal = items.reduce(
                      (acc, i) => ({
                        kcal: acc.kcal + (Number(i.kcal) || 0),
                        protein: acc.protein + (Number(i.protein) || 0),
                        carbs: acc.carbs + (Number(i.carbs) || 0),
                        fat: acc.fat + (Number(i.fat) || 0),
                      }),
                      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
                    );
                    const obs = (selectedMealPlan as any)?.mealObservations?.[meal.id];
                    return (
                      <div key={meal.id} className="rounded-xl border border-gray-200 overflow-hidden" style={{ breakInside: 'avoid' }}>
                        <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #d1fae5' }}>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800">{meal.label}</span>
                            {meal.time && <span className="text-xs text-gray-500 bg-black/5 px-1.5 py-0.5 rounded font-medium">{meal.time}</span>}
                          </div>
                          <span className="text-xs text-gray-600 font-medium">
                            {subtotal.kcal} kcal · {subtotal.protein.toFixed(1)}g P · {subtotal.carbs.toFixed(1)}g C · {subtotal.fat.toFixed(1)}g G
                          </span>
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-5 py-2 text-left font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Alimento</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Quantidade</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Kcal</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wide">P (g)</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wide">C (g)</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wide">G (g)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, idx) => (
                              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-5 py-2 font-medium text-gray-800">{item.food}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{item.quantity || '0'} {item.unit || 'g'}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{item.kcal || 0}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{Number(item.protein || 0).toFixed(1)}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{Number(item.carbs || 0).toFixed(1)}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{Number(item.fat || 0).toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {obs && (
                          <div className="px-5 py-3 text-xs text-gray-600 italic border-t border-gray-100 bg-yellow-50">
                            <span className="font-semibold not-italic text-gray-700">Obs.: </span>{obs}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Print: Tabela de Medidas Caseiras */}
                <div className="hidden print:block mt-4 pt-4 border-t border-gray-200 mb-6">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Tabela de Medidas Caseiras (Referência)</p>
                  <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">Medida</th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-600 border-b border-gray-200">Peso aprox.</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">Medida</th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-600 border-b border-gray-200">Peso aprox.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Colher de chá', '~4 g', 'Copo (200ml)', '~200 ml'],
                        ['Colher de sobremesa', '~9 g', 'Concha pequena', '~80 g'],
                        ['Colher de sopa', '~13 g', 'Concha média', '~150 g'],
                        ['Colher de servir', '~30 g', 'Xícara (sólidos)', '~80 g'],
                        ['Unidade (fruta média)', '~130 g', 'Xícara (líquidos)', '~200 ml'],
                        ['Fatia (fruta)', '~80 g', 'Lata', '~350 ml'],
                      ].map(([m1, p1, m2, p2], i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-1.5 text-gray-700">{m1}</td>
                          <td className="px-4 py-1.5 text-center text-gray-500">{p1}</td>
                          <td className="px-4 py-1.5 text-gray-700">{m2}</td>
                          <td className="px-4 py-1.5 text-center text-gray-500">{p2}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[9px] text-gray-400 mt-1.5 italic">
                    Valores de referência (Pinheiro et al. 2004 / TBCA). Pesos reais variam conforme o alimento e forma de preparo.
                  </p>
                </div>

                {/* Print: Rodapé assinatura */}
                <div className="hidden print:flex flex-col items-center mt-6 pt-4">
                  <div style={{ height: '48px' }} />
                  <div className="w-56 border-t border-gray-400 pt-3 text-center">
                    <p className="font-bold text-gray-800 text-sm">{nutritionist?.name || user?.displayName || 'Nutricionista'}</p>
                    {nutritionist?.crn && <p className="text-xs text-gray-500 mt-0.5">CRN: {nutritionist.crn}</p>}
                  </div>
                  <p className="text-[9px] text-gray-400 mt-4">
                    Gerado em {formatDateSafely(new Date().toISOString(), 'dd/MM/yyyy')}
                  </p>
                </div>

                {/* Nutritional Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
                  <SummaryCard label="Calorias" value={viewMealTotals.kcal} unit="kcal" icon={Activity} color="bg-primary/10 text-primary" progressColor="bg-primary" />
                  <SummaryCard label="Proteínas" value={viewMealTotals.protein} unit="g" icon={Dna} color="bg-primary/10 text-primary" progressColor="bg-primary" />
                  <SummaryCard label="Carboidratos" value={viewMealTotals.carbs} unit="g" icon={Zap} color="bg-primary/10 text-primary" progressColor="bg-primary" />
                  <SummaryCard label="Gorduras" value={viewMealTotals.fat} unit="g" icon={Droplets} color="bg-muted text-muted-foreground" progressColor="bg-muted-foreground" />
                </div>

                {/* Water Intake & General Instructions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
                  <div>
                    <Card className="border-none shadow-sm bg-card overflow-hidden p-6 space-y-4 h-full">
                      <div className="flex items-center gap-3 text-primary mb-2">
                        <div className="p-2 rounded-xl bg-primary/10">
                          <Droplets className="w-5 h-5" />
                        </div>
                        <h4 className="font-medium text-xs">Meta de Água</h4>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Quantidade Diária</p>
                        <p className="text-lg font-bold text-foreground">{selectedMealPlan?.waterIntake || 'Não informada'}</p>
                      </div>
                    </Card>
                  </div>
                  <div>
                    <Card className="border-none shadow-sm bg-card overflow-hidden p-6 space-y-4 h-full">
                      <div className="flex items-center gap-3 text-primary mb-2">
                        <div className="p-2 rounded-xl bg-primary/10">
                          <Activity className="w-5 h-5" />
                        </div>
                        <h4 className="font-medium text-xs">Orientações Gerais</h4>
                      </div>
                      <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {selectedMealPlan?.generalInstructions || 'Nenhuma orientação cadastrada.'}
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Meal Sections */}
                <div className="space-y-8">
                  {(selectedMealPlan?.customMeals && selectedMealPlan.customMeals.length > 0
                    ? selectedMealPlan.customMeals
                    : defaultMealTypes).map((meal) => {
                      const items = selectedMealPlanItems.filter(item => item.meal === meal.id);
                      if (items.length === 0) return null;
                      
                      const mealTotals = items.reduce((acc, item) => ({
                        kcal: acc.kcal + (Number(item.kcal) || 0),
                        protein: acc.protein + (Number(item.protein) || 0),
                        carbs: acc.carbs + (Number(item.carbs) || 0),
                        fat: acc.fat + (Number(item.fat) || 0),
                      }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

                      const getIcon = (label: string) => {
                        const l = label.toLowerCase();
                        if (l.includes('café') || l.includes('desjejum')) return Coffee;
                        if (l.includes('almoço')) return Utensils;
                        if (l.includes('jantar') || l.includes('noite')) return Moon;
                        if (l.includes('lanche')) return Apple;
                        if (l.includes('ceia')) return CloudMoon;
                        if (l.includes('treino')) return Activity;
                        if (l.includes('suco') || l.includes('vitamina') || l.includes('shake')) return Droplets;
                        return Activity;
                      };

                      const Icon = getIcon(meal.label);

                      return (
                        <Card key={meal.id} className="border-none shadow-sm bg-card overflow-hidden rounded-2xl print:shadow-none print:border print:border-border break-inside-avoid relative">
                          <div className={cn("absolute top-0 left-0 w-1.5 h-full transition-colors", meal.color.split(' ')[0])} />
                          <div className={cn("px-6 py-5 flex items-center justify-between border-b print:bg-muted/30", meal.color.split(' ')[0], "bg-opacity-5")}>
                            <div className="flex items-center gap-4">
                              <div className={cn("p-2.5 rounded-2xl bg-card shadow-sm ring-1 ring-black/5 print:bg-card", meal.color.split(' ')[2])}>
                                <Icon className="w-6 h-6" />
                              </div>
                              <div>
                                <div className="flex items-center gap-3">
                                  <h4 className="font-bold text-xl leading-none">{meal.label}</h4>
                                  {meal.time && <span className="text-xs font-medium opacity-50 bg-black/5 px-2 py-0.5 rounded-full">{meal.time}</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[10px] font-medium opacity-50">{items.length} {items.length === 1 ? 'alimento' : 'alimentos'}</span>
                                  <span className="w-1 h-1 rounded-full bg-black/10" />
                                  <div className="flex items-center gap-2 text-[10px] font-bold opacity-60">
                                    <span>{mealTotals.kcal.toFixed(0)} kcal</span>
                                    <span>P: {mealTotals.protein.toFixed(1)}g</span>
                                    <span>C: {mealTotals.carbs.toFixed(1)}g</span>
                                    <span>G: {mealTotals.fat.toFixed(1)}g</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[800px]">
                              <thead>
                                <tr className="bg-muted/30 text-muted-foreground text-left border-b">
                                  <th className="px-6 py-4 font-medium text-[11px] text-muted-foreground">Alimento</th>
                                  <th className="px-4 py-4 font-medium text-[11px] text-muted-foreground text-center">Qtd</th>
                                  <th className="px-4 py-4 font-medium text-[11px] text-muted-foreground text-center">Unidade</th>
                                  <th className="px-4 py-4 font-medium text-[11px] text-muted-foreground text-center">Kcal</th>
                                  <th className="px-4 py-4 font-medium text-[11px] text-muted-foreground text-center">P (g)</th>
                                  <th className="px-4 py-4 font-medium text-[11px] text-muted-foreground text-center">C (g)</th>
                                  <th className="px-4 py-4 font-medium text-[11px] text-muted-foreground text-center">G (g)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {items.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-6 py-4 font-medium text-foreground">{item.food}</td>
                                    <td className="px-4 py-4 text-muted-foreground text-center">{item.quantity}</td>
                                    <td className="px-4 py-4 text-muted-foreground text-center">{item.unit}</td>
                                    <td className="px-4 py-4 text-muted-foreground text-center font-mono">{item.kcal || 0}</td>
                                    <td className="px-4 py-4 text-muted-foreground text-center font-mono">{item.protein || 0}</td>
                                    <td className="px-4 py-4 text-muted-foreground text-center font-mono">{item.carbs || 0}</td>
                                    <td className="px-4 py-4 text-muted-foreground text-center font-mono">{item.fat || 0}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Meal Observation in View Modal */}
                          {selectedMealPlan?.mealObservations?.[meal.id] && (
                            <div className="p-4 bg-accent/10 border-t border-accent-foreground/10">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 p-1.5 rounded-lg bg-accent/20 text-accent-foreground shrink-0">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-[10px] font-medium text-accent-foreground/70 mb-1">Observações da Refeição</p>
                                  <p className="text-sm text-muted-foreground leading-relaxed italic">
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

              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteMealPlanConfirmOpen} onOpenChange={setIsDeleteMealPlanConfirmOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
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
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
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
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
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
          <div className="bg-white text-gray-900" style={{ fontFamily: 'system-ui, sans-serif', width: '210mm', minHeight: '297mm', padding: '0' }}>

            {/* 1. Cabeçalho */}
            <div className="flex items-center justify-between px-8 py-5" style={{ backgroundColor: 'var(--primary, #16a34a)', color: 'white' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-xl">N</div>
                <div>
                  <div className="font-bold text-lg leading-none">Nutrir</div>
                  <div className="text-xs opacity-80 mt-0.5">Gestão Nutricional</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-base">Plano Alimentar</div>
                <div className="text-xs opacity-80 mt-0.5">
                  {selectedMealPlan && formatDateSafely(selectedMealPlan.createdAt, 'dd/MM/yyyy')}
                </div>
              </div>
            </div>

            <div className="px-8 py-6 space-y-6">

              {/* 2. Identificação: Paciente + Nutricionista */}
              <div className="grid grid-cols-2 gap-4 p-5 rounded-xl border border-gray-200">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Paciente</p>
                  <p className="font-bold text-gray-900 text-base">{patient?.name}</p>
                  {patient?.email && <p className="text-xs text-gray-500 mt-0.5">{patient.email}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nutricionista</p>
                  <p className="font-bold text-gray-900 text-base">{nutritionist?.name || user?.displayName || 'Nutricionista'}</p>
                  {nutritionist?.crn && <p className="text-xs text-gray-500 mt-0.5">CRN: {nutritionist.crn}</p>}
                </div>
              </div>

              {/* 3. Resumo de macros totais */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Calorias', value: `${viewMealTotals.kcal}`, unit: 'kcal', accent: 'var(--primary, #16a34a)' },
                  { label: 'Proteínas', value: viewMealTotals.protein.toFixed(1), unit: 'g', accent: '#6b7280' },
                  { label: 'Carboidratos', value: viewMealTotals.carbs.toFixed(1), unit: 'g', accent: '#6b7280' },
                  { label: 'Gorduras', value: viewMealTotals.fat.toFixed(1), unit: 'g', accent: '#6b7280' },
                ].map((macro) => (
                  <div key={macro.label} className="rounded-xl border border-gray-200 p-3 text-center" style={{ borderTop: `3px solid ${macro.accent}` }}>
                    <p className="text-[10px] text-gray-500 font-medium">{macro.label}</p>
                    <p className="font-bold text-lg text-gray-900 leading-tight mt-0.5">{macro.value}</p>
                    <p className="text-[10px] text-gray-400">{macro.unit}</p>
                  </div>
                ))}
              </div>

              {/* 4. Orientações gerais */}
              {selectedMealPlan?.generalInstructions && (
                <div className="rounded-xl p-4" style={{ borderLeft: '4px solid var(--primary, #16a34a)', backgroundColor: '#f0fdf4' }}>
                  <p className="text-xs font-bold text-gray-700 mb-1">Orientações Gerais</p>
                  <p className="text-sm text-gray-600 italic whitespace-pre-wrap leading-relaxed">
                    {selectedMealPlan.generalInstructions}
                  </p>
                </div>
              )}

              {/* 5. Refeições */}
              <div className="space-y-5">
                {(selectedMealPlan?.customMeals && selectedMealPlan.customMeals.length > 0
                  ? selectedMealPlan.customMeals
                  : defaultMealTypes
                ).map((meal: any) => {
                  const items = selectedMealPlanItems.filter(item => item.meal === meal.id);
                  if (items.length === 0) return null;

                  const subtotal = items.reduce(
                    (acc, i) => ({
                      kcal: acc.kcal + (Number(i.kcal) || 0),
                      protein: acc.protein + (Number(i.protein) || 0),
                      carbs: acc.carbs + (Number(i.carbs) || 0),
                      fat: acc.fat + (Number(i.fat) || 0),
                    }),
                    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
                  );

                  const obs = (selectedMealPlan as any)?.mealObservations?.[meal.id];

                  return (
                    <div key={meal.id} className="rounded-xl border border-gray-200 overflow-hidden" style={{ breakInside: 'avoid' }}>
                      {/* Header da refeição */}
                      <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #d1fae5' }}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">{meal.label}</span>
                          {meal.time && (
                            <span className="text-xs text-gray-500 bg-black/5 px-1.5 py-0.5 rounded font-medium">{meal.time}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-600 font-medium">
                          {subtotal.kcal} kcal · {subtotal.protein.toFixed(1)}g P · {subtotal.carbs.toFixed(1)}g C · {subtotal.fat.toFixed(1)}g G
                        </span>
                      </div>

                      {/* Tabela de alimentos */}
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-5 py-2 text-left font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Alimento</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Quantidade</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Kcal</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wide">P (g)</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wide">C (g)</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wide">G (g)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => {
                            const unit = item.unit || 'g';
                            const qty = item.quantity || '0';
                            const qtyDisplay = `${qty} ${unit}`;
                            return (
                              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-5 py-2 font-medium text-gray-800">{item.food}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{qtyDisplay}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{item.kcal || 0}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{Number(item.protein || 0).toFixed(1)}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{Number(item.carbs || 0).toFixed(1)}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{Number(item.fat || 0).toFixed(1)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Observações da refeição */}
                      {obs && (
                        <div className="px-5 py-3 text-xs text-gray-600 italic border-t border-gray-100 bg-yellow-50">
                          <span className="font-semibold not-italic text-gray-700">Obs.: </span>{obs}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 6. Tabela de Medidas Caseiras */}
              <div className="mt-6 pt-5 border-t border-gray-200">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Tabela de Medidas Caseiras (Referência)</p>
                <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">Medida</th>
                      <th className="px-4 py-2 text-center font-semibold text-gray-600 border-b border-gray-200">Peso aprox.</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">Medida</th>
                      <th className="px-4 py-2 text-center font-semibold text-gray-600 border-b border-gray-200">Peso aprox.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Colher de chá', '~4 g', 'Copo (200ml)', '~200 ml'],
                      ['Colher de sobremesa', '~9 g', 'Concha pequena', '~80 g'],
                      ['Colher de sopa', '~13 g', 'Concha média', '~150 g'],
                      ['Colher de servir', '~30 g', 'Xícara (sólidos)', '~80 g'],
                      ['Unidade (fruta média)', '~130 g', 'Xícara (líquidos)', '~200 ml'],
                      ['Fatia (fruta)', '~80 g', 'Lata', '~350 ml'],
                    ].map(([m1, p1, m2, p2], i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-1.5 text-gray-700">{m1}</td>
                        <td className="px-4 py-1.5 text-center text-gray-500">{p1}</td>
                        <td className="px-4 py-1.5 text-gray-700">{m2}</td>
                        <td className="px-4 py-1.5 text-center text-gray-500">{p2}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[9px] text-gray-400 mt-1.5 italic">
                  Valores de referência (Pinheiro et al. 2004 / TBCA). Pesos reais variam conforme o alimento e forma de preparo.
                </p>
              </div>

              {/* 7. Rodapé — Assinatura/Carimbo */}
              <div className="mt-8 pt-6 flex flex-col items-center">
                <div style={{ height: '48px' }} /> {/* espaço para assinatura manuscrita */}
                <div className="w-56 border-t border-gray-400 pt-3 text-center">
                  <p className="font-bold text-gray-800 text-sm">{nutritionist?.name || user?.displayName || 'Nutricionista'}</p>
                  {nutritionist?.crn && (
                    <p className="text-xs text-gray-500 mt-0.5">CRN: {nutritionist.crn}</p>
                  )}
                </div>
                <p className="text-[9px] text-gray-400 mt-4">
                  Gerado em {formatDateSafely(new Date().toISOString(), 'dd/MM/yyyy')}
                </p>
              </div>

            </div>
          </div>
        </div>

        <TabsContent value="exams" className="mt-0">
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

                }
              }}>
                <PremiumFeature active={isLabExamLimitReached || isPatientReadOnly}>
                  <DialogTrigger
                    render={<Button className="bg-primary hover:bg-primary/90 text-white rounded-xl h-8 px-4 gap-2 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50" size="sm" disabled={isPatientReadOnly} />}
                    nativeButton={true}
                  >
                    <Plus className="w-4 h-4" /> Registrar Exame
                  </DialogTrigger>
                </PremiumFeature>
                <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl">
                  <DialogHeader className="p-6 pb-0">
                    <DialogTitle>{selectedExam ? 'Editar Exame' : 'Novo Exame'}</DialogTitle>
                    <DialogDescription>Insira os dados do exame laboratorial e seus marcadores.</DialogDescription>
                  </DialogHeader>
                  <form key={selectedExam?.id || 'new'} onSubmit={onLabExamSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">


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
                          <h3 className="font-bold text-foreground">Resultados</h3>
                          <Button type="button" variant="outline" size="sm" onClick={addExamMarker} className="gap-2">
                            <Plus className="w-4 h-4" /> Adicionar marcador
                          </Button>
                        </div>

                        <div className="space-y-4">
                          {examMarkers.map((marker, index) => (
                            <div key={marker.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-4 relative">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Marcador {index + 1}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => removeExamMarker(marker.id)}
                                  title="Remover este marcador"
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
                            <div className="text-center py-8 border-2 border-dashed border-border rounded-xl text-muted-foreground text-sm">
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
                    <DialogFooter className="p-6 bg-muted/30 border-t gap-2 sm:gap-0">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsLabExamModalOpen(false)}
                        className="rounded-xl h-8 px-4 border-border text-muted-foreground text-sm hover:bg-muted/30 transition-all active:scale-95"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        className="bg-primary hover:bg-primary/90 text-white rounded-xl h-8 px-5 font-bold text-sm transition-all shadow-sm active:scale-95"
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
                    <div key={exam.id} className="rounded-xl border border-border overflow-hidden">
                      <div
                        className="flex items-center justify-between p-4 bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => toggleExamExpansion(exam.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-muted-foreground">
                            {expandedExams[exam.id] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{exam.title || 'Exame laboratorial'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-muted-foreground">{formatDateSafely(exam.date, "dd 'de' MMMM 'de' yyyy")}</p>
                              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                                {exam.markers?.length || 0} marcadores
                              </span>

                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-primary disabled:opacity-30"
                            title="Editar exame"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedExam(exam);
                              setExamMarkers(exam.markers || []);
                              setIsLabExamModalOpen(true);
                            }}
                                                     >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                            title="Excluir exame"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteLabExam(exam.id);
                            }}
                                                     >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {expandedExams[exam.id] && (
                        <div className="p-4 bg-muted/20 border-t border-border">

                          <div className="rounded-xl border border-border bg-card overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/30 text-muted-foreground text-left border-b">
                                  <th className="px-4 py-3 font-medium text-[11px] text-muted-foreground">Marcador</th>
                                  <th className="px-4 py-3 font-medium text-[11px] text-muted-foreground">Tipo</th>
                                  <th className="px-4 py-3 font-medium text-[11px] text-muted-foreground">Resultado</th>
                                  <th className="px-4 py-3 font-medium text-[11px] text-muted-foreground">Referência</th>
                                  <th className="px-4 py-3 font-medium text-[11px] text-muted-foreground">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {exam.markers?.map((marker) => (
                                  <tr key={marker.id}>
                                    <td className="px-4 py-3 font-bold text-foreground">{marker.name}</td>
                                    <td className="px-4 py-3">
                                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
                                        {marker.type}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="font-bold text-foreground">{marker.result}</span>
                                      <span className="text-muted-foreground ml-1 text-xs">{marker.unit}</span>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{marker.reference || '—'}</td>
                                    <td className="px-4 py-3">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                                        marker.status === 'normal' ? "bg-primary/10 text-primary" :
                                          marker.status === 'alto' ? "bg-destructive/10 text-destructive" :
                                            marker.status === 'baixo' ? "bg-accent/20 text-accent-foreground" :
                                              "bg-muted text-muted-foreground"
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
                            <div className="mt-4 p-3 bg-card rounded-lg border border-border italic text-muted-foreground text-sm">
                              {exam.observations}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Beaker className="w-10 h-10 opacity-20 mx-auto mb-3" />
                  <p className="font-medium text-sm">Nenhum exame registrado</p>
                  <p className="text-xs mt-1">Clique em "Registrar Exame" para adicionar o primeiro resultado laboratorial.</p>
                </div>
              )}

              {hasHiddenHistory && (
                <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Histórico Oculto</p>
                      <p className="text-xs text-primary">Existem exames mais antigos que não estão visíveis no plano gratuito.</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsUpgradeModalOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-8 px-4 text-xs gap-2 shrink-0"
                  >
                    Ver Tudo com Premium
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolution" className="mt-0">
          <PremiumFeature>
            <div className="grid grid-cols-1 gap-4">

              {/* Resumo Geral do Acompanhamento */}
              {consultations.length > 0 && (() => {
                const sorted = [...consultations].sort((a, b) =>
                  new Date(a.date).getTime() - new Date(b.date).getTime()
                );
                const first = sorted[0];
                const latest = sorted[sorted.length - 1];
                const isMultiple = sorted.length > 1;

                const days = Math.floor(
                  (new Date(latest.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24)
                );
                const months = Math.floor(days / 30);
                const durationLabel = !isMultiple
                  ? '1 consulta'
                  : months >= 1
                  ? `${months} ${months === 1 ? 'mês' : 'meses'} de acompanhamento`
                  : `${days} dias de acompanhamento`;

                const totalDelta = (a?: number, b?: number, unit = '') => {
                  if (a == null || b == null || !isMultiple) return null;
                  const diff = +(b - a).toFixed(1);
                  if (diff === 0) return { label: 'sem variação', neutral: true };
                  return { label: `${diff > 0 ? '+' : ''}${diff}${unit}`, positive: diff > 0 };
                };

                const stats = [
                  { label: 'Peso', d: totalDelta(first.weight, latest.weight, ' kg') },
                  { label: 'IMC', d: totalDelta(first.imc, latest.imc) },
                  ...(first.fatPercentage != null && latest.fatPercentage != null
                    ? [{ label: 'Gordura', d: totalDelta(first.fatPercentage, latest.fatPercentage, '%') }]
                    : []),
                  ...(first.waist != null && latest.waist != null
                    ? [{ label: 'Cintura', d: totalDelta(first.waist, latest.waist, ' cm') }]
                    : []),
                ];

                return (
                  <Card className="bg-muted/30 border-0 shadow-none">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-sm">{durationLabel}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {sorted.length} consulta{sorted.length !== 1 ? 's' : ''} registrada{sorted.length !== 1 ? 's' : ''}
                            {isMultiple && (
                              <> · {formatDateSafely(first.date, 'dd/MM/yyyy')} → {formatDateSafely(latest.date, 'dd/MM/yyyy')}</>
                            )}
                          </p>
                        </div>
                        {isMultiple && stats.length > 0 && (
                          <div className="flex flex-wrap gap-3">
                            {stats.map((s) => s.d && (
                              <div key={s.label} className="text-center">
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                                <p className={cn(
                                  'text-sm font-bold',
                                  s.d.neutral ? 'text-muted-foreground' : 'text-foreground'
                                )}>
                                  {s.d.label}
                                </p>
                                <p className="text-[10px] text-muted-foreground">total</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* KPI Cards (6 métricas) */}
              {consultations.length > 0 && (() => {
                const sorted = [...consultations].sort((a, b) =>
                  new Date(a.date).getTime() - new Date(b.date).getTime()
                );
                const latest = sorted[sorted.length - 1];
                const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;

                const imcInfo = (imc: number) => {
                  if (imc < 18.5) return { label: 'Abaixo do peso', cls: 'text-muted-foreground bg-muted' };
                  if (imc < 25) return { label: 'Normal', cls: 'text-primary bg-primary/10' };
                  if (imc < 30) return { label: 'Sobrepeso', cls: 'text-accent-foreground bg-accent/30' };
                  return { label: 'Obesidade', cls: 'text-destructive bg-destructive/10' };
                };

                const fmtDelta = (curr?: number, prevVal?: number, unit = '') => {
                  if (curr == null || prevVal == null) return null;
                  const diff = curr - prevVal;
                  if (diff === 0) return null;
                  const sign = diff > 0 ? '+' : '';
                  return `${sign}${diff.toFixed(1)}${unit} desde última`;
                };

                const imc = imcInfo(latest.imc);
                const h = latest.height;
                const idealMin = h ? (18.5 * h * h).toFixed(1) : null;
                const idealMax = h ? (24.9 * h * h).toFixed(1) : null;

                const cards = [
                  {
                    label: 'Peso atual',
                    value: `${latest.weight} kg`,
                    sub: idealMin && idealMax ? `Ideal: ${idealMin}–${idealMax} kg` : null,
                    delta: fmtDelta(latest.weight, prev?.weight, ' kg'),
                  },
                  {
                    label: 'IMC',
                    value: latest.imc.toFixed(1),
                    badge: imc,
                    sub: h ? `Altura: ${(h * 100).toFixed(0)} cm` : null,
                    delta: fmtDelta(latest.imc, prev?.imc),
                  },
                  {
                    label: 'Gordura corporal',
                    value: latest.fatPercentage != null ? `${latest.fatPercentage}%` : '—',
                    delta: fmtDelta(latest.fatPercentage, prev?.fatPercentage, '%'),
                  },
                  {
                    label: 'Cintura',
                    value: latest.waist != null ? `${latest.waist} cm` : '—',
                    delta: fmtDelta(latest.waist, prev?.waist, ' cm'),
                  },
                  {
                    label: 'Quadril',
                    value: latest.hip != null ? `${latest.hip} cm` : '—',
                    delta: fmtDelta(latest.hip, prev?.hip, ' cm'),
                  },
                  {
                    label: 'Braço',
                    value: latest.arm != null ? `${latest.arm} cm` : '—',
                    delta: fmtDelta(latest.arm, prev?.arm, ' cm'),
                  },
                ];

                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {cards.map((card) => (
                      <div key={card.label} className="rounded-xl p-3 border border-border bg-card shadow-sm">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{card.label}</p>
                        <p className="text-lg font-bold leading-tight text-foreground">{card.value}</p>
                        {card.badge && (
                          <span className={cn('inline-block text-xs font-medium px-2 py-0.5 rounded-md mt-1.5', card.badge.cls)}>
                            {card.badge.label}
                          </span>
                        )}
                        {card.sub && !card.badge && (
                          <p className="text-xs text-muted-foreground mt-1.5">{card.sub}</p>
                        )}
                        {card.delta && (
                          <p className="text-xs text-muted-foreground/80 mt-1.5 leading-snug">{card.delta}</p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Chart Card */}
              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
                  <div>
                    <CardTitle className="text-base">Evolução ao Longo do Tempo</CardTitle>
                    <CardDescription>
                      {consultations.length} consulta{consultations.length !== 1 ? 's' : ''} registrada{consultations.length !== 1 ? 's' : ''}.
                    </CardDescription>
                  </div>
                  <div className="inline-flex items-center bg-muted rounded-lg p-[3px] gap-[3px]">
                    {(
                      [
                        ['weight', 'Peso'],
                        ['imc', 'IMC'],
                        ['fatPercentage', 'Composição'],
                        ['measurements', 'Medidas'],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setEvolutionMetric(val)}
                        className={cn(
                          'px-3 py-1 text-sm font-medium rounded-md transition-all whitespace-nowrap',
                          evolutionMetric === val
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px] w-full">
                    {consultations.length > 0 && activeTab === 'evolution' ? (
                      <ResponsiveContainer width="100%" height="100%" debounce={100}>
                        <AreaChart
                          data={[...consultations].sort(
                            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                          )}
                          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="evGradWeight" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="oklch(0.52 0.10 163)" stopOpacity={0.18} />
                              <stop offset="95%" stopColor="oklch(0.52 0.10 163)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="evGradFat" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="oklch(0.72 0.14 75)" stopOpacity={0.18} />
                              <stop offset="95%" stopColor="oklch(0.72 0.14 75)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="evGradIMC" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="oklch(0.60 0.12 240)" stopOpacity={0.18} />
                              <stop offset="95%" stopColor="oklch(0.60 0.12 240)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="evGradWaist" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="oklch(0.60 0.12 280)" stopOpacity={0.12} />
                              <stop offset="95%" stopColor="oklch(0.60 0.12 280)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.4} />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(date) => formatDateSafely(date, 'dd/MM')}
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: 'var(--muted-foreground)' }}
                          />
                          <YAxis
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            width={38}
                            tick={{ fill: 'var(--muted-foreground)' }}
                          />
                          <RechartsTooltip content={<EvolutionTooltip />} />
                          <Legend verticalAlign="top" height={32} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />

                          {evolutionMetric === 'weight' && (
                            <Area
                              name="Peso (kg)"
                              type="monotone"
                              dataKey="weight"
                              stroke="oklch(0.52 0.10 163)"
                              strokeWidth={2.5}
                              fill="url(#evGradWeight)"
                              dot={{ r: 4, fill: 'oklch(0.52 0.10 163)', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                          )}

                          {evolutionMetric === 'fatPercentage' && (
                            <Area
                              name="Gordura (%)"
                              type="monotone"
                              dataKey="fatPercentage"
                              stroke="oklch(0.72 0.14 75)"
                              strokeWidth={2.5}
                              fill="url(#evGradFat)"
                              dot={{ r: 4, fill: 'oklch(0.72 0.14 75)', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                          )}

                          {evolutionMetric === 'imc' && (
                            <>
                              <ReferenceLine y={18.5} stroke="oklch(0.65 0 0)" strokeDasharray="4 3" label={{ value: 'Baixo peso  ', position: 'insideTopRight', fontSize: 10, fill: 'oklch(0.55 0 0)' }} />
                              <ReferenceLine y={25} stroke="oklch(0.72 0.14 75)" strokeDasharray="4 3" label={{ value: 'Sobrepeso  ', position: 'insideTopRight', fontSize: 10, fill: 'oklch(0.60 0.12 75)' }} />
                              <ReferenceLine y={30} stroke="oklch(0.55 0.20 27)" strokeDasharray="4 3" label={{ value: 'Obesidade  ', position: 'insideTopRight', fontSize: 10, fill: 'oklch(0.50 0.18 27)' }} />
                              <Area
                                name="IMC"
                                type="monotone"
                                dataKey="imc"
                                stroke="oklch(0.60 0.12 240)"
                                strokeWidth={2.5}
                                fill="url(#evGradIMC)"
                                dot={{ r: 4, fill: 'oklch(0.60 0.12 240)', strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                              />
                            </>
                          )}

                          {evolutionMetric === 'measurements' && (
                            <>
                              <Area name="Cintura (cm)" type="monotone" dataKey="waist" stroke="oklch(0.60 0.12 280)" strokeWidth={2} fill="url(#evGradWaist)" dot={{ r: 3, fill: 'oklch(0.60 0.12 280)', strokeWidth: 2, stroke: '#fff' }} />
                              <Area name="Quadril (cm)" type="monotone" dataKey="hip" stroke="oklch(0.60 0.14 340)" strokeWidth={2} fill="none" dot={{ r: 3, fill: 'oklch(0.60 0.14 340)', strokeWidth: 2, stroke: '#fff' }} />
                              <Area name="Abdômen (cm)" type="monotone" dataKey="abdomen" stroke="oklch(0.55 0.15 300)" strokeWidth={2} fill="none" dot={{ r: 3, fill: 'oklch(0.55 0.15 300)', strokeWidth: 2, stroke: '#fff' }} />
                              <Area name="Braço (cm)" type="monotone" dataKey="arm" stroke="oklch(0.65 0.12 200)" strokeWidth={2} fill="none" dot={{ r: 3, fill: 'oklch(0.65 0.12 200)', strokeWidth: 2, stroke: '#fff' }} />
                            </>
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                        <TrendingUp className="w-10 h-10 opacity-20" />
                        <div className="text-center">
                          <p className="font-medium text-sm">Sem dados de evolução ainda</p>
                          <p className="text-xs mt-1 max-w-[260px]">
                            Registre consultas com medidas para visualizar o progresso do paciente aqui.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Tabela Completa */}
              {consultations.length > 0 && (() => {
                const imcLabel = (imc: number) => {
                  if (imc < 18.5) return { text: 'Abaixo', cls: 'text-muted-foreground' };
                  if (imc < 25) return { text: 'Normal', cls: 'text-primary' };
                  if (imc < 30) return { text: 'Sobrepeso', cls: 'text-accent-foreground' };
                  if (imc < 35) return { text: 'Obesidade I', cls: 'text-destructive' };
                  if (imc < 40) return { text: 'Obesidade II', cls: 'text-destructive' };
                  return { text: 'Obesidade III', cls: 'text-destructive' };
                };

                const deltaTag = (curr?: number, prevVal?: number, unit = '') => {
                  if (curr == null || prevVal == null) return null;
                  const diff = +(curr - prevVal).toFixed(1);
                  if (diff === 0) return null;
                  return (
                    <span className="ml-1 text-[11px] text-muted-foreground whitespace-nowrap">
                      {diff > 0 ? '↑' : '↓'}{Math.abs(diff)}{unit}
                    </span>
                  );
                };

                const rows = [...consultations].sort(
                  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                );

                const cols = [
                  'Data', 'Altura', 'Peso', 'IMC', 'Classif.', '% Gordura',
                  'Cintura', 'Quadril', 'Abdômen', 'Braço',
                ];

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Histórico Completo de Medidas</CardTitle>
                      <CardDescription>
                        Todas as consultas com variação em relação à consulta anterior. {rows.length} registro{rows.length !== 1 ? 's' : ''}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[760px]">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              {cols.map((h) => (
                                <th
                                  key={h}
                                  className={cn(
                                    'py-2.5 px-3 text-[11px] font-medium text-muted-foreground whitespace-nowrap',
                                    h === 'Data' || h === 'Classif.' ? 'text-left' : 'text-right'
                                  )}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((c, idx, arr) => {
                              const prev = arr[idx + 1];
                              const cl = imcLabel(c.imc);
                              return (
                                <tr
                                  key={c.id}
                                  className={cn(
                                    'border-b border-border/40 transition-colors hover:bg-muted/30',
                                    idx === 0 && 'bg-muted/20'
                                  )}
                                >
                                  <td className="px-3 py-2.5">
                                    <div className="font-medium whitespace-nowrap">{formatDateSafely(c.date, 'dd/MM/yyyy')}</div>
                                    {idx === 0 && <span className="text-[11px] text-primary font-medium">Mais recente</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                                    {c.height ? `${(c.height * 100).toFixed(0)} cm` : '—'}
                                  </td>
                                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                    <span className="font-medium">{c.weight} kg</span>
                                    {deltaTag(c.weight, prev?.weight, ' kg')}
                                  </td>
                                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                    <span className="font-medium">{c.imc.toFixed(1)}</span>
                                    {deltaTag(c.imc, prev?.imc)}
                                  </td>
                                  <td className="px-3 py-2.5 text-left">
                                    <span className={cn('text-xs font-medium whitespace-nowrap', cl.cls)}>{cl.text}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                                    {c.fatPercentage != null ? `${c.fatPercentage}%` : '—'}
                                    {deltaTag(c.fatPercentage, prev?.fatPercentage, '%')}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                                    {c.waist != null ? `${c.waist} cm` : '—'}
                                    {deltaTag(c.waist, prev?.waist, ' cm')}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                                    {c.hip != null ? `${c.hip} cm` : '—'}
                                    {deltaTag(c.hip, prev?.hip, ' cm')}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                                    {c.abdomen != null ? `${c.abdomen} cm` : '—'}
                                    {deltaTag(c.abdomen, prev?.abdomen, ' cm')}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                                    {c.arm != null ? `${c.arm} cm` : '—'}
                                    {deltaTag(c.arm, prev?.arm, ' cm')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          </PremiumFeature>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <Dialog open={isCalculatorModalOpen} onOpenChange={setIsCalculatorModalOpen}>
        <DialogContent showCloseButton={false} className="w-[calc(100vw-2rem)] sm:max-w-6xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col bg-background rounded-2xl shadow-2xl">
          <div className="bg-card px-6 py-4 border-b flex justify-between items-center shadow-sm z-10 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-foreground">Cálculo Nutricional</h2>
              <p className="text-sm text-muted-foreground">Consulta de {selectedConsultationForCalc ? formatDateSafely(selectedConsultationForCalc.date, "dd 'de' MMMM 'de' yyyy") : ''}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsCalculatorModalOpen(false)} title="Fechar calculadora">
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            {patient && selectedConsultationForCalc && (
              <NutritionalCalculator
                patient={patient}
                latestConsultation={selectedConsultationForCalc}
                existingCalculation={selectedExistingCalc}
                onSaveCalculation={handleSaveCalculation}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Patient Modal */}
      <Dialog open={isEditPatientModalOpen} onOpenChange={setIsEditPatientModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle>Editar Perfil do Paciente</DialogTitle>
            <DialogDescription>Atualize as informações cadastrais do paciente.</DialogDescription>
          </DialogHeader>
          <form key={patient.id} onSubmit={onEditPatientSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input id="name" name="name" defaultValue={patient.name} required className="bg-muted/30 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" defaultValue={patient.email} required className="bg-muted/30 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={maskPhone(patient.phone)}
                  onChange={(e) => { e.target.value = maskPhone(e.target.value); }}
                  required
                  className="bg-muted/30 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  name="cpf"
                  defaultValue={maskCPF(patient.cpf)}
                  onChange={(e) => { e.target.value = maskCPF(e.target.value); }}
                  required
                  className="bg-muted/30 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de Nascimento</Label>
                <Input id="birthDate" name="birthDate" type="date" defaultValue={patient.birthDate} required className="bg-muted/30 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gênero</Label>
                <Select name="gender" value={gender} onValueChange={(v: any) => setGender(v)}>
                  <SelectTrigger className="bg-muted/30 rounded-lg">
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
              <Input id="address" name="address" defaultValue={patient.address} className="bg-muted/30 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="diseases">Doenças</Label>
                <Textarea id="diseases" name="diseases" defaultValue={patient.diseases} placeholder="Ex: Diabetes, Hipertensão..." className="bg-muted/30 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medications">Medicamentos</Label>
                <Textarea id="medications" name="medications" defaultValue={patient.medications} placeholder="Ex: Metformina, Losartana..." className="bg-muted/30 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allergies">Alergias</Label>
                <Textarea id="allergies" name="allergies" defaultValue={patient.allergies} placeholder="Ex: Lactose, Glúten, Amendoim..." className="bg-muted/30 rounded-lg" />
              </div>
            </div>
            <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditPatientModalOpen(false)}
                className="rounded-xl h-8 px-4 border-border text-muted-foreground text-sm hover:bg-muted/30 transition-all active:scale-95"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-white rounded-xl h-8 px-5 font-bold text-sm transition-all shadow-sm active:scale-95"
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

