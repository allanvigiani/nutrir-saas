import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, UtensilsCrossed, Mail, Phone, Cake } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { apiRequest } from '../hooks/useApi';
import { Patient, Consultation, MealPlan, MealPlanItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
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

  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);

  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlan | null>(null);
  const [mealPlanItems, setMealPlanItems] = useState<MealPlanItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const openMealPlan = (mp: MealPlan) => {
    setSelectedMealPlan(mp);
    setMealPlanItems([]);
    setItemsError(null);
    if (mp.type === 'blocks') {
      setItemsLoading(true);
      apiRequest<MealPlanItem[]>(`/api/admin/meal-plans/${mp.id}/items`, 'GET')
        .then((res) => setMealPlanItems(res ?? []))
        .catch((err) => setItemsError(err.message || 'Erro ao carregar itens do plano.'))
        .finally(() => setItemsLoading(false));
    }
  };

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
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedConsultation(c)}
                        className="w-full px-6 py-3 flex items-center justify-between gap-3 text-left hover:bg-muted/30 transition-colors"
                      >
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
                      </button>
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
                      <button
                        key={mp.id}
                        type="button"
                        onClick={() => openMealPlan(mp)}
                        className="w-full px-6 py-3 flex items-center justify-between gap-3 text-left hover:bg-muted/30 transition-colors"
                      >
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
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <Dialog open={!!selectedConsultation} onOpenChange={(open) => !open && setSelectedConsultation(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
          {selectedConsultation && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Consulta de{' '}
                  {selectedConsultation.date
                    ? format(parseISO(selectedConsultation.date), 'dd/MM/yyyy', { locale: ptBR })
                    : '—'}
                </DialogTitle>
                <DialogDescription>
                  {CONSULTATION_STATUS_LABEL[selectedConsultation.status]} · somente leitura
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {[
                    ['Peso', selectedConsultation.weight, 'kg'],
                    ['Altura', selectedConsultation.height, 'cm'],
                    ['IMC', selectedConsultation.imc, ''],
                    ['% Gordura', selectedConsultation.fatPercentage, '%'],
                    ['Cintura', selectedConsultation.waist, 'cm'],
                    ['Quadril', selectedConsultation.hip, 'cm'],
                    ['Abdômen', selectedConsultation.abdomen, 'cm'],
                    ['Braço', selectedConsultation.arm, 'cm'],
                  ]
                    .filter(([, value]) => value !== undefined && value !== null)
                    .map(([label, value, unit]) => (
                      <div key={label as string} className="bg-muted/30 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
                        <p className="text-sm font-bold text-foreground">
                          {value as number}
                          {unit as string}
                        </p>
                      </div>
                    ))}
                </div>
                {[
                  ['Anamnese', selectedConsultation.anamnesis],
                  ['Queixas', selectedConsultation.complaints],
                  ['Objetivos', selectedConsultation.objectives],
                  ['Observações', selectedConsultation.observations],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">{label}</p>
                      <p className="text-foreground whitespace-pre-wrap">{value}</p>
                    </div>
                  ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedMealPlan} onOpenChange={(open) => !open && setSelectedMealPlan(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
          {selectedMealPlan && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedMealPlan.name}</DialogTitle>
                <DialogDescription>
                  {MEAL_PLAN_STATUS_LABEL[selectedMealPlan.status]} ·{' '}
                  {selectedMealPlan.type === 'blocks' ? 'Refeições estruturadas' : 'Texto livre'} · somente leitura
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {selectedMealPlan.waterIntake && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Água</p>
                    <p className="text-foreground">{selectedMealPlan.waterIntake}</p>
                  </div>
                )}
                {selectedMealPlan.generalInstructions && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">
                      Orientações gerais
                    </p>
                    <p className="text-foreground whitespace-pre-wrap">{selectedMealPlan.generalInstructions}</p>
                  </div>
                )}

                {selectedMealPlan.type === 'free' ? (
                  selectedMealPlan.freeTextContent ? (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">
                        Conteúdo
                      </p>
                      <p className="text-foreground whitespace-pre-wrap">{selectedMealPlan.freeTextContent}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Sem conteúdo registrado.</p>
                  )
                ) : itemsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
                ) : itemsError ? (
                  <p className="text-destructive text-center py-4">{itemsError}</p>
                ) : mealPlanItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Nenhum alimento registrado.</p>
                ) : (
                  Object.entries(
                    mealPlanItems.reduce<Record<string, MealPlanItem[]>>((acc, item) => {
                      (acc[item.meal] ||= []).push(item);
                      return acc;
                    }, {})
                  ).map(([meal, items]) => (
                    <div key={meal}>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">{meal}</p>
                      <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                        {items.map((item) => (
                          <div key={item.id} className="px-3 py-2 flex items-center justify-between gap-3 bg-card">
                            <span className="text-foreground">{item.food}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
