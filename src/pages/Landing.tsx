import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  TrendingUp,
  UtensilsCrossed,
  MessageSquare,
  Calendar,
  Target,
  Smartphone,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { LandingNavbar } from '../components/LandingNavbar';
import { LandingFooter } from '../components/LandingFooter';

export function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ctaLabel = user ? 'Acessar Área do Nutricionista' : 'Começar Grátis';
  const ctaPath = user ? '/dashboard' : '/register';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl sm:text-6xl font-bold leading-tight">
                Transforme a <span className="text-emerald-600">Nutrição</span> em Resultados
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                A plataforma completa para nutricionistas e pacientes. Acompanhamento inteligente, planejamento personalizado e resultados comprovados em um só lugar.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  size="lg"
                  onClick={() => navigate(ctaPath)}
                  className="text-base bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {ctaLabel} <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-base"
                >
                  Ver Preços
                </Button>
              </div>

              <div className="flex items-center gap-8 pt-6 text-sm">
                <div>
                  <div className="font-bold text-lg">500+</div>
                  <div className="text-muted-foreground">Profissionais</div>
                </div>
                <div>
                  <div className="font-bold text-lg">10k+</div>
                  <div className="text-muted-foreground">Pacientes Ativos</div>
                </div>
                <div>
                  <div className="font-bold text-lg">95%</div>
                  <div className="text-muted-foreground">Satisfação</div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <Card className="h-96 bg-gradient-to-br from-emerald-600/10 to-emerald-600/5 border-emerald-600/20 flex items-center justify-center">
                <TrendingUp className="w-24 h-24 text-emerald-600 opacity-50" />
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold">
              Funcionalidades que <span className="text-emerald-600">Fazem a Diferença</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tudo o que você precisa para gerenciar nutrição de forma profissional e obter resultados reais
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: TrendingUp,
                title: 'Acompanhamento Inteligente',
                desc: 'Rastreie peso, medidas e bioimpedância em tempo real com gráficos automatizados e análises comparativas.'
              },
              {
                icon: UtensilsCrossed,
                title: 'Planos Personalizados',
                desc: 'Crie planos alimentares customizados com macros automáticos, receitas integradas e ajustes dinâmicos.'
              },
              {
                icon: MessageSquare,
                title: 'Comunicação em Tempo Real',
                desc: 'Chat integrado entre nutricionista e paciente para dúvidas, ajustes e suporte contínuo.'
              },
              {
                icon: Calendar,
                title: 'Agenda Profissional',
                desc: 'Gerencie agendamentos, lembretes automáticos e histórico completo de consultas com cada paciente.'
              },
              {
                icon: Target,
                title: 'Metas e Progressão',
                desc: 'Defina objetivos realistas e acompanhe progresso com marcos, celebrações e feedback motivacional.'
              },
              {
                icon: Smartphone,
                title: 'Acesso em Qualquer Lugar',
                desc: 'Acesso via web ou app mobile. Seus dados sempre sincronizados e acessíveis quando você precisa.'
              },
            ].map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Card key={i} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <Icon className="w-8 h-8 text-emerald-600 mb-2" />
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold">
              Como <span className="text-emerald-600">Funciona</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: 1, title: 'Crie sua Conta', desc: 'Registre-se como nutricionista ou paciente em segundos' },
              { step: 2, title: 'Configure seu Perfil', desc: 'Adicione dados pessoais, objetivos e preferências alimentares' },
              { step: 3, title: 'Comece o Acompanhamento', desc: 'Receba seu plano personalizado e comece a rastrear progresso' },
              { step: 4, title: 'Veja Resultados', desc: 'Acompanhe transformações com dados visuais e insights' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold">
              Planos <span className="text-emerald-600">Simples e Transparentes</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Escolha o plano perfeito para suas necessidades. Sem contratos de longo prazo.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Gratuito</CardTitle>
                <p className="text-muted-foreground text-sm">Para começar</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <span className="text-4xl font-bold">R$ 0</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>

                <Button
                  onClick={() => navigate(ctaPath)}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  {user ? 'Acessar Área do Nutricionista' : 'Começar Agora'}
                </Button>

                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>1 paciente</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>Acompanhamento básico</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>Até 5 planos</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border border-border flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Agendamento profissional</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border border-border flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Relatórios avançados</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card className="border-emerald-600 ring-2 ring-emerald-600/20 shadow-lg relative">
              <CardHeader>
                <CardTitle className="text-2xl">Premium</CardTitle>
                <p className="text-muted-foreground text-sm">Para profissionais</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <span className="text-4xl font-bold">R$ 49,90</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>

                <Button
                  onClick={() => navigate(ctaPath)}
                  size="lg"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {user ? 'Acessar Área do Nutricionista' : 'Começar Premium'} <ChevronRight className="w-4 h-4 ml-2" />
                </Button>

                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="font-medium">Pacientes ilimitados</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="font-medium">Acompanhamento completo</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="font-medium">Planos ilimitados</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="font-medium">Agendamento profissional</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="font-medium">Relatórios avançados</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold">
              O que <span className="text-emerald-600">Nossos Usuários</span> Dizem
            </h2>
            <p className="text-xl text-muted-foreground">Histórias reais de sucesso e transformação</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              {
                text: 'Nutrir transformou minha prática. Gerencio 3 pacientes facilmente, acompanho progresso em tempo real e os resultados são muito melhores. A ferramenta é intuitiva e economiza horas do meu tempo.',
                author: 'Dra. Maria Silva',
                role: 'Nutricionista Clínica',
              },
              {
                text: 'Como paciente, a experiência é incrível. Vejo meu progresso, recebo feedback rápido e tenho um plano que faz sentido. Já perdi 15kg em 4 meses com a orientação certa.',
                author: 'João Santos',
                role: 'Paciente Premium',
              },
            ].map((testimonial, i) => (
              <Card key={i} className="border-emerald-600/20 bg-muted/30">
                <CardContent className="space-y-4 pt-6">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, j) => (
                      <span key={j} className="text-yellow-400">★</span>
                    ))}
                  </div>
                  <p className="text-foreground leading-relaxed">"{testimonial.text}"</p>
                  <div>
                    <p className="font-semibold">{testimonial.author}</p>
                    <p className="text-muted-foreground text-sm">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-emerald-600 text-white">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-4xl sm:text-5xl font-bold">
            Pronto para Transformar Sua Prática?
          </h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">
            Junte-se a centenas de nutricionistas que já estão usando Nutrir para crescer e impactar mais pacientes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Button
              onClick={() => navigate(ctaPath)}
              variant="secondary"
              size="lg"
              className="text-base"
            >
              {ctaLabel} <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-base bg-white/10 border-white/20 hover:bg-white/20 text-white"
              onClick={() => window.location.href = 'mailto:contato@nutrir.app'}
            >
              Falar com Equipe
            </Button>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
