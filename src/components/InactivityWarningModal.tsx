import React, { useEffect, useState } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';

const COUNTDOWN_SECONDS = 60;

export function InactivityWarningModal() {
  const { showInactivityWarning, dismissInactivityWarning, confirmSignOut } = useAuth();
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!showInactivityWarning) {
      setCountdown(COUNTDOWN_SECONDS);
      return;
    }

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          confirmSignOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showInactivityWarning]);

  if (!showInactivityWarning) return null;

  const progress = (countdown / COUNTDOWN_SECONDS) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-8 space-y-6 animate-in fade-in zoom-in-96 duration-220 ease-out">

        {/* Ícone + título */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Sessão por encerrar</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Você está inativo há 2 horas. Por segurança, sua sessão será encerrada automaticamente.
            </p>
          </div>
        </div>

        {/* Countdown visual */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Encerrando em</span>
            <span className={`font-bold tabular-nums text-lg ${countdown <= 10 ? 'text-destructive' : 'text-foreground'}`}>
              {countdown}s
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                countdown <= 10 ? 'bg-destructive' : 'bg-primary'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={dismissInactivityWarning}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
          >
            Continuar conectado
          </Button>
          <Button
            onClick={confirmSignOut}
            variant="outline"
            className="flex-1 h-11 gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
          >
            <LogOut className="w-4 h-4" />
            Sair agora
          </Button>
        </div>

      </div>
    </div>
  );
}
