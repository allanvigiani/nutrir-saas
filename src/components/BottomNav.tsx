import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, DollarSign, Settings, ShieldCheck, ChefHat } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

const baseNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: Users, label: 'Pacientes', to: '/patients' },
  { icon: Calendar, label: 'Agenda', to: '/schedule' },
  { icon: DollarSign, label: 'Financeiro', to: '/financial' },
  { icon: ChefHat, label: 'Receitas', to: '/recipes' },
  { icon: Settings, label: 'Config', to: '/settings' },
];

export const BottomNav = () => {
  const location = useLocation();
  const { nutritionist } = useAuth();

  if (!nutritionist) return null;

  const navItems = [
    ...baseNavItems,
    ...(nutritionist.role === 'admin'
      ? [{ icon: ShieldCheck, label: 'Admin', to: '/admin' }]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden h-16 bg-sidebar border-t border-sidebar-border overflow-x-auto scrollbar-none">
      {navItems.map((item) => {
        const isActive =
          location.pathname === item.to ||
          (item.to !== '/dashboard' && location.pathname.startsWith(item.to + '/'));
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex shrink-0 flex-col items-center justify-center gap-0.5 transition-colors px-4 min-w-[64px] flex-1',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <item.icon className={cn('w-5 h-5', isActive && 'fill-primary/10')} />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
