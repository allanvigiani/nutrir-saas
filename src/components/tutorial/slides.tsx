import React from 'react';

export interface TutorialSlideData {
  id: number;
  icon: string;
  title: string;
  description: string;
  accentClass?: string; // substitui bg-primary quando definido
  Preview: React.FC;
}

// ─── Componentes de preview (mockup simplificado de cada módulo) ──────────────

function WelcomePreview() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-foreground">
      <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-4xl">🌿</div>
      <div className="text-center space-y-1">
        <div className="h-3 w-32 bg-foreground/20 rounded-full mx-auto" />
        <div className="h-2 w-48 bg-foreground/10 rounded-full mx-auto" />
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="p-4 space-y-3 h-full">
      <div className="grid grid-cols-3 gap-2">
        {['Pacientes', 'Consultas', 'Hoje'].map((label) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3">
            <div className="h-2 w-12 bg-primary/30 rounded-full mb-2" />
            <div className="text-lg font-bold text-foreground">—</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-3 space-y-2">
        <div className="h-2 w-24 bg-muted rounded-full" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className="w-6 h-6 rounded-full bg-muted" />
            <div className="h-2 flex-1 bg-muted rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PatientsPreview() {
  return (
    <div className="p-4 space-y-3 h-full">
      <div className="flex gap-2">
        <div className="flex-1 h-9 bg-card border border-border rounded-lg" />
        <div className="w-24 h-9 bg-primary/20 rounded-lg" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-2 w-32 bg-foreground/20 rounded-full" />
              <div className="h-2 w-20 bg-muted rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonalDataPreview() {
  return (
    <div className="p-4 space-y-3 h-full">
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-2 w-16 bg-muted rounded-full" />
            <div className="h-9 bg-card border border-border rounded-lg" />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <div className="h-2 w-20 bg-muted rounded-full" />
        <div className="h-16 bg-card border border-border rounded-lg" />
      </div>
    </div>
  );
}

function ConsultationsPreview() {
  return (
    <div className="p-4 space-y-2 h-full">
      <div className="flex justify-between items-center mb-2">
        <div className="h-3 w-28 bg-foreground/20 rounded-full" />
        <div className="w-24 h-8 bg-primary/20 rounded-lg" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-3">
          <div className="flex justify-between mb-2">
            <div className="h-2 w-24 bg-foreground/20 rounded-full" />
            <div className="h-2 w-16 bg-muted rounded-full" />
          </div>
          <div className="h-2 w-full bg-muted rounded-full" />
        </div>
      ))}
    </div>
  );
}

