import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { Eye, EyeOff, ChevronLeft, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { maskCPF, maskCNPJ, maskPhone } from '../lib/utils';
import { remoteLogger } from '../lib/remote-logger';
import { recordSessionStart, useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { logEvent } from '../lib/firebase';
import { strongPasswordSchema } from '../lib/passwordSchema';
import { isStrongPassword } from '../lib/passwordStrength';
import { PasswordStrengthBar } from '../components/ui/PasswordStrengthBar';

const registerSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  crn: z.string().min(3, 'CRN é obrigatório'),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(10, 'Telefone inválido'),
  password: strongPasswordSchema,
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
  const { theme, setTheme } = useTheme();
  const { reloadNutritionist } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const registerHeroImageUrl = import.meta.env.VITE_LOGIN_HERO_IMAGE_URL || '';
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<RegisterFormValues>({
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

      // Check if user already exists in PostgreSQL
      const idToken = await user.getIdToken();
      const meRes = await fetch('/api/me', { headers: { Authorization: `Bearer ${idToken}` } });
      if (meRes.ok) {
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
      const crnCheck = await fetch(`/api/check-unique?field=crn&value=${encodeURIComponent(data.crn)}`).then(r => r.json());
      if (crnCheck.isDuplicate) {
        toast.error('Ops! Este CRN já está em uso por outro profissional. Verifique se o número está correto.');
        return;
      }

      // 2. Verificar duplicidade de CPF (se preenchido)
      if (data.cpf) {
        const cpfCheck = await fetch(`/api/check-unique?field=cpf&value=${encodeURIComponent(data.cpf)}`).then(r => r.json());
        if (cpfCheck.isDuplicate) {
          toast.error('Este CPF já está cadastrado. Você já possui uma conta com este documento.');
          return;
        }
      }

      // 3. Verificar duplicidade de CNPJ (se preenchido)
      if (data.cnpj) {
        const cnpjCheck = await fetch(`/api/check-unique?field=cnpj&value=${encodeURIComponent(data.cnpj)}`).then(r => r.json());
        if (cnpjCheck.isDuplicate) {
          toast.error('Este CNPJ já está cadastrado. Verifique os dados da sua empresa.');
          return;
        }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: data.name
      });

      const idToken = await user.getIdToken();

      const profileRes = await fetch('/api/auth/register-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: data.name,
          crn: data.crn,
          cpf: data.cpf || null,
          cnpj: data.cnpj || null,
          email: data.email,
          phone: data.phone,
        }),
      });

      if (!profileRes.ok) {
        const err = await profileRes.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao salvar perfil.');
      }

      remoteLogger.info("Novo usuário cadastrado (Email/Senha)", { userId: user.uid, email: data.email });

      void logEvent('sign_up', { method: 'email' });
      recordSessionStart();
      await reloadNutritionist();
      toast.success('Conta criada com sucesso!');
      navigate('/dashboard');
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
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Side - Register Form */}
      <div className="flex-1 flex flex-col justify-center px-5 sm:px-12 lg:px-20 py-16 bg-card relative overflow-y-auto">
        <div className="max-w-md w-full mx-auto space-y-6">
          {/* Top controls */}
          <div className="absolute left-6 top-6">
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
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-2.5 mb-6">
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
                <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3C7.5 3 4 7 4 12c0 3.5 2 6.5 5 8l3 1 3-1c3-1.5 5-4.5 5-8 0-5-3.5-9-8-9z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-foreground tracking-tight">Nutrir</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Crie sua conta</h1>
            <p className="text-sm text-muted-foreground">Preencha os dados abaixo para começar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium">Nome Completo</Label>
              <Input id="name" placeholder="Seu nome completo" className="h-11 rounded-xl" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>

            {/* CPF / CNPJ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cpf" className="text-sm font-medium">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  className="h-11 rounded-xl"
                  {...register('cpf')}
                  onChange={(e) => setValue('cpf', maskCPF(e.target.value))}
                />
                {errors.cpf && <p className="text-xs text-destructive mt-1">{errors.cpf.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cnpj" className="text-sm font-medium">CNPJ</Label>
                <Input
                  id="cnpj"
                  placeholder="00.000.000/0000-00"
                  className="h-11 rounded-xl"
                  {...register('cnpj')}
                  onChange={(e) => setValue('cnpj', maskCNPJ(e.target.value))}
                />
                {errors.cnpj && <p className="text-xs text-destructive mt-1">{errors.cnpj.message}</p>}
              </div>
            </div>

            {/* CRN / Telefone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="crn" className="text-sm font-medium">CRN</Label>
                <Input id="crn" placeholder="Ex: 12345" className="h-11 rounded-xl" {...register('crn')} />
                {errors.crn && <p className="text-xs text-destructive mt-1">{errors.crn.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-sm font-medium">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(00) 00000-0000"
                  className="h-11 rounded-xl"
                  {...register('phone')}
                  onChange={(e) => setValue('phone', maskPhone(e.target.value))}
                />
                {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>}
              </div>
            </div>

            {/* E-mail */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
              <Input id="email" type="email" placeholder="exemplo@email.com" className="h-11 rounded-xl" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-11 rounded-xl pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthBar password={watch('password') ?? ''} />
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
            </div>

            {/* Confirmar Senha */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-11 rounded-xl pr-10"
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-md shadow-primary/20 transition-all active:scale-[0.98]"
              disabled={isSubmitting || !isStrongPassword(watch('password') ?? '')}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  <span>Criando conta...</span>
                </div>
              ) : 'Cadastrar'}
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
              onClick={handleGoogleRegister}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Cadastrar com Google
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-primary font-semibold hover:text-primary/80 transition-colors">
                Entrar
              </Link>
            </p>
          </form>

          <p className="text-xs text-center text-muted-foreground/70">
            © 2026 Nutrir. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* Right Side - Brand Panel (mesmo padrão do Login) */}
      <div className="hidden md:flex flex-1 relative overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/70">
        {registerHeroImageUrl ? (
          <img
            src={registerHeroImageUrl}
            alt="Alimentação saudável"
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
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/20 text-white/90 text-xs font-semibold">
              Comece Gratuitamente
            </div>
            <h2 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Tudo que você precisa para gerenciar pacientes
            </h2>
            <p className="text-white/75 text-base leading-relaxed">
              Prontuários, planos alimentares, agenda e financeiro — tudo em um só lugar.
            </p>

            {/* Feature list */}
            <div className="space-y-3 text-left pt-2">
              {[
                'Até 3 pacientes no plano grátis',
                'Planos alimentares personalizados',
                'Agenda e controle de consultas',
                'Relatórios e evolução do paciente',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white/85 text-sm">{feature}</span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              {[
                { value: '+15', label: 'Nutricionistas' },
                { value: 'Grátis', label: 'Para começar' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/10 rounded-2xl p-4 border border-white/15">
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-white/70 text-xs mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
