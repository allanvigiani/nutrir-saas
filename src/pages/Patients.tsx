import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Search,
  Edit,
  UserPlus,
  Mail,
  Phone,
  Calendar as CalendarIcon,
  Activity,
  AlertCircle,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Card,
  CardContent,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { FREE_PLAN_LIMITS, isAdminOrPremium } from '../lib/planLimits';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { Patient } from '../types';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { logEvent } from '../lib/firebase';
import { PremiumFeature } from '../components/PremiumFeature';
import { PremiumBanner } from '../components/PremiumBanner';
import { PageHeader } from '../components/PageHeader';
import { maskCPF, maskPhone } from '../lib/masks';
import { Skeleton } from '../components/ui/skeleton';

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

type StatusFilter = 'all' | 'active' | 'inactive';

const AVATAR_STYLES = [
  'bg-primary/10 text-primary',
  'bg-accent text-accent-foreground',
  'bg-secondary text-secondary-foreground',
  'bg-muted text-foreground/70',
] as const;

export const Patients = () => {
  const { user, nutritionist, isAuthReady } = useAuth();
  const isPremium = isAdminOrPremium(nutritionist);
  const gracePeriodEndAt = nutritionist?.gracePeriodEndAt
    ? new Date(nutritionist.gracePeriodEndAt)
    : null;
  const now = new Date();
  const isInGracePeriod = !isPremium && gracePeriodEndAt !== null && gracePeriodEndAt > now;
  const isGracePeriodOver = !isPremium && gracePeriodEndAt !== null && gracePeriodEndAt <= now;
  const gracePeriodDaysLeft = isInGracePeriod && gracePeriodEndAt
    ? differenceInDays(gracePeriodEndAt, now)
    : 0;

  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    mode: 'onBlur',
    defaultValues: { gender: 'male' },
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

  const refetchPatients = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/patients', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPatients(await res.json());
      else toast.error('Erro ao carregar pacientes.');
    } catch (err) {
      console.error('Error loading patients:', err);
      toast.error('Erro ao carregar pacientes.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthReady || !user) return;
    refetchPatients();
  }, [refetchPatients, isAuthReady]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleDeletePatient = async () => {
    if (!user || !patientToDelete) return;
    setIsDeleting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`/api/patients/${patientToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Paciente excluído com sucesso.');
      setPatientToDelete(null);
      await refetchPatients();
    } catch (error) {
      console.error('Error deleting patient:', error);
      toast.error('Erro ao excluir paciente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = async (data: PatientFormValues) => {
    if (!user) return;

    if (!editingPatient && !isPremium) {
      const activePatients = patients.filter(p => p.status === 'active');
      const maxPatients = FREE_PLAN_LIMITS.maxPatients;
      if (activePatients.length >= maxPatients) {
        toast.error(`O plano gratuito permite apenas ${maxPatients} pacientes ativos.`);
        return;
      }
    }

    try {
      const cpfExists = patients.some(p => p.cpf === data.cpf && p.id !== editingPatient?.id);
      if (cpfExists) {
        toast.error('Já existe um paciente cadastrado com este CPF.');
        return;
      }

      const emailExists = patients.some(p => p.email === data.email && p.id !== editingPatient?.id);
      if (emailExists) {
        toast.error('Já existe um paciente cadastrado com este e-mail.');
        return;
      }

      const token = await auth.currentUser?.getIdToken();
      if (editingPatient) {
        await fetch(`/api/patients/${editingPatient.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(data),
        });
        toast.success('Paciente atualizado com sucesso!');
      } else {
        await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(data),
        });
        void logEvent('novo_paciente');
        toast.success('Paciente cadastrado com sucesso!');
      }
      setIsModalOpen(false);
      setEditingPatient(null);
      reset();
      await refetchPatients();
    } catch (error) {
      console.error('Error saving patient:', error);
      toast.error('Erro ao salvar paciente.');
    }
  };

  const filteredPatients = useMemo(() =>
    patients.filter(patient => {
      const matchesSearch =
        patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.cpf.includes(searchTerm);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && patient.status === 'active') ||
        (statusFilter === 'inactive' && patient.status !== 'active');
      return matchesSearch && matchesStatus;
    }),
  [patients, searchTerm, statusFilter]);

  const isLimitReached = !isPremium && patients.filter(p => p.status === 'active').length >= FREE_PLAN_LIMITS.maxPatients;

  return (
    <div className="space-y-6">

      {/* Grace period warning */}
      {isInGracePeriod && (
        <div className="bg-accent/30 border border-accent-foreground/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-accent-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-accent-foreground">Período de transição ativo</p>
            <p className="text-accent-foreground/80 mt-0.5">
              Você mudou para o plano gratuito. Todos os seus pacientes estão acessíveis por mais{' '}
              <strong>{gracePeriodDaysLeft} {gracePeriodDaysLeft === 1 ? 'dia' : 'dias'}</strong>.
              Após esse prazo, pacientes além do limite de {FREE_PLAN_LIMITS.maxPatients} ficarão em somente leitura.{' '}
              <Link to="/settings" className="underline font-medium">Reativar Premium</Link>
            </p>
          </div>
        </div>
      )}

      {/* Hard limit exceeded */}
      {isGracePeriodOver && patients.length > FREE_PLAN_LIMITS.maxPatients && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">Limite do plano gratuito atingido</p>
            <p className="text-destructive/80 mt-0.5">
              {patients.length - FREE_PLAN_LIMITS.maxPatients} paciente(s) estão em somente leitura.
              Faça <Link to="/settings" className="underline font-medium">upgrade para Premium</Link> para recuperar o acesso completo.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <PageHeader
        icon={Users}
        title="Pacientes"
        description={!loading ? `${patients.length} ${patients.length === 1 ? 'paciente cadastrado' : 'pacientes cadastrados'}` : undefined}
        action={
          <Dialog open={isModalOpen} onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) setEditingPatient(null);
          }}>
            <PremiumFeature active={isLimitReached}>
              <DialogTrigger
                render={<Button className="bg-primary hover:bg-primary/90 text-white rounded-xl h-9 px-4 gap-2 font-medium text-sm transition-all active:scale-95" onClick={openNewModal} />}
                nativeButton={true}
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" /> Novo Paciente
              </DialogTrigger>
            </PremiumFeature>

          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border-none shadow-2xl p-4">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-bold">
                {editingPatient ? 'Editar Paciente' : 'Cadastrar Novo Paciente'}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {editingPatient
                  ? 'Atualize os dados do paciente abaixo.'
                  : 'Preencha os dados abaixo para criar o prontuário do paciente.'}
              </DialogDescription>
            </DialogHeader>

            <form key={editingPatient?.id || 'new'} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input id="name" {...register('name')} />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" {...register('email')} />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Data de Nascimento</Label>
                  <Input id="birthDate" type="date" {...register('birthDate')} />
                  {errors.birthDate && <p className="text-sm text-destructive">{errors.birthDate.message}</p>}
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
                  {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
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
                  {errors.cpf && <p className="text-sm text-destructive">{errors.cpf.message}</p>}
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
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço Completo</Label>
                <Input id="address" {...register('address')} />
                {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" aria-hidden="true" />
                  Dados Clínicos Iniciais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="objective">Objetivo Nutricional</Label>
                    <Input id="objective" placeholder="Ex: Perda de peso, Ganho de massa" {...register('objective')} />
                    {errors.objective && <p className="text-sm text-destructive">{errors.objective.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="activityLevel">Nível de Atividade Física</Label>
                    <Input id="activityLevel" placeholder="Ex: Sedentário, Moderado, Ativo" {...register('activityLevel')} />
                    {errors.activityLevel && <p className="text-sm text-destructive">{errors.activityLevel.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diseases">Histórico de Doenças</Label>
                    <Input id="diseases" placeholder="Ex: Diabetes tipo 2, Hipertensão" {...register('diseases')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="medications">Medicamentos em uso</Label>
                    <Input id="medications" placeholder="Ex: Metformina 500mg, Losartana" {...register('medications')} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="allergies">Alergias e Intolerâncias</Label>
                    <Input id="allergies" placeholder="Ex: Lactose, Glúten, Frutos do mar" {...register('allergies')} />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl h-9 px-4 border-border text-muted-foreground text-sm hover:bg-muted/30 transition-all active:scale-95"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl h-9 px-5 font-medium text-sm transition-all active:scale-95 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Salvando...' : editingPatient ? 'Salvar Alterações' : 'Salvar Paciente'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        }
      />

      {!isPremium && isLimitReached && (
        <PremiumBanner
          title="Limite de Pacientes Atingido"
          description={`Você atingiu o limite de ${FREE_PLAN_LIMITS.maxPatients} pacientes ativos do plano gratuito. Assine o Premium para cadastrar pacientes ilimitados.`}
        />
      )}

      {/* Search + status filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            className="pl-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 shrink-0" role="group" aria-label="Filtrar por status">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                'text-xs font-medium px-3 py-2 rounded-lg transition-colors',
                statusFilter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
      </div>

      {/* Patient grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton className="w-11 h-11 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                </div>
                <div className="space-y-2 mb-5">
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
                <Skeleton className="h-9 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPatients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPatients.map((patient) => {
            const avatarStyle = AVATAR_STYLES[patient.name.charCodeAt(0) % AVATAR_STYLES.length];
            const initials = patient.name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase();

            return (
              <Card key={patient.id} className="hover:shadow-sm transition-all duration-200 hover:border-border group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={cn('w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shrink-0', avatarStyle)} aria-hidden="true">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold text-foreground truncate text-sm" title={patient.name}>{patient.name}</h3>
                          {patient.isReadOnly && (
                            <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground shrink-0">
                              Somente leitura
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{patient.cpf || '—'}</p>
                      </div>
                    </div>
                    {/* Delete action: visible on hover AND on keyboard focus within the card */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setPatientToDelete(patient)}
                        aria-label={`Excluir ${patient.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4 pl-0.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{patient.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{patient.phone || '—'}</span>
                    </div>
                    {patient.objective && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Activity className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{patient.objective}</span>
                      </div>
                    )}
                    {!patient.objective && patient.birthDate && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Nasc: {format(parseISO(patient.birthDate), 'dd/MM/yyyy')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      nativeButton={false}
                      render={<Link to={`/patients/${patient.id}`} aria-label={`Ver prontuário de ${patient.name}`} />}
                      className="flex-1 h-9 text-sm font-medium rounded-lg"
                      variant="secondary"
                    >
                      Ver Prontuário
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 w-9 p-0 rounded-lg"
                      onClick={() => openEditModal(patient)}
                      aria-label={`Editar ${patient.name}`}
                    >
                      <Edit className="w-3.5 h-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-base font-medium text-foreground">
            {searchTerm || statusFilter !== 'all' ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchTerm || statusFilter !== 'all'
              ? 'Tente ajustar a busca ou o filtro de status.'
              : 'Cadastre o primeiro paciente para começar.'}
          </p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!patientToDelete} onOpenChange={(open) => { if (!open) setPatientToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir paciente</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{patientToDelete?.name}</strong>? O prontuário ficará salvo por 30 dias antes da remoção permanente, conforme a LGPD.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPatientToDelete(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeletePatient} disabled={isDeleting}>
              {isDeleting ? 'Excluindo...' : 'Excluir paciente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
