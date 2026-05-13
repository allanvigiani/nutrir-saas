import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  User, 
  Users,
  Mail, 
  Phone, 
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
import { Separator } from '../components/ui/separator';
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
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { cn, maskCPF, maskCNPJ, maskPhone } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { FREE_PLAN_LIMITS } from '../lib/planLimits';
import { doc, updateDoc, collection, query, where, onSnapshot, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../lib/firebase';
import { signOut, updatePassword } from 'firebase/auth';
import { toast } from 'sonner';
import { remoteLogger } from '../lib/remote-logger';
import { CustomFood } from '../types';
import { CustomFoodDialog } from '../components/CustomFoodDialog';
import { useSubscription } from '../hooks/useSubscription';
import { useSearchParams } from 'react-router-dom';

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
  const { nutritionist, user } = useAuth();
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
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [foodToDelete, setFoodToDelete] = useState<string | null>(null);
  const [editingFood, setEditingFood] = useState<CustomFood | null>(null);
  const [foodSearch, setFoodSearch] = useState('');
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  
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

    const q = query(
      collection(db, 'custom_foods'),
      where('nutritionist_id', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const foods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomFood));
      setCustomFoods(foods);
    });

    return () => unsubscribe();
  }, [user]);

  const handleResetAllUsers = async () => {
    if (!user?.email) return;
    setIsResettingAll(true);
    const toastId = toast.loading('Resetando todos os usuários...');

    try {
      const response = await fetch('/api/admin/reset-all-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminEmail: user.email,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message, { id: toastId });
        setShowResetAllConfirm(false);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        throw new Error(data.error || 'Erro ao resetar usuários.');
      }
    } catch (error: any) {
      console.error('Erro no reset global:', error);
      toast.error('Erro: ' + (error.message || 'Tente novamente.'), { id: toastId });
    } finally {
      setIsResettingAll(false);
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
      try {
        await updateDoc(doc(db, 'nutritionists', user.uid), {
          photoUrl: downloadURL,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `nutritionists/${user.uid}`);
      }

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
      const crnQuery = query(
        collection(db, 'nutritionists'), 
        where('crn', '==', data.crn)
      );
      const crnSnapshot = await getDocs(crnQuery);
      const isCrnDuplicate = crnSnapshot.docs.some(doc => doc.id !== user.uid);
      if (isCrnDuplicate) {
        toast.error('CRN já cadastrado: Este número já pertence a outro profissional.');
        setIsSaving(false);
        return;
      }

      // 2. Verificar duplicidade de CPF (se preenchido e excluindo o próprio usuário)
      if (data.cpf) {
        const cpfQuery = query(
          collection(db, 'nutritionists'), 
          where('cpf', '==', data.cpf)
        );
        const cpfSnapshot = await getDocs(cpfQuery);
        const isCpfDuplicate = cpfSnapshot.docs.some(doc => doc.id !== user.uid);
        if (isCpfDuplicate) {
          toast.error('CPF já cadastrado: Este documento já está sendo utilizado.');
          setIsSaving(false);
          return;
        }
      }

      // 3. Verificar duplicidade de CNPJ (se preenchido e excluindo o próprio usuário)
      if (data.cnpj) {
        const cnpjQuery = query(
          collection(db, 'nutritionists'), 
          where('cnpj', '==', data.cnpj)
        );
        const cnpjSnapshot = await getDocs(cnpjQuery);
        const isCnpjDuplicate = cnpjSnapshot.docs.some(doc => doc.id !== user.uid);
        if (isCnpjDuplicate) {
          toast.error('CNPJ já cadastrado: Este documento já está sendo utilizado.');
          setIsSaving(false);
          return;
        }
      }

      const specialtiesArray = data.specialties 
        ? data.specialties.split(',').map(s => s.trim()) 
        : [];
        
      try {
        await updateDoc(doc(db, 'nutritionists', user.uid), {
          name: data.name,
          crn: data.crn,
          cpf: data.cpf || null,
          cnpj: data.cnpj || null,
          phone: data.phone,
          specialties: specialtiesArray,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `nutritionists/${user.uid}`);
      }
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
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        toast.success('Google Agenda conectado com sucesso!');
        // Refresh nutritionist data if needed, or just let the snapshot handle it
        setIsConnectingGoogle(false);
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
      await updateDoc(doc(db, 'nutritionists', user.uid), {
        googleCalendarConnected: false,
        googleCalendarTokens: null,
        updatedAt: new Date().toISOString()
      });
      toast.success('Google Agenda desconectado.', { id: toastId });
    } catch (error) {
      console.error("Error disconnecting Google:", error);
      toast.error('Erro ao desconectar Google Agenda.', { id: toastId });
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

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
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
      await deleteDoc(doc(db, 'custom_foods', id));
      toast.success('Alimento excluído com sucesso!');
      setFoodToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `custom_foods/${id}`);
    }
  };

  const filteredFoods = customFoods.filter(food => 
    food.name.toLowerCase().includes(foodSearch.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie seu perfil e preferências do sistema.</p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="flex w-full items-center justify-start gap-2 bg-transparent border-b border-border p-0 rounded-none h-auto mb-8 overflow-x-auto">
          <TabsTrigger 
            value="profile" 
            className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <User className="w-4 h-4" /> Perfil Profissional
          </TabsTrigger>
          <TabsTrigger 
            value="foods" 
            className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <Utensils className="w-4 h-4" /> Alimentos Próprios
          </TabsTrigger>
          <TabsTrigger 
            value="security" 
            className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <Shield className="w-4 h-4" /> Segurança
          </TabsTrigger>
          <TabsTrigger 
            value="subscription" 
            className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
          >
            <Award className="w-4 h-4" /> Assinatura e Plano
          </TabsTrigger>
          <TabsTrigger 
            value="integrations" 
            className="relative gap-2 px-4 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all whitespace-nowrap"
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
                            variant={nutritionist?.plan === 'premium' ? 'default' : 'secondary'} 
                            className={nutritionist?.plan === 'premium' ? 'bg-primary/15 text-primary hover:bg-primary/15' : ''}
                          >
                            {nutritionist?.plan === 'premium' ? 'Premium' : 'Gratuito'}
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
                    <Button type="submit" className="bg-primary hover:bg-primary/90 gap-2 rounded-xl h-8 px-6 font-bold text-sm" disabled={isSaving}>
                      <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
            
            <div className="space-y-6">
              <Card className="border-none shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-red-600">Sair do Sistema</CardTitle>
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
              className="bg-primary hover:bg-primary/90 text-white rounded-xl h-8 px-4 font-bold text-sm transition-all shadow-sm active:scale-95"
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
                        <tr key={food.id} className="hover:bg-muted/30/50 transition-colors">
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
                                className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg"
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
          <div className="max-w-2xl">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Segurança da Conta</CardTitle>
                <CardDescription>Altere sua senha de acesso para manter sua conta segura.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova Senha</Label>
                    <Input 
                      id="newPassword" 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-muted/30 rounded-lg" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmNewPassword">Confirmar Nova Senha</Label>
                    <Input 
                      id="confirmNewPassword" 
                      type="password" 
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="bg-muted/30 rounded-lg" 
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-border pt-6">
                <Button 
                  className="bg-primary hover:bg-primary/90 text-white gap-2 rounded-xl h-8 px-4 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  onClick={handleUpdatePassword}
                  disabled={isUpdatingPassword}
                >
                  <Lock className="w-4 h-4" /> {isUpdatingPassword ? 'Atualizando...' : 'Atualizar Senha'}
                </Button>
              </CardFooter>
            </Card>


          </div>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-6">
          <div className="max-w-2xl">
            <Card className={cn(
              "border-none shadow-sm",
              nutritionist?.plan === 'premium' ? "bg-primary/90 text-white" : "bg-card"
            )}>
              <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className={cn("text-xl font-bold flex items-center gap-2", nutritionist?.plan === 'premium' ? "text-white" : "text-foreground")}>
                    <Award className={cn("w-6 h-6", nutritionist?.plan === 'premium' ? "text-primary" : "text-primary")} />
                    {nutritionist?.plan === 'premium' ? 'Plano Premium Ativo' : 'Plano Gratuito'}
                  </CardTitle>
                  <CardDescription className={nutritionist?.plan === 'premium' ? "text-primary-foreground/80" : "text-muted-foreground"}>
                    {nutritionist?.plan === 'premium' 
                      ? 'Você está usando a versão completa do sistema com todos os recursos liberados.' 
                      : 'Você está usando a versão limitada do sistema. Faça o upgrade para remover limites.'}
                  </CardDescription>
                </div>

                {nutritionist?.plan === 'premium' && !nutritionist.cancelAtPeriodEnd && !nutritionist.hadRefundBefore && (
                  (() => {
                    const createdDate = nutritionist.firstSubscriptionDate ? new Date(nutritionist.firstSubscriptionDate) : new Date();
                    const now = new Date();
                    const diffDays = Math.ceil((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays <= 7) {
                      const refundDeadline = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                      return (
                        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-start gap-2 max-w-xs">
                          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-primary/70 uppercase tracking-wider">Garantia Ativa</p>
                            <p className="text-[11px] text-primary-foreground leading-tight">
                              Reembolso integral disponível até{' '}
                              <span className="font-bold text-white">{refundDeadline.toLocaleDateString('pt-BR')}</span>.
                            </p>
                            <button 
                              className="text-[10px] text-primary font-bold underline hover:text-primary-foreground transition-colors"
                              onClick={handleCancelSubscription}
                              disabled={isManaging}
                            >
                              Solicitar reembolso agora
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className={cn(
                    "grid grid-cols-1 md:grid-cols-2 gap-4",
                    nutritionist?.plan === 'premium' ? "text-primary-foreground" : "text-muted-foreground"
                  )}>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-black/5">
                      <Users className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-xs font-medium text-primary-foreground/60">Pacientes</p>
                        <p className="font-bold">{nutritionist?.plan === 'premium' ? 'Ilimitados' : `${FREE_PLAN_LIMITS.maxPatients} ativos`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-black/5">
                      <Activity className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-xs font-medium text-primary-foreground/60">Planos Alimentares</p>
                        <p className="font-bold">{nutritionist?.plan === 'premium' ? 'Ilimitados' : `${FREE_PLAN_LIMITS.maxMealPlans} ativos`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-black/5">
                      <Shield className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-xs font-medium text-primary-foreground/60">Histórico</p>
                        <p className="font-bold">{nutritionist?.plan === 'premium' ? 'Completo' : `${FREE_PLAN_LIMITS.historyMonths} meses`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-black/5">
                      <CreditCard className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-xs font-medium text-primary-foreground/60">Exames</p>
                        <p className="font-bold">{nutritionist?.plan === 'premium' ? 'Ilimitados' : `${FREE_PLAN_LIMITS.maxExams} por paciente`}</p>
                      </div>
                    </div>
                  </div>

                  {(nutritionist?.plan === 'premium' || nutritionist?.cancelAtPeriodEnd) && (
                    <div className="pt-4 space-y-4">
                      {!nutritionist.cancelAtPeriodEnd && nutritionist.currentPeriodEnd && (
                        <div className="bg-primary/40 border border-primary/50 rounded-xl p-4 flex items-start gap-3">
                          <Calendar className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-primary-foreground/80">Próxima Renovação</p>
                            <p className="text-xs text-primary-foreground">
                              Sua assinatura será renovada automaticamente em{' '}
                              <span className="font-bold">
                                {new Date(nutritionist.currentPeriodEnd).toLocaleDateString('pt-BR')}
                              </span>.
                            </p>
                          </div>
                        </div>
                      )}

                      {nutritionist.cancelAtPeriodEnd && (
                        <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-amber-200">Assinatura Cancelada</p>
                            <p className="text-xs text-amber-100/80">
                              Seu acesso Premium continuará ativo até o dia{' '}
                              <span className="font-bold">
                                {nutritionist.currentPeriodEnd ? new Date(nutritionist.currentPeriodEnd).toLocaleDateString('pt-BR') : 'fim do período'}
                              </span>.
                            </p>
                            <Button 
                              variant="link" 
                              className="p-0 h-auto text-xs text-white font-bold underline decoration-white/30 hover:decoration-white gap-1"
                              onClick={handleSubscribe}
                              disabled={isSubscribing}
                            >
                              <RefreshCw className="w-3 h-3" /> Reativar assinatura agora
                            </Button>
                          </div>
                        </div>
                      )}

                      <Button 
                        className="w-full bg-card text-primary hover:bg-primary/10 border-none rounded-xl h-10 font-bold text-sm transition-all active:scale-95 shadow-sm" 
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
                                  onClick={() => {
                                    handleManageSubscription();
                                    setIsManageDialogOpen(false);
                                  }}
                                >
                                  <CreditCard className="w-5 h-5 text-primary" />
                                  <div className="text-left">
                                    <p className="font-bold text-sm">Ver Faturas e Pagamentos</p>
                                    <p className="text-[10px] text-muted-foreground">Acesse seu histórico de cobranças no Asaas</p>
                                  </div>
                                </Button>

                                <Button 
                                  variant="outline" 
                                  className="w-full justify-start gap-3 h-12 rounded-xl border-red-100 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                                  onClick={() => setShowCancelConfirm(true)}
                                >
                                  <Trash2 className="w-5 h-5 text-red-500" />
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
                                  onClick={() => {
                                    handleCancelSubscription();
                                    setIsManageDialogOpen(false);
                                    setShowCancelConfirm(false);
                                  }}
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
                        className="w-full text-[10px] text-center mt-2 opacity-40 hover:opacity-100 transition-opacity text-primary-foreground/60 underline"
                      >
                        {isVerifying ? 'Sincronizando...' : 'Sincronizar status da assinatura'}
                      </button>

                      <p className="text-[10px] text-center mt-2 opacity-60 text-primary-foreground/60">
                        Você será redirecionado para o portal de faturamento do Asaas em uma nova aba.
                      </p>
                    </div>
                  )}

                  {nutritionist?.plan !== 'premium' && !nutritionist?.cancelAtPeriodEnd && (
                    <div className="pt-4 space-y-4">
                      <Button 
                        className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-10 font-bold text-sm shadow-lg shadow-primary/10 transition-all active:scale-95" 
                        onClick={handleSubscribe}
                        disabled={isSubscribing}
                      >
                        {isSubscribing ? 'Carregando...' : 'Assinar Plano Premium - R$ 39,90/mês'}
                      </Button>
                      
                      <button 
                        onClick={() => verifySubscription(false)}
                        disabled={isVerifying}
                        className="w-full text-[10px] text-center mt-2 opacity-40 hover:opacity-100 transition-opacity text-muted-foreground underline"
                      >
                        {isVerifying ? 'Sincronizando...' : 'Já assinou? Clique aqui para sincronizar status'}
                      </button>

                      <p className="text-[10px] text-center mt-2 opacity-60">
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

                  {/* Ferramenta de Desenvolvedor - Visível apenas para o Admin principal */}
                  {nutritionist?.role === 'admin' && (
                    <div className="mt-8 pt-6 border-t border-border">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Ferramentas de Desenvolvedor</p>
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
                          <p className="text-[10px] text-red-500 font-bold text-center">Confirmar reset dos SEUS dados?</p>
                          <div className="flex gap-2">
                            <Button 
                              variant="destructive" 
                              size="sm"
                              className="flex-1 text-[10px] h-8"
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'nutritionists', user.uid), {
                                    plan: 'free',
                                    subscriptionId: null,
                                    subscriptionStatus: null,
                                    cancelAtPeriodEnd: false,
                                    currentPeriodEnd: null,
                                    firstSubscriptionDate: null,
                                    hadRefundBefore: false,
                                    lastSubscriptionCheck: null,
                                    updatedAt: new Date().toISOString(),
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

                      {/* Reset Global */}
                      <div className="mt-4">
                        {!showResetAllConfirm ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="w-full border-red-200 text-red-500 hover:bg-red-50 text-[10px] h-8 font-bold"
                            onClick={() => setShowResetAllConfirm(true)}
                          >
                            RESETAR TODOS OS USUÁRIOS (LIMPA GERAL)
                          </Button>
                        ) : (
                          <div className="flex flex-col gap-2 p-2 border border-red-200 rounded-lg bg-red-50">
                            <p className="text-[10px] text-red-600 font-bold text-center">
                              ATENÇÃO: Isso voltará TODOS os usuários para o plano gratuito. Confirmar?
                            </p>
                            <div className="flex gap-2">
                              <Button 
                                variant="destructive" 
                                size="sm"
                                className="flex-1 text-[10px] h-8"
                                onClick={handleResetAllUsers}
                                disabled={isResettingAll}
                              >
                                {isResettingAll ? 'Resetando...' : 'SIM, LIMPAR TUDO'}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="flex-1 text-[10px] h-8 border-border"
                                onClick={() => setShowResetAllConfirm(false)}
                                disabled={isResettingAll}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border border-border bg-muted/30/30 gap-4">
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
                      className="text-red-600 border-red-100 hover:bg-red-50"
                      onClick={handleDisconnectGoogle}
                    >
                      Desconectar
                    </Button>
                  </div>
                ) : (
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-white gap-2 rounded-xl"
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
      </Tabs>
    </div>
  );
};
