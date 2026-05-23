import React, { useEffect, useState } from 'react';
import { apiRequest } from '../hooks/useApi';


import { Nutritionist } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Users,
  ShieldCheck,
  CreditCard,
  Search,
  Activity,
  Settings as SettingsIcon,
  LayoutDashboard,
  TrendingUp,
  AlertTriangle,
  ClipboardList,
  UtensilsCrossed,
  ScrollText,
  Wrench
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { FREE_PLAN_LIMITS } from '../lib/planLimits';
import { Navigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Label } from '../components/ui/label';

import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '../components/ui/tabs';

export const AdminDashboard = () => {
  const { nutritionist, loading: authLoading } = useAuth();
  const [nutritionists, setNutritionists] = useState<Nutritionist[]>([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [engagementFilter, setEngagementFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingDeletion, setPendingDeletion] = useState<number | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<{
    totalNutritionists: number;
    premiumCount: number;
    freeCount: number;
    adminCount: number;
    conversionRate: number;
    estimatedRevenue: number;
    activeLast30Days: number;
    newLast7Days: number;
    totalPatients: number;
    newSubscribersThisMonth: number;
    newSubscribersPrevMonth: number;
    pendingChurn: number;
    consultationsThisMonth: number;
    mealPlansThisMonth: number;
  } | null>(null);
  const [operationalData, setOperationalData] = useState<{
    noCpfCnpjCount: number;
    noPatientsCount: number;
    manualPlanOverrides: { id: string; name: string; email: string; plan: string; updatedAt: string }[];
  } | null>(null);
  const [showRetentionConfirm, setShowRetentionConfirm] = useState(false);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const LIMIT = 20;

  useEffect(() => { setPage(1); }, [engagementFilter]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const filterParam = engagementFilter !== 'all' ? `&filter=${engagementFilter}` : '';
        const [nutriRes, patientCount, pending, logs, statsRes, operational] = await Promise.all([
          apiRequest<{ data: Nutritionist[]; total: number; totalPages: number }>(
            `/api/admin/nutritionists?page=${page}&limit=${LIMIT}${filterParam}`, 'GET'
          ),
          apiRequest<{ count: number }>('/api/admin/patients/count', 'GET'),
          apiRequest<{ count: number }>('/api/admin/retention/pending', 'GET'),
          apiRequest<any[]>('/api/admin/audit-logs', 'GET'),
          apiRequest<{
            totalNutritionists: number;
            premiumCount: number;
            freeCount: number;
            adminCount: number;
            conversionRate: number;
            estimatedRevenue: number;
            activeLast30Days: number;
            newLast7Days: number;
            totalPatients: number;
            newSubscribersThisMonth: number;
            newSubscribersPrevMonth: number;
            pendingChurn: number;
            consultationsThisMonth: number;
            mealPlansThisMonth: number;
          }>('/api/admin/stats/expanded', 'GET'),
          apiRequest<{
            noCpfCnpjCount: number;
            noPatientsCount: number;
            manualPlanOverrides: { id: string; name: string; email: string; plan: string; updatedAt: string }[];
          }>('/api/admin/operational', 'GET'),
        ]);
        setNutritionists(nutriRes?.data || []);
        setTotalPages(nutriRes?.totalPages || 1);
        setTotalPatients(patientCount?.count || 0);
        setPendingDeletion(pending?.count ?? 0);
        setAuditLogs(logs || []);
        setAdminStats(statsRes);
        setOperationalData(operational);
      } catch (error) {
        console.error("Error fetching admin data:", error);
        toast.error("Erro ao carregar dados administrativos.");
      } finally {
        setLoading(false);
      }
    };

    if (nutritionist?.role === 'admin') {
      fetchData();
    }
  }, [nutritionist, page, engagementFilter]);

  if (authLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (nutritionist?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const handleTogglePlan = async (id: string, currentPlan: string) => {
    const newPlan = currentPlan === 'premium' ? 'free' : 'premium';
    try {
      await apiRequest(`/api/admin/nutritionists/${id}`, 'PATCH', { plan: newPlan });
      setNutritionists(prev => prev.map(n => n.id === id ? { ...n, plan: newPlan as any } : n));
      toast.success(`Plano atualizado para ${newPlan === 'premium' ? 'Assinante' : 'Gratuito'}!`);
    } catch (error: any) {
      toast.error('Erro ao atualizar plano: ' + error.message);
    }
  };

  const handleRetentionCleanup = async () => {
    setIsRunningCleanup(true);
    try {
      await apiRequest('/api/admin/retention-cleanup', 'POST');
      toast.success('Limpeza LGPD executada com sucesso!');
      setPendingDeletion(0);
    } catch (error: any) {
      toast.error('Erro ao executar limpeza: ' + error.message);
    } finally {
      setIsRunningCleanup(false);
    }
  };

  const filteredNutritionists = nutritionists.filter(n => {
    const matchesSearch = n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.crn.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlan = planFilter === 'all' || n.plan === planFilter;
    const matchesRole = roleFilter === 'all' || n.role === roleFilter;

    return matchesSearch && matchesPlan && matchesRole;
  });

  const stats = {
    total: nutritionists.length,
    subscribers: nutritionists.filter(n => n.plan === 'premium').length,
    free: nutritionists.filter(n => n.plan !== 'premium').length,
    admins: nutritionists.filter(n => n.role === 'admin').length
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gerenciamento global da plataforma Nutrir</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex w-full items-center justify-start gap-2 bg-transparent border-b border-border p-0 rounded-none h-auto mb-8 overflow-x-auto">
          <TabsTrigger 
            value="overview" 
            className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <LayoutDashboard className="w-4 h-4" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger 
            value="nutritionists" 
            className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <Users className="w-4 h-4" /> Nutricionistas
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <SettingsIcon className="w-4 h-4" /> Configurações do Plano
          </TabsTrigger>
          <TabsTrigger value="audit" className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap">
            <ScrollText className="w-4 h-4" /> Auditoria
          </TabsTrigger>
          <TabsTrigger value="operational" className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap">
            <Wrench className="w-4 h-4" /> Operacional
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Nutricionistas */}
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Nutricionistas</p>
                    <p className="text-2xl font-bold text-foreground">{adminStats?.totalNutritionists ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{adminStats?.newLast7Days ?? 0} novos nos últimos 7 dias</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Premium */}
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Premium</p>
                    <p className="text-2xl font-bold text-foreground">{adminStats?.premiumCount ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">Conversão: {adminStats?.conversionRate ?? 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Receita */}
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Receita Estimada</p>
                    <p className="text-2xl font-bold text-foreground">
                      {adminStats ? `R$ ${adminStats.estimatedRevenue.toFixed(2).replace('.', ',')}` : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">mensal recorrente</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Novos assinantes */}
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Novos Assinantes</p>
                    <p className="text-2xl font-bold text-foreground">{adminStats?.newSubscribersThisMonth ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {adminStats ? `${adminStats.newSubscribersPrevMonth} no mês anterior` : 'este mês'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Churn pendente */}
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className={cn("w-5 h-5", adminStats?.pendingChurn ? "text-amber-500" : "text-primary")} />
                  <div>
                    <p className="text-xs text-muted-foreground">Cancelamentos Pendentes</p>
                    <p className={cn("text-2xl font-bold", adminStats?.pendingChurn ? "text-amber-600" : "text-foreground")}>
                      {adminStats?.pendingChurn ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">não renovarão</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ativos */}
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ativos (30 dias)</p>
                    <p className="text-2xl font-bold text-foreground">{adminStats?.activeLast30Days ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">com login recente</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Consultas do mês */}
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Consultas este Mês</p>
                    <p className="text-2xl font-bold text-foreground">{adminStats?.consultationsThisMonth ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">registradas na plataforma</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Planos alimentares do mês */}
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <UtensilsCrossed className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Planos Alimentares este Mês</p>
                    <p className="text-2xl font-bold text-foreground">{adminStats?.mealPlansThisMonth ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">criados na plataforma</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pacientes */}
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pacientes (total)</p>
                    <p className="text-2xl font-bold text-foreground">{adminStats?.totalPatients ?? totalPatients}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        <TabsContent value="nutritionists">
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-6 gap-4">
              <CardTitle className="text-xl font-bold">Nutricionistas Cadastrados</CardTitle>
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nome, email ou CRN..." 
                    className="pl-10 bg-muted/30 border-none rounded-xl h-8 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="w-[140px] bg-muted/30 border-none rounded-xl h-8 text-sm">
                      <SelectValue placeholder="Plano">
                        {planFilter === 'all' ? 'Todos Planos' : 
                         planFilter === 'free' ? 'Gratuito' : 
                         planFilter === 'premium' ? 'Premium' : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Planos</SelectItem>
                      <SelectItem value="free">Gratuito</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[140px] bg-muted/30 border-none rounded-xl h-8 text-sm">
                      <SelectValue placeholder="Cargo">
                        {roleFilter === 'all' ? 'Todos Cargos' :
                         roleFilter === 'nutritionist' ? 'Nutricionista' :
                         roleFilter === 'admin' ? 'Admin' : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Cargos</SelectItem>
                      <SelectItem value="nutritionist">Nutricionista</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={engagementFilter} onValueChange={(v) => { setEngagementFilter(v); }}>
                    <SelectTrigger className="w-[180px] h-9 text-sm rounded-xl border-border">
                      <SelectValue placeholder="Engajamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="churnRisk">Risco de Churn</SelectItem>
                      <SelectItem value="atLimit">Atingiu Limite Free</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                      <th className="px-6 py-4 font-bold">Nutricionista</th>
                      <th className="hidden md:table-cell px-6 py-4 font-bold">CRN</th>
                      <th className="px-6 py-4 font-bold">Plano</th>
                      <th className="px-6 py-4 font-bold">Cargo</th>
                      <th className="hidden md:table-cell px-6 py-4 font-bold">Último Login</th>
                      <th className="px-6 py-4 font-bold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        </td>
                      </tr>
                    ) : filteredNutritionists.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                          Nenhum nutricionista encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredNutritionists.map((n) => (
                        <tr key={n.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold">
                                {n.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-foreground">{n.name}</p>
                                <p className="text-xs text-muted-foreground">{n.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="hidden md:table-cell px-6 py-4 text-muted-foreground font-medium">{n.crn}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              n.plan === 'premium' ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                              {n.plan === 'premium' ? 'Premium' : 'Gratuito'}
                            </span>
                            {n.planOverridedByAdmin && (
                              <span
                                className="ml-1 text-xs text-amber-600 font-medium"
                                title="Plano definido manualmente — sync do Asaas não irá sobrescrever"
                              >
                                Manual
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              n.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {n.role === 'admin' ? 'Admin' : 'Nutricionista'}
                            </span>
                          </td>
                          <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                            {(n as any).lastLogin ? (() => {
                              const daysInactive = differenceInDays(new Date(), parseISO((n as any).lastLogin));
                              return (
                                <span className={cn(
                                  "text-sm",
                                  daysInactive > 60 ? "text-amber-600 font-medium" : "text-muted-foreground"
                                )}>
                                  {format(parseISO((n as any).lastLogin), "dd/MM/yyyy", { locale: ptBR })}
                                  {daysInactive > 60 && <span className="ml-1 text-xs">(inativo {daysInactive}d)</span>}
                                </span>
                              );
                            })() : (
                              <span className="text-xs text-muted-foreground">Nunca</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 rounded-lg text-xs"
                                onClick={() => handleTogglePlan(n.id, n.plan || 'free')}
                              >
                                Mudar Plano
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <div className="max-w-2xl">
            <Card className="border-none shadow-sm bg-card">
              <CardHeader className="border-b border-border pb-6">
                <div className="flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-xl font-bold">Limites do Plano Gratuito</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Definidos em código — altere o arquivo <code className="text-xs bg-muted px-1 py-0.5 rounded">src/lib/planLimits.ts</code> para modificar.
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {[
                    { label: 'Pacientes ativos', value: FREE_PLAN_LIMITS.maxPatients },
                    { label: 'Consultas por mês', value: FREE_PLAN_LIMITS.maxConsultationsPerMonth },
                    { label: 'Consultas por paciente/mês', value: FREE_PLAN_LIMITS.maxConsultationsPerPatientPerMonth },
                    { label: 'Planos alimentares ativos', value: FREE_PLAN_LIMITS.maxMealPlans },
                    { label: 'Exames por paciente', value: FREE_PLAN_LIMITS.maxExams },
                    { label: 'Meses de histórico visível', value: FREE_PLAN_LIMITS.historyMonths },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-bold text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="border-b border-border pb-6">
              <CardTitle className="text-xl font-bold">Log de Auditoria</CardTitle>
              <p className="text-sm text-muted-foreground">Últimas 50 ações administrativas</p>
            </CardHeader>
            <CardContent className="p-0">
              {auditLogs.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhuma ação registrada.</p>
              ) : (
                <div className="divide-y divide-border">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start justify-between px-6 py-4 gap-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {log.action === 'set_role' && `Papel alterado: ${log.previousValue} → ${log.newValue}`}
                          {log.action === 'set_plan' && `Plano alterado: ${log.previousValue} → ${log.newValue}`}
                          {log.action === 'retention_cleanup' && `Limpeza LGPD: ${log.newValue}`}
                        </p>
                        {log.targetEmail && (
                          <p className="text-xs text-muted-foreground">Alvo: {log.targetEmail}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Por: {log.adminEmail}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(parseISO(log.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operational" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-none shadow-sm bg-card">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Sem CPF/CNPJ</p>
                    <p className="text-2xl font-bold text-foreground">{operationalData?.noCpfCnpjCount ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">impedem checkout do Asaas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-card">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Sem Pacientes</p>
                    <p className="text-2xl font-bold text-foreground">{operationalData?.noPatientsCount ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">onboarding incompleto</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-bold">Liberações Manuais de Plano</CardTitle>
              <p className="text-sm text-muted-foreground">Planos definidos pelo admin — sync do Asaas não sobrescreve</p>
            </CardHeader>
            <CardContent className="p-0">
              {!operationalData?.manualPlanOverrides?.length ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhuma liberação manual ativa.</p>
              ) : (
                <div className="divide-y divide-border">
                  {operationalData.manualPlanOverrides.map((n) => (
                    <div key={n.id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <p className="text-sm font-medium">{n.name}</p>
                        <p className="text-xs text-muted-foreground">{n.email}</p>
                      </div>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        n.plan === 'premium' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {n.plan === 'premium' ? 'Premium' : 'Gratuito'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-bold">Limpeza LGPD</CardTitle>
              <p className="text-sm text-muted-foreground">Remove permanentemente pacientes com soft delete há mais de 30 dias</p>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {pendingDeletion !== null && (
                <p className="text-sm text-muted-foreground">
                  {pendingDeletion === 0
                    ? 'Nenhum paciente pendente de remoção permanente.'
                    : `${pendingDeletion} paciente(s) aguardando remoção permanente.`}
                </p>
              )}
              <Button
                variant="destructive"
                disabled={pendingDeletion === 0 || isRunningCleanup}
                onClick={() => setShowRetentionConfirm(true)}
              >
                {isRunningCleanup ? 'Removendo...' : `Executar Limpeza LGPD${pendingDeletion ? ` (${pendingDeletion})` : ''}`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showRetentionConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 shadow-xl max-w-sm w-full space-y-4">
            <h3 className="font-bold text-lg">Confirmar remoção permanente</h3>
            <p className="text-sm text-muted-foreground">
              Esta ação irá remover permanentemente <strong>{pendingDeletion} paciente(s)</strong> do banco de dados. Essa operação é irreversível e está em conformidade com a LGPD.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRetentionConfirm(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  setShowRetentionConfirm(false);
                  await handleRetentionCleanup();
                }}
              >
                Confirmar remoção
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
