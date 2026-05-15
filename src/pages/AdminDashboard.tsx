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
  LayoutDashboard
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
import { format, parseISO } from 'date-fns';
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [nutriData, patientCount] = await Promise.all([
          apiRequest<Nutritionist[]>('/api/admin/nutritionists', 'GET'),
          apiRequest<{ count: number }>('/api/admin/patients/count', 'GET'),
        ]);
        setNutritionists(nutriData || []);
        setTotalPatients(patientCount?.count || 0);
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
  }, [nutritionist]);

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

  const handlePromoteToAdmin = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'nutritionist' : 'admin';
    try {
      await apiRequest(`/api/admin/nutritionists/${id}`, 'PATCH', { role: newRole });
      setNutritionists(prev => prev.map(n => n.id === id ? { ...n, role: newRole as any } : n));
      toast.success(`Usuário ${newRole === 'admin' ? 'promovido a admin' : 'removido de admin'} com sucesso!`);
    } catch (error: any) {
      toast.error('Erro ao atualizar role: ' + error.message);
    }
  };

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
          <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
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
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total de Nutricionistas</p>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Assinantes Premium</p>
                    <p className="text-2xl font-bold text-foreground">{stats.subscribers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted/30 text-muted-foreground flex items-center justify-center">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total de Pacientes</p>
                    <p className="text-2xl font-bold text-foreground">{totalPatients}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Administradores</p>
                    <p className="text-2xl font-bold text-foreground">{stats.admins}</p>
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
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                      <th className="px-6 py-4 font-bold">Nutricionista</th>
                      <th className="px-6 py-4 font-bold">CRN</th>
                      <th className="px-6 py-4 font-bold">Plano</th>
                      <th className="px-6 py-4 font-bold">Cargo</th>
                      <th className="px-6 py-4 font-bold">Último Login</th>
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
                          <td className="px-6 py-4 text-muted-foreground font-medium">{n.crn}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              n.plan === 'premium' ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                              {n.plan === 'premium' ? 'Premium' : 'Gratuito'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              n.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {n.role === 'admin' ? 'Admin' : 'Nutricionista'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground text-sm">
                            {n.lastLogin ? (
                              format(parseISO(n.lastLogin), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            ) : (
                              <span className="text-muted-foreground italic">Nunca logou</span>
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
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn(
                                  "h-8 w-8 rounded-lg",
                                  n.role === 'admin' ? "text-red-600 hover:bg-red-50" : "text-purple-600 hover:bg-purple-50"
                                )}
                                onClick={() => handlePromoteToAdmin(n.id, n.role || 'nutritionist')}
                                title={n.role === 'admin' ? "Remover Admin" : "Promover a Admin"}
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
      </Tabs>
    </div>
  );
};
