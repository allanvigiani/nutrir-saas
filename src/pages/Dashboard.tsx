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

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <Card>
      <CardContent className="p-4 px-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
          </div>
          <div className={cn("p-3 rounded-xl", color)}>
            <Icon className="w-6 h-6 text-white" />
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
          <h1 className="text-3xl font-bold text-slate-900">Olá, {getFirstName()}</h1>
          <p className="text-slate-500">Veja o que temos para hoje.</p>
        </div>
        <div className="flex gap-3">
          <Button nativeButton={false} variant="outline" className="gap-2 h-8 text-sm font-bold" render={<Link to="/patients" />}>
            <Search className="w-4 h-4" /> Buscar Paciente
          </Button>
          <PremiumFeature active={stats.activePatients >= 3}>
            <Button 
              nativeButton={false} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-4 gap-2 font-bold text-sm transition-all shadow-sm active:scale-95" 
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
          color="bg-blue-500" 
        />
        <StatCard 
          title="Consultas do Mês" 
          value={stats.monthConsultations} 
          icon={TrendingUp} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="Agenda de Hoje" 
          value={stats.todayAppointments} 
          icon={Calendar} 
          color="bg-amber-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Today's Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              Consultas de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppointments.length > 0 ? (
              <div className="space-y-4">
                {todayAppointments.map((app) => (
                  <div key={app.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                        {format(parseISO(app.date), 'HH:mm')}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{patientsMap[app.patient_id] || 'Paciente...'}</p>
                        <p className={cn(
                          "text-xs font-medium",
                          app.status === 'confirmed' && "text-blue-600",
                          app.status === 'realized' && "text-emerald-600",
                          app.status === 'cancelled' && "text-red-600",
                          app.status === 'pending' && "text-amber-600"
                        )}>
                          {translateStatus(app.status)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button nativeButton={false} variant="ghost" size="sm" className="text-emerald-600" render={<Link to={`/patients/${app.patient_id}`} />}>
                        Ver Perfil
                      </Button>
                      <Button nativeButton={false} variant="ghost" size="sm" className="text-slate-600" render={<Link to={`/patients/${app.patient_id}?edit=true`} />}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
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
                  <div key={patient.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{patient.name}</p>
                        <p className="text-xs text-slate-500">Cadastrado em {format(parseISO(patient.createdAt), 'dd/MM/yyyy')}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button nativeButton={false} variant="ghost" size="sm" render={<Link to={`/patients/${patient.id}`} />}>
                        Ver Perfil
                      </Button>
                      <Button nativeButton={false} variant="ghost" size="sm" className="text-slate-600" render={<Link to={`/patients/${patient.id}?edit=true`} />}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                Nenhum paciente cadastrado recentemente.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
