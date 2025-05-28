// Using React client component
'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorSuppressor } from '@/components/ErrorSuppressor';
import { AppWalletProvider } from '@/contexts/WalletContext';

interface ClientOnlyRootProps {
  children: ReactNode;
}

export default function ClientOnlyRoot({ children }: ClientOnlyRootProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    console.log('🚀 ClientOnlyRoot useEffect FIRED!');
    // Use a small delay to ensure proper hydration
    const timer = setTimeout(() => {
      setIsClient(true);
      console.log('✅ ClientOnlyRoot isClient set to true');
    }, 10);
    
    return () => clearTimeout(timer);
  }, []);

  console.log('🔄 ClientOnlyRoot render, isClient:', isClient, 'window exists:', typeof window !== 'undefined');

  // Render a minimal fallback during SSR and initial client render
  if (!isClient) {
    return (
      <main className='container mx-auto px-4 py-8'>
        <div className="text-center">
          <div>Loading wallet and blockchain components...</div>
          <div className="mt-2 text-sm text-gray-600">Initializing client...</div>
        </div>
      </main>
    );
  }

  console.log('🎯 ClientOnlyRoot rendering full app with wallet provider');

  return (
    <ErrorBoundary>
      <ErrorSuppressor />
      <AppWalletProvider>
        {children}
      </AppWalletProvider>
    </ErrorBoundary>
  );
}
