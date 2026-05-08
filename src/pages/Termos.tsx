import { LandingNavbar } from '../components/LandingNavbar';
import { LandingFooter } from '../components/LandingFooter';

export function Termos() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Termos de Uso</h1>
            <p className="text-muted-foreground text-sm">Última atualização: maio de 2026</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ao acessar ou usar o Nutrir, você concorda com estes Termos de Uso. Se não concordar, não utilize a plataforma. O uso continuado após alterações implica aceitação dos novos termos.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground leading-relaxed">
              O Nutrir é uma plataforma SaaS de gestão nutricional destinada a nutricionistas registrados e seus pacientes. A plataforma facilita o acompanhamento de consultas, planos alimentares e evolução clínica.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. Responsabilidades do Usuário</h2>
            <p className="text-muted-foreground leading-relaxed">
              Você é responsável por manter a confidencialidade de sua conta e senha; fornecer informações verídicas; usar o serviço de acordo com as leis aplicáveis e o Código de Ética do nutricionista (CFN).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">4. Planos e Pagamentos</h2>
            <p className="text-muted-foreground leading-relaxed">
              O plano Gratuito é oferecido sem custo com recursos limitados. O plano Premium é cobrado mensalmente no valor vigente no momento da assinatura. Cancelamentos têm efeito ao final do período pago.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">5. Propriedade Intelectual</h2>
            <p className="text-muted-foreground leading-relaxed">
              Todo o conteúdo da plataforma, incluindo software, design e marca, é propriedade do Nutrir ou de seus licenciadores. Os dados inseridos pelos usuários permanecem de propriedade dos próprios usuários.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">6. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground leading-relaxed">
              O Nutrir é uma ferramenta de apoio e não substitui o julgamento clínico profissional. Não nos responsabilizamos por decisões tomadas com base exclusiva nas informações da plataforma.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">7. Foro</h2>
            <p className="text-muted-foreground leading-relaxed">
              Estes termos são regidos pelas leis brasileiras. Eventuais disputas serão resolvidas no foro da comarca de São Paulo – SP, Brasil.
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
