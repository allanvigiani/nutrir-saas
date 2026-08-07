import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Leaf,
  BookOpen,
  ArrowRightLeft,
  Lock,
  ChefHat,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { PageLoader } from './PageLoader';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { remoteLogger } from '../lib/remote-logger';
import { useAuth } from '../contexts/AuthContext';
import { useTutorial } from '../contexts/TutorialContext';
import { ModeToggle } from './mode-toggle';

const SidebarItem = ({
  icon: Icon,
  label,
  to,
  collapsed,
  active
}: any) => (
  <Link
    to={to}
    title={collapsed ? label : undefined}
    className={cn(
      "flex items-center gap-3 px-3 py-2.5 transition-all duration-200 group",
      active
        ? "bg-primary text-primary-foreground shadow-sm rounded-lg"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg"
    )}
  >
    <Icon className={cn("w-4.5 h-4.5 shrink-0", collapsed && "w-5 h-5")} />
    {!collapsed && <span className="font-medium text-sm">{label}</span>}
  </Link>
);

const SidebarItemLocked = ({
  icon: Icon,
  label,
  collapsed,
}: { icon: React.ElementType; label: string; collapsed: boolean }) => (
  <TooltipProvider delay={200}>
    <Tooltip>
      <TooltipTrigger
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2.5 rounded-lg cursor-not-allowed opacity-50 select-none",
          "text-muted-foreground"
        )}
      >
        <Icon className={cn("w-4.5 h-4.5 shrink-0", collapsed && "w-5 h-5")} />
        {!collapsed && (
          <span className="font-medium text-sm flex-1 text-left">{label}</span>
        )}
        {!collapsed && <Lock className="w-3 h-3 shrink-0" />}
      </TooltipTrigger>
      <TooltipContent side="right">
        Em Breve
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const Sidebar = () => {
  const [collapsed, setCollapsed] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const location = useLocation();
  const { user, nutritionist } = useAuth();
  const { openTutorial } = useTutorial();

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    if (auth.currentUser) {
      remoteLogger.info("Logout realizado", { userId: auth.currentUser.uid, email: auth.currentUser.email });
    }
    await signOut(auth);
  };

  const navItems = [];

  // Itens do Nutricionista
  if (nutritionist) {
    navItems.push(
      { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
      { icon: Users, label: 'Pacientes', to: '/patients' },
      { icon: Calendar, label: 'Agenda', to: '/schedule' },
      { icon: DollarSign, label: 'Financeiro', to: '/financial' },
      { icon: ChefHat, label: 'Receitas', to: '/recipes' },
      ...(nutritionist?.role === 'admin' ? [{ icon: ShieldCheck, label: 'Admin', to: '/admin' }] : []),
      { icon: Settings, label: 'Configurações', to: '/settings' },
    );
  }

  const lockedNavItems = nutritionist ? [
    { icon: ArrowRightLeft, label: 'Migração' },
  ] : [];

  const userName = nutritionist?.name || user?.displayName || 'Usuário';
  const userEmail = nutritionist?.email || user?.email || '';

  return (
    <>
    {loggingOut && <PageLoader message="Saindo..." />}
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center border-b border-sidebar-border", collapsed ? "p-3 justify-center" : "px-5 py-4 gap-3")}>
        {!collapsed && (
          <>
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-sm shadow-primary/30 shrink-0">
              <Leaf className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-sidebar-foreground tracking-tight">Nutrir</span>
          </>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-sm shadow-primary/30">
            <Leaf className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto w-7 h-7 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
      </div>

      {collapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="mx-auto mt-2 w-7 h-7 text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <SidebarItem
            key={item.to}
            icon={item.icon}
            label={item.label}
            to={item.to}
            collapsed={collapsed}
            active={location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(item.to + '/'))}
          />
        ))}
        {lockedNavItems.map((item) => (
          <SidebarItemLocked
            key={item.label}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Tutorial */}
      <div className={cn("px-3 pb-2")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          title="Ver tutorial"
          onClick={openTutorial}
          className={cn(
            "w-full text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed ? "justify-center" : "justify-start gap-2"
          )}
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="font-medium text-sm">Tutorial</span>}
        </Button>
      </div>

      {/* Footer */}
      <div className={cn("border-t border-sidebar-border", collapsed ? "p-3" : "px-4 py-4")}>
        {!collapsed && (
          <div className="mb-3 px-1">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
        )}
        <div className={cn("flex gap-2", collapsed ? "flex-col items-center" : "items-center justify-between")}>
          <ModeToggle />
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            disabled={loggingOut}
            className={cn(
              "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
              !collapsed && "flex-1 justify-start gap-2"
            )}
            onClick={handleLogout}
          >
            {loggingOut
              ? <span className="w-4 h-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              : <LogOut className="w-4 h-4 shrink-0" />
            }
            {!collapsed && (
              <span className="font-medium text-sm">
                {loggingOut ? 'Saindo...' : 'Sair'}
              </span>
            )}
          </Button>
        </div>
      </div>
    </aside>
    </>
  );
};
