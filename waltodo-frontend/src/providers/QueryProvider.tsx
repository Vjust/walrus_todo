'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/queryClient';
import { ReactNode, useEffect } from 'react';
import { websocketManager } from '@/lib/websocket';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Initialize WebSocket on mount (but don't connect until wallet is ready)
  useEffect(() => {
    console.log('🔄 QueryProvider mounted, WebSocket manager ready');
    
    // Cleanup on unmount
    return () => {
      console.log('🔄 QueryProvider unmounting, cleaning up WebSocket');
      websocketManager.disconnect();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Show React Query DevTools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}