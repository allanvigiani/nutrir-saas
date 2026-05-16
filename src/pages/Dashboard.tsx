import React, { useMemo } from 'react';
import { useTheme } from 'next-themes';
import {
  Users,
  Calendar,
  PlusCircle,
  TrendingUp,
  Clock,
  DollarSign,
  FileText,
  ChevronRight,
  Zap,
  Video,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { PremiumFeature } from '../components/PremiumFeature';
import { PremiumBanner } from '../components/PremiumBanner';
import { FREE_PLAN_LIMITS } from '../lib/planLimits';
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

export const Dashboard = () => {
  const { user, nutritionist, isAuthReady } = useAuth();
  const isPremium = nutritionist?.plan === 'premium';
  const { resolvedTheme } = useTheme();
  const chartTickColor = useMemo(() => {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return '#94a3b8';
    }
    return '#64748b';
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

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getFirstName = () => {
    const name = nutritionist?.name || user?.displayName;
    if (!name) return 'Nutricionista';
    return name.split(' ')[0];
  };

  const translateStatus = (status: string) => ({
    confirmed: 'Confirmada',
    pending: 'Pendente',
    cancelled: 'Cancelada',
    realized: 'Realizada',
  }[status] ?? status);

  const statusColor = (status: string) => ({
    confirmed: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    cancelled: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    realized: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  }[status] ?? 'bg-muted text-muted-foreground');

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Build last-7-days chart data from raw consultations
  const weekChartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      const key = format(d, 'yyyy-MM-dd');
      // consultationDates are ISO strings — format to yyyy-MM-dd for comparison
      const count = consultationDates.filter(date => {
        try { return format(parseISO(date), 'yyyy-MM-dd') === key; } catch { return false; }
      }).length;
      const isToday = i === 6;
      return {
        day: format(d, 'dd/MM'),
        consultas: count,
        isToday,
      };
    });
  }, [consultationDates]);

  const kpis = [
    {
      title: 'Pacientes Ativos',
      value: activePatients,
      icon: Users,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      href: '/patients',
    },
    {
      title: 'Consultas do Mês',
      value: monthConsultations,
      icon: TrendingUp,
      iconBg: 'bg-blue-50 dark:bg-blue-950/40',
      iconColor: 'text-blue-600 dark:text-blue-400',
      href: '/patients',
    },
    {
      title: 'Agenda de Hoje',
      value: todayAppointments.length,
      icon: Calendar,
      iconBg: 'bg-amber-50 dark:bg-amber-950/40',
      iconColor: 'text-amber-600 dark:text-amber-400',
      href: '/schedule',
    },
    {
      title: 'Receita do Mês',
      value: formatCurrency(monthRevenue),
      icon: DollarSign,
      iconBg: 'bg-violet-50 dark:bg-violet-950/40',
      iconColor: 'text-violet-600 dark:text-violet-400',
      href: '/financial',
    },
    {
      title: 'Planos Ativos',
      value: activeMealPlans,
      icon: FileText,
      iconBg: 'bg-cyan-50 dark:bg-cyan-950/40',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      href: '/patients',
    },
  ];

  const quickActions = [
    { label: 'Novo Paciente', icon: Users, to: '/patients', color: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50' },
    { label: 'Ver Agenda', icon: Calendar, to: '/schedule', color: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50' },
    { label: 'Financeiro', icon: DollarSign, to: '/financial', color: 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-950/50' },
    { label: 'Pacientes', icon: FileText, to: '/patients', color: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/50' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-muted-foreground">{payload[0].value} consulta{payload[0].value !== 1 ? 's' : ''}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {getGreeting()}, {getFirstName()}
            </h1>
            <span className="text-2xl">👋</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
          </p>
        </div>
        <PremiumFeature active={activePatients >= FREE_PLAN_LIMITS.maxPatients}>
          <Button
            nativeButton={false}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-9 px-4 gap-2 font-semibold text-sm transition-all shadow-sm shadow-primary/20 active:scale-95 shrink-0"
            render={<Link to="/patients" />}
          >
            <PlusCircle className="w-4 h-4" /> Novo Paciente
          </Button>
        </PremiumFeature>
      </div>

      {!isPremium && (
        <PremiumBanner
          title="Você está no Plano Gratuito"
          description="Aproveite o Nutrir ao máximo! Assine o Premium para ter pacientes ilimitados, histórico completo e muito mais."
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="overflow-hidden border-border/60 h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                  </div>
                  <Skeleton className="h-3 w-24 mb-2 rounded" />
                  <Skeleton className="h-7 w-16 rounded" />
                </CardContent>
              </Card>
            ))
          : kpis.map((kpi) => (
              <Link key={kpi.title} to={kpi.href} className="group">
                <Card className="overflow-hidden border-border/60 hover:shadow-md hover:border-border transition-all duration-200 h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn('p-2 rounded-lg', kpi.iconBg)}>
                        <kpi.icon className={cn('w-4 h-4', kpi.iconColor)} />
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 leading-tight">{kpi.title}</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{kpi.value}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>

      {!isPremium && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm">
          <Zap className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-amber-800 dark:text-amber-200">
            Consultas em {format(new Date(), 'MMMM', { locale: ptBR })}:{' '}
            <strong>{monthConsultations}/{FREE_PLAN_LIMITS.maxConsultationsPerMonth}</strong> usadas
          </span>
          <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 shrink-0">Plano Gratuito</span>
        </div>
      )}

      {/* Chart + Today's Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Bar chart — last 7 days */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Consultas Realizadas</CardTitle>
                <CardDescription className="text-xs mt-0.5">Últimos 7 dias</CardDescription>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-foreground">{weekChartData.reduce((s, d) => s + d.consultas, 0)}</p>
                <p className="text-xs text-muted-foreground">no período</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {loading ? (
              <div className="h-[180px] flex flex-col justify-end gap-1 px-2">
                {[40, 65, 30, 80, 55, 90, 70].map((h, i) => (
                  <div key={i} className="flex-1 flex items-end">
                    <Skeleton className="w-full rounded-t-md" style={{ height: `${h}%` }} />
                  </div>
                ))}
              </div>
            ) : weekChartData.reduce((s, d) => s + d.consultas, 0) === 0 ? (
              <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <TrendingUp className="w-8 h-8 opacity-20" />
                <p className="text-sm">Nenhuma consulta nos últimos 7 dias.</p>
              </div>
            ) : (
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekChartData} barSize={28} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
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
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#10b98120', radius: 6 }} />
                    <Bar dataKey="consultas" radius={[6, 6, 0, 0]}>
                      {weekChartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.isToday ? '#10b981' : '#6ee7b7'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Appointments */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Agenda de Hoje
              </CardTitle>
              <Button nativeButton={false} variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 px-2" render={<Link to="/schedule" />}>
                Ver tudo <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {todayAppointments.length > 0 ? (
              <div className="space-y-2">
                {todayAppointments.map((app) => {
                  let timeStr = '—';
                  try { timeStr = format(parseISO(app.date), 'HH:mm'); } catch {}
                  return (
                    <div key={app.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                      <div className="w-12 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary leading-none">{timeStr}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {app.patient?.name || 'Paciente'}
                        </p>
                        <span className={cn('inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5', statusColor(app.status))}>
                          {translateStatus(app.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {app.meetLink && (
                          <a href={app.meetLink} target="_blank" rel="noopener noreferrer" title="Google Meet">
                            <Button variant="ghost" size="icon" className="w-7 h-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50">
                              <Video className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        )}
                        <Button nativeButton={false} variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-foreground" render={<Link to={`/patients/${app.patientId}`} />}>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <Calendar className="w-8 h-8 opacity-20" />
                <p className="text-sm text-center">Nenhuma consulta<br />agendada para hoje.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Patients + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Recent Patients */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Pacientes Recentes</CardTitle>

              <Button nativeButton={false} variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 px-2" render={<Link to="/patients" />}>
                Ver todos <ChevronRight className="w-3 h-3 ml-1" />
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
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{patient.name}</p>
                        <p className="text-xs text-muted-foreground">Cadastrado em {dateStr}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <Users className="w-8 h-8 opacity-20" />
                <p className="text-sm">Nenhum paciente cadastrado ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Acesso Rápido</CardTitle>
            <CardDescription className="text-xs">Navegue para as principais áreas do sistema</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link key={action.label} to={action.to}>
                  <div className={cn(
                    'flex items-center gap-3 p-4 rounded-xl transition-all cursor-pointer border border-transparent hover:border-border/60',
                    action.color
                  )}>
                    <div className="p-2 rounded-lg bg-white/50 dark:bg-black/20">
                      <action.icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold">{action.label}</span>
                  </div>
                </Link>
              ))}
            </div>

            {!isPremium && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-primary/15 shrink-0">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Upgrade para Premium</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Desbloqueie pacientes ilimitados e recursos avançados.</p>
                    <Link to="/settings?tab=subscription">
                      <Button size="sm" className="mt-2 h-7 text-xs rounded-lg px-3 bg-primary hover:bg-primary/90">
                        Ver planos
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
