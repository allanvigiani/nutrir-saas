import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, UtensilsCrossed, Mail, Phone, Cake } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { apiRequest } from '../hooks/useApi';
import { Patient, Consultation, MealPlan } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import { ReadOnlyBanner } from '../components/admin/ReadOnlyBanner';

interface PatientDetailResponse extends Patient {
  nutritionist: { id: string; name: string; email: string };
}

const CONSULTATION_STATUS_LABEL: Record<Consultation['status'], string> = {
  realized: 'Realizada',
  cancelled: 'Cancelada',
  missed: 'Faltou',
};

const MEAL_PLAN_STATUS_LABEL: Record<MealPlan['status'], string> = {
  active: 'Ativo',
  archived: 'Arquivado',
};

export const AdminPatientDetail = () => {
  const { nutritionist: currentAdmin, loading: authLoading } = useAuth();
  const { id } = useParams<{ id: string }>();

  const [patient, setPatient] = useState<PatientDetailResponse | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);

    (async () => {
      try {
        const patientRes = await apiRequest<PatientDetailResponse>(`/api/admin/patients/${id}`, 'GET');
        if (cancelled) return;
        setPatient(patientRes);

        const [consultationsRes, mealPlansRes] = await Promise.all([
          apiRequest<Consultation[]>(`/api/admin/patients/${id}/consultations`, 'GET'),
          apiRequest<MealPlan[]>(`/api/admin/patients/${id}/meal-plans`, 'GET'),
        ]);
        if (cancelled) return;
        setConsultations(consultationsRes ?? []);
        setMealPlans(mealPlansRes ?? []);
      } catch (err: any) {
        if (cancelled) return;
        if (String(err.message || '').includes('não encontrado') || String(err.message || '').includes('HTTP 404')) {
          setNotFound(true);
        } else {
          setError(err.message || 'Erro ao carregar dados do paciente.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (authLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (currentAdmin?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (!id) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          render={<Link to={patient ? `/admin/nutritionists/${patient.nutritionist.id}/patients` : '/admin'} />}
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>

      <ReadOnlyBanner context={patient ? `nutricionista ${patient.nutritionist.name}` : undefined} />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : notFound ? (
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Paciente não encontrado.</p>
            <Button variant="outline" render={<Link to="/admin" />}>Voltar ao painel</Button>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-12 text-center text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : patient ? (
        <>
          <Card className="border-none shadow-sm bg-card">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-xl shrink-0">
                    {patient.name.charAt(0)}
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-foreground">{patient.name}</h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                      {patient.email && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" /> {patient.email}
                        </span>
                      )}
                      {patient.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> {patient.phone}
                        </span>
                      )}
                      {patient.birthDate && (
                        <span className="flex items-center gap-1.5">
                          <Cake className="w-3.5 h-3.5" />
                          {format(parseISO(patient.birthDate), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Nutricionista responsável</p>
                  <p className="text-sm font-bold text-foreground">{patient.nutritionist.name}</p>
                  <p className="text-xs text-muted-foreground">{patient.nutritionist.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-none shadow-sm bg-card">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" /> Consultas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {consultations.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground text-center">Nenhuma consulta registrada.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {consultations.map((c) => (
                      <div key={c.id} className="px-6 py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {c.date ? format(parseISO(c.date), "dd/MM/yyyy", { locale: ptBR }) : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Peso {c.weight ?? '—'}kg · IMC {c.imc ?? '—'}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0',
                            c.status === 'realized' ? 'bg-primary/15 text-primary' : 'bg-destructive/10 text-destructive'
                          )}
                        >
                          {CONSULTATION_STATUS_LABEL[c.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-primary" /> Planos Alimentares
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {mealPlans.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground text-center">Nenhum plano alimentar registrado.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {mealPlans.map((mp) => (
                      <div key={mp.id} className="px-6 py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{mp.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {mp.createdAt ? format(parseISO(mp.createdAt), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0',
                            mp.status === 'active' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {MEAL_PLAN_STATUS_LABEL[mp.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};
