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
  UserCheck,
  UserX,
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
import { FREE_PLAN_LIMITS } from '../lib/planLimits';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy, serverTimestamp, onSnapshot, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

import { Patient } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PremiumFeature } from '../components/PremiumFeature';
import { PremiumBanner } from '../components/PremiumBanner';
import { maskCPF, maskPhone } from '../lib/masks';
import { generateSecureToken } from '../lib/utils';

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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState<string | null>(null);

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

  const togglePatientStatus = async (patient: Patient) => {
    if (!user) return;

    const newStatus = patient.status === 'active' ? 'inactive' : 'active';

    // If activating, check limit
    if (newStatus === 'active' && !isPremium) {
      const activePatients = patients.filter(p => p.status === 'active');
      const maxPatients = FREE_PLAN_LIMITS.maxPatients;
      if (activePatients.length >= maxPatients) {
        toast.error(`O plano gratuito permite apenas ${maxPatients} pacientes ativos.`);
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'patients', patient.id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Paciente ${newStatus === 'active' ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (error) {
      console.error("Error toggling patient status:", error);
      toast.error("Erro ao alterar status do paciente.");
      handleFirestoreError(error, OperationType.UPDATE, 'patients');
    }
  };

  const onSubmit = async (data: PatientFormValues) => {
    if (!user) return;

    // Premium check: Free plan allows only a limited number of active patients
    if (!editingPatient && !isPremium) {
      const activePatients = patients.filter(p => p.status === 'active');
      const maxPatients = FREE_PLAN_LIMITS.maxPatients;
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

  const generateAccessToken = async (patient: Patient) => {
    setIsGeneratingToken(patient.id);
    const toastId = toast.loading('Gerando link de acesso e atualizando registros...');
    
    try {
      const token = generateSecureToken();
      
      // 1. Atualizar o paciente
      await updateDoc(doc(db, 'patients', patient.id), {
        access_token: token,
        updatedAt: new Date().toISOString()
      });

      // 2. Propagar o token para registros existentes (Consultas, Planos, Exames, Agendamentos)
      const collectionsToUpdate = ['consultations', 'meal_plans', 'lab_exams', 'appointments'];
      let totalUpdated = 0;
      
      for (const colName of collectionsToUpdate) {
        const q = query(collection(db, colName), where('patient_id', '==', patient.id));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.docs.forEach((docSnap) => {
            batch.update(doc(db, colName, docSnap.id), { access_token: token });
            totalUpdated++;
          });
          await batch.commit();

          // Se for plano alimentar, atualizar também os itens
          if (colName === 'meal_plans') {
            for (const planDoc of snapshot.docs) {
              const itemsQ = query(collection(db, 'meal_plan_items'), where('meal_plan_id', '==', planDoc.id));
              const itemsSnap = await getDocs(itemsQ);
              if (!itemsSnap.empty) {
                const itemsBatch = writeBatch(db);
                itemsSnap.docs.forEach((itemDoc) => {
                  itemsBatch.update(doc(db, 'meal_plan_items', itemDoc.id), { access_token: token });
                  totalUpdated++;
                });
                await itemsBatch.commit();
              }
            }
          }
        }
      }

      toast.success(`Link gerado e ${totalUpdated} registros atualizados!`, { id: toastId });
      fetchPatients();
    } catch (error) {
      console.error("Error generating access token:", error);
      toast.error('Erro ao gerar link de acesso ou atualizar registros.', { id: toastId });
    } finally {
      setIsGeneratingToken(null);
    }
  };

  const shareAccessLink = (patient: Patient) => {
    if (!patient.access_token) return;
    const whatsappBaseUrl = import.meta.env.VITE_WHATSAPP_BASE_URL || '';
    if (!whatsappBaseUrl) {
      toast.error('VITE_WHATSAPP_BASE_URL não configurada.');
      return;
    }
    
    const baseUrl = window.location.origin;
    const accessUrl = `${baseUrl}/patient-access/${patient.id}?token=${patient.access_token}`;
    
    const message = `Olá ${patient.name}! Aqui está seu link exclusivo para acessar seu plano alimentar e evolução no Nutrir: ${accessUrl}\n\nPara sua segurança, ao acessar, digite os 3 últimos dígitos do seu CPF.`;
    
    const whatsappUrl = `${whatsappBaseUrl}/55${patient.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          patient.cpf.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || patient.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activePatientsCount = patients.filter(p => p.status === 'active').length;
  const isLimitReached = !isPremium && activePatientsCount >= FREE_PLAN_LIMITS.maxPatients;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pacientes</h1>
          <p className="text-muted-foreground">Gerencie todos os seus pacientes em um só lugar.</p>
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

              <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border mt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl h-8 px-4 border-border text-muted-foreground text-sm hover:bg-muted/30 transition-all active:scale-95"
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
          description={`Você atingiu o limite de ${FREE_PLAN_LIMITS.maxPatients} pacientes ativos do plano gratuito. Assine o Premium para cadastrar pacientes ilimitados.`}
          className="mb-8"
        />
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                <div className="flex items-start justify-between mb-4 gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg shrink-0">
                      {patient.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-foreground truncate" title={patient.name}>{patient.name}</h3>
                      <p className="text-xs text-muted-foreground">{patient.cpf}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      patient.status === 'active' 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : "bg-muted/30 text-muted-foreground border-border"
                    )}>
                      {patient.status === 'active' ? 'Ativo' : 'Inativo'}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className={cn(
                        "h-8 w-8 rounded-full",
                        patient.status === 'active' ? "text-muted-foreground hover:text-red-500 hover:bg-red-50" : "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                      )}
                      onClick={() => togglePatientStatus(patient)}
                      title={patient.status === 'active' ? 'Desativar Paciente' : 'Ativar Paciente'}
                    >
                      {patient.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{patient.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{patient.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarIcon className="w-4 h-4" />
                    <span>Nasc: {format(parseISO(patient.birthDate), 'dd/MM/yyyy')}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    nativeButton={false} 
                    render={<Link to={`/patients/${patient.id}`} />} 
                    className="flex-1 bg-muted text-foreground hover:bg-accent h-8 text-sm font-medium" 
                    variant="secondary"
                  >
                    Ver Prontuário
                  </Button>
                  {/* 
                  {!patient.access_token ? (
                    <Button 
                      variant="outline" 
                      className="flex-1 h-8 text-[10px] font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => generateAccessToken(patient)}
                      disabled={isGeneratingToken === patient.id || patient.status === 'inactive'}
                    >
                      {isGeneratingToken === patient.id ? 'GERANDO...' : 'GERAR ACESSO'}
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="flex-1 h-8 text-[10px] font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => shareAccessLink(patient)}
                      disabled={patient.status === 'inactive'}
                    >
                      ENVIAR WHATSAPP
                    </Button>
                  )}
                  */}
                  <Button 
                    variant="outline" 
                    className="h-8 w-8 p-0" 
                    onClick={() => openEditModal(patient)}
                    disabled={patient.status === 'inactive'}
                    title="Editar Paciente"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">Nenhum paciente encontrado</h3>
          <p className="text-muted-foreground">Tente ajustar sua busca ou cadastrar um novo paciente.</p>
        </div>
      )}
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
