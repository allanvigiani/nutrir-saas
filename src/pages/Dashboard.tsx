import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Calendar, 
  PlusCircle, 
  Search, 
  TrendingUp,
  Clock,
  CheckCircle2,
  Edit
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Patient, Appointment } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { PremiumFeature } from '../components/PremiumFeature';

import { PremiumBanner } from '../components/PremiumBanner';
import { FREE_PLAN_LIMITS } from '../lib/planLimits';

export const Dashboard = () => {
  const { user, nutritionist, isAuthReady } = useAuth();
  const isPremium = nutritionist?.plan === 'premium';
  const [stats, setStats] = useState({
    activePatients: 0,
    monthConsultations: 0,
    todayAppointments: 0
  });
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [patientsMap, setPatientsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const translateStatus = (status: string) => {
    const statuses: Record<string, string> = {
      'confirmed': 'Confirmada',
      'pending': 'Pendente',
      'cancelled': 'Cancelada',
      'realized': 'Realizada'
    };
    return statuses[status] || status;
  };

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const fetchDashboardData = () => {
      setLoading(true);
      
      // Fetch active patients count
      const patientsQuery = query(
        collection(db, 'patients'), 
        where('nutritionist_id', '==', user.uid),
        where('status', '==', 'active')
      );
      
      // Fetch recent patients
      const recentPatientsQuery = query(
        collection(db, 'patients'),
        where('nutritionist_id', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      
      // Fetch today's appointments
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const appointmentsQuery = query(
        collection(db, 'appointments'),
        where('nutritionist_id', '==', user.uid),
        where('date', '>=', today.toISOString()),
        where('date', '<', tomorrow.toISOString()),
        orderBy('date', 'asc')
      );

      // Fetch month consultations
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

      const monthConsultationsQuery = query(
        collection(db, 'consultations'),
        where('nutritionist_id', '==', user.uid),
        where('date', '>=', startOfMonth.toISOString()),
        where('date', '<=', endOfMonth.toISOString())
      );

      const unsubPatients = onSnapshot(patientsQuery, (snap) => {
        setStats(prev => ({ ...prev, activePatients: snap.size }));
        const map: Record<string, string> = {};
        snap.docs.forEach(doc => {
          const data = doc.data() as Patient;
          map[doc.id] = data.name;
        });
        setPatientsMap(prev => ({ ...prev, ...map }));
      });

      const unsubRecent = onSnapshot(recentPatientsQuery, (snap) => {
        setRecentPatients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
      });

      const unsubAppointments = onSnapshot(appointmentsQuery, (snap) => {
        setTodayAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
        setStats(prev => ({ ...prev, todayAppointments: snap.size }));
      });

      const unsubMonthConsultations = onSnapshot(monthConsultationsQuery, (snap) => {
        setStats(prev => ({ ...prev, monthConsultations: snap.size }));
        setLoading(false);
      });

      return () => {
        unsubPatients();
        unsubRecent();
        unsubAppointments();
        unsubMonthConsultations();
      };
    };

    const unsubscribe = fetchDashboardData();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, isAuthReady]);

  const StatCard = ({ title, value, icon: Icon, iconBg, iconColor }: any) => (
    <Card className="overflow-hidden border-border/60 hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-3xl font-bold text-card-foreground tabular-nums">
              {loading ? <span className="text-muted-foreground">—</span> : value}
            </h3>
          </div>
          <div className={cn("p-2.5 rounded-xl", iconBg)}>
            <Icon className={cn("w-5 h-5", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const getFirstName = () => {
    const name = nutritionist?.name || user?.displayName;
    if (!name) return 'Nutricionista';
    return name.split(' ')[0];
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Olá, {getFirstName()} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
          </p>
        </div>
        <div className="flex gap-3">
          <PremiumFeature active={stats.activePatients >= FREE_PLAN_LIMITS.maxPatients}>
            <Button
              nativeButton={false}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-9 px-4 gap-2 font-semibold text-sm transition-all shadow-sm shadow-primary/20 active:scale-95"
              render={<Link to="/patients" />}
            >
              <PlusCircle className="w-4 h-4" /> Novo Paciente
            </Button>
          </PremiumFeature>
        </div>
      </div>

      {!isPremium && (
        <PremiumBanner 
          title="Você está no Plano Gratuito" 
          description="Aproveite o Nutrir ao máximo! Assine o Premium para ter pacientes ilimitados, histórico completo e muito mais."
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Pacientes Ativos"
          value={stats.activePatients}
          icon={Users}
          iconBg="bg-muted"
          iconColor="text-muted-foreground"
        />
        <StatCard
          title="Consultas do Mês"
          value={stats.monthConsultations}
          icon={TrendingUp}
          iconBg="bg-blue-50 dark:bg-blue-950/30"
          iconColor="text-blue-500 dark:text-blue-400"
        />
        <StatCard
          title="Agenda de Hoje"
          value={stats.todayAppointments}
          icon={Calendar}
          iconBg="bg-amber-100 dark:bg-amber-950"
          iconColor="text-amber-600 dark:text-amber-400"
        />
      </div>

      {!isPremium && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm">
          <TrendingUp className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-amber-800 dark:text-amber-200">
            Consultas em {format(new Date(), 'MMMM', { locale: ptBR })}:{' '}
            <strong>{stats.monthConsultations}/{FREE_PLAN_LIMITS.maxConsultationsPerMonth}</strong> usadas
          </span>
          <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 shrink-0">
            Plano Gratuito
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Today's Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Consultas de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppointments.length > 0 ? (
              <div className="space-y-4">
                {todayAppointments.map((app) => (
                  <div key={app.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold">
                        {format(parseISO(app.date), 'HH:mm')}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{patientsMap[app.patient_id] || 'Paciente...'}</p>
                        <p className={cn(
                          "text-xs font-medium",
                          app.status === 'confirmed' && "text-blue-600",
                          app.status === 'realized' && "text-primary",
                          app.status === 'cancelled' && "text-red-600",
                          app.status === 'pending' && "text-amber-600"
                        )}>
                          {translateStatus(app.status)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button nativeButton={false} variant="ghost" size="sm" className="text-primary" render={<Link to={`/patients/${app.patient_id}`} />}>
                        Ver Perfil
                      </Button>
                      <Button nativeButton={false} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" render={<Link to={`/patients/${app.patient_id}?edit=true`} />}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma consulta agendada para hoje.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Patients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-blue-600" />
              Novos Pacientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPatients.length > 0 ? (
              <div className="space-y-4">
                {recentPatients.map((patient) => (
                  <div key={patient.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-sm">
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{patient.name}</p>
                        <p className="text-xs text-muted-foreground">Cadastrado em {format(parseISO(patient.createdAt), 'dd/MM/yyyy')}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button nativeButton={false} variant="ghost" size="sm" render={<Link to={`/patients/${patient.id}`} />}>
                        Ver Perfil
                      </Button>
                      <Button nativeButton={false} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" render={<Link to={`/patients/${patient.id}?edit=true`} />}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum paciente cadastrado recentemente.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
