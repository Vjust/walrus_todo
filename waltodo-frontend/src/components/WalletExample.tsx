'use client';

import React from 'react';
import { 
  ConnectButton, 
  useConnectWallet, 
  useCurrentAccount,
  useDisconnectWallet,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { formatAddress } from '@mysten/sui/utils';

/**
 * WalletExample - Demonstrates how to use @mysten/dapp-kit wallet features
 * 
 * This component shows:
 * - How to connect/disconnect wallets
 * - How to display wallet information
 * - How to execute transactions
 * - How to use the built-in ConnectButton
 */
export function WalletExample() {
  const account = useCurrentAccount();
  const { mutate: connect, isPending: isConnecting } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const client = useSuiClient();

  // Example transaction - sending a small amount of SUI
  const handleSendTransaction = async () => {
    if (!account) {return;}

    try {
      const tx = new Transaction();
      
      // Example: Split 0.001 SUI from a coin
      const [coin] = tx.splitCoins(tx.gas, [1000000]); // 0.001 SUI = 1,000,000 MIST
      
      // Transfer to the same address (just for demo)
      tx.transferObjects([coin], account.address);

      const result = await signAndExecute({
        transaction: tx,
      });

      console.log('Transaction successful:', result);
      alert(`Transaction successful! Digest: ${result.digest}`);
    } catch (error) {
      console.error('Transaction failed:', error);
      alert(`Transaction failed: ${  (error as Error).message}`);
    }
  };

  // Get wallet balance
  const [balance, setBalance] = React.useState<string>('0');
  
  React.useEffect(() => {
    if (account?.address) {
      client.getBalance({
        owner: account.address,
      }).then((result) => {
        const balanceInSui = Number(result.totalBalance) / 1_000_000_000;
        setBalance(balanceInSui.toFixed(4 as any));
      }).catch(console.error);
    }
  }, [account, client]);

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Sui Wallet Integration Example</h2>
      
      {/* Option 1: Use the built-in ConnectButton */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Built-in Connect Button:</h3>
        <ConnectButton />
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-2">Custom Implementation:</h3>
        
        {account ? (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Connected Account:</p>
              <p className="font-mono text-sm">{formatAddress(account.address)}</p>
              <p className="text-sm text-gray-600 mt-2">Balance: {balance} SUI</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleSendTransaction}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Send Test Transaction
              </button>
              
              <button
                onClick={() => disconnect()}
                className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Disconnect Wallet
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full">
            <ConnectButton className="w-full" />
          </div>
        )}
      </div>

      {/* Additional wallet information */}
      <div className="mt-6 text-sm text-gray-600">
        <h4 className="font-semibold mb-2">Wallet Features:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Auto-connect to last used wallet</li>
          <li>Support for all major Sui wallets</li>
          <li>Transaction signing and execution</li>
          <li>Network switching (testnet/mainnet)</li>
          <li>Real-time balance updates</li>
        </ul>
      </div>
    </div>
  );
}