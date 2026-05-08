import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';
import { LandingNavbar } from '../components/LandingNavbar';
import { LandingFooter } from '../components/LandingFooter';

const contatoSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  assunto: z.string().min(5, 'Assunto deve ter pelo menos 5 caracteres'),
  mensagem: z.string().min(20, 'Mensagem deve ter pelo menos 20 caracteres'),
});

type ContatoFormValues = z.infer<typeof contatoSchema>;

export function Contato() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContatoFormValues>({
    resolver: zodResolver(contatoSchema),
  });

  const onSubmit = async (data: ContatoFormValues) => {
    await new Promise((r) => setTimeout(r, 800));
    console.info('Contato form submitted:', data);
    toast.success('Mensagem enviada! Retornaremos em até 1 dia útil.');
    reset();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h1 className="text-4xl font-bold">Entre em <span className="text-emerald-600">Contato</span></h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tem alguma dúvida, sugestão ou precisa de suporte? Nossa equipe está pronta para ajudar.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Info Cards */}
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Mail className="w-8 h-8 text-emerald-600" />
                  <h3 className="font-semibold">E-mail</h3>
                  <p className="text-sm text-muted-foreground">Para suporte e dúvidas gerais</p>
                  <a href="mailto:contato@nutrir.app" className="text-sm text-emerald-600 hover:underline">
                    contato@nutrir.app
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Clock className="w-8 h-8 text-emerald-600" />
                  <h3 className="font-semibold">Horário de Atendimento</h3>
                  <p className="text-sm text-muted-foreground">Segunda a Sexta<br />09h – 18h (BRT)</p>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <div className="md:col-span-2">
              <Card>
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome</Label>
                        <Input id="nome" placeholder="Seu nome completo" {...register('nome')} />
                        {errors.nome && <p className="text-sm text-red-500">{errors.nome.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">E-mail</Label>
                        <Input id="email" type="email" placeholder="seu@email.com" {...register('email')} />
                        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="assunto">Assunto</Label>
                      <Input id="assunto" placeholder="Como podemos ajudar?" {...register('assunto')} />
                      {errors.assunto && <p className="text-sm text-red-500">{errors.assunto.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mensagem">Mensagem</Label>
                      <textarea
                        id="mensagem"
                        rows={6}
                        placeholder="Descreva sua dúvida ou sugestão em detalhes..."
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                        {...register('mensagem')}
                      />
                      {errors.mensagem && <p className="text-sm text-red-500">{errors.mensagem.message}</p>}
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      size="lg"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Enviando...' : 'Enviar Mensagem'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
