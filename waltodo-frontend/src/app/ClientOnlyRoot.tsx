// Using React client component
'use client';

import React, { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorSuppressor } from '@/components/ErrorSuppressor';
import { AppWalletProvider } from '@/contexts/WalletContext';
import { ContextWarning } from '@/components/context-warning';
import { StorageContextWarning } from '@/components/StorageContextWarning';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import '@/lib/global-error-suppression'; // Setup global error suppression on client

interface ClientOnlyRootProps {
  children: ReactNode;
}

export default function ClientOnlyRoot({ children }: ClientOnlyRootProps) {
  return (
    <ErrorBoundary>
      <ErrorSuppressor />
      <AppWalletProvider>
        <ContextWarning />
        <StorageContextWarning />
        <main className='container mx-auto px-4 py-8'>{children}</main>
        <footer className='mt-auto py-6 text-center text-sm text-ocean-deep dark:text-ocean-foam'>
          <p>Powered by Sui Blockchain and Walrus Storage</p>
        </footer>
        <SessionTimeoutWarning />
      </AppWalletProvider>
    </ErrorBoundary>
  );
}
