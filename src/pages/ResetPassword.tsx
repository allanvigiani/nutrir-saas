import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, XCircle } from 'lucide-react';

const resetSchema = z.object({
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type ResetFormValues = z.infer<typeof resetSchema>;

type Step = 'validating' | 'invalid' | 'form' | 'success';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('validating');
  const [isLoading, setIsLoading] = useState(false);
  const oobCode = searchParams.get('oobCode') ?? '';

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  });

  useEffect(() => {
    if (!oobCode) {
      setStep('invalid');
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then(() => setStep('form'))
      .catch(() => setStep('invalid'));
  }, [oobCode]);

  const onSubmit = async (data: ResetFormValues) => {
    setIsLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, data.password);
      setStep('success');
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      const msg =
        code === 'auth/expired-action-code'
          ? 'Este link expirou. Solicite um novo.'
          : 'Não foi possível redefinir a senha. Tente novamente.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg border p-8">

          {/* Validating */}
          {step === 'validating' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-muted-foreground text-sm">Verificando link...</p>
            </div>
          )}

          {/* Invalid */}
          {step === 'invalid' && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-destructive" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Link inválido ou expirado</h1>
                <p className="text-muted-foreground text-sm">
                  Este link de redefinição de senha expirou ou já foi utilizado.
                  Links são válidos por 1 hora.
                </p>
              </div>
              <Button
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl"
                onClick={() => navigate('/forgot-password')}
              >
                Solicitar novo link
              </Button>
            </div>
          )}

          {/* Form */}
          {step === 'form' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Nova senha</h1>
                <p className="text-muted-foreground text-sm">
                  Escolha uma nova senha para sua conta no Nutrir.
                </p>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      className="h-11 rounded-xl pl-11"
                      {...form.register('password')}
                    />
                    <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-xs text-destructive mt-1">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repita a nova senha"
                      className="h-11 rounded-xl pl-11"
                      {...form.register('confirmPassword')}
                    />
                    <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                  {form.formState.errors.confirmPassword && (
                    <p className="text-xs text-destructive mt-1">{form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/10 transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? 'Salvando...' : 'Salvar nova senha'}
                </Button>
              </form>
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Senha redefinida!</h1>
                <p className="text-muted-foreground text-sm">
                  Sua senha foi alterada com sucesso. Faça login com a nova senha.
                </p>
              </div>
              <Button
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl"
                onClick={() => navigate('/login')}
              >
                Ir para o login
              </Button>
            </div>
          )}

          {/* Back link — visível em todas as telas exceto success e validating */}
          {step !== 'success' && step !== 'validating' && (
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar ao login
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
