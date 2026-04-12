import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  limit 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Patient, Consultation, MealPlan, LabExam } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
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
  ArrowLeft
} from 'lucide-react';
import { format, parseISO, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export const PatientAccess = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [exams, setExams] = useState<LabExam[]>([]);
  
  const [loading, setLoading] = useState(true);
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
        // Usar query em vez de getDoc para poder passar o token nas regras de segurança
        const q = query(
          collection(db, 'patients'), 
          where('access_token', '==', token),
          limit(1)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          const data = { id: docSnap.id, ...docSnap.data() } as Patient;
          
          // Verificar se o ID bate (para garantir que é o paciente certo)
          if (docSnap.id === id) {
            setPatient(data);
          } else {
            toast.error('Link de acesso inválido.');
          }
        } else {
          toast.error('Link de acesso inválido ou expirado.');
        }
      } catch (error) {
        console.error("Error verifying access:", error);
      } finally {
        setLoading(false);
      }
    };

    verifyTokenAndFetchPatient();
  }, [id, token]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;

    // Limpar CPF para pegar os 3 últimos dígitos
    const cleanCpf = patient.cpf.replace(/\D/g, '');
    const lastThree = cleanCpf.slice(-3);

    if (cpfSuffix === lastThree) {
      setIsAuthenticated(true);
      fetchPatientData();
    } else {
      setAuthError('Os 3 últimos dígitos do CPF não conferem.');
    }
  };

  const fetchPatientData = async () => {
    if (!id || !token) return;

    try {
      // Consultas
      const consultationsSnap = await getDocs(
        query(
          collection(db, 'consultations'), 
          where('patient_id', '==', id), 
          where('access_token', '==', token),
          orderBy('date', 'desc')
        )
      );
      setConsultations(consultationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation)));

      // Planos Alimentares
      const mealPlansSnap = await getDocs(
        query(
          collection(db, 'meal_plans'), 
          where('patient_id', '==', id), 
          where('access_token', '==', token),
          orderBy('createdAt', 'desc')
        )
      );
      setMealPlans(mealPlansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MealPlan)));

      // Exames
      const examsSnap = await getDocs(
        query(
          collection(db, 'lab_exams'), 
          where('patient_id', '==', id), 
          where('access_token', '==', token),
          orderBy('date', 'desc')
        )
      );
      setExams(examsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LabExam)));

    } catch (error) {
      console.error("Error fetching patient data:", error);
      toast.error('Erro ao carregar seus dados.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md text-center p-8 rounded-2xl border-none shadow-xl">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Acesso Inválido</h1>
          <p className="text-slate-500 mb-6">Este link de acesso não é mais válido ou o paciente não foi encontrado.</p>
          <Button onClick={() => navigate('/')} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl">
            Voltar para o Início
          </Button>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md rounded-2xl border-none shadow-xl overflow-hidden">
          <div className="bg-emerald-600 p-8 text-center text-white">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Acesso Restrito</h1>
            <p className="text-emerald-100 mt-2">Olá, {patient.name.split(' ')[0]}!</p>
          </div>
          <CardContent className="p-8">
            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-2 text-center">
                <Label htmlFor="cpf-suffix" className="text-slate-600">Para sua segurança, informe os 3 últimos dígitos do seu CPF:</Label>
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
                  className="text-center text-2xl tracking-[1em] h-14 font-bold border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl"
                  autoFocus
                />
                {authError && <p className="text-red-500 text-sm font-medium">{authError}</p>}
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-200">
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
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">N</div>
            <span className="font-bold text-slate-900">Nutrir</span>
          </div>
          <div className="text-sm font-medium text-slate-500">
            Olá, {patient.name.split(' ')[0]}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-8 space-y-8">
        {/* Perfil */}
        <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-white">
          <div className="h-24 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <CardContent className="px-6 pb-6 -mt-12">
            <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
              <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-lg">
                <div className="w-full h-full rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-3xl">
                  {patient.name.charAt(0)}
                </div>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-900">{patient.name}</h1>
                <div className="flex flex-wrap gap-3 text-slate-500 text-sm mt-1">
                  <span className="flex items-center gap-1"><User className="w-4 h-4" /> {age} anos</span>
                  <span className="flex items-center gap-1"><Activity className="w-4 h-4" /> {patient.objective}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Última Consulta</p>
                <p className="font-bold text-slate-900">
                  {consultations.length > 0 
                    ? format(parseISO(consultations[0].date), "dd 'de' MMMM", { locale: ptBR })
                    : 'Nenhuma registrada'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Peso Atual</p>
                <p className="font-bold text-slate-900">
                  {consultations.length > 0 ? `${consultations[0].weight} kg` : '--'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Status</p>
                <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Ativo
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Planos Alimentares */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Apple className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900">Meus Planos Alimentares</h2>
          </div>
          
          {mealPlans.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {mealPlans.map((plan) => (
                <Card key={plan.id} className="rounded-2xl border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{plan.name}</h3>
                        <p className="text-sm text-slate-500">Criado em {format(parseISO(plan.createdAt), 'dd/MM/yyyy')}</p>
                      </div>
                    </div>
                    <Button variant="ghost" className="text-emerald-600 font-bold">Ver Plano</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center">
              <p className="text-slate-500">Nenhum plano alimentar disponível ainda.</p>
            </div>
          )}
        </section>

        {/* Evolução */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900">Minha Evolução</h2>
          </div>
          
          <Card className="rounded-2xl border-none shadow-sm p-6">
            {consultations.length > 1 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Variação de Peso</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {(consultations[0].weight - consultations[consultations.length - 1].weight).toFixed(1)} kg
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">IMC Atual</p>
                    <p className="text-2xl font-bold text-emerald-600">{consultations[0].imc.toFixed(1)}</p>
                  </div>
                </div>
                <div className="h-48 flex items-end gap-2 px-2">
                  {consultations.slice(0, 6).reverse().map((c, i) => (
                    <div key={c.id} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-emerald-100 rounded-t-lg relative group"
                        style={{ height: `${(c.weight / consultations[0].weight) * 100}%` }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {c.weight} kg
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">{format(parseISO(c.date), 'dd/MM')}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500">Acompanhe sua evolução após a próxima consulta!</p>
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
};
