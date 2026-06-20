import React, { useMemo } from 'react';
import { useTheme } from 'next-themes';
import {
  Users,
  Calendar,
  PlusCircle,
  TrendingUp,
  Clock,
  ChevronRight,
  Zap,
  Video,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { PremiumFeature } from '../components/PremiumFeature';
import { FREE_PLAN_LIMITS, isAdminOrPremium } from '../lib/planLimits';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Skeleton } from '../components/ui/skeleton';

interface DashboardStats {
  activePatients: number;
  recentPatients: Array<{ id: string; name: string; createdAt: string; status: string }>;
  todayAppointments: Array<{
    id: string;
    date: string;
    status: string;
    nutritionistId: string;
    patient: { name: string };
    patientId: string;
    meetLink?: string;
  }>;
  monthConsultations: number;
  consultationDates: string[];
  monthRevenue: number;
  activeMealPlans: number;
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-foreground capitalize">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} consulta{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  );
};

export const Dashboard = () => {
  const { user, nutritionist, isAuthReady } = useAuth();
  const isPremium = isAdminOrPremium(nutritionist);
  const { resolvedTheme } = useTheme();

  const chartTickColor = useMemo(() => {
    if (typeof window === 'undefined') return 'oklch(0.50 0 0)';
    const val = getComputedStyle(document.documentElement)
      .getPropertyValue('--muted-foreground')
      .trim();
    return val || 'oklch(0.50 0 0)';
  }, [resolvedTheme]);

  const { data: stats, loading } = useApi<DashboardStats>('/api/dashboard/stats', {
    immediate: isAuthReady && !!user,
  });

  const activePatients = stats?.activePatients ?? 0;
  const recentPatients = stats?.recentPatients ?? [];
  const todayAppointments = stats?.todayAppointments ?? [];
  const monthConsultations = stats?.monthConsultations ?? 0;
  const monthRevenue = stats?.monthRevenue ?? 0;
  const activeMealPlans = stats?.activeMealPlans ?? 0;
  const consultationDates = stats?.consultationDates ?? [];

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const firstName = useMemo(() => {
    const name = nutritionist?.name || user?.displayName;
    if (!name) return 'Nutricionista';
    return name.split(' ')[0];
  }, [nutritionist?.name, user?.displayName]);

  const translateStatus = (status: string) =>
    ({ confirmed: 'Confirmada', pending: 'Pendente', cancelled: 'Cancelada', realized: 'Realizada' }[status] ?? status);

  const statusColor = (status: string) =>
    ({
      confirmed: 'bg-primary/10 text-primary',
      pending: 'bg-accent text-accent-foreground',
      cancelled: 'bg-destructive/10 text-destructive',
      realized: 'bg-secondary text-secondary-foreground',
    }[status] ?? 'bg-muted text-muted-foreground');

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const weekChartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      const key = format(d, 'yyyy-MM-dd');
      const count = consultationDates.filter(date => {
        try { return format(parseISO(date), 'yyyy-MM-dd') === key; } catch { return false; }
      }).length;
      return { day: format(d, 'EEE', { locale: ptBR }), consultas: count, isToday: i === 6 };
    });
  }, [consultationDates]);

  const nextAppointment = useMemo(() => {
    const now = new Date();
    return todayAppointments.find(app => {
      try { return parseISO(app.date) >= now && app.status !== 'cancelled'; } catch { return false; }
    });
  }, [todayAppointments]);

  const planProgress = FREE_PLAN_LIMITS.maxConsultationsPerMonth > 0
    ? Math.min(100, (monthConsultations / FREE_PLAN_LIMITS.maxConsultationsPerMonth) * 100)
    : 0;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight text-balance">
              {greeting}, {firstName}
            </h1>
            <span className="text-xl" aria-hidden="true">👋</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
          </p>
        </div>
        <PremiumFeature active={activePatients >= FREE_PLAN_LIMITS.maxPatients}>
          <Button
            nativeButton={false}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-9 px-4 gap-2 font-medium text-sm shrink-0"
            render={<Link to="/patients" />}
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" /> Novo Paciente
          </Button>
        </PremiumFeature>
      </div>

      {/* Hero row: Agenda de Hoje (3/5) + Stats cluster (2/5) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Agenda de Hoje — hero, informação mais urgente */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base leading-snug font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent-foreground" aria-hidden="true" />
                Agenda de hoje
              </h2>
              <Button
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-9 px-2"
                render={<Link to="/schedule" />}
              >
                Ver tudo <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5">
                    <Skeleton className="w-12 h-10 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-36 rounded" />
                      <Skeleton className="h-2.5 w-20 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : todayAppointments.length > 0 ? (
              <div className="space-y-1">
                {todayAppointments.map((app) => {
                  let timeStr = '—';
                  try { timeStr = format(parseISO(app.date), 'HH:mm'); } catch {}
                  const isNext = app.id === nextAppointment?.id;
                  return (
                    <div
                      key={app.id}
                      className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg transition-colors group',
                        isNext ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/50',
                      )}
                    >
                      <div className={cn(
                        'w-12 h-10 rounded-lg flex flex-col items-center justify-center shrink-0',
                        isNext ? 'bg-primary' : 'bg-primary/10',
                      )}>
                        <span className={cn(
                          'text-xs font-bold leading-none',
                          isNext ? 'text-primary-foreground' : 'text-primary',
                        )}>
                          {timeStr}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {app.patient?.name || 'Paciente'}
                        </p>
                        <span className={cn('inline-block text-xs font-medium px-1.5 py-0.5 rounded-full mt-0.5', statusColor(app.status))}>
                          {translateStatus(app.status)}
                        </span>
                      </div>
                      {/* opacity-0: visible on hover AND on keyboard focus within the row */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        {app.meetLink && (
                          <a href={app.meetLink} target="_blank" rel="noopener noreferrer" aria-label="Abrir Google Meet">
                            <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-foreground">
                              <Video className="w-3.5 h-3.5" aria-hidden="true" />
                            </Button>
                          </a>
                        )}
                        <Button
                          nativeButton={false}
                          variant="ghost"
                          size="icon"
                          className="w-9 h-9 text-muted-foreground hover:text-foreground"
                          render={<Link to={`/patients/${app.patientId}`} aria-label={`Ver perfil de ${app.patient?.name || 'paciente'}`} />}
                        >
                          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <Calendar className="w-8 h-8 opacity-20" aria-hidden="true" />
                <p className="text-sm text-center">Sem consultas agendadas para hoje.</p>
                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  className="mt-1 h-9 text-xs"
                  render={<Link to="/schedule" />}
                >
                  Abrir agenda
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats cluster */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Pacientes Ativos — métrica principal */}
          <Link
            to="/patients"
            className="block group"
            aria-label={`${activePatients} pacientes ativos. Ver lista de pacientes.`}
          >
            <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 active:border-primary/50 transition-colors h-full">
              <p className="text-xs font-medium text-muted-foreground mb-3">Pacientes ativos</p>
              {loading ? (
                <Skeleton className="h-10 w-20 rounded" />
              ) : (
                <div className="flex items-end justify-between gap-2">
                  <p className="text-4xl font-bold tabular-nums text-foreground leading-none">{activePatients}</p>
                  <ChevronRight
                    className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground mb-0.5 transition-colors shrink-0"
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>
          </Link>

          {/* Consultas + Receita — métricas secundárias */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2 leading-tight">Consultas este mês</p>
              {loading ? (
                <Skeleton className="h-7 w-12 rounded" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-foreground leading-none">{monthConsultations}</p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2 leading-tight">Receita do mês</p>
              {loading ? (
                <Skeleton className="h-7 w-16 rounded" />
              ) : (
                <p className="text-xl font-bold tabular-nums text-foreground leading-none truncate">
                  {isPremium
                    ? formatCurrency(monthRevenue)
                    : <span aria-label="Disponível apenas no plano Premium" className="text-muted-foreground text-base font-medium">—</span>
                  }
                </p>
              )}
            </div>
          </div>

          {/* Planos ativos — stat terciária, sem card */}
          <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <TrendingUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {loading ? (
              <Skeleton className="h-3.5 w-36 rounded" />
            ) : (
              <span>
                <strong className="font-semibold text-foreground">{activeMealPlans}</strong> planos alimentares ativos
              </span>
            )}
          </div>

          {/* Limite do plano (free only) — único touchpoint de upsell */}
          {!isPremium && !loading && (
            <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  <Zap className="w-3 h-3 inline mr-1 text-accent-foreground" aria-hidden="true" />
                  <strong className="font-semibold text-foreground">{monthConsultations}</strong>
                  /{FREE_PLAN_LIMITS.maxConsultationsPerMonth} consultas em {format(new Date(), 'MMMM', { locale: ptBR })}
                </span>
                <Link
                  to="/settings?tab=subscription"
                  className="text-primary font-medium hover:underline shrink-0"
                >
                  Upgrade
                </Link>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    planProgress >= 90
                      ? 'bg-destructive'
                      : planProgress >= 70
                        ? 'bg-[oklch(0.72_0.14_75)]'
                        : 'bg-primary',
                  )}
                  style={{ width: `${planProgress}%` }}
                  role="progressbar"
                  aria-valuenow={monthConsultations}
                  aria-valuemin={0}
                  aria-valuemax={FREE_PLAN_LIMITS.maxConsultationsPerMonth}
                  aria-label="Uso do limite de consultas do plano"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart + Pacientes Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Bar chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <h2 className="text-base leading-snug font-medium">Consultas realizadas</h2>
            <CardDescription>Últimos 7 dias</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {loading ? (
              <div className="h-[180px] flex items-end gap-2 pb-1">
                {[40, 65, 30, 80, 55, 90, 70].map((h, i) => (
                  <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
                ))}
              </div>
            ) : weekChartData.every(d => d.consultas === 0) ? (
              <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <TrendingUp className="w-8 h-8 opacity-20" aria-hidden="true" />
                <p className="text-sm">Nenhuma consulta nos últimos 7 dias.</p>
              </div>
            ) : (
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekChartData} barSize={24} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                    <XAxis
                      dataKey="day"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: chartTickColor }}
                    />
                    <YAxis
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      tick={{ fill: chartTickColor }}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'oklch(0.52 0.10 163 / 8%)', radius: 6 }} />
                    <Bar dataKey="consultas" radius={[4, 4, 0, 0]}>
                      {weekChartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.isToday ? 'oklch(0.52 0.10 163)' : 'oklch(0.80 0.055 163)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pacientes Recentes */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base leading-snug font-medium">Pacientes recentes</h2>
              <Button
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-9 px-2"
                render={<Link to="/patients" />}
              >
                Ver todos <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5">
                    <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32 rounded" />
                      <Skeleton className="h-2.5 w-24 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentPatients.length > 0 ? (
              <div className="space-y-1">
                {recentPatients.map((patient) => {
                  const initials = patient.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                  let dateStr = '';
                  try { dateStr = format(parseISO(patient.createdAt), "dd 'de' MMM", { locale: ptBR }); } catch {}
                  return (
                    <Link
                      key={patient.id}
                      to={`/patients/${patient.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                      aria-label={`Ver perfil de ${patient.name}`}
                    >
                      <div
                        className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0"
                        aria-hidden="true"
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{patient.name}</p>
                        <p className="text-xs text-muted-foreground">Cadastrado em {dateStr}</p>
                      </div>
                      <ChevronRight
                        className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0"
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <Users className="w-8 h-8 opacity-20" aria-hidden="true" />
                <p className="text-sm">Nenhum paciente cadastrado ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
