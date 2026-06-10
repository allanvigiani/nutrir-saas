import React, { Suspense } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { PageLoader } from './PageLoader';
import { TooltipProvider } from './ui/tooltip';
import { SupportWidget } from './SupportWidget';
import { MobileHeader } from './MobileHeader';
import { BottomNav } from './BottomNav';

export const Layout = () => {
  const { user, loading, nutritionist } = useAuth();

  if (loading) {
    return <PageLoader message="Carregando..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background overflow-hidden text-foreground">
        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <MobileHeader />
          <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<PageLoader message="Carregando página..." />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>
        <BottomNav />
      </div>
      <SupportWidget context="app" userName={nutritionist?.name} />
    </TooltipProvider>
  );
};
