import React, { Suspense } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { PageLoader } from './PageLoader';
import { TooltipProvider } from './ui/tooltip';

export const Layout = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader message="Carregando..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background overflow-hidden text-foreground">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <Suspense fallback={<PageLoader message="Carregando página..." />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
};
