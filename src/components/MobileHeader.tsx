import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Settings, LogOut } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { remoteLogger } from '../lib/remote-logger';
import { useAuth } from '../contexts/AuthContext';
import { ModeToggle } from './mode-toggle';
import { PageLoader } from './PageLoader';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export const MobileHeader = () => {
  const { user, nutritionist } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    if (auth.currentUser) {
      remoteLogger.info("Logout realizado", { userId: auth.currentUser.uid, email: auth.currentUser.email });
    }
    try {
      await signOut(auth);
    } finally {
      setLoggingOut(false);
    }
  };

  const userName = nutritionist?.name || user?.displayName || 'Usuário';
  const userEmail = nutritionist?.email || user?.email || '';
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
    {loggingOut && <PageLoader message="Saindo..." />}
    <header className="flex md:hidden items-center justify-between px-4 h-14 bg-sidebar border-b border-sidebar-border sticky top-0 z-40 shrink-0">
      <Link to="/dashboard" className="flex items-center gap-2">
        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-sm shadow-primary/30">
          <Leaf className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
        <span className="font-bold text-base text-sidebar-foreground tracking-tight">Nutrir</span>
      </Link>

      <div className="flex items-center gap-1">
        <ModeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted focus-visible:outline-none"
            aria-label="Menu do usuário"
          >
            <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs">
              {initials}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              <p className="text-sm font-semibold truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate('/settings')}
              className="cursor-pointer flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={loggingOut}
              className="cursor-pointer gap-2"
              variant="destructive"
            >
              <LogOut className="w-4 h-4" />
              {loggingOut ? 'Saindo...' : 'Sair'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    </>
  );
};
