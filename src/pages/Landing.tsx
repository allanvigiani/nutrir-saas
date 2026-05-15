import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import {
  TrendingUp,
  UtensilsCrossed,
  MessageSquare,
  Calendar,
  Target,
  Smartphone,
  ChevronRight,
  CheckCircle2,
  Users,
  BarChart3,
  Leaf,
  ArrowRight,
  Star,
  Zap,
  Shield,
  Clock,
  LayoutDashboard,
  DollarSign,
  Settings,
  Edit,
  CheckCircle,
  CalendarCheck,
  RefreshCw,
  Bell,
} from 'lucide-react';
import { LandingNavbar } from '../components/LandingNavbar';
import { LandingFooter } from '../components/LandingFooter';

export function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ctaLabel = user ? 'Acessar Plataforma' : 'Começar Grátis';
  const ctaPath = user ? '/dashboard' : '/register';

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <LandingNavbar />

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-24 px-4 sm:px-6 lg:px-8">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-background to-background pointer-events-none" />

        <div className="relative max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left — copy */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-semibold border border-primary/20">
                <Leaf className="w-3.5 h-3.5" />
                Plataforma de Nutrição #1 do Brasil
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl sm:text-6xl lg:text-6xl font-bold leading-[1.08] tracking-tight">
                  Resultados reais<br />
                  para seus{' '}
                  <span className="relative">
                    <span className="text-primary">pacientes</span>
                    <svg className="absolute -bottom-1 left-0 w-full" height="6" viewBox="0 0 200 6" fill="none">
                      <path d="M0 5 Q50 1 100 4 Q150 7 200 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-primary/40"/>
                    </svg>
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
                  Gerencie consultas, acompanhe evolução e crie planos alimentares personalizados — tudo em um só lugar.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={() => navigate(ctaPath)}
                  className="h-12 px-7 text-base bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/25 transition-all active:scale-[0.98]"
                >
                  {ctaLabel} <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                  className="h-12 px-7 text-base"
                >
                  Ver planos
                </Button>
              </div>

              {/* Trust signals */}
              <div className="flex items-center gap-6 pt-2">
                <div className="flex items-center gap-1.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="text-sm font-medium ml-1">4.9</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground">100+</strong> nutricionistas ativos
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground">10k+</strong> pacientes
                </div>
              </div>
            </div>

            {/* Right — fiel ao app real */}
            <div className="hidden lg:block relative">
              {/* Browser chrome wrapper */}
              <div className="relative bg-card rounded-2xl border border-border shadow-2xl shadow-black/10 overflow-hidden">

                {/* Browser bar */}
                <div className="bg-muted/60 px-4 py-2.5 flex items-center gap-3 border-b border-border">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-primary/40" />
                  </div>
                  <div className="flex-1 bg-background rounded h-4 max-w-[200px] flex items-center px-2.5 border border-border">
                    <span className="text-[9px] text-muted-foreground">www.nutrir.app</span>
                  </div>
                </div>

                {/* App layout — sidebar + content */}
                <div className="flex h-[340px]">

                  {/* Sidebar real */}
                  <div className="w-[130px] bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
                    {/* Logo */}
                    <div className="flex items-center gap-2 px-3 py-3 border-b border-sidebar-border">
                      <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center shrink-0">
                        <Leaf className="w-3 h-3 text-primary-foreground" />
                      </div>
                      <span className="font-bold text-[11px] text-sidebar-foreground tracking-tight">Nutrir</span>
                    </div>

                    {/* Nav items */}
                    <nav className="flex-1 px-2 py-2 space-y-0.5">
                      {[
                        { icon: LayoutDashboard, label: 'Dashboard', active: true },
                        { icon: Users, label: 'Pacientes', active: false },
                        { icon: Calendar, label: 'Agenda', active: false },
                        { icon: DollarSign, label: 'Financeiro', active: false },
                        { icon: Settings, label: 'Config.', active: false },
                      ].map(item => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.label}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-full text-[10px] font-medium transition-colors ${
                              item.active
                                ? 'bg-primary text-primary-foreground'
                                : 'text-sidebar-foreground/60 hover:bg-sidebar-accent'
                            }`}
                          >
                            <Icon className="w-3 h-3 shrink-0" />
                            <span>{item.label}</span>
                          </div>
                        );
                      })}
                    </nav>

                    {/* User footer */}
                    <div className="px-2 py-2 border-t border-sidebar-border">
                      <div className="flex items-center gap-1.5 px-1">
                        <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[8px] font-bold flex items-center justify-center shrink-0">A</div>
                        <div className="min-w-0">
                          <div className="text-[9px] font-semibold text-sidebar-foreground truncate">Dra. Ana Lima</div>
                          <div className="text-[8px] text-muted-foreground truncate">Premium</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dashboard content */}
                  <div className="flex-1 overflow-hidden bg-background">
                    <div className="p-4 space-y-3 h-full overflow-hidden">

                      {/* Page header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-[13px] font-bold">Olá, Ana 👋</h2>
                          <p className="text-[9px] text-muted-foreground">Sexta-feira, 9 de maio</p>
                        </div>
                        <div className="bg-primary text-primary-foreground text-[9px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" /> Novo Paciente
                        </div>
                      </div>

                      {/* StatCards — idênticos ao componente real */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Pacientes Ativos', value: '47', icon: Users, iconBg: 'bg-muted', iconColor: 'text-muted-foreground' },
                          { label: 'Consultas do Mês', value: '128', icon: TrendingUp, iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
                          { label: 'Agenda de Hoje', value: '6', icon: Calendar, iconBg: 'bg-amber-50', iconColor: 'text-amber-500' },
                        ].map(stat => {
                          const Icon = stat.icon;
                          return (
                            <div key={stat.label} className="bg-card rounded-xl border border-border p-2.5">
                              <div className="flex items-start justify-between mb-1.5">
                                <p className="text-[8px] text-muted-foreground font-medium leading-tight">{stat.label}</p>
                                <div className={`p-1 rounded-lg ${stat.iconBg}`}>
                                  <Icon className={`w-2.5 h-2.5 ${stat.iconColor}`} />
                                </div>
                              </div>
                              <div className="text-[18px] font-bold leading-none">{stat.value}</div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Two-column grid — Consultas + Pacientes */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Consultas de Hoje */}
                        <div className="bg-card rounded-xl border border-border p-2.5 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[9px] font-bold">Consultas de Hoje</span>
                          </div>
                          {[
                            { time: '09:00', name: 'Maria S.', status: 'realized' },
                            { time: '11:00', name: 'Carlos M.', status: 'confirmed' },
                            { time: '14:30', name: 'Lucia R.', status: 'pending' },
                          ].map(a => (
                            <div key={a.time} className="flex items-center gap-2 p-1.5 rounded-lg border border-border bg-background">
                              <div className="w-8 h-7 rounded-lg bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">{a.time}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-semibold truncate">{a.name}</p>
                                <p className={`text-[8px] font-medium ${a.status === 'realized' ? 'text-primary' : a.status === 'confirmed' ? 'text-blue-500' : 'text-amber-500'}`}>
                                  {a.status === 'realized' ? 'Realizada' : a.status === 'confirmed' ? 'Confirmada' : 'Pendente'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Novos Pacientes */}
                        <div className="bg-card rounded-xl border border-border p-2.5 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[9px] font-bold">Novos Pacientes</span>
                          </div>
                          {[
                            { name: 'Fernanda C.', date: '07/05' },
                            { name: 'Bruno A.', date: '05/05' },
                            { name: 'Patrícia O.', date: '02/05' },
                          ].map(p => (
                            <div key={p.name} className="flex items-center gap-2 p-1.5 rounded-lg border border-border bg-background">
                              <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-[8px] font-bold flex items-center justify-center shrink-0">
                                {p.name[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-semibold truncate">{p.name}</p>
                                <p className="text-[8px] text-muted-foreground">Desde {p.date}</p>
                              </div>
                              <Edit className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

              {/* Floating — consulta realizada */}
              <div className="absolute -top-4 -right-4 bg-card border border-border rounded-xl shadow-xl p-2.5 flex items-center gap-2 min-w-[160px]">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold leading-tight">Consulta realizada</div>
                  <div className="text-[9px] text-muted-foreground">Maria S. · agora</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Social proof bar ─────────────────────────────────────────────── */}
      <div className="border-y border-border bg-muted/30 py-8 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '100+', label: 'Nutricionistas' },
            { value: '2k+', label: 'Pacientes Ativos' },
            { value: '50k+', label: 'Consultas Realizadas' },
            { value: '95%', label: 'Taxa de Satisfação' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-foreground tracking-tight">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Features Bento ───────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-3 mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest">Funcionalidades</p>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Tudo que sua prática precisa
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              De nutricionistas para nutricionistas. Cada funcionalidade foi criada para resolver problemas reais do consultório.
            </p>
          </div>

          {/* Bento grid — row 1 */}
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            {/* Large card — 2/3 */}
            <div className="md:col-span-2 bg-card rounded-2xl border border-border p-8 hover:shadow-lg transition-all duration-300 group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/4 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-5">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Acompanhamento Inteligente</h3>
              <p className="text-muted-foreground leading-relaxed mb-6 max-w-md">
                Rastreie peso, medidas, bioimpedância e exames em tempo real. Gráficos automáticos que mostram a evolução do seu paciente sem esforço.
              </p>
              <div className="flex gap-3">
                {['Peso', 'IMC', 'Gordura', 'Massa Magra'].map(tag => (
                  <span key={tag} className="text-xs font-medium bg-muted text-muted-foreground rounded-full px-3 py-1">{tag}</span>
                ))}
              </div>
            </div>

            {/* Small card — 1/3 */}
            <div className="bg-primary rounded-2xl p-8 text-primary-foreground hover:shadow-lg transition-all duration-300 relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2 pointer-events-none" />
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-5">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">Planos Alimentares</h3>
              <p className="text-primary-foreground/80 leading-relaxed text-sm">
                Crie planos completos com macros calculados automaticamente e receitas integradas.
              </p>
            </div>
          </div>

          {/* Bento grid — row 2 */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Small card */}
            <div className="bg-card rounded-2xl border border-border p-8 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/40 rounded-xl flex items-center justify-center mb-5">
                <Calendar className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Agenda Profissional</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Agendamentos, lembretes automáticos e histórico completo de consultas integrado ao Google Calendar.
              </p>
            </div>

            {/* Large card — 2/3 */}
            <div className="md:col-span-2 bg-card rounded-2xl border border-border p-8 hover:shadow-lg transition-all duration-300 overflow-hidden relative">
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/3 rounded-full translate-x-[-30%] translate-y-[30%] pointer-events-none" />
              <div className="grid sm:grid-cols-2 gap-8 items-start">
                <div>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/40 rounded-xl flex items-center justify-center mb-5">
                    <BarChart3 className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Relatórios Avançados</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Relatórios completos de evolução em PDF. Compartilhe com o paciente com um clique.
                  </p>
                </div>
                <div>
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-5">
                    <MessageSquare className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Área do Paciente</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Acesso exclusivo onde o paciente acompanha plano, progresso e histórico de consultas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Google Calendar Integration ──────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/25">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left — mockup de evento no Google Calendar */}
            <div className="relative order-2 lg:order-1">
              {/* Card principal — evento sendo criado no Nutrir */}
              <div className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden">
                <div className="bg-muted/50 px-5 py-3 border-b border-border flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">Nutrir · Agendamento</span>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Nova consulta agendada</p>
                      <h3 className="font-bold text-base">Consulta — Maria S.</h3>
                      <p className="text-sm text-muted-foreground">Sexta, 16 de maio · 14h30 – 15h30</p>
                    </div>
                    <div className="bg-primary/10 rounded-xl p-2">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                  </div>

                  {/* Barra de progresso de sincronização */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Sincronizando com Google Calendar…</span>
                      <span className="text-primary font-semibold">100%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full w-full" />
                    </div>
                  </div>

                  {/* Checkboxes de quem recebeu */}
                  <div className="space-y-2">
                    {[
                      { label: 'Adicionado na sua agenda Google', done: true },
                      { label: 'Adicionado na agenda da paciente', done: true },
                      { label: 'Lembrete 1h antes enviado', done: true },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2.5 text-sm">
                        <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <CheckCircle className="w-3 h-3 text-primary" />
                        </div>
                        <span className="text-foreground">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating — evento no Google Calendar style */}
              <div className="absolute -bottom-6 -right-4 bg-white dark:bg-card border border-border rounded-xl shadow-xl p-3.5 w-56">
                <div className="flex items-center gap-2 mb-3">
                  {/* Google Calendar colored dots */}
                  <div className="flex gap-0.5">
                    <div className="w-2 h-2 rounded-sm bg-blue-500" />
                    <div className="w-2 h-2 rounded-sm bg-red-400" />
                    <div className="w-2 h-2 rounded-sm bg-amber-400" />
                    <div className="w-2 h-2 rounded-sm bg-primary" />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">Google Calendar</span>
                </div>
                <div className="bg-primary/10 border-l-2 border-primary rounded-r-lg px-2.5 py-2 space-y-0.5">
                  <p className="text-[10px] font-bold text-primary">Consulta — Maria S.</p>
                  <p className="text-[9px] text-muted-foreground">14:30 – 15:30 · via Nutrir</p>
                </div>
                <div className="mt-2 bg-muted/60 border-l-2 border-blue-400 rounded-r-lg px-2.5 py-2 space-y-0.5">
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Consulta — Dra. Ana Lima</p>
                  <p className="text-[9px] text-muted-foreground">14:30 · na agenda da paciente</p>
                </div>
              </div>
            </div>

            {/* Right — copy */}
            <div className="space-y-7 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-semibold border border-primary/20">
                <CalendarCheck className="w-3.5 h-3.5" />
                Integração Google Calendar
              </div>

              <div className="space-y-4">
                <h2 className="text-4xl font-bold tracking-tight leading-tight">
                  Agende uma vez.<br />
                  <span className="text-primary">Todos ficam informados.</span>
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Ao criar uma consulta no Nutrir, o horário é adicionado automaticamente na sua agenda e na do paciente no Google Calendar — sem copiar e colar, sem risco de esquecer.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    icon: CalendarCheck,
                    title: 'Sincronização automática',
                    desc: 'A consulta aparece instantaneamente nas duas agendas assim que você confirma o agendamento.',
                  },
                  {
                    icon: Bell,
                    title: 'Lembretes automáticos',
                    desc: 'O paciente recebe notificação 1 hora antes da consulta direto pelo Google Calendar.',
                  },
                  {
                    icon: RefreshCw,
                    title: 'Reagendamento sem esforço',
                    desc: 'Alterou o horário? As duas agendas atualizam sozinhas. Nenhum contato manual necessário.',
                  },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex gap-4">
                      <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm mb-0.5">{item.title}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/25">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-3 mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest">Como funciona</p>
            <h2 className="text-4xl font-bold tracking-tight">Comece em minutos</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-border" />

            {[
              { step: '01', icon: Users, title: 'Crie sua conta', desc: 'Cadastro gratuito em menos de 2 minutos, sem cartão de crédito.' },
              { step: '02', icon: Target, title: 'Adicione pacientes', desc: 'Importe ou cadastre seus pacientes com dados completos de saúde.' },
              { step: '03', icon: UtensilsCrossed, title: 'Monte planos', desc: 'Crie planos alimentares personalizados com cálculo automático de macros.' },
              { step: '04', icon: TrendingUp, title: 'Acompanhe evolução', desc: 'Veja os resultados em tempo real com gráficos e relatórios automáticos.' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="relative flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-card border border-border rounded-2xl flex items-center justify-center shadow-sm mb-5 relative z-10">
                    <Icon className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] font-bold text-primary bg-primary/10 rounded-full w-5 h-5 flex items-center justify-center -translate-y-1 z-20">
                    {i + 1}
                  </div>
                  <h3 className="font-bold text-base mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-3 mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest">Preços</p>
            <h2 className="text-4xl font-bold tracking-tight">Simples e transparente</h2>
            <p className="text-lg text-muted-foreground">Sem surpresas. Cancele quando quiser.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="bg-card rounded-2xl border border-border p-8 space-y-8">
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Gratuito</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold">R$0</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Para começar e explorar a plataforma.</p>
              </div>

              <Button
                onClick={() => navigate(ctaPath)}
                variant="outline"
                className="w-full h-11 font-semibold"
              >
                {user ? 'Acessar plataforma' : 'Cadastre-se'} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>

              <ul className="space-y-3">
                {[
                  'Até 2 pacientes ativos',
                  'Até 2 consultas por mês',
                  '1 plano alimentar por paciente',
                  '1 exame por paciente',
                  'Histórico dos últimos 3 meses',
                  'Área do paciente incluída',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
                {['Agenda profissional', 'Relatórios em PDF'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium */}
            <div className="relative bg-card rounded-2xl border-2 border-primary p-8 space-y-8 shadow-xl shadow-primary/8">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                  <Zap className="w-3 h-3" /> Mais Popular
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-primary mb-1">Premium</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold">R$39</span>
                  <span className="text-muted-foreground text-sm">,90/mês</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Para nutricionistas que querem crescer sem limites.</p>
              </div>

              <Button
                onClick={() => navigate(ctaPath)}
                className="w-full h-11 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
              >
                {user ? 'Acessar plataforma' : 'Começar Premium'} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>

              <ul className="space-y-3">
                {[
                  'Pacientes ilimitados',
                  'Acompanhamento completo',
                  'Planos alimentares ilimitados',
                  'Agenda profissional',
                  'Relatórios avançados em PDF',
                  'Integração Google Calendar',
                  'Suporte prioritário',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Guarantee */}
          <div className="mt-10 flex items-center justify-center gap-8 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span>Cancele a qualquer momento</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Sem fidelidade</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>Dados sempre seus</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────────────────────────────────── */}
      <section id="testimonials" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/25">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-3 mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest">Depoimentos</p>
            <h2 className="text-4xl font-bold tracking-tight">Quem usa, recomenda</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                text: 'Nutrir transformou minha prática clínica. Antes eu gastava horas com planilhas. Hoje em 10 minutos tenho o plano pronto e o paciente já recebe no celular. Minha agenda lotou em 3 meses.',
                author: 'Dra. Maria Silva',
                role: 'Nutricionista Clínica · São Paulo',
                initials: 'MS',
                rating: 5,
              },
              {
                text: 'Perdi 15kg em 4 meses com a orientação da minha nutricionista pelo Nutrir. Ver meu progresso ali, saber exatamente o que comer — isso mudou tudo. Nunca consegui me manter motivado antes.',
                author: 'João Santos',
                role: 'Paciente · Campinas',
                initials: 'JS',
                rating: 5,
              },
            ].map((t) => (
              <div key={t.author} className="bg-card rounded-2xl border border-border p-8 space-y-6 hover:shadow-md transition-shadow">
                <div className="flex gap-1">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-foreground leading-relaxed text-[15px]">
                  "{t.text}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{t.author}</div>
                    <div className="text-muted-foreground text-xs">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-primary rounded-3xl p-12 text-center overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-black/10 rounded-full pointer-events-none" />

            <div className="relative space-y-6">
              <div className="inline-flex items-center gap-2 bg-white/20 text-primary-foreground rounded-full px-4 py-1.5 text-sm font-semibold">
                <Leaf className="w-3.5 h-3.5" /> Comece hoje, grátis
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-primary-foreground leading-tight tracking-tight">
                Pronto para transformar<br />sua prática?
              </h2>
              <p className="text-primary-foreground/80 text-lg max-w-xl mx-auto">
                Junte-se a mais de 100 nutricionistas que já usam o Nutrir para crescer e impactar mais pacientes.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button
                  onClick={() => navigate(ctaPath)}
                  size="lg"
                  className="h-12 px-8 text-base font-semibold bg-white text-primary hover:bg-white/90 shadow-lg"
                >
                  {ctaLabel} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-8 text-base border-white/30 bg-white/10 hover:bg-white/20 text-primary-foreground"
                  onClick={() => window.location.href = 'mailto:contato@nutrir.app'}
                >
                  Falar com a equipe
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
