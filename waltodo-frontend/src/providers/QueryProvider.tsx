'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/queryClient';
import { ReactNode, useEffect } from 'react';
// TODO: WebSocket integration temporarily disabled
// import { websocketManager } from '@/lib/websocket';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // TODO: WebSocket initialization temporarily disabled
  useEffect(() => {
    console.log('🔄 QueryProvider mounted');
    
    // Cleanup on unmount
    return () => {
      console.log('🔄 QueryProvider unmounting');
      // TODO: websocketManager.disconnect();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Show React Query DevTools in development */}
      {process.env?.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}