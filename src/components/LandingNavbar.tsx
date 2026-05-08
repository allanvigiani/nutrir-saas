import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Moon, Sun, ChevronDown, LayoutDashboard, LogOut, User } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

export function LandingNavbar() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, nutritionist } = useAuth();

  const displayName = nutritionist?.name || user?.displayName || user?.email || 'Usuário';
  const firstName = displayName.split(' ')[0];

  const handleLogout = () => {
    signOut(auth).then(() => navigate('/'));
  };

  return (
    <nav className="fixed top-0 w-full bg-background/95 backdrop-blur border-b z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="font-bold text-xl">Nutrir</span>
          </button>

          <div className="hidden md:flex items-center gap-8">
            <a href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition">
              Funcionalidades
            </a>
            <a href="/#pricing" className="text-sm text-muted-foreground hover:text-foreground transition">
              Preços
            </a>
            <a href="/#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition">
              Depoimentos
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={`Ativar modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" className="flex items-center gap-2 text-sm font-medium">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{firstName.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="hidden sm:inline">{firstName}</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </Button>
                } />
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/dashboard')} className="cursor-pointer gap-2">
                    <LayoutDashboard className="w-4 h-4 text-emerald-600" />
                    Área do Nutricionista
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer gap-2 text-red-500 focus:text-red-500">
                    <LogOut className="w-4 h-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/login')} className="hidden sm:inline-flex text-sm">
                  Entrar
                </Button>
                <Button
                  onClick={() => navigate('/register')}
                  className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <span className="hidden sm:inline">Começar Grátis</span>
                  <span className="sm:hidden">Grátis</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
