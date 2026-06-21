import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  User,
  Users,
  Award,
  Camera,
  Save,
  Lock,
  LogOut,
  Shield,
  Activity,
  CreditCard,
  Plus,
  Trash2,
  Edit,
  Search as SearchIcon,
  Utensils,
  Calendar,
  AlertCircle,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { cn, maskCPF, maskCNPJ, maskPhone } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { FREE_PLAN_LIMITS, isAdminOrPremium } from '../lib/planLimits';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../lib/firebase';
import { apiRequest } from '../hooks/useApi';
import { signOut, updatePassword } from 'firebase/auth';
import { isStrongPassword } from '../lib/passwordStrength';
import { PasswordStrengthBar } from '../components/ui/PasswordStrengthBar';
import { toast } from 'sonner';
import { remoteLogger } from '../lib/remote-logger';
import { CustomFood } from '../types';
import { CustomFoodDialog } from '../components/CustomFoodDialog';
import { useSubscription } from '../hooks/useSubscription';
import { useSearchParams, Link } from 'react-router-dom';
import { useCookieConsent } from '../contexts/CookieConsentContext';

const profileSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  crn: z.string().min(3, 'CRN é obrigatório'),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  phone: z.string().min(10, 'Telefone inválido'),
  specialties: z.string().optional(),
}).refine((data) => data.cpf || data.cnpj, {
  message: "CPF ou CNPJ deve ser preenchido",
  path: ["cpf"],
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export const Settings = () => {
  const { nutritionist, user, reloadNutritionist } = useAuth();
  const isPremiumOrAdmin = isAdminOrPremium(nutritionist);
  const [searchParams] = useSearchParams();
  const { 
    handleSubscribe, 
    verifySubscription, 
    handleManageSubscription,
    handleCancelSubscription,
    isSubscribing, 
    isVerifying,
    isManaging
  } = useSubscription();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([]);
  const [isFoodDialogOpen, setIsFoodDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [foodToDelete, setFoodToDelete] = useState<string | null>(null);
  const [editingFood, setEditingFood] = useState<CustomFood | null>(null);
  const [foodSearch, setFoodSearch] = useState('');
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  
  const defaultTab = searchParams.get('tab') || 'profile';
  
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (nutritionist) {
      reset({
        name: nutritionist.name,
        crn: nutritionist.crn,
        cpf: nutritionist.cpf || '',
        cnpj: nutritionist.cnpj || '',
        phone: nutritionist.phone || '',
        specialties: nutritionist.specialties?.join(', ') || '',
      });
    }
  }, [nutritionist, reset]);

  useEffect(() => {
    if (user && defaultTab === 'subscription') {
      verifySubscription(true);
    }
  }, [user, defaultTab]); // Sincroniza automaticamente ao entrar na aba de assinatura

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/custom-foods', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const foods = await res.json();
          setCustomFoods(foods);
        }
      } catch (err) {
        console.error('Error loading custom foods:', err);
      }
    };
    load();
  }, [user]);

  const refetchCustomFoods = async () => {
    if (!user) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/custom-foods', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCustomFoods(await res.json());
    } catch (err) {
      console.error('Error loading custom foods:', err);
    }
  };


  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida.');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.');
      return;
    }

    setIsUploadingPhoto(true);
    const toastId = toast.loading('Enviando foto...');

    try {
      console.log("Starting photo upload for user:", user.uid);
      const storageRef = ref(storage, `nutritionists/${user.uid}/profile_photo`);
      
      // Add a timeout to the upload
      const uploadPromise = uploadBytes(storageRef, file);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao enviar imagem. Verifique sua conexão.')), 30000)
      );

      await Promise.race([uploadPromise, timeoutPromise]);
      
      console.log("Photo uploaded successfully, getting download URL...");
      const downloadURL = await getDownloadURL(storageRef);

      console.log("Updating nutritionist document with new photo URL...");
      await apiRequest('/api/me', 'PATCH', { photoUrl: downloadURL });

      toast.success('Foto de perfil atualizada!', { id: toastId });
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      const errorMessage = error.message || 'Erro ao enviar foto de perfil.';
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsUploadingPhoto(false);
      // Ensure toast is dismissed if it somehow persists
      setTimeout(() => toast.dismiss(toastId), 5000);
    }
  };

   const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    setIsSaving(true);
    try {
      // 1. Verificar duplicidade de CRN (excluindo o próprio usuário)
      const crnCheck = await apiRequest<{ isDuplicate: boolean }>(`/api/me/check-unique?field=crn&value=${encodeURIComponent(data.crn)}`, 'GET');
      if (crnCheck?.isDuplicate) {
        toast.error('CRN já cadastrado: Este número já pertence a outro profissional.');
        setIsSaving(false);
        return;
      }

      // 2. Verificar duplicidade de CPF (se preenchido e excluindo o próprio usuário)
      if (data.cpf) {
        const cpfCheck = await apiRequest<{ isDuplicate: boolean }>(`/api/me/check-unique?field=cpf&value=${encodeURIComponent(data.cpf)}`, 'GET');
        if (cpfCheck?.isDuplicate) {
          toast.error('CPF já cadastrado: Este documento já está sendo utilizado.');
          setIsSaving(false);
          return;
        }
      }

      // 3. Verificar duplicidade de CNPJ (se preenchido e excluindo o próprio usuário)
      if (data.cnpj) {
        const cnpjCheck = await apiRequest<{ isDuplicate: boolean }>(`/api/me/check-unique?field=cnpj&value=${encodeURIComponent(data.cnpj)}`, 'GET');
        if (cnpjCheck?.isDuplicate) {
          toast.error('CNPJ já cadastrado: Este documento já está sendo utilizado.');
          setIsSaving(false);
          return;
        }
      }

      const specialtiesArray = data.specialties
        ? data.specialties.split(',').map(s => s.trim())
        : [];

      await apiRequest('/api/me', 'PATCH', {
        name: data.name,
        crn: data.crn,
        cpf: data.cpf || null,
        cnpj: data.cnpj || null,
        phone: data.phone,
        specialties: specialtiesArray,
      });
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error('Erro ao atualizar perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    if (auth.currentUser) {
      remoteLogger.info("Logout realizado (Configurações)", { userId: auth.currentUser.uid, email: auth.currentUser.email });
    }
    signOut(auth);
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setIsConnectingGoogle(false);
        await reloadNutritionist();
        toast.success('Google Agenda conectado com sucesso!');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      // Pass current origin to help server generate correct redirect URI
      const origin = window.location.origin;
      const response = await fetch(`/api/auth/google/url?origin=${encodeURIComponent(origin)}`);
      const { url } = await response.json();
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        url,
        'google_auth_popup',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (error) {
      console.error("Error connecting Google:", error);
      toast.error('Erro ao iniciar conexão com Google.');
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!user) return;
    const toastId = toast.loading('Desconectando Google Agenda...');
    try {
      await apiRequest('/api/me', 'PATCH', {
        googleCalendarConnected: false,
        googleCalendarTokens: null,
      });
      await reloadNutritionist();
      toast.success('Google Agenda desconectado.', { id: toastId });
    } catch (error) {
      console.error("Error disconnecting Google:", error);
      toast.error('Erro ao desconectar Google Agenda.', { id: toastId });
    }
  };
  const handleDeleteAccount = async () => {
    if (!user) return;
    const userEmail = user.email || '';
    if (deleteConfirmEmail !== userEmail) {
      toast.error('E-mail digitado não confere com o da conta.');
      return;
    }
    setIsDeletingAccount(true);
    const toastId = toast.loading('Excluindo conta e todos os dados...');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmation: userEmail }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Erro ao excluir conta. Tente novamente.');
      }
      toast.success('Conta excluída com sucesso.', { id: toastId });
      await signOut(auth);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir conta.', { id: toastId });
      setIsDeletingAccount(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user) {
      toast.error('Usuário não autenticado.');
      return;
    }
    
    if (!newPassword || !confirmNewPassword) {
      toast.error('Preencha os campos de senha.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    if (!isStrongPassword(newPassword)) {
      toast.error('A senha não atende aos requisitos de segurança.');
      return;
    }

    setIsUpdatingPassword(true);
    const toastId = toast.loading('Atualizando senha...');
    
    try {
      // Use the current user from auth directly as updatePassword requires the User object
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        toast.success('Senha atualizada com sucesso!', { id: toastId });
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        throw new Error('Usuário não encontrado no Firebase Auth.');
      }
    } catch (error: any) {
      console.error("Error updating password:", error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Esta operação requer um login recente. Por favor, saia e entre novamente.', { id: toastId });
      } else {
        toast.error('Erro ao atualizar senha: ' + (error.message || 'Tente novamente.'), { id: toastId });
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteFood = async (id: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`/api/custom-foods/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await refetchCustomFoods();
      toast.success('Alimento excluído com sucesso!');
      setFoodToDelete(null);
    } catch (error) {
      console.error('Error deleting custom food:', error);
      toast.error('Erro ao excluir alimento.');
    }
  };

  const filteredFoods = customFoods.filter(food => 
    food.name.toLowerCase().includes(foodSearch.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie seu perfil e preferências do sistema.</p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="flex w-full items-center justify-start gap-2 bg-transparent border-b border-border p-0 rounded-none h-auto mb-8 overflow-x-auto">
          <TabsTrigger 
            value="profile" 
            className="relative gap-2 px-3 py-3 md:px-4 md:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <User className="w-4 h-4" /> Perfil Profissional
          </TabsTrigger>
          <TabsTrigger 
            value="foods" 
            className="relative gap-2 px-3 py-3 md:px-4 md:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <Utensils className="w-4 h-4" /> Alimentos Próprios
          </TabsTrigger>
          <TabsTrigger 
            value="security" 
            className="relative gap-2 px-3 py-3 md:px-4 md:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <Shield className="w-4 h-4" /> Segurança
          </TabsTrigger>
          <TabsTrigger
            value="subscription"
            className="relative gap-2 px-3 py-3 md:px-4 md:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <Award className="w-4 h-4" /> Assinatura e Plano
          </TabsTrigger>
          <TabsTrigger
            value="privacy"
            className="relative gap-2 px-3 py-3 md:px-4 md:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <Shield className="w-4 h-4" /> Privacidade
          </TabsTrigger>
          <TabsTrigger
            value="integrations"
            className="relative gap-2 px-3 py-3 md:px-4 md:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4" /> Integrações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          {/* ... existing profile content ... */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Dados Profissionais</CardTitle>
                  <CardDescription>Atualize suas informações básicas e de contato.</CardDescription>
                </CardHeader>
                <form key={user?.uid || 'settings'} onSubmit={handleSubmit(onSubmit)}>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-6 mb-6">
                      <div className="relative group">
                        <div className="w-24 h-24 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-3xl overflow-hidden border-4 border-white shadow-sm">
                          {isUploadingPhoto ? (
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          ) : nutritionist?.photoUrl ? (
                            <img src={nutritionist.photoUrl} alt={nutritionist.name} className="w-full h-full object-cover" />
                          ) : (
                            nutritionist?.name.charAt(0)
                          )}
                        </div>
                        <input
                          type="file"
                          id="photo-upload"
                          className="hidden"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={isUploadingPhoto}
                        />
                        <button 
                          type="button" 
                          className="absolute bottom-0 right-0 p-2 bg-card rounded-full shadow-md border border-border text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          onClick={() => document.getElementById('photo-upload')?.click()}
                          disabled={isUploadingPhoto}
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-foreground">{nutritionist?.name}</h3>
                          <Badge 
                            variant={isPremiumOrAdmin ? 'default' : 'secondary'}
                            className={isPremiumOrAdmin ? 'bg-primary/15 text-primary hover:bg-primary/15' : ''}
                          >
                            {nutritionist?.role === 'admin' ? 'Admin' : isPremiumOrAdmin ? 'Premium' : 'Gratuito'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Nutricionista • CRN {nutritionist?.crn}</p>
                      </div>
                    </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cpf">CPF</Label>
                          <Input 
                            id="cpf" 
                            {...register('cpf')} 
                            className="bg-muted/30 rounded-lg" 
                            onChange={(e) => {
                              const masked = maskCPF(e.target.value);
                              setValue('cpf', masked);
                            }}
                          />
                          {errors.cpf && <p className="text-xs text-destructive mt-1">{errors.cpf.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cnpj">CNPJ</Label>
                          <Input 
                            id="cnpj" 
                            {...register('cnpj')} 
                            className="bg-muted/30 rounded-lg" 
                            onChange={(e) => {
                              const masked = maskCNPJ(e.target.value);
                              setValue('cnpj', masked);
                            }}
                          />
                          {errors.cnpj && <p className="text-xs text-destructive mt-1">{errors.cnpj.message}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nome Completo</Label>
                        <Input id="name" {...register('name')} className="bg-muted/30 rounded-lg" />
                        {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="crn">CRN</Label>
                        <Input id="crn" {...register('crn')} className="bg-muted/30 rounded-lg" />
                        {errors.crn && <p className="text-xs text-destructive mt-1">{errors.crn.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">E-mail (Não editável)</Label>
                        <Input id="email" value={nutritionist?.email || ''} disabled className="bg-muted/50 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input 
                          id="phone" 
                          {...register('phone')} 
                          className="bg-muted/30 rounded-lg" 
                          onChange={(e) => {
                            const masked = maskPhone(e.target.value);
                            setValue('phone', masked);
                          }}
                        />
                        {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="specialties">Especialidades (Separadas por vírgula)</Label>
                      <Input id="specialties" placeholder="Ex: Nutrição Esportiva, Clínica, Funcional" {...register('specialties')} className="bg-muted/30 rounded-lg" />
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-border pt-6">
                    <Button type="submit" className="bg-primary hover:bg-primary/90 gap-2 rounded-xl h-8 px-6 font-bold text-sm w-full md:w-auto" disabled={isSaving}>
                      <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
            
            <div className="space-y-6">
              <Card className="border-none shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Sair do Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">Deseja encerrar sua sessão atual?</p>
                  <Button variant="destructive" className="w-full gap-2 rounded-xl h-8 font-bold text-sm" onClick={handleLogout}>
                    <LogOut className="w-4 h-4" /> Sair da Conta
                  </Button>
                </CardContent>
              </Card>


            </div>
          </div>
        </TabsContent>

        <TabsContent value="foods" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Alimentos Próprios</h2>
              <p className="text-muted-foreground text-sm">Cadastre alimentos específicos que não constam na tabela TACO.</p>
            </div>
            <Button 
              onClick={() => {
                setEditingFood(null);
                setIsFoodDialogOpen(true);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-8 px-4 font-bold text-sm transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" /> Cadastrar Alimento
            </Button>
          </div>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="pb-0">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Pesquisar em seus alimentos..." 
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  className="pl-10 bg-muted/30 rounded-lg"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 mt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground text-left border-b">
                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Alimento</th>
                      <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] text-center">Base</th>
                      <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] text-center">Medida</th>
                      <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] text-center">Kcal</th>
                      <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] text-center">P (g)</th>
                      <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] text-center">C (g)</th>
                      <th className="px-4 py-4 font-bold uppercase tracking-wider text-[10px] text-center">G (g)</th>
                      <th className="px-6 py-4 w-24 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredFoods.length > 0 ? (
                      filteredFoods.map((food) => (
                        <tr key={food.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-semibold text-foreground">{food.name}</span>
                          </td>
                          <td className="px-4 py-4 text-center text-muted-foreground">
                            {food.baseQuantity}{food.baseUnit}
                          </td>
                          <td className="px-4 py-4 text-center text-muted-foreground">
                            {food.serving ? `1 ${food.serving.name} (${food.serving.weight}g)` : '-'}
                          </td>
                          <td className="px-4 py-4 text-center font-medium text-muted-foreground">
                            {food.kcal}
                          </td>
                          <td className="px-4 py-4 text-center text-muted-foreground">
                            {food.protein}
                          </td>
                          <td className="px-4 py-4 text-center text-muted-foreground">
                            {food.carbs}
                          </td>
                          <td className="px-4 py-4 text-center text-muted-foreground">
                            {food.fat}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                                onClick={() => {
                                  setEditingFood(food);
                                  setIsFoodDialogOpen(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                onClick={() => setFoodToDelete(food.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Utensils className="w-12 h-12 opacity-20" />
                            <p className="font-medium">Nenhum alimento próprio cadastrado.</p>
                            {foodSearch && <p className="text-xs">Tente uma busca diferente.</p>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <CustomFoodDialog 
            open={isFoodDialogOpen} 
            onOpenChange={setIsFoodDialogOpen}
            food={editingFood}
          />

          <Dialog open={!!foodToDelete} onOpenChange={(open) => !open && setFoodToDelete(null)}>
            <DialogContent className="sm:max-w-sm rounded-2xl">
              <DialogHeader>
                <DialogTitle>Excluir Alimento</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir este alimento? Esta ação não pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="ghost" onClick={() => setFoodToDelete(null)}>Cancelar</Button>
                <Button variant="destructive" onClick={() => foodToDelete && handleDeleteFood(foodToDelete)}>Excluir</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">Segurança da Conta</CardTitle>
                <CardDescription>Altere sua senha de acesso.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-muted/30 rounded-lg"
                  />
                  <PasswordStrengthBar password={newPassword} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmNewPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmNewPassword"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="bg-muted/30 rounded-lg"
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t border-border pt-5">
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-xl h-8 px-4 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50 w-full md:w-auto"
                  onClick={handleUpdatePassword}
                  disabled={isUpdatingPassword || !isStrongPassword(newPassword) || newPassword !== confirmNewPassword}
                >
                  <Lock className="w-4 h-4" /> {isUpdatingPassword ? 'Atualizando...' : 'Atualizar Senha'}
                </Button>
              </CardFooter>
            </Card>

            {/* Zona de Perigo */}
            <Card className="border border-destructive/30 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold text-destructive flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Zona de Perigo
                </CardTitle>
                <CardDescription>
                  Ações irreversíveis. Leia com atenção.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Remove permanentemente sua conta e <strong className="text-foreground">todos os dados</strong>:
                  pacientes, consultas, planos, exames e financeiro.
                  Conforme LGPD Art. 18.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="self-start rounded-lg"
                  onClick={() => { setDeleteConfirmEmail(''); setIsDeleteAccountOpen(true); }}
                >
                  Excluir Minha Conta
                </Button>
              </CardContent>
            </Card>
          </div>

            {/* Dialog de confirmação */}
            <Dialog open={isDeleteAccountOpen} onOpenChange={setIsDeleteAccountOpen}>
              <DialogContent className="sm:max-w-md rounded-2xl shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-destructive flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" /> Excluir Conta Permanentemente
                  </DialogTitle>
                  <DialogDescription>
                    Esta ação é <strong>irreversível</strong>. Todos os dados abaixo serão excluídos imediatamente:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <ul className="text-sm text-muted-foreground space-y-1.5 bg-muted/30 rounded-lg p-3">
                    {['Perfil e dados do nutricionista','Todos os pacientes cadastrados','Consultas e dados antropométricos','Planos alimentares','Exames laboratoriais','Agendamentos','Registros financeiros','Alimentos personalizados'].map(item => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-1.5">
                    <Label htmlFor="deleteConfirmEmail" className="text-sm">
                      Digite seu e-mail <strong className="text-foreground">{user?.email}</strong> para confirmar:
                    </Label>
                    <Input
                      id="deleteConfirmEmail"
                      placeholder={user?.email || 'seu@email.com'}
                      value={deleteConfirmEmail}
                      onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                      className="bg-muted/30 rounded-lg"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" className="rounded-xl" onClick={() => setIsDeleteAccountOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    className="rounded-xl"
                    disabled={deleteConfirmEmail !== user?.email || isDeletingAccount}
                    onClick={handleDeleteAccount}
                  >
                    {isDeletingAccount ? 'Excluindo...' : 'Excluir Minha Conta'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

        </TabsContent>

        <TabsContent value="subscription" className="space-y-6">
          <div className="max-w-2xl">
            <Card className="border-none shadow-sm pt-0 gap-0">

              {/* Header colorido por estado */}
              {nutritionist?.freeTrialMode ? (
                <div className="px-6 py-5 bg-gradient-to-br from-emerald-600 to-emerald-500">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Award className="w-6 h-6 text-white/90" />
                        Acesso Premium Gratuito
                      </h3>
                      <p className="text-sm text-white/75">
                        Você está aproveitando todos os recursos Premium gratuitamente durante o período de avaliação do sistema.
                      </p>
                    </div>
                    <Badge className="shrink-0 text-[10px] font-bold px-2.5 py-1 bg-white/20 text-white border-white/30">
                      BETA
                    </Badge>
                  </div>
                  <div className="mt-3 bg-black/15 rounded-lg px-3 py-2 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-white/80 shrink-0" />
                    <span className="text-xs text-white/85">Sem cobranças durante este período. Aproveite à vontade!</span>
                  </div>
                </div>
              ) : (
              <div className={cn(
                "px-6 py-5",
                nutritionist?.role === 'admin'
                  ? "bg-slate-800"
                  : nutritionist?.plan === 'premium'
                  ? "bg-gradient-to-br from-primary to-primary/80"
                  : "bg-card border-b border-border"
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className={cn(
                      "text-xl font-bold flex items-center gap-2",
                      nutritionist?.role === 'admin' || nutritionist?.plan === 'premium'
                        ? "text-white"
                        : "text-foreground"
                    )}>
                      <Award className={cn(
                        "w-6 h-6",
                        nutritionist?.role === 'admin' || nutritionist?.plan === 'premium'
                          ? "text-white/90"
                          : "text-muted-foreground"
                      )} />
                      {nutritionist?.role === 'admin'
                        ? 'Acesso Administrativo'
                        : nutritionist?.plan === 'premium'
                        ? 'Plano Premium Ativo'
                        : 'Plano Gratuito'}
                    </h3>
                    <p className={cn(
                      "text-sm",
                      nutritionist?.role === 'admin' || nutritionist?.plan === 'premium'
                        ? "text-white/65"
                        : "text-muted-foreground"
                    )}>
                      {nutritionist?.role === 'admin'
                        ? 'Acesso completo ao sistema sem restrições.'
                        : nutritionist?.plan === 'premium'
                        ? 'Você está usando a versão completa com todos os recursos liberados.'
                        : 'Versão limitada. Faça upgrade para remover os limites.'}
                    </p>
                  </div>
                  <Badge className={cn(
                    "shrink-0 text-[10px] font-bold px-2.5 py-1",
                    nutritionist?.role === 'admin'
                      ? "bg-white/15 text-white border-white/20"
                      : nutritionist?.plan === 'premium'
                      ? "bg-white/20 text-white border-white/30"
                      : "bg-muted text-muted-foreground border-border"
                  )}>
                    {nutritionist?.role === 'admin' ? 'ADMIN' : nutritionist?.plan === 'premium' ? 'PREMIUM' : 'GRATUITO'}
                  </Badge>
                </div>

                {/* Data de renovação no header (premium ativo) */}
                {nutritionist?.plan === 'premium' && !nutritionist.subscription?.cancelAtPeriodEnd && nutritionist.subscription?.currentPeriodEnd && (
                  <div className="mt-3 bg-black/20 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-white/70 shrink-0" />
                    <span className="text-xs text-white/70">Próxima renovação:</span>
                    <span className="text-xs text-white font-bold">
                      {new Date(nutritionist.subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}

                {/* Banner de garantia (primeiros 7 dias) */}
                {nutritionist?.plan === 'premium' && !nutritionist.subscription?.cancelAtPeriodEnd && !nutritionist.subscription?.hadRefundBefore && (
                  (() => {
                    const createdDate = nutritionist.subscription?.firstSubscriptionDate
                      ? new Date(nutritionist.subscription.firstSubscriptionDate)
                      : new Date();
                    const diffDays = Math.ceil((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays > 7) return null;
                    const refundDeadline = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                    return (
                      <div className="mt-3 bg-white/10 border border-white/20 rounded-xl p-3 flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Garantia Ativa</p>
                          <p className="text-[11px] text-white/85 leading-tight">
                            Reembolso integral disponível até{' '}
                            <span className="font-bold text-white">{refundDeadline.toLocaleDateString('pt-BR')}</span>.
                          </p>
                          <button
                            className="text-[10px] text-white/80 font-bold underline hover:text-white transition-colors"
                            onClick={handleCancelSubscription}
                            disabled={isManaging}
                          >
                            Solicitar reembolso agora
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
              )}

              <CardContent className="pt-5 space-y-5">
                {/* Grid de limites/benefícios */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Users, label: 'Pacientes', value: isPremiumOrAdmin ? 'Ilimitados' : `${FREE_PLAN_LIMITS.maxPatients} ativos` },
                    { icon: Activity, label: 'Planos Alimentares', value: isPremiumOrAdmin ? 'Ilimitados' : `${FREE_PLAN_LIMITS.maxMealPlans} ativos` },
                    { icon: Shield, label: 'Histórico', value: isPremiumOrAdmin ? 'Completo' : `${FREE_PLAN_LIMITS.historyMonths} meses` },
                    { icon: CreditCard, label: 'Exames', value: isPremiumOrAdmin ? 'Ilimitados' : `${FREE_PLAN_LIMITS.maxExams} por paciente` },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border",
                      nutritionist?.role === 'admin'
                        ? "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700"
                        : isPremiumOrAdmin
                        ? "bg-primary/5 border-primary/20"
                        : "bg-destructive/10 border-destructive/20"
                    )}>
                      <Icon className={cn(
                        "w-4 h-4 shrink-0",
                        nutritionist?.role === 'admin'
                          ? "text-slate-400"
                          : isPremiumOrAdmin
                          ? "text-primary"
                          : "text-destructive"
                      )} />
                      <div className="min-w-0">
                        <p className={cn(
                          "text-[10px] font-semibold uppercase tracking-wide",
                          nutritionist?.role === 'admin'
                            ? "text-slate-400"
                            : isPremiumOrAdmin
                            ? "text-primary/70"
                            : "text-destructive"
                        )}>{label}</p>
                        <p className="text-sm font-bold text-foreground truncate">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Aviso cancelamento pendente */}
                {!nutritionist?.freeTrialMode && nutritionist?.subscription?.cancelAtPeriodEnd && (
                  <div className="bg-accent/30 border border-accent-foreground/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-accent-foreground shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-accent-foreground">Assinatura Cancelada</p>
                      <p className="text-xs text-accent-foreground/80">
                        Seu acesso Premium continua ativo até{' '}
                        <span className="font-bold">
                          {nutritionist.subscription?.currentPeriodEnd
                            ? new Date(nutritionist.subscription.currentPeriodEnd).toLocaleDateString('pt-BR')
                            : 'fim do período'}
                        </span>.
                      </p>
                      <Button
                        variant="link"
                        className="p-0 h-auto text-xs text-accent-foreground font-bold underline gap-1"
                        onClick={handleSubscribe}
                        disabled={isSubscribing}
                      >
                        <RefreshCw className="w-3 h-3" /> Reativar assinatura agora
                      </Button>
                    </div>
                  </div>
                )}

                {/* Ações premium: gerenciar */}
                {!nutritionist?.freeTrialMode && (nutritionist?.plan === 'premium' || nutritionist?.subscription?.cancelAtPeriodEnd) && (
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full rounded-xl h-10 font-bold text-sm border-border hover:bg-muted/50"
                      onClick={() => setIsManageDialogOpen(true)}
                      disabled={isManaging}
                    >
                      {isManaging ? 'Carregando...' : 'Gerenciar ou Cancelar Assinatura'}
                    </Button>

                    <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                      <DialogContent className="sm:max-w-sm rounded-2xl">
                        <DialogHeader>
                          <DialogTitle>
                            {showCancelConfirm ? 'Confirmar Cancelamento' : 'Gerenciar Assinatura'}
                          </DialogTitle>
                          <DialogDescription>
                            {showCancelConfirm
                              ? 'Tem certeza que deseja cancelar sua assinatura? Você manterá o acesso Premium até o final do período já pago.'
                              : 'Escolha o que você deseja fazer com sua assinatura Premium.'}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          {!showCancelConfirm ? (
                            <>
                              <Button
                                variant="outline"
                                className="w-full justify-start gap-3 h-12 rounded-xl"
                                onClick={() => { handleManageSubscription(); setIsManageDialogOpen(false); }}
                              >
                                <CreditCard className="w-5 h-5 text-primary" />
                                <div className="text-left">
                                  <p className="font-bold text-sm">Ver Faturas e Pagamentos</p>
                                  <p className="text-[10px] text-muted-foreground">Acesse seu histórico de cobranças no Asaas</p>
                                </div>
                              </Button>
                              <Button
                                variant="outline"
                                className="w-full justify-start gap-3 h-12 rounded-xl border-destructive/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                                onClick={() => setShowCancelConfirm(true)}
                              >
                                <Trash2 className="w-5 h-5 text-destructive" />
                                <div className="text-left">
                                  <p className="font-bold text-sm">Cancelar Assinatura</p>
                                  <p className="text-[10px] text-muted-foreground">Interromper renovações automáticas</p>
                                </div>
                              </Button>
                            </>
                          ) : (
                            <div className="flex flex-col gap-3">
                              <Button
                                variant="destructive"
                                className="w-full h-10 rounded-xl font-bold"
                                onClick={() => { handleCancelSubscription(); setIsManageDialogOpen(false); setShowCancelConfirm(false); }}
                              >
                                Sim, cancelar assinatura
                              </Button>
                              <Button
                                variant="ghost"
                                className="w-full h-10 rounded-xl"
                                onClick={() => setShowCancelConfirm(false)}
                              >
                                Voltar
                              </Button>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    <button
                      onClick={() => verifySubscription(false)}
                      disabled={isVerifying}
                      className="w-full text-[10px] text-center opacity-40 hover:opacity-80 transition-opacity text-muted-foreground underline"
                    >
                      {isVerifying ? 'Sincronizando...' : 'Sincronizar status da assinatura'}
                    </button>
                    <p className="text-[10px] text-center opacity-50 text-muted-foreground">
                      Você será redirecionado para o portal de faturamento do Asaas em uma nova aba.
                    </p>
                  </div>
                )}

                {/* CTA para plano gratuito */}
                {!nutritionist?.freeTrialMode && !isPremiumOrAdmin && !nutritionist?.subscription?.cancelAtPeriodEnd && (
                  <div className="space-y-3 pt-1">
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11 font-bold text-sm shadow-md shadow-primary/20 transition-all active:scale-95"
                      onClick={handleSubscribe}
                      disabled={isSubscribing}
                    >
                      {isSubscribing ? 'Carregando...' : '🚀 Assinar Plano Premium — R$ 39,90/mês'}
                    </Button>
                    <button
                      onClick={() => verifySubscription(false)}
                      disabled={isVerifying}
                      className="w-full text-[10px] text-center opacity-40 hover:opacity-80 transition-opacity text-muted-foreground underline"
                    >
                      {isVerifying ? 'Sincronizando...' : 'Já assinou? Clique aqui para sincronizar status'}
                    </button>
                    <p className="text-[10px] text-center opacity-50">
                      Pagamento processado com segurança pelo{' '}
                      <a
                        href="https://www.asaas.com/sobre-nos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
                      >
                        Asaas
                      </a>. Cancele a qualquer momento.
                    </p>
                  </div>
                )}

                {/* Ferramentas de desenvolvedor (admin, colapsável) */}
                {nutritionist?.role === 'admin' && (
                  <div className="pt-4 border-t border-border">
                    <button
                      className="w-full flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
                      onClick={() => setShowDevTools(v => !v)}
                    >
                      <span>🔧 Ferramentas de Desenvolvedor</span>
                      <span>{showDevTools ? '▲' : '▼'}</span>
                    </button>
                    {showDevTools && (
                      <div className="mt-3">
                        {!showResetConfirm ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-dashed border-border text-muted-foreground hover:bg-muted/30 text-[10px] h-8"
                            onClick={() => setShowResetConfirm(true)}
                          >
                            Resetar MEU Status (Teste)
                          </Button>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <p className="text-[10px] text-destructive font-bold text-center">Confirmar reset dos SEUS dados?</p>
                            <div className="flex gap-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                className="flex-1 text-[10px] h-8"
                                onClick={async () => {
                                  try {
                                    await apiRequest('/api/me', 'PATCH', {
                                      plan: 'free',
                                      subscriptionId: null,
                                      subscriptionStatus: null,
                                      cancelAtPeriodEnd: false,
                                      currentPeriodEnd: null,
                                      firstSubscriptionDate: null,
                                      hadRefundBefore: false,
                                      lastSubscriptionCheck: null,
                                    });
                                    toast.success('Seus dados foram resetados!');
                                    setTimeout(() => window.location.reload(), 1000);
                                  } catch (error) {
                                    toast.error('Erro ao resetar dados.');
                                  }
                                }}
                              >
                                Sim, Resetar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-[10px] h-8"
                                onClick={() => setShowResetConfirm(false)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="integrations" className="space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-card border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">Integrações Externas</CardTitle>
                  <CardDescription>Conecte o Nutrir com outras ferramentas que você utiliza.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border border-border bg-muted/30 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-card rounded-xl shadow-sm flex items-center justify-center border border-border">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Google Agenda</h3>
                    <p className="text-sm text-muted-foreground">Sincronize suas consultas e gere links do Google Meet automaticamente.</p>
                  </div>
                </div>
                
                {nutritionist?.googleCalendarConnected ? (
                  <div className="flex items-center gap-3">
                    <Badge className="bg-primary/15 text-primary border-primary/30 gap-1 py-1 px-3">
                      <ShieldCheck className="w-3 h-3" /> Conectado
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-destructive border-destructive/20 hover:bg-destructive/10"
                      onClick={handleDisconnectGoogle}
                    >
                      Desconectar
                    </Button>
                  </div>
                ) : (
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-xl"
                    onClick={handleConnectGoogle}
                    disabled={isConnectingGoogle}
                  >
                    {isConnectingGoogle ? 'Conectando...' : 'Conectar Google Agenda'}
                  </Button>
                )}
              </div>

              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex gap-3">
                <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm text-secondary-foreground">
                  <p className="font-bold mb-1">Como funciona a integração?</p>
                  <ul className="list-disc list-inside space-y-1 opacity-90">
                    <li>Ao agendar uma consulta, um evento será criado na sua agenda principal do Google.</li>
                    <li>O paciente receberá um convite por e-mail automaticamente.</li>
                    <li>Um link do <strong>Google Meet</strong> será gerado e anexado ao evento e ao agendamento no Nutrir.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacidade & Cookies */}
        <TabsContent value="privacy" className="space-y-6">
          <PrivacyTab />
        </TabsContent>

      </Tabs>
    </div>
  );
};

function PrivacyTab() {
  const { consent, acceptAll, acceptEssentialOnly, resetConsent } = useCookieConsent();

  async function handleExportData() {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/account/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Falha ao exportar dados');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meus-dados-nutrir.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Não foi possível exportar os dados. Tente novamente.');
    }
  }

  const statusLabel = consent === 'all'
    ? 'Aceito — cookies essenciais e analíticos'
    : consent === 'essential'
    ? 'Parcial — somente cookies essenciais'
    : 'Não definido';

  const statusColor = consent === 'all'
    ? 'text-emerald-600 dark:text-emerald-400'
    : consent === 'essential'
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-muted-foreground';

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Cookies e Privacidade
          </CardTitle>
          <CardDescription>
            Gerencie suas preferências de privacidade conforme a LGPD (Art. 18).
            Você pode alterar ou revogar seu consentimento a qualquer momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Status atual */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Preferência atual
            </p>
            <p className={`text-sm font-semibold ${statusColor}`}>{statusLabel}</p>
          </div>

          {/* Tipos de cookies */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Cookies Essenciais</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Necessários para autenticação, sessão e funcionamento do sistema.
                  Não podem ser desativados.
                </p>
              </div>
              <span className="ml-auto text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                Sempre ativo
              </span>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
              <Activity className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Cookies Analíticos</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Registros de uso enviados ao Axiom (eventos como login/logout)
                  para nos ajudar a identificar erros e melhorar o serviço.
                </p>
              </div>
              <span className={`ml-auto text-xs font-medium shrink-0 ${consent === 'all' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                {consent === 'all' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg w-full sm:w-auto"
              onClick={acceptEssentialOnly}
              disabled={consent === 'essential'}
            >
              Somente Essenciais
            </Button>
            <Button
              size="sm"
              className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
              onClick={acceptAll}
              disabled={consent === 'all'}
            >
              Aceitar Todos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-muted-foreground sm:ml-auto w-full sm:w-auto"
              onClick={resetConsent}
            >
              Redefinir preferências
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Leia nossa{' '}
            <Link to="/cookies" className="text-primary underline underline-offset-2 hover:text-primary/80">
              Política de Cookies
            </Link>{' '}
            para mais detalhes sobre os dados coletados.
          </p>

          {/* Portabilidade de dados — LGPD Art. 20 */}
          <div className="space-y-2 pt-4 border-t border-border">
            <h3 className="text-sm font-medium">Portabilidade de dados</h3>
            <p className="text-sm text-muted-foreground">
              Conforme LGPD Art. 20, você pode exportar todos os seus dados em formato JSON.
            </p>
            <Button variant="outline" className="w-full md:w-auto" onClick={handleExportData}>
              Exportar meus dados
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
