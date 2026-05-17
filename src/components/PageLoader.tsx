import React from 'react';

interface PageLoaderProps {
  message?: string;
}

export const PageLoader = ({ message }: PageLoaderProps) => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    {message && <p className="text-sm text-muted-foreground">{message}</p>}
  </div>
);
