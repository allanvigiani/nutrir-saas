import { LandingNavbar } from '../components/LandingNavbar';
import { LandingFooter } from '../components/LandingFooter';

export function Privacidade() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Política de Privacidade</h1>
            <p className="text-muted-foreground text-sm">Última atualização: maio de 2026</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Informações que Coletamos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Coletamos informações que você nos fornece diretamente ao criar uma conta, como nome, e-mail, CRN, CPF ou CNPJ e telefone. Também coletamos dados de uso da plataforma para melhorar a experiência.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Como Usamos suas Informações</h2>
            <p className="text-muted-foreground leading-relaxed">
              Utilizamos seus dados para fornecer, manter e melhorar nossos serviços; enviar comunicações relevantes sobre sua conta; garantir a segurança da plataforma; e cumprir obrigações legais.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. Compartilhamento de Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Não vendemos nem alugamos seus dados pessoais. Podemos compartilhá-los com prestadores de serviço essenciais (como processadores de pagamento) que operam sob estritos acordos de confidencialidade.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">4. Segurança dos Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Adotamos medidas técnicas e organizacionais adequadas para proteger suas informações contra acesso não autorizado, alteração, divulgação ou destruição.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">5. Seus Direitos (LGPD)</h2>
            <p className="text-muted-foreground leading-relaxed">
              Em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a: acessar, corrigir ou excluir seus dados; revogar consentimentos; e solicitar portabilidade. Entre em contato via <a href="mailto:privacidade@nutrir.app" className="text-emerald-600 hover:underline">privacidade@nutrir.app</a>.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">6. Contato</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para dúvidas sobre esta política, entre em contato com nosso Encarregado de Proteção de Dados (DPO) em <a href="mailto:privacidade@nutrir.app" className="text-emerald-600 hover:underline">privacidade@nutrir.app</a>.
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
