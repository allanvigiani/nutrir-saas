import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit,
  MoreVertical, 
  UserPlus,
  Mail,
  Phone,
  Calendar as CalendarIcon,
  Activity,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '../components/ui/card';
import { Button, buttonVariants } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

import { Patient } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PremiumFeature } from '../components/PremiumFeature';
import { PremiumBanner } from '../components/PremiumBanner';
import { maskCPF, maskPhone } from '../lib/masks';

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

const patientSchema = z.object({
  name: z.string().min(3, 'Nome é obrigatório').refine((name) => {
    return name.trim().split(/\s+/).length >= 2;
  }, 'Informe o nome completo (pelo menos nome e sobrenome)'),
  birthDate: z.string().min(10, 'Data de nascimento é obrigatória').refine((date) => {
    const birthDate = new Date(date);
    const today = new Date();
    return birthDate <= today;
  }, 'Data de nascimento não pode ser no futuro'),
  gender: z.enum(['male', 'female', 'other']),
  cpf: z.string().min(11, 'CPF inválido').transform((val) => val.replace(/\D/g, '')).refine((val) => val.length === 11, 'O CPF deve conter 11 dígitos'),
  phone: z.string().min(10, 'Telefone inválido').transform((val) => val.replace(/\D/g, '')).refine((val) => val.length >= 10, 'Telefone deve conter pelo menos 10 dígitos'),
  email: z.string().email('E-mail inválido'),
  address: z.string().min(5, 'Endereço é obrigatório'),
  objective: z.string().min(3, 'Objetivo é obrigatório'),
  activityLevel: z.string().min(3, 'Nível de atividade é obrigatório'),
  diseases: z.string().optional(),
  medications: z.string().optional(),
  allergies: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

export const Patients = () => {
  const { user, nutritionist, isAuthReady } = useAuth();
  const isPremium = nutritionist?.plan === 'premium';
  const { settings } = useSettings();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      gender: 'male',
    }
  });

  const genderValue = watch('gender');

  const openEditModal = (patient: Patient) => {
    setEditingPatient(patient);
    reset({
      name: patient.name,
      email: patient.email,
      birthDate: patient.birthDate,
      gender: patient.gender,
      cpf: maskCPF(patient.cpf),
      phone: maskPhone(patient.phone),
      address: patient.address,
      objective: patient.objective,
      activityLevel: patient.activityLevel,
      diseases: patient.diseases,
      medications: patient.medications,
      allergies: patient.allergies,
    });
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingPatient(null);
    reset({
      name: '',
      email: '',
      birthDate: '',
      gender: 'male',
      cpf: '',
      phone: '',
      address: '',
      objective: '',
      activityLevel: '',
      diseases: '',
      medications: '',
      allergies: '',
    });
    setIsModalOpen(true);
  };

  const fetchPatients = () => {
    if (!user || !isAuthReady) return;
    setLoading(true);
    
    const q = query(
      collection(db, 'patients'),
      where('nutritionist_id', '==', user.uid),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const patientsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      setPatients(patientsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching patients:", error);
      toast.error("Erro ao carregar pacientes.");
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'patients');
    });

    return unsubscribe;
  };

  useEffect(() => {
    if (!isAuthReady || !user) return;
    const unsubscribe = fetchPatients();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, isAuthReady]);

  const onSubmit = async (data: PatientFormValues) => {
    if (!user) return;

    // Premium check: Free plan allows only a limited number of active patients
    if (!editingPatient && nutritionist?.plan === 'free') {
      const activePatients = patients.filter(p => p.status === 'active');
      const maxPatients = settings.free.maxPatients;
      if (activePatients.length >= maxPatients) {
        toast.error(`O plano gratuito permite apenas ${maxPatients} pacientes ativos.`);
        return;
      }
    }

    try {
      // Duplicate check: CPF and Email must be unique for the same nutritionist
      const patientsRef = collection(db, 'patients');
      
      // Check CPF
      const cpfQuery = query(
        patientsRef, 
        where('nutritionist_id', '==', user.uid),
        where('cpf', '==', data.cpf)
      );
      const cpfSnapshot = await getDocs(cpfQuery);
      const duplicateCpf = cpfSnapshot.docs.find(doc => doc.id !== editingPatient?.id);
      
      if (duplicateCpf) {
        toast.error('Já existe um paciente cadastrado com este CPF.');
        return;
      }

      // Check Email
      const emailQuery = query(
        patientsRef, 
        where('nutritionist_id', '==', user.uid),
        where('email', '==', data.email)
      );
      const emailSnapshot = await getDocs(emailQuery);
      const duplicateEmail = emailSnapshot.docs.find(doc => doc.id !== editingPatient?.id);

      if (duplicateEmail) {
        toast.error('Já existe um paciente cadastrado com este E-mail.');
        return;
      }

      if (editingPatient) {
        try {
          await updateDoc(doc(db, 'patients', editingPatient.id), {
            ...data,
            updatedAt: new Date().toISOString(),
          });
          toast.success('Paciente atualizado com sucesso!');
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `patients/${editingPatient.id}`);
        }
      } else {
        try {
          const docRef = await addDoc(collection(db, 'patients'), {
            ...data,
            nutritionist_id: user.uid,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          
          toast.success('Paciente cadastrado com sucesso!');

          // Enviar e-mail de boas-vindas (assíncrono, não bloqueia a UI)
          try {
            fetch('/api/send-welcome-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                patientEmail: data.email,
                patientName: data.name,
                nutritionistName: nutritionist?.name || user.displayName || 'Seu Nutricionista',
                nutritionistEmail: user.email,
                nutritionistPhone: nutritionist?.phone
              })
            }).catch(err => console.error('Erro ao disparar e-mail:', err));
          } catch (emailErr) {
            console.error('Erro ao preparar envio de e-mail:', emailErr);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'patients');
        }
      }
      setIsModalOpen(false);
      setEditingPatient(null);
      reset();
      fetchPatients();
    } catch (error) {
      console.error("Error saving patient:", error);
      toast.error('Erro ao salvar paciente.');
    }
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          patient.cpf.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || patient.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activePatientsCount = patients.filter(p => p.status === 'active').length;
  const isLimitReached = activePatientsCount >= 3;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pacientes</h1>
          <p className="text-slate-500">Gerencie todos os seus pacientes em um só lugar.</p>
        </div>
        
        <Dialog open={isModalOpen} onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setEditingPatient(null);
        }}>
          <PremiumFeature active={isLimitReached}>
            <DialogTrigger 
              render={<Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-4 gap-2 font-bold text-sm transition-all shadow-sm active:scale-95" onClick={openNewModal} />}
              nativeButton={true}
            >
              <UserPlus className="w-4 h-4" /> Novo Paciente
            </DialogTrigger>
          </PremiumFeature>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border-none shadow-2xl p-4">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-bold">{editingPatient ? 'Editar Paciente' : 'Cadastrar Novo Paciente'}</DialogTitle>
              <DialogDescription className="text-sm">
                {editingPatient ? 'Atualize os dados do paciente abaixo.' : 'Preencha os dados abaixo para criar o prontuário do paciente.'}
              </DialogDescription>
            </DialogHeader>
            <form key={editingPatient?.id || 'new'} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input id="name" {...register('name')} />
                  {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" {...register('email')} />
                  {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Data de Nascimento</Label>
                  <Input id="birthDate" type="date" {...register('birthDate')} />
                  {errors.birthDate && <p className="text-sm text-red-500">{errors.birthDate.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Sexo</Label>
                  <Select value={genderValue} onValueChange={(v) => setValue('gender', v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione">
                        {genderValue === 'male' ? 'Masculino' : genderValue === 'female' ? 'Feminino' : genderValue === 'other' ? 'Outro' : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Masculino</SelectItem>
                      <SelectItem value="female">Feminino</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.gender && <p className="text-sm text-red-500">{errors.gender.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input 
                    id="cpf" 
                    placeholder="000.000.000-00" 
                    {...register('cpf')} 
                    onChange={(e) => {
                      const masked = maskCPF(e.target.value);
                      setValue('cpf', masked);
                    }}
                  />
                  {errors.cpf && <p className="text-sm text-red-500">{errors.cpf.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input 
                    id="phone" 
                    placeholder="(00) 00000-0000" 
                    {...register('phone')} 
                    onChange={(e) => {
                      const masked = maskPhone(e.target.value);
                      setValue('phone', masked);
                    }}
                  />
                  {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço Completo</Label>
                <Input id="address" {...register('address')} />
                {errors.address && <p className="text-sm text-red-500">{errors.address.message}</p>}
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Dados Clínicos Iniciais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="objective">Objetivo Nutricional</Label>
                    <Input id="objective" placeholder="Ex: Perda de peso, Ganho de massa" {...register('objective')} />
                    {errors.objective && <p className="text-sm text-red-500">{errors.objective.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="activityLevel">Nível de Atividade Física</Label>
                    <Input id="activityLevel" placeholder="Ex: Sedentário, Ativo" {...register('activityLevel')} />
                    {errors.activityLevel && <p className="text-sm text-red-500">{errors.activityLevel.message}</p>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="diseases">Histórico de Doenças</Label>
                  <Input id="diseases" {...register('diseases')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allergies">Alergias e Intolerâncias</Label>
                  <Input id="allergies" {...register('allergies')} />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-100 mt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl h-8 px-4 border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-all active:scale-95"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-5 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Salvando...' : editingPatient ? 'Salvar Alterações' : 'Salvar Paciente'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!isPremium && isLimitReached && (
        <PremiumBanner 
          title="Limite de Pacientes Atingido" 
          description="Você atingiu o limite de 3 pacientes ativos do plano gratuito. Assine o Premium para cadastrar pacientes ilimitados."
          className="mb-8"
        />
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Buscar por nome ou CPF..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status">
              {statusFilter === 'all' ? 'Todos' : statusFilter === 'active' ? 'Ativos' : statusFilter === 'inactive' ? 'Inativos' : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : filteredPatients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPatients.map((patient) => (
            <Card key={patient.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                      {patient.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 truncate max-w-[150px]">{patient.name}</h3>
                      <p className="text-xs text-slate-500">{patient.cpf}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                    patient.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  )}>
                    {patient.status === 'active' ? 'Ativo' : 'Inativo'}
                  </div>
                </div>
                
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{patient.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4" />
                    <span>{patient.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CalendarIcon className="w-4 h-4" />
                    <span>Nasc: {format(parseISO(patient.birthDate), 'dd/MM/yyyy')}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    nativeButton={false} 
                    render={<Link to={`/patients/${patient.id}`} />} 
                    className="flex-1 bg-slate-100 text-slate-900 hover:bg-slate-200 h-8 text-sm font-medium" 
                    variant="secondary"
                  >
                    Ver Prontuário
                  </Button>
                  <Button 
                    variant="outline" 
                    className="gap-2 h-8 text-sm font-medium" 
                    onClick={() => openEditModal(patient)}
                  >
                    <Edit className="w-4 h-4" /> Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Nenhum paciente encontrado</h3>
          <p className="text-slate-500">Tente ajustar sua busca ou cadastrar um novo paciente.</p>
        </div>
      )}
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
