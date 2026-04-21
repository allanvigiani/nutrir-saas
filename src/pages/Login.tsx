import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { Eye, EyeOff } from 'lucide-react';
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
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = React.useState(false);
  const loginHeroImageUrl = import.meta.env.VITE_LOGIN_HERO_IMAGE_URL || '';
  const loginAvatarBaseUrl = import.meta.env.VITE_LOGIN_AVATAR_BASE_URL || '';
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const email = data.email.trim();
      const userCredential = await signInWithEmailAndPassword(auth, email, data.password);
      const user = userCredential.user;
      
      // Update last login (non-blocking)
      updateDoc(doc(db, 'nutritionists', user.uid), {
        lastLogin: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).catch(error => {
        console.error("Failed to update last login:", error);
      });

      remoteLogger.info("Login realizado com sucesso (Email/Senha)", { userId: user.uid, email: user.email });

      toast.success('Login realizado com sucesso!');
      navigate('/');
    } catch (error: any) {
      remoteLogger.error("Erro no login (Email/Senha)", error, { email: data.email });
      console.error("Login error:", error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('O login por e-mail/senha não está habilitado no console do Firebase.');
      } else if (error.code === 'auth/invalid-credential') {
        toast.error('E-mail ou senha incorretos. Verifique suas credenciais.');
      } else if (error.code === 'auth/user-disabled') {
        toast.error('Esta conta foi desativada.');
      } else {
        toast.error('Erro ao fazer login. Tente novamente mais tarde.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'nutritionists', user.uid));

      if (!userDoc.exists()) {
        // If user doesn't exist, we need to redirect to register or handle creation
        // But we need CRN/CPF/CNPJ. For now, let's redirect to register with a state
        // or just show a message.
        // Actually, let's create a basic profile and ask them to complete it later?
        // No, the user said "login/cadastro com google".
        // I'll redirect them to register page with pre-filled email/name if they are new.
        toast.info('Conta Google conectada. Por favor, complete seu cadastro.');
        navigate('/register', { state: { email: user.email, name: user.displayName } });
        return;
      }

      // Update last login
      await updateDoc(doc(db, 'nutritionists', user.uid), {
        lastLogin: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      remoteLogger.info("Login realizado com sucesso (Google)", { userId: user.uid, email: user.email });

      toast.success('Login com Google realizado com sucesso!');
      navigate('/');
    } catch (error: any) {
      console.error("Google login error:", {
        code: error?.code,
        message: error?.message,
        customData: error?.customData,
      });
      if (error.code === 'auth/popup-closed-by-user') {
        return;
      }
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('Domínio não autorizado no Firebase. Adicione este domínio em Authentication > Settings > Authorized domains.');
        return;
      }
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('Login com Google não está habilitado no Firebase Authentication.');
        return;
      }
      if (error.code === 'auth/configuration-not-found') {
        toast.error('Configuração OAuth ausente para Google. Verifique o provedor Google no Firebase.');
        return;
      }
      if (error.code === 'auth/popup-blocked') {
        toast.error('O navegador bloqueou o popup de autenticação. Permita popups para este site.');
        return;
      }
      if (error.code === 'auth/cancelled-popup-request') {
        toast.error('Tentativa de login cancelada. Feche popups anteriores e tente novamente.');
        return;
      }
      toast.error(`Erro ao entrar com Google (${error.code || 'desconhecido'}).`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-24 py-12 bg-white">
        <div className="max-w-md w-full mx-auto space-y-8">
          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
                <span className="text-white font-bold text-xl">N</span>
              </div>
              <span className="text-2xl font-bold text-slate-900 tracking-tight">Nutrir</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bem-vindo de volta</h1>
            <p className="text-slate-500">Entre com seu e-mail e senha para acessar sua conta</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-medium">E-mail</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="exemplo@email.com" 
                  className="h-12 rounded-xl border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  {...register('email')}
                />
                {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-700 font-medium">Senha</Label>
                  <Link to="/forgot-password" className="text-sm text-emerald-600 font-medium hover:text-emerald-700 transition-colors">
                    Esqueceu a senha?
                  </Link>
                </div>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    className="h-12 rounded-xl border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 transition-all pr-12"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>}
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-100 transition-all active:scale-[0.98]" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Entrando...</span>
                </div>
              ) : 'Entrar'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400">Ou continue com</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 rounded-xl border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 font-semibold text-slate-700"
              onClick={handleGoogleLogin}
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

            <p className="text-center text-slate-600">
              Não tem uma conta?{' '}
              <Link to="/register" className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
                Cadastre-se agora
              </Link>
            </p>
          </form>

          <div className="pt-8 border-t border-slate-100">
            <p className="text-xs text-center text-slate-400">
              © 2026 Nutrir - Sistema de Gestão para Nutricionistas. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="hidden md:block flex-1 relative overflow-hidden bg-emerald-900">
        {loginHeroImageUrl ? (
          <img
            src={loginHeroImageUrl}
            alt="Nutrition and Healthy Food"
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-900/20 to-transparent z-10" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-16 z-20">
          <div className="max-w-lg space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-4 backdrop-blur-sm">
              Plataforma Profissional
            </div>
            <h2 className="text-5xl font-extrabold text-white leading-tight tracking-tight">
              Gestão inteligente para <span className="text-emerald-400">Nutricionistas</span>
            </h2>
            <p className="text-emerald-50/80 text-xl leading-relaxed max-w-md mx-auto">
              Simplifique seu dia a dia, encante seus pacientes e foque no que realmente importa: a saúde.
            </p>
            <div className="pt-8 flex justify-center gap-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-emerald-900 bg-emerald-100 overflow-hidden">
                    {loginAvatarBaseUrl ? <img src={`${loginAvatarBaseUrl}?img=${i + 10}`} alt="User" /> : null}
                  </div>
                ))}
              </div>
              <div className="text-left">
                <p className="text-white font-bold text-sm">+500 Nutricionistas</p>
                <p className="text-emerald-400 text-xs">já utilizam o Nutrir</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
