import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  User, 
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Edit
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '../components/ui/card';
import { Button, buttonVariants } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '../components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '../components/ui/tabs';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, orderBy, updateDoc, doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Appointment, Patient } from '../types';
import { 
  format, 
  isSameDay, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  addMonths, 
  subMonths,
  addDays,
  isSameHour,
  startOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const Schedule = () => {
  const { user, isAuthReady, nutritionist } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [isDateLocked, setIsDateLocked] = useState(false);
  
  // Form states
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [selectedStatus, setSelectedStatus] = useState<Appointment['status']>('pending');

  const translateStatus = (status: string) => {
    const statuses: Record<string, string> = {
      'confirmed': 'Confirmado',
      'pending': 'Pendente',
      'cancelled': 'Cancelado',
      'realized': 'Realizado'
    };
    return statuses[status] || status;
  };

  const fetchAppointments = () => {
    if (!user || !isAuthReady) return;
    setLoading(true);
    
    // Fetch patients first to ensure they are available for the appointments list
    const patientsQuery = query(
      collection(db, 'patients'),
      where('nutritionist_id', '==', user.uid),
      orderBy('name', 'asc')
    );

    const unsubPatients = onSnapshot(patientsQuery, (snap) => {
      setPatients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    }, (error) => {
      console.error("Error fetching patients:", error);
      handleFirestoreError(error, OperationType.GET, 'patients');
    });

    const q = query(
      collection(db, 'appointments'),
      where('nutritionist_id', '==', user.uid),
      orderBy('date', 'asc')
    );
    
    const unsubAppointments = onSnapshot(q, (querySnapshot) => {
      setAppointments(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching schedule data:", error);
      toast.error("Erro ao carregar agenda.");
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'appointments');
    });

    return () => {
      unsubPatients();
      unsubAppointments();
    };
  };

  useEffect(() => {
    if (!isAuthReady || !user) return;
    const unsubscribe = fetchAppointments();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, isAuthReady]);

  const handleAddAppointment = async () => {
    if (!user || !selectedDate || !selectedPatientId) return;
    
    try {
      const appointmentDate = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':');
      appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const now = new Date();
      if (!editingAppointment && appointmentDate < now) {
        toast.error('Não é possível agendar consultas no passado.');
        return;
      }

      if (editingAppointment) {
        const oldDate = new Date(editingAppointment.date);
        if (appointmentDate.getTime() !== oldDate.getTime() && appointmentDate < now) {
          toast.error('Não é possível alterar o agendamento para uma data no passado.');
          return;
        }
        await updateDoc(doc(db, 'appointments', editingAppointment.id), {
          patient_id: selectedPatientId,
          date: appointmentDate.toISOString(),
          status: selectedStatus,
          updatedAt: new Date().toISOString(),
        });
        toast.success('Agendamento atualizado com sucesso!');
      } else {
        const patient = patients.find(p => p.id === selectedPatientId);
        const docRef = await addDoc(collection(db, 'appointments'), {
          patient_id: selectedPatientId,
          nutritionist_id: user.uid,
          access_token: patient?.access_token || null,
          date: appointmentDate.toISOString(),
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        
        toast.success('Agendamento realizado com sucesso!');

        // Trigger Google Calendar integration if connected
        if (nutritionist?.googleCalendarConnected) {
          user.getIdToken().then(token => {
            fetch('/api/create-calendar-event', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                appointmentId: docRef.id,
                nutritionistId: user.uid
              })
            }).then(res => res.json())
              .then(data => {
                if (data.success && data.meetLink) {
                  toast.success('Evento criado no Google Agenda com link do Meet!');
                }
              }).catch(err => console.error("Error creating calendar event:", err));
          });
        }
      }

      setIsModalOpen(false);
      setEditingAppointment(null);
      fetchAppointments();
    } catch (error) {
      console.error("Error saving appointment:", error);
      toast.error('Erro ao salvar agendamento.');
    }
  };

  const handleDeleteAppointment = async () => {
    if (!appointmentToDelete) return;
    try {
      await deleteDoc(doc(db, 'appointments', appointmentToDelete));
      toast.success('Agendamento excluído com sucesso!');
      setIsDeleteModalOpen(false);
      setAppointmentToDelete(null);
      fetchAppointments();
    } catch (error) {
      console.error("Error deleting appointment:", error);
      toast.error('Erro ao excluir agendamento.');
    }
  };

  const openEditModal = (app: Appointment) => {
    setEditingAppointment(app);
    setSelectedPatientId(app.patient_id);
    setSelectedDate(parseISO(app.date));
    setSelectedTime(format(parseISO(app.date), 'HH:mm'));
    setSelectedStatus(app.status);
    setIsDateLocked(false); // Allow rescheduling when editing
    setIsModalOpen(true);
  };

  const openNewModal = (date?: Date) => {
    if (date && !isToday(date) && date < new Date()) {
      toast.error('Não é possível agendar consultas no passado.');
      return;
    }
    setEditingAppointment(null);
    setSelectedPatientId('');
    setSelectedDate(date || new Date());
    setIsDateLocked(!!date); // Lock if date was provided from calendar click
    setSelectedTime('09:00');
    setSelectedStatus('pending');
    setIsModalOpen(true);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'appointments', id), {
        status,
        updatedAt: new Date().toISOString()
      });
      toast.success('Status atualizado!');
      fetchAppointments();
    } catch (error) {
      console.error("Error updating appointment:", error);
      toast.error('Erro ao atualizar status.');
    }
  };

  const getPatientName = (id: string) => {
    return patients.find(p => p.id === id)?.name || 'Paciente não encontrado';
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground">Gerencie seus horários e atendimentos.</p>
        </div>
        <div className="flex items-center gap-4">
          <Tabs value={view} onValueChange={(val: any) => setView(val)} className="w-auto">
            <TabsList className="flex items-center justify-start gap-2 bg-transparent border-b border-border p-0 rounded-none h-auto overflow-x-auto">
              <TabsTrigger 
                value="month" 
                className="relative gap-2 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap text-sm font-medium"
              >
                Mês
              </TabsTrigger>
              <TabsTrigger 
                value="week" 
                className="relative gap-2 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap text-sm font-medium"
              >
                Semana
              </TabsTrigger>
              <TabsTrigger 
                value="day" 
                className="relative gap-2 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap text-sm font-medium"
              >
                Dia
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Dialog open={isModalOpen} onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) setEditingAppointment(null);
          }}>
            <DialogTrigger 
              render={<Button className="bg-primary hover:bg-primary/90 text-white rounded-xl h-8 px-4 gap-2 font-bold text-sm transition-all shadow-sm active:scale-95" onClick={() => openNewModal()} />}
              nativeButton={true}
            >
              <Plus className="w-4 h-4" /> Novo Agendamento
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl rounded-2xl">
              <DialogHeader>
                <DialogTitle>{editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
                <DialogDescription>
                  {editingAppointment ? 'Altere os dados do agendamento abaixo.' : 'Selecione o paciente e o horário para a consulta.'}
                </DialogDescription>
              </DialogHeader>
              <div key={editingAppointment?.id || 'new'} className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label>Paciente</Label>
                  <Select value={selectedPatientId} onValueChange={setSelectedPatientId} disabled={!!editingAppointment}>
                    <SelectTrigger className="bg-muted/30 rounded-lg w-full">
                      <SelectValue placeholder="Selecione o paciente">
                        {selectedPatientId ? (
                          <div className="flex items-center">
                            <span className="font-medium text-foreground whitespace-nowrap">{patients.find(p => p.id === selectedPatientId)?.name}</span>
                          </div>
                        ) : "Selecione o paciente"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {patients.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          Nenhum paciente cadastrado
                        </div>
                      ) : (
                        patients.map(p => (
                          <SelectItem key={p.id} value={p.id} className="py-2">
                            <div className="flex flex-col">
                              <span className="font-medium">{p.name}</span>
                              <span className="text-xs text-muted-foreground">{p.email}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    {isDateLocked ? (
                      <div className="p-2 border rounded-xl text-sm bg-muted/30 font-medium text-muted-foreground flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Selecione no calendário'}
                      </div>
                    ) : (
                      <Input
                        type="date"
                        className="bg-muted/30 rounded-lg"
                        value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
                          const newDate = parseISO(e.target.value);
                          if (newDate < startOfDay(new Date())) {
                            toast.error('Não é possível agendar consultas no passado.');
                            return;
                          }
                          setSelectedDate(newDate);
                        }}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Input
                      type="time"
                      className="bg-muted/30 rounded-lg"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                    />
                  </div>
                </div>
                {editingAppointment && (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={selectedStatus} onValueChange={(val: any) => setSelectedStatus(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status">
                          {selectedStatus === 'pending' ? 'Pendente' : 
                           selectedStatus === 'confirmed' ? 'Confirmado' : 
                           selectedStatus === 'realized' ? 'Realizado' : 
                           selectedStatus === 'cancelled' ? 'Cancelado' : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="realized">Realizado</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {editingAppointment?.meetLink && (
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center border border-primary/20">
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path fill="#00ac47" d="M16 11c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z"/>
                          <path fill="#00ac47" d="M19 7h-1V6c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v1H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-3 12H8v-2h8v2zm0-4H8v-2h8v2zm0-4H8V9h8v2z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-secondary-foreground">Google Meet Gerado</p>
                        <a 
                          href={editingAppointment.meetLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline break-all font-medium"
                        >
                          {editingAppointment.meetLink}
                        </a>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="bg-card border-primary/30 text-primary hover:bg-primary/15 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(editingAppointment.meetLink!);
                        toast.success('Link copiado!');
                      }}
                    >
                      Copiar Link
                    </Button>
                  </div>
                )}
              </div>
              <DialogFooter className="flex justify-between items-center">
                {editingAppointment && (
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      setAppointmentToDelete(editingAppointment.id);
                      setIsDeleteModalOpen(true);
                      setIsModalOpen(false);
                    }}
                    className="mr-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                  </Button>
                )}
                <div className="flex gap-2">
                  {editingAppointment && (
                    <Button nativeButton={false} variant="outline" className="gap-2" render={<Link to={`/patients/${editingAppointment.patient_id}?edit=true`} />}>
                      <Edit className="w-4 h-4" /> Editar Paciente
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                  <Button onClick={handleAddAppointment} className="bg-primary hover:bg-primary/90">
                    {editingAppointment ? 'Salvar Alterações' : 'Confirmar Agendamento'}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
            <DialogContent className="sm:max-w-sm p-6 rounded-2xl">
              <DialogHeader className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-2">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <DialogTitle className="text-center text-xl">Excluir Agendamento</DialogTitle>
                <DialogDescription className="text-center">
                  Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
                <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} className="flex-1 rounded-xl">Cancelar</Button>
                <Button variant="destructive" onClick={handleDeleteAppointment} className="flex-1 rounded-xl">Excluir</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="overflow-hidden border-none shadow-sm">
        <CardHeader className="bg-card border-b border-border flex flex-row items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-foreground capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday} className="h-8">
                Hoje
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {view === 'month' && (
            <div className="grid grid-cols-7 border-b border-border">
              {weekDays.map(day => (
                <div key={day} className="py-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/30/50 border-r border-border last:border-r-0">
                  {day}
                </div>
              ))}
              {calendarDays.map((day, idx) => {
                const dayAppointments = appointments.filter(app => isSameDay(parseISO(app.date), day));
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isPast = !isToday(day) && day < new Date();
                
                return (
                  <div 
                    key={idx} 
                    className={cn(
                      "min-h-[120px] p-2 border-r border-b border-border transition-colors",
                      !isCurrentMonth && "bg-muted/30/30 text-muted-foreground",
                      isToday(day) && "bg-primary/10/30",
                      isPast && "bg-muted/30/50 text-muted-foreground",
                      !isPast && "hover:bg-muted/30/50 cursor-pointer",
                      idx % 7 === 6 && "border-r-0"
                    )}
                    onClick={() => {
                      if (!isPast) openNewModal(day);
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={cn(
                        "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                        isToday(day) && "bg-primary text-white",
                        !isCurrentMonth && "text-muted-foreground"
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dayAppointments.slice(0, 3).map(app => (
                        <div 
                          key={app.id} 
                          className={cn(
                            "text-[10px] p-1 rounded border truncate",
                            app.status === 'confirmed' ? "bg-blue-50 border-blue-100 text-blue-700" :
                            app.status === 'realized' ? "bg-primary/10 border-primary/20 text-primary" :
                            app.status === 'cancelled' ? "bg-red-50 border-red-100 text-red-700" :
                            "bg-amber-50 border-amber-100 text-amber-700"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(app);
                          }}
                        >
                          <span className="font-bold mr-1">{format(parseISO(app.date), 'HH:mm')}</span>
                          {getPatientName(app.patient_id)}
                        </div>
                      ))}
                      {dayAppointments.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1">
                          + {dayAppointments.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === 'week' && (
            <div className="flex flex-col h-[600px] overflow-y-auto">
              <div className="grid grid-cols-8 border-b border-border sticky top-0 bg-card z-10">
                <div className="py-2 border-r border-border bg-muted/30/50"></div>
                {eachDayOfInterval({
                  start: startOfWeek(currentDate),
                  end: endOfWeek(currentDate)
                }).map(day => (
                  <div key={day.toString()} className={cn(
                    "py-2 text-center border-r border-border last:border-r-0 bg-muted/30/50",
                    isToday(day) && "bg-primary/8"
                  )}>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{format(day, 'EEE', { locale: ptBR })}</div>
                    <div className={cn(
                      "text-sm font-medium w-7 h-7 mx-auto flex items-center justify-center rounded-full mt-1",
                      isToday(day) && "bg-primary text-white"
                    )}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-8 flex-1">
                <div className="border-r border-border">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="h-20 border-b border-border text-[10px] text-muted-foreground p-1 text-right pr-2">
                      {format(addDays(startOfDay(new Date()), i + 7), 'HH:mm')}
                    </div>
                  ))}
                </div>
                {eachDayOfInterval({
                  start: startOfWeek(currentDate),
                  end: endOfWeek(currentDate)
                }).map(day => (
                  <div key={day.toString()} className="relative border-r border-border last:border-r-0">
                    {Array.from({ length: 15 }).map((_, i) => (
                      <div key={i} className="h-20 border-b border-border"></div>
                    ))}
                    {appointments
                      .filter(app => isSameDay(parseISO(app.date), day))
                      .map(app => {
                        const appDate = parseISO(app.date);
                        const hour = appDate.getHours();
                        const minutes = appDate.getMinutes();
                        const top = (hour - 7) * 80 + (minutes / 60) * 80;
                        
                        return (
                          <div 
                            key={app.id}
                            className={cn(
                              "absolute left-1 right-1 p-1 rounded border text-[10px] overflow-hidden z-0 cursor-pointer hover:brightness-95 transition-all",
                              app.status === 'confirmed' ? "bg-blue-50 border-blue-100 text-blue-700" :
                              app.status === 'realized' ? "bg-primary/10 border-primary/20 text-primary" :
                              app.status === 'cancelled' ? "bg-red-50 border-red-100 text-red-700" :
                              "bg-amber-50 border-amber-100 text-amber-700"
                            )}
                            style={{ top: `${top}px`, height: '70px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(app);
                            }}
                          >
                            <div className="font-bold">{format(appDate, 'HH:mm')}</div>
                            <div className="truncate">{getPatientName(app.patient_id)}</div>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'day' && (
            <div className="flex flex-col h-[600px] overflow-y-auto">
              <div className="grid grid-cols-8 border-b border-border sticky top-0 bg-card z-10">
                <div className="py-2 border-r border-border bg-muted/30/50"></div>
                <div className={cn(
                  "col-span-7 py-2 text-center bg-muted/30/50",
                  isToday(currentDate) && "bg-primary/8"
                )}>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{format(currentDate, 'EEEE', { locale: ptBR })}</div>
                  <div className={cn(
                    "text-sm font-medium w-7 h-7 mx-auto flex items-center justify-center rounded-full mt-1",
                    isToday(currentDate) && "bg-primary text-white"
                  )}>
                    {format(currentDate, 'd')}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-8 flex-1">
                <div className="border-r border-border">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="h-20 border-b border-border text-[10px] text-muted-foreground p-1 text-right pr-2">
                      {format(addDays(startOfDay(new Date()), i + 7), 'HH:mm')}
                    </div>
                  ))}
                </div>
                <div className="col-span-7 relative">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="h-20 border-b border-border"></div>
                  ))}
                  {appointments
                    .filter(app => isSameDay(parseISO(app.date), currentDate))
                    .map(app => {
                      const appDate = parseISO(app.date);
                      const hour = appDate.getHours();
                      const minutes = appDate.getMinutes();
                      const top = (hour - 7) * 80 + (minutes / 60) * 80;
                      
                      return (
                        <div 
                          key={app.id}
                          className={cn(
                            "absolute left-2 right-2 p-2 rounded border text-xs overflow-hidden z-0 cursor-pointer hover:brightness-95 transition-all",
                            app.status === 'confirmed' ? "bg-blue-50 border-blue-100 text-blue-700" :
                            app.status === 'realized' ? "bg-primary/10 border-primary/20 text-primary" :
                            app.status === 'cancelled' ? "bg-red-50 border-red-100 text-red-700" :
                            "bg-amber-50 border-amber-100 text-amber-700"
                          )}
                          style={{ top: `${top}px`, height: '70px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(app);
                          }}
                        >
                          <div className="font-bold">{format(appDate, 'HH:mm')}</div>
                          <div className="font-medium">{getPatientName(app.patient_id)}</div>
                          <div className="text-[10px] opacity-70">Status: {translateStatus(app.status)}</div>
                          {app.meetLink && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-primary font-bold">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary/100 animate-pulse" />
                              Google Meet disponível
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

