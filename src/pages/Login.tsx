import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { Eye, EyeOff, ChevronLeft, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { remoteLogger } from '../lib/remote-logger';
import { recordSessionStart } from '../contexts/AuthContext';

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
import { logEvent } from '../lib/firebase';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const Login = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
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

      recordSessionStart();
      remoteLogger.info("Login realizado com sucesso (Email/Senha)", { userId: user.uid, email: user.email });

      void logEvent('login', { method: 'email' });
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
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

      recordSessionStart();
      remoteLogger.info("Login realizado com sucesso (Google)", { userId: user.uid, email: user.email });

      toast.success('Login com Google realizado com sucesso!');
      navigate('/dashboard');
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
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-12 bg-card relative">
        <div className="max-w-md w-full mx-auto space-y-8">
          {/* Top controls */}
          <div className="absolute left-6 top-6 flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
              title="Voltar para a página inicial"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="absolute right-6 top-6 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
            title={`Ativar modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
          >
            {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>

          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-2.5 mb-6">
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
                <svg className="w-4.5 h-4.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3C7.5 3 4 7 4 12c0 3.5 2 6.5 5 8l3 1 3-1c3-1.5 5-4.5 5-8 0-5-3.5-9-8-9z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-foreground tracking-tight">Nutrir</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Bem-vindo de volta</h1>
            <p className="text-sm text-muted-foreground">Entre com suas credenciais para continuar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="exemplo@email.com"
                  className="h-11 rounded-xl transition-all"
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                  <Link to="/forgot-password" className="text-xs text-primary font-medium hover:text-primary/80 transition-colors">
                    Esqueceu a senha?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="h-11 rounded-xl transition-all pr-12"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-md shadow-primary/20 transition-all active:scale-[0.98]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  <span>Entrando...</span>
                </div>
              ) : 'Entrar'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Ou continue com</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl hover:bg-muted/50 transition-all flex items-center justify-center gap-3 font-medium"
              onClick={handleGoogleLogin}
            >
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Entrar com Google
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Não tem uma conta?{' '}
              <Link to="/register" className="text-primary font-semibold hover:text-primary/80 transition-colors">
                Cadastre-se grátis
              </Link>
            </p>
          </form>

          <p className="text-xs text-center text-muted-foreground/70">
            © 2026 Nutrir. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* Right Side - Brand Panel */}
      <div className="hidden md:flex flex-1 relative overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/70">
        {loginHeroImageUrl ? (
          <img
            src={loginHeroImageUrl}
            alt="Nutrition and Healthy Food"
            className="absolute inset-0 w-full h-full object-cover opacity-35"
            referrerPolicy="no-referrer"
          />
        ) : null}

        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/3 right-8 w-40 h-40 rounded-full bg-white/5" />

        <div className="relative flex flex-col items-center justify-center text-center p-16 w-full">
          <div className="max-w-sm space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/20 text-white/90 text-xs font-semibold uppercase tracking-widest backdrop-blur-sm">
              Plataforma Profissional
            </div>
            <h2 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Gestão inteligente para Nutricionistas
            </h2>
            <p className="text-white/75 text-base leading-relaxed">
              Simplifique seu dia a dia, encante seus pacientes e foque no que realmente importa: a saúde.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              {[
                { value: '+15', label: 'Nutricionistas' },
                { value: '+120', label: 'Pacientes ativos' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/15">
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-white/70 text-xs mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Avatars */}
            {loginAvatarBaseUrl && (
              <div className="flex justify-center gap-3 pt-2">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-9 h-9 rounded-full border-2 border-primary bg-primary/15 overflow-hidden">
                      <img src={`${loginAvatarBaseUrl}?img=${i + 10}`} alt="User" />
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <p className="text-white font-semibold text-sm">já utilizam o Nutrir</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