function MealPlansPreview() {
  return (
    <div className="p-4 space-y-2 h-full">
      <div className="grid grid-cols-2 gap-2">
        {['Café da Manhã', 'Almoço', 'Lanche', 'Jantar'].map((r) => (
          <div key={r} className="bg-card border border-border rounded-xl p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">{r}</div>
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-2 items-center">
                <div className="w-4 h-4 rounded bg-muted" />
                <div className="h-2 flex-1 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExamsPreview() {
  return (
    <div className="p-4 space-y-2 h-full">
      <div className="flex gap-2 mb-3">
        <div className="flex-1 h-8 bg-card border border-border rounded-lg" />
        <div className="w-20 h-8 bg-primary/20 rounded-lg" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-3 flex justify-between items-center">
          <div className="space-y-1">
            <div className="h-2 w-28 bg-foreground/20 rounded-full" />
            <div className="h-2 w-16 bg-muted rounded-full" />
          </div>
          <div className="h-6 w-16 bg-muted rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function EvolutionPreview() {
  return (
    <div className="p-4 h-full flex flex-col gap-3">
      <div className="flex gap-4">
        {['Peso atual', 'IMC', 'Meta'].map((l) => (
          <div key={l} className="flex-1 bg-card border border-border rounded-xl p-2 text-center">
            <div className="h-2 w-8 bg-muted rounded-full mx-auto mb-1" />
            <div className="h-3 w-12 bg-foreground/20 rounded-full mx-auto" />
            <div className="text-xs text-muted-foreground mt-1">{l}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 bg-card border border-border rounded-xl p-3 flex items-end gap-1">
        {[40, 55, 45, 65, 60, 70, 62, 75].map((h, i) => (
          <div key={i} className="flex-1 bg-primary/30 rounded-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

function SchedulePreview() {
  return (
    <div className="p-4 h-full space-y-2">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs text-muted-foreground">{d}</div>
        ))}
        {Array.from({ length: 14 }, (_, i) => (
          <div
            key={i}
            className={`h-8 rounded-lg text-xs flex items-center justify-center border border-border ${i === 3 ? 'bg-primary text-primary-foreground font-bold' : 'bg-card text-foreground'}`}
          >
            {i + 1}
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {['09:00', '10:30', '14:00'].map((h) => (
          <div key={h} className="bg-card border border-border rounded-lg p-2 flex gap-2 items-center">
            <div className="text-xs text-muted-foreground w-10">{h}</div>
            <div className="h-2 flex-1 bg-muted rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancialPreview() {
  return (
    <div className="p-4 space-y-3 h-full">
      <div className="grid grid-cols-2 gap-2">
        {['Receita do mês', 'A receber'].map((l) => (
          <div key={l} className="bg-card border border-border rounded-xl p-3">
            <div className="text-xs text-muted-foreground mb-1">{l}</div>
            <div className="h-5 w-20 bg-foreground/20 rounded-full" />
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-3 space-y-2">
        <div className="h-2 w-24 bg-muted rounded-full" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between items-center">
            <div className="h-2 w-28 bg-muted rounded-full" />
            <div className="h-2 w-16 bg-foreground/20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPreview() {
  return (
    <div className="p-4 space-y-3 h-full">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl">👤</div>
        <div className="space-y-2">
          <div className="h-3 w-32 bg-foreground/20 rounded-full" />
          <div className="h-2 w-24 bg-muted rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-2 w-16 bg-muted rounded-full" />
            <div className="h-9 bg-card border border-border rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomFoodsPreview() {
  return (
    <div className="p-4 space-y-3 h-full">
      <div className="flex gap-2">
        <div className="flex-1 h-9 bg-card border border-border rounded-lg" />
        <div className="w-32 h-9 bg-accent/40 rounded-lg" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3 flex justify-between items-center">
            <div className="space-y-1">
              <div className="h-2 w-28 bg-foreground/20 rounded-full" />
              <div className="h-2 w-20 bg-muted rounded-full" />
            </div>
            <div className="flex gap-1">
              <div className="w-7 h-7 rounded-lg bg-muted" />
              <div className="w-7 h-7 rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Array de slides ──────────────────────────────────────────────────────────

export const TUTORIAL_SLIDES: TutorialSlideData[] = [
  {
    id: 1,
    icon: '🌿',
    title: 'Bem-vindo ao Nutrir!',
    description: 'Vamos conhecer rapidamente o sistema em 12 passos. Você pode pular a qualquer momento.',
    accentClass: 'bg-accent text-accent-foreground',
    Preview: WelcomePreview,
  },
  {
    id: 2,
    icon: '📊',
    title: 'Dashboard',
    description: 'Tela inicial com resumo completo: pacientes ativos, consultas do mês, agenda do dia e últimos prontuários acessados.',
    Preview: DashboardPreview,
  },
  {
    id: 3,
    icon: '👥',
    title: 'Pacientes',
    description: 'Cadastre, busque e organize todos os seus pacientes em um só lugar.',
    Preview: PatientsPreview,
  },
  {
    id: 4,
    icon: '📋',
    title: 'Prontuário — Dados Pessoais',
    description: 'Dados pessoais e antropométricos: peso, altura, histórico clínico e informações de contato do paciente.',
    Preview: PersonalDataPreview,
  },
  {
    id: 5,
    icon: '🩺',
    title: 'Prontuário — Consultas',
    description: 'Registre cada consulta com anotações clínicas, peso aferido e observações de evolução.',
    Preview: ConsultationsPreview,
  },
  {
    id: 6,
    icon: '🥗',
    title: 'Prontuário — Planos Alimentares',
    description: 'Monte planos alimentares completos com cálculo automático de macronutrientes e calorias.',
    Preview: MealPlansPreview,
  },
  {
    id: 7,
    icon: '🔬',
    title: 'Prontuário — Exames',
    description: 'Anexe e organize resultados de exames laboratoriais por data para acompanhamento longitudinal.',
    Preview: ExamsPreview,
  },
  {
    id: 8,
    icon: '📈',
    title: 'Prontuário — Evolução',
    description: 'Acompanhe a evolução de peso, medidas corporais e composição em gráficos ao longo do tempo.',
    Preview: EvolutionPreview,
  },
  {
    id: 9,
    icon: '📅',
    title: 'Agenda',
    description: 'Marque consultas, configure seus horários disponíveis e integre com o Google Calendar.',
    Preview: SchedulePreview,
  },
  {
    id: 10,
    icon: '💰',
    title: 'Financeiro',
    description: 'Acompanhe sua receita mensal, visualize recebimentos pendentes e gere relatórios financeiros.',
    Preview: FinancialPreview,
  },
  {
    id: 11,
    icon: '⚙️',
    title: 'Configurações',
    description: 'Edite seu perfil profissional, gerencie sua assinatura e personalize as preferências do sistema.',
    Preview: SettingsPreview,
  },
  {
    id: 12,
    icon: '🥦',
    title: 'Alimentos Próprios',
    description: 'Cadastre alimentos personalizados não presentes na base TACO/IBGE para usar nos planos alimentares.',
    accentClass: 'bg-accent text-accent-foreground',
    Preview: CustomFoodsPreview,
  },
];

export const TOTAL_SLIDES = TUTORIAL_SLIDES.length; // 12
