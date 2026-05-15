import { Cookie } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { useCookieConsent } from '../contexts/CookieConsentContext';

export function CookieConsentBanner() {
  const { consent, acceptAll, acceptEssentialOnly } = useCookieConsent();

  if (consent !== null) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Cookie className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Usamos cookies essenciais para o funcionamento do sistema e, com sua permissão,
            cookies analíticos para melhorar o serviço. Veja nossa{' '}
            <Link to="/cookies" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
              Política de Cookies
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={acceptEssentialOnly}
            className="flex-1 sm:flex-none rounded-lg text-xs h-8"
          >
            Somente Essenciais
          </Button>
          <Button
            size="sm"
            onClick={acceptAll}
            className="flex-1 sm:flex-none rounded-lg text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Aceitar Todos
          </Button>
        </div>
      </div>
    </div>
  );
}
