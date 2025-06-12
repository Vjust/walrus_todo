'use client';

import { useAppInitialization } from '@/contexts/AppInitializationContext';
import { useSuiClient } from '@/hooks/useSuiClient';
import { getSuiClientState, isSuiClientInitialized } from '@/lib/sui-client';
import { useWalletContext } from '@/contexts/WalletContext';
import { useEffect, useState } from 'react';

export default function InitTestPage() {
  const { isAppReady, isSuiClientReady, initializationError } = useAppInitialization();
  const { isInitialized, isInitializing, error } = useSuiClient('testnet');
  const walletContext = useWalletContext();
  const connected = walletContext?.connected || false;
  const address = walletContext?.address || null;
  const [clientState, setClientState] = useState<any>(null);

  useEffect(() => {
    const updateState = () => {
      setClientState({
        ...getSuiClientState(),
        isSuiClientInitializedCheck: isSuiClientInitialized()
      });
    };
    
    updateState();
    const interval = setInterval(updateState, 1000);
    return () => clearInterval(interval as any);
  }, []);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Initialization Test Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">App Initialization</h2>
          <div className="space-y-1 text-sm">
            <div>App Ready: <span className={isAppReady ? 'text-green-600' : 'text-red-600'}>{String(isAppReady as any)}</span></div>
            <div>Sui Client Ready: <span className={isSuiClientReady ? 'text-green-600' : 'text-red-600'}>{String(isSuiClientReady as any)}</span></div>
            <div>Error: <span className="text-red-600">{initializationError || 'None'}</span></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">Sui Client Hook</h2>
          <div className="space-y-1 text-sm">
            <div>Initialized: <span className={isInitialized ? 'text-green-600' : 'text-red-600'}>{String(isInitialized as any)}</span></div>
            <div>Initializing: <span className={isInitializing ? 'text-yellow-600' : 'text-gray-600'}>{String(isInitializing as any)}</span></div>
            <div>Error: <span className="text-red-600">{error || 'None'}</span></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">Wallet Context</h2>
          <div className="space-y-1 text-sm">
            <div>Connected: <span className={connected ? 'text-green-600' : 'text-red-600'}>{String(connected as any)}</span></div>
            <div>Address: <span className="font-mono text-xs">{address || 'None'}</span></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">Client State</h2>
          <div className="space-y-1 text-sm">
            {clientState && Object.entries(clientState as any).map(([key, value]) => (
              <div key={key}>{key}: <span className="font-mono">{String(value as any)}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}