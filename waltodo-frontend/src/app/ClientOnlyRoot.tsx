// Using React client component
'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorSuppressor } from '@/components/ErrorSuppressor';
import { AppWalletProvider } from '@/contexts/WalletContext';
import { initializeSuiClientWithConfig } from '@/lib/sui-client';

interface ClientOnlyRootProps {
  children: ReactNode;
}

export default function ClientOnlyRoot({ children }: ClientOnlyRootProps) {
  const [isClient, setIsClient] = useState(false);
  const [suiClientReady, setSuiClientReady] = useState(false);

  useEffect(() => {
    console.log('🚀 ClientOnlyRoot useEffect FIRED!');
    
    const initializeAll = async () => {
      // Use a small delay to ensure proper hydration
      await new Promise(resolve => setTimeout(resolve, 10));
      setIsClient(true);
      console.log('✅ ClientOnlyRoot isClient set to true');
      
      // Initialize Sui client early
      try {
        console.log('🔗 Initializing Sui client...');
        await initializeSuiClientWithConfig();
        setSuiClientReady(true);
        console.log('✅ Sui client initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize Sui client:', error);
        // Set ready anyway to allow the app to continue
        setSuiClientReady(true);
      }
    };
    
    initializeAll();
  }, []);

  console.log('🔄 ClientOnlyRoot render, isClient:', isClient, 'window exists:', typeof window !== 'undefined');

  // Render a minimal fallback during SSR and initial client render
  if (!isClient || !suiClientReady) {
    return (
      <main className='container mx-auto px-4 py-8'>
        <div className="text-center">
          <div>Loading wallet and blockchain components...</div>
          <div className="mt-2 text-sm text-gray-600">
            {!isClient ? 'Initializing client...' : 'Initializing Sui blockchain connection...'}
          </div>
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
