import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';

const forgotSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<'forgot' | 'success'>('forgot');
  const [email, setEmail] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotFormValues) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setEmail(data.email);
      setStep('success');
      toast.success('E-mail de redefinição enviado!');
    } catch (_error) {
      toast.error('Erro ao enviar e-mail de redefinição. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-md w-full bg-card rounded-3xl shadow-xl p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">E-mail Enviado!</h1>
            <p className="text-muted-foreground">
              Enviamos um link de redefinição de senha para <strong>{email}</strong>.
              Por favor, verifique sua caixa de entrada e a pasta de spam.
            </p>
          </div>
          <Button
            onClick={() => navigate('/login')}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl"
          >
            Voltar para o Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="max-w-md w-full bg-card rounded-3xl shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <Link to="/login" className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">N</span>
              </div>
              <span className="font-bold text-foreground">Nutrir</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Esqueceu a senha?</h1>
              <p className="text-muted-foreground text-sm">
                Informe seu e-mail e enviaremos um link para você redefinir sua senha. Verifique sua caixa de entrada e spam.
              </p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Seu E-mail</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="exemplo@email.com"
                    className="h-11 rounded-xl pl-11"
                    {...form.register('email')}
                  />
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
                {form.formState.errors.email && <p className="text-xs text-destructive mt-1">{form.formState.errors.email.message}</p>}
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/10 transition-all"
                disabled={isLoading}
              >
                {isLoading ? 'Enviando...' : 'Enviar Link de Redefinição'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
