import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDocs, query, where, collection, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { Eye, EyeOff } from 'lucide-react';
import { maskCPF, maskCNPJ, maskPhone } from '../lib/utils';
import { remoteLogger } from '../lib/remote-logger';

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
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';

const registerSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  crn: z.string().min(3, 'CRN é obrigatório'),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(10, 'Telefone inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
}).refine((data) => data.cpf || data.cnpj, {
  message: "CPF ou CNPJ deve ser preenchido",
  path: ["cpf"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = React.useState(false);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: location.state?.email || '',
      name: location.state?.name || '',
    }
  });

  React.useEffect(() => {
    if (location.state?.email) setValue('email', location.state.email);
    if (location.state?.name) setValue('name', location.state.name);
  }, [location.state, setValue]);

  const handleGoogleRegister = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user already exists
      const userDoc = await getDoc(doc(db, 'nutritionists', user.uid));
      if (userDoc.exists()) {
        toast.success('Você já possui uma conta. Entrando...');
        navigate('/');
        return;
      }

      // Pre-fill form
      setValue('email', user.email || '');
      setValue('name', user.displayName || '');
      toast.info('Dados do Google importados. Por favor, complete os campos obrigatórios.');
    } catch (error: any) {
      console.error("Google register error:", error);
      if (error.code === 'auth/popup-closed-by-user') return;
      toast.error('Erro ao conectar com Google.');
    }
  };

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      // 1. Verificar duplicidade de CRN
      const crnQuery = query(collection(db, 'nutritionists'), where('crn', '==', data.crn));
      const crnSnapshot = await getDocs(crnQuery);
      if (!crnSnapshot.empty) {
        toast.error('Ops! Este CRN já está em uso por outro profissional. Verifique se o número está correto.');
        return;
      }

      // 2. Verificar duplicidade de CPF (se preenchido)
      if (data.cpf) {
        const cpfQuery = query(collection(db, 'nutritionists'), where('cpf', '==', data.cpf));
        const cpfSnapshot = await getDocs(cpfQuery);
        if (!cpfSnapshot.empty) {
          toast.error('Este CPF já está cadastrado. Você já possui uma conta com este documento.');
          return;
        }
      }

      // 3. Verificar duplicidade de CNPJ (se preenchido)
      if (data.cnpj) {
        const cnpjQuery = query(collection(db, 'nutritionists'), where('cnpj', '==', data.cnpj));
        const cnpjSnapshot = await getDocs(cnpjQuery);
        if (!cnpjSnapshot.empty) {
          toast.error('Este CNPJ já está cadastrado. Verifique os dados da sua empresa.');
          return;
        }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: data.name
      });

      try {
        await setDoc(doc(db, 'nutritionists', user.uid), {
          name: data.name,
          crn: data.crn,
          cpf: data.cpf || null,
          cnpj: data.cnpj || null,
          email: data.email,
          phone: data.phone,
          role: 'nutritionist',
          plan: 'free',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        });
        remoteLogger.info("Novo usuário cadastrado (Email/Senha)", { userId: user.uid, email: data.email });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `nutritionists/${user.uid}`);
      }

      toast.success('Conta criada com sucesso!');
      navigate('/');
    } catch (error: any) {
      remoteLogger.error("Erro no cadastro (Email/Senha)", error, { email: data.email });
      console.error("Registration error:", error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('O cadastro por e-mail/senha não está habilitado no console do Firebase.');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('Este e-mail já está em uso.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('E-mail inválido.');
      } else if (error.code === 'auth/weak-password') {
        toast.error('A senha é muito fraca.');
      } else if (error.code === 'auth/invalid-credential') {
        toast.error('Erro de credencial. Tente novamente.');
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-2xl">N</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Crie sua conta</CardTitle>
          <CardDescription>Preencha os dados abaixo para começar a usar o Nutrir</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input 
                  id="cnpj" 
                  placeholder="00.000.000/0000-00" 
                  {...register('cnpj')} 
                  onChange={(e) => {
                    const masked = maskCNPJ(e.target.value);
                    setValue('cnpj', masked);
                  }}
                />
                {errors.cnpj && <p className="text-sm text-red-500">{errors.cnpj.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="crn">CRN</Label>
                <Input id="crn" placeholder="Ex: 12345" {...register('crn')} />
                {errors.crn && <p className="text-sm text-red-500">{errors.crn.message}</p>}
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
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="exemplo@email.com" {...register('email')} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    {...register('password')} 
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
                {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
              {isSubmitting ? 'Criando conta...' : 'Cadastrar'}
            </Button>

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">Ou continue com</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2 border-slate-200 hover:bg-slate-50"
              onClick={handleGoogleRegister}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              Google
            </Button>

            <p className="text-center text-sm text-slate-600">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-emerald-600 font-semibold hover:underline">
                Entrar
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
