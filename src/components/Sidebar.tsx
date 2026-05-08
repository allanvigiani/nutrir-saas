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
  Menu
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { remoteLogger } from '../lib/remote-logger';
import { useAuth } from '../contexts/AuthContext';
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
    className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
      active 
        ? "bg-primary/10 text-primary" 
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    )}
  >
    <Icon className="w-5 h-5 shrink-0" />
    {!collapsed && <span className="font-medium">{label}</span>}
  </Link>
);

export const Sidebar = () => {
  const [collapsed, setCollapsed] = React.useState(false);
  const location = useLocation();
  const { user, nutritionist } = useAuth();

  const handleLogout = () => {
    if (auth.currentUser) {
      remoteLogger.info("Logout realizado", { userId: auth.currentUser.uid, email: auth.currentUser.email });
    }
    signOut(auth);
  };

  const navItems = [];

  // Itens do Nutricionista
  if (nutritionist) {
    navItems.push(
      { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
      { icon: Users, label: 'Pacientes', to: '/patients' },
      { icon: Calendar, label: 'Agenda', to: '/schedule' },
      { icon: DollarSign, label: 'Financeiro', to: '/financial' },
      ...(nutritionist?.role === 'admin' ? [{ icon: ShieldCheck, label: 'Admin', to: '/admin' }] : []),
      { icon: Settings, label: 'Configurações', to: '/settings' },
    );
  }

  const userName = nutritionist?.name || user?.displayName || 'Usuário';
  const userEmail = nutritionist?.email || user?.email || '';

  return (
    <aside 
      className={cn(
        "flex flex-col h-screen bg-card border-r border-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="p-4 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">N</span>
            </div>
            <span className="font-bold text-xl text-card-foreground">Nutrir</span>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => (
          <SidebarItem 
            key={item.to}
            icon={item.icon}
            label={item.label}
            to={item.to}
            collapsed={collapsed}
            active={location.pathname === item.to}
          />
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        {!collapsed && (
          <div className="mb-4 px-2">
            <p className="text-sm font-semibold text-card-foreground truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {!collapsed && (
             <div className="flex items-center justify-between px-2 mb-2">
               <span className="text-sm font-medium text-muted-foreground">Tema</span>
               <ModeToggle />
             </div>
          )}
          {collapsed && (
             <div className="flex justify-center mb-2">
               <ModeToggle />
             </div>
          )}
          <Button 
            variant="ghost" 
            className={cn("w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10", collapsed && "px-2")}
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="ml-3 font-medium">Sair</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
};
