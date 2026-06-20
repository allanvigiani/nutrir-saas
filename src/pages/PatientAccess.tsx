import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Patient, Consultation, MealPlan, LabExam, MealPlanItem, Nutritionist } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  User, 
  Calendar, 
  FileText, 
  TrendingUp, 
  AlertCircle,
  Lock,
  CheckCircle2,
  Apple,
  Activity,
  ArrowLeft,
  Droplets,
  Loader2,
  Download,
  Utensils,
  Sun,
  Coffee,
  Moon,
  CloudMoon
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';


export const PatientAccess = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [nutritionist, setNutritionist] = useState<Nutritionist | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [exams, setExams] = useState<LabExam[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [downloadingPlanId, setDownloadingPlanId] = useState<string | null>(null);
  const [evolutionMetric, setEvolutionMetric] = useState<'weight' | 'fatPercentage' | 'imc' | 'measurements'>('weight');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [cpfSuffix, setCpfSuffix] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const verifyTokenAndFetchPatient = async () => {
      if (!id || !token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/portal/patients/${id}?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || 'Link de acesso inválido ou expirado.');
          return;
        }
        const { patient: patientData, nutritionist: nutData } = await res.json();
        setPatient(patientData);
        if (nutData) setNutritionist(nutData);
      } catch (error) {
        console.error("Error verifying access:", error);
        toast.error('Erro ao verificar acesso.');
      } finally {
        setLoading(false);
      }
    };

    verifyTokenAndFetchPatient();
  }, [id, token]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient || !token) return;

    // Validação server-side — CPF nunca comparado no client
    const verifyResponse = await fetch(`/api/portal/patients/${patient.id}/verify-cpf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, cpfSuffix }),
    });

    if (verifyResponse.ok) {
      setIsAuthenticated(true);
    } else {
      setAuthError('Os 3 últimos dígitos do CPF não conferem.');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchPatientData();
    }
  }, [isAuthenticated]);

  const generateMealPlanPDF = (plan: MealPlan, items: MealPlanItem[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    const mealTypesList = [
      { id: 'breakfast', label: 'Café da Manhã', icon: Sun, color: 'bg-amber-50 border-amber-100 text-amber-700' },
      { id: 'morning_snack', label: 'Lanche da Manhã', icon: Apple, color: 'bg-rose-50 border-rose-100 text-rose-700' },
      { id: 'lunch', label: 'Almoço', icon: Utensils, color: 'bg-primary/10 border-primary/20 text-primary' },
      { id: 'afternoon_snack', label: 'Lanche da Tarde', icon: Coffee, color: 'bg-orange-50 border-orange-100 text-orange-700' },
      { id: 'dinner', label: 'Jantar', icon: Moon, color: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
      { id: 'supper', label: 'Ceia', icon: CloudMoon, color: 'bg-muted/30 border-border text-muted-foreground' },
    ];

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

      const mealLabel = mealTypesList.find(m => m.id === mealId)?.label || mealId;
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

    // Household Measurements Table (EXACT COPY FROM NUTRITIONIST PROFILE)
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

    // Signature and Stamp Area (EXACT COPY FROM NUTRITIONIST PROFILE)
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

    // Footer with Disclaimer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      
      const mainFooter = `Gerado por Nutrir em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Página ${i} de ${pageCount}`;
      const patientDisclaimer = 'Este documento foi gerado pelo paciente através de link exclusivo de acesso.';
      
      doc.text(mainFooter, pageWidth / 2, doc.internal.pageSize.getHeight() - 15, { align: 'center' });
      doc.setFont('helvetica', 'italic');
      doc.text(patientDisclaimer, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }

    doc.save(`${patient?.name.replace(/\s+/g, '_')}_Plano_Alimentar.pdf`);
  };

  const downloadMealPlan = async (plan: MealPlan) => {
    if (downloadingPlanId) return;
    
    setDownloadingPlanId(plan.id);
    const toastId = toast.loading('Preparando seu plano alimentar para download...');
    
    try {
      const res = await fetch(`/api/portal/meal-plans/${plan.id}/items?token=${encodeURIComponent(token || '')}`);
      if (!res.ok) throw new Error('Erro ao buscar itens do plano.');
      const items: MealPlanItem[] = await res.json();

      if (items.length === 0) {
        toast.warning('Este plano alimentar parece estar vazio.', { id: toastId });
      } else {
        generateMealPlanPDF(plan, items);
        toast.success('Plano baixado com sucesso!', { id: toastId });
      }
    } catch (error) {
      console.error("Error fetching meal plan items:", error);
      toast.error("Erro ao baixar o plano alimentar. Tente novamente.", { id: toastId });
    } finally {
      setDownloadingPlanId(null);
    }
  };

  const fetchPatientData = async () => {
    if (!id || !token) return;
    setLoadingData(true);
    const toastId = toast.loading('Buscando suas informações...');

    try {
      const encodedToken = encodeURIComponent(token);

      const [consultationsRes, mealPlansRes, examsRes] = await Promise.all([
        fetch(`/api/portal/patients/${id}/consultations?token=${encodedToken}`),
        fetch(`/api/portal/patients/${id}/meal-plans?token=${encodedToken}`),
        fetch(`/api/portal/patients/${id}/lab-exams?token=${encodedToken}`),
      ]);

      const [consultationsData, mealPlansData, examsData] = await Promise.all([
        consultationsRes.ok ? consultationsRes.json() : [],
        mealPlansRes.ok ? mealPlansRes.json() : [],
        examsRes.ok ? examsRes.json() : [],
      ]);

      setConsultations((consultationsData as Consultation[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setMealPlans((mealPlansData as MealPlan[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setExams((examsData as LabExam[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

      toast.success('Informações carregadas com sucesso!', { id: toastId });
    } catch (error) {
      console.error("Error fetching patient data:", error);
      toast.error('Erro ao carregar algumas informações. Por favor, tente novamente.', { id: toastId });
    } finally {
      setLoadingData(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md text-center p-8 rounded-2xl border-none shadow-xl">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Inválido</h1>
          <p className="text-muted-foreground mb-6">Este link de acesso não é mais válido ou o paciente não foi encontrado.</p>
          <Button onClick={() => navigate('/')} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl">
            Voltar para o Início
          </Button>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md rounded-2xl border-none shadow-xl overflow-hidden">
          <div className="bg-primary p-8 text-center text-primary-foreground">
            <div className="w-16 h-16 bg-card/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">Acesso Restrito</h1>
            <p className="text-primary-foreground/80 mt-2">Olá, {patient.name.split(' ')[0]}!</p>
          </div>
          <CardContent className="p-8">
            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-2 text-center">
                <Label htmlFor="cpf-suffix" className="text-muted-foreground">Para sua segurança, informe os 3 últimos dígitos do seu CPF:</Label>
                <Input 
                  id="cpf-suffix"
                  type="password"
                  maxLength={3}
                  placeholder="000"
                  value={cpfSuffix}
                  onChange={(e) => {
                    setCpfSuffix(e.target.value.replace(/\D/g, ''));
                    setAuthError('');
                  }}
                  className="text-center text-2xl tracking-[1em] h-14 font-bold border-border focus:ring-primary focus:border-primary rounded-xl"
                  autoFocus
                />
                {authError && <p className="text-destructive text-sm font-medium">{authError}</p>}
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl transition-all active:scale-95 shadow-lg shadow-primary/10">
                Acessar Meu Perfil
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const age = differenceInYears(new Date(), parseISO(patient.birthDate));

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">N</div>
            <span className="font-bold text-foreground">Nutrir</span>
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            Olá, {patient.name.split(' ')[0]}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-8 space-y-8">
        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Buscando suas informações...</p>
          </div>
        ) : (
          <>
            {/* Perfil */}
            <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-card">
          <div className="h-24 bg-gradient-to-r from-primary to-primary/80" />
          <CardContent className="px-6 pb-6 -mt-12">
            <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
              <div className="w-24 h-24 rounded-2xl bg-card p-1 shadow-lg">
                <div className="w-full h-full rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-3xl">
                  {patient.name.charAt(0)}
                </div>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-foreground">{patient.name}</h1>
                <div className="flex flex-wrap gap-3 text-muted-foreground text-sm mt-1">
                  <span className="flex items-center gap-1"><User className="w-4 h-4" /> {age} anos</span>
                  <span className="flex items-center gap-1"><Activity className="w-4 h-4" /> {patient.objective}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted/30 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Última Consulta</p>
                <p className="font-bold text-foreground">
                  {consultations.length > 0 
                    ? format(parseISO(consultations[0].date), "dd 'de' MMMM", { locale: ptBR })
                    : 'Nenhuma registrada'}
                </p>
              </div>
              <div className="p-4 bg-muted/30 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Peso Atual</p>
                <p className="font-bold text-foreground">
                  {consultations.length > 0 ? `${consultations[0].weight} kg` : '--'}
                </p>
              </div>
              <div className="p-4 bg-muted/30 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Status</p>
                <div className="flex items-center gap-1.5 text-primary font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Ativo
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Planos Alimentares */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Apple className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Meus Planos Alimentares</h2>
          </div>
          
          {mealPlans.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {mealPlans.map((plan) => (
                <Card 
                  key={plan.id} 
                  className="rounded-2xl border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => downloadMealPlan(plan)}
                >
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {downloadingPlanId === plan.id ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <FileText className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground">Criado em {format(parseISO(plan.createdAt), 'dd/MM/yyyy')}</p>
                      </div>
                    </div>
                    <Button variant="ghost" className="text-primary font-bold gap-2">
                      <Download className="w-4 h-4" /> Baixar Plano
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-card p-8 rounded-2xl border border-dashed border-border text-center">
              <p className="text-muted-foreground">Nenhum plano alimentar disponível ainda.</p>
            </div>
          )}
        </section>

        {/* Evolução */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Minha Evolução</h2>
            </div>
            
            <Select value={evolutionMetric} onValueChange={(val: any) => setEvolutionMetric(val)}>
              <SelectTrigger className="w-full sm:w-[220px] bg-card border-border rounded-xl h-10 shadow-sm font-medium focus:ring-primary/20">
                <SelectValue placeholder="Selecione a métrica">
                  {evolutionMetric === 'weight' ? 'Peso (kg)' : 
                   evolutionMetric === 'fatPercentage' ? 'Gordura Corporal (%)' : 
                   evolutionMetric === 'imc' ? 'Índice de Massa Corporal (IMC)' : 
                   evolutionMetric === 'measurements' ? 'Circunferências (cm)' : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border shadow-xl">
                <SelectItem value="weight">Peso (kg)</SelectItem>
                <SelectItem value="fatPercentage">Gordura Corporal (%)</SelectItem>
                <SelectItem value="imc">Índice de Massa Corporal (IMC)</SelectItem>
                <SelectItem value="measurements">Circunferências (cm)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Card className="rounded-2xl border-none shadow-sm p-6 bg-card overflow-hidden">
            {consultations.length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      {evolutionMetric === 'weight' ? 'Variação de Peso' : 
                       evolutionMetric === 'fatPercentage' ? 'Variação de Gordura' : 
                       evolutionMetric === 'imc' ? 'IMC Atual' : 'Consistência de Medidas'}
                    </p>
                    <p className="text-3xl font-bold text-foreground">
                      {evolutionMetric === 'weight' ? (
                        `${(consultations[0].weight - (consultations[consultations.length - 1].weight || consultations[0].weight)).toFixed(1)} kg`
                      ) : evolutionMetric === 'fatPercentage' ? (
                        `${consultations[0].fatPercentage ? (consultations[0].fatPercentage - (consultations[consultations.length - 1].fatPercentage || consultations[0].fatPercentage)).toFixed(1) : '0.0'}%`
                      ) : evolutionMetric === 'imc' ? (
                        consultations[0].imc.toFixed(1)
                      ) : (
                        'Visualizando tendências'
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Última Consulta</p>
                    <p className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 italic">
                      {format(parseISO(consultations[0].date), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
                
                <div className="h-80 pt-6 -ml-6">
                  <ResponsiveContainer width="100%" height="100%">
                    {evolutionMetric === 'measurements' ? (
                      <LineChart 
                        data={consultations.slice().reverse().map(c => ({
                          date: format(parseISO(c.date), 'dd/MM'),
                          fullDate: format(parseISO(c.date), "dd 'de' MMMM", { locale: ptBR }),
                          waist: c.waist,
                          hip: c.hip,
                          abdomen: c.abdomen,
                          arm: c.arm
                        }))}
                        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 12 }} 
                          dy={10}
                        />
                        <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-card p-4 rounded-xl shadow-2xl border border-border min-w-[160px]">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                                    {payload[0].payload.fullDate}
                                  </p>
                                  <div className="space-y-1.5">
                                    {payload.map((p, idx) => (
                                      <div key={idx} className="flex items-center justify-between gap-4">
                                        <span className="text-xs text-muted-foreground font-medium">{p.name}:</span>
                                        <span className="text-xs font-bold text-foreground">{p.value} cm</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" />
                        <Line name="Cintura" type="monotone" dataKey="waist" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        <Line name="Quadril" type="monotone" dataKey="hip" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        <Line name="Abdômen" type="monotone" dataKey="abdomen" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        <Line name="Braço" type="monotone" dataKey="arm" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    ) : (
                      <AreaChart 
                        data={consultations.slice().reverse().map(c => ({
                          date: format(parseISO(c.date), 'dd/MM'),
                          fullDate: format(parseISO(c.date), "dd 'de' MMMM", { locale: ptBR }),
                          value: evolutionMetric === 'weight' ? Number(c.weight) : 
                                 evolutionMetric === 'fatPercentage' ? Number(c.fatPercentage || 0) : 
                                 Number(c.imc.toFixed(1)),
                          metricName: evolutionMetric === 'weight' ? 'Peso' : 
                                      evolutionMetric === 'fatPercentage' ? 'Gordura' : 'IMC',
                          unit: evolutionMetric === 'weight' ? 'kg' : 
                                evolutionMetric === 'fatPercentage' ? '%' : ''
                        }))}
                        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 12 }} 
                          dy={10}
                        />
                        <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-card p-4 rounded-xl shadow-2xl border border-border min-w-[140px]">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                                    {data.fullDate}
                                  </p>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">{data.metricName}:</span>
                                    <span className="text-base font-bold text-primary">
                                      {payload[0].value} {data.unit}
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#10b981" 
                          strokeWidth={4}
                          fillOpacity={1} 
                          fill="url(#colorMetric)" 
                          dot={{ r: 5, fill: '#fff', stroke: '#10b981', strokeWidth: 3 }}
                          activeDot={{ r: 8, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/30 rounded-2xl border-2 border-dashed border-border">
                <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <TrendingUp className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">Sua evolução aparecerá aqui após as próximas consultas!</p>
              </div>
            )}
          </Card>
        </section>
      </>
    )}
      </div>
    </div>
  );
};
