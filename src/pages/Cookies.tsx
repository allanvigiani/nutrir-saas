import { LandingNavbar } from '../components/LandingNavbar';
import { LandingFooter } from '../components/LandingFooter';

export function Cookies() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Política de Cookies</h1>
            <p className="text-muted-foreground text-sm">Última atualização: maio de 2026</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. O que são Cookies?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cookies são pequenos arquivos de texto armazenados no seu dispositivo quando você visita um site. Eles nos ajudam a lembrar suas preferências e melhorar sua experiência na plataforma.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Cookies que Utilizamos</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p><strong className="text-foreground">Essenciais:</strong> Necessários para o funcionamento básico da plataforma, como manter sua sessão autenticada. Não podem ser desativados.</p>
              <p><strong className="text-foreground">Funcionais:</strong> Recordam suas preferências, como tema (claro/escuro) e configurações de exibição.</p>
              <p><strong className="text-foreground">Analíticos:</strong> Coletam dados agregados e anônimos sobre como a plataforma é utilizada, para melhorar nossos serviços.</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. Cookies de Terceiros</h2>
            <p className="text-muted-foreground leading-relaxed">
              Utilizamos serviços de terceiros como Firebase (autenticação e banco de dados) que podem definir seus próprios cookies. Esses serviços possuem suas próprias políticas de privacidade.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">4. Gerenciar Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Você pode controlar e/ou excluir cookies pelas configurações do seu navegador. Desativar cookies essenciais pode impedir o funcionamento correto da plataforma.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">5. Contato</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para dúvidas sobre nossa política de cookies, entre em contato em <a href="mailto:privacidade@nutrir.app" className="text-emerald-600 hover:underline">privacidade@nutrir.app</a>.
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
