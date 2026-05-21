import { useNavigate } from 'react-router-dom';
import { useCookieConsent } from '../contexts/CookieConsentContext';

export function LandingFooter() {
  const navigate = useNavigate();
  const { resetConsent } = useCookieConsent();

  return (
    <footer className="border-t bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">N</span>
              </div>
              <span className="font-bold">Nutrir</span>
            </div>
            <p className="text-sm text-muted-foreground">Transformando a nutrição em resultados desde 2025.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Produto</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/#features" className="hover:text-foreground transition">Funcionalidades</a></li>
              <li><a href="/#pricing" className="hover:text-foreground transition">Preços</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Empresa</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition">Sobre</a></li>
              <li>
                <button onClick={() => navigate('/contato')} className="hover:text-foreground transition text-left">
                  Contato
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <button onClick={() => navigate('/privacidade')} className="hover:text-foreground transition text-left">
                  Privacidade
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/termos')} className="hover:text-foreground transition text-left">
                  Termos
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/cookies')} className="hover:text-foreground transition text-left">
                  Cookies
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t pt-8 flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>&copy; 2026 Nutrir. Todos os direitos reservados.</p>
          <div className="flex gap-6 mt-4 sm:mt-0">
            <a href="#" className="hover:text-foreground transition">Twitter</a>
            <a href="#" className="hover:text-foreground transition">LinkedIn</a>
            <a href="#" className="hover:text-foreground transition">Instagram</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
