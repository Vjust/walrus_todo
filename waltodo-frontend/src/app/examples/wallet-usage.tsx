'use client';

/**
 * Example: How to use the updated wallet integration in components
 */

import { useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';
import { storeTodoOnBlockchain } from '@/lib/todo-service';
import { TransactionHistory } from '@/components/TransactionHistory';

export default function WalletUsageExample() {
  const {
    connected,
    address,
    chainId,
    name: walletName,
    connect,
    disconnect,
    switchNetwork,
    trackTransaction,
  } = useWalletContext();

  const [transactionStatus, setTransactionStatus] = useState<
    'idle' | 'pending' | 'success' | 'error'
  >('idle');
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Example of how to store a todo on blockchain with transaction tracking
  const handleStoreOnBlockchain = async (listName: string, todoId: string) => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }

    setTransactionStatus('pending');

    try {
      // Store the todo on blockchain (returns object ID)
      const objectId = await storeTodoOnBlockchain(listName, todoId);

      if (objectId) {
        console.log('Todo stored with ID:', objectId);
        setTransactionStatus('success');
        setTransactionId(objectId);
      } else {
        throw new Error('Failed to store todo on blockchain');
      }
    } catch (error) {
      console.error('Transaction failed:', error);
      setTransactionStatus('error');
    }
  };

  return (
    <div className='p-4 ocean-card'>
      <h2 className='text-xl font-bold mb-4'>Wallet Usage Example</h2>

      <div className='space-y-4'>
        <div className='p-4 bg-ocean-deep/10 rounded-lg'>
          <p>
            <span className='font-medium'>Connected:</span>{' '}
            {connected ? 'Yes' : 'No'}
          </p>
          <p>
            <span className='font-medium'>Wallet:</span> {walletName || 'None'}
          </p>
          <p>
            <span className='font-medium'>Address:</span>{' '}
            {address || 'Not connected'}
          </p>
          <p>
            <span className='font-medium'>Network:</span> {chainId || 'Unknown'}
          </p>
        </div>

        {/* Wallet connection controls */}
        <div className='flex gap-4 flex-wrap'>
          {!connected ? (
            <button
              onClick={() => connect()}
              className='px-4 py-2 bg-ocean-deep text-white rounded-lg hover:bg-ocean-deep/80'
            >
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={() => disconnect()}
              className='px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600'
            >
              Disconnect
            </button>
          )}

          {/* Network switching example */}
          {connected && (
            <div className='flex gap-2'>
              <button
                onClick={() => switchNetwork('mainnet')}
                className={`px-4 py-2 rounded-lg ${
                  chainId === 'mainnet'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Mainnet
              </button>
              <button
                onClick={() => switchNetwork('testnet')}
                className={`px-4 py-2 rounded-lg ${
                  chainId === 'testnet'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Testnet
              </button>
              <button
                onClick={() => switchNetwork('devnet')}
                className={`px-4 py-2 rounded-lg ${
                  chainId === 'devnet'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Devnet
              </button>
            </div>
          )}
        </div>

        {/* Transaction example section */}
        <div className='mt-6'>
          <h3 className='text-lg font-medium mb-2'>Transaction Example</h3>
          <div className='flex gap-4 items-center'>
            <button
              onClick={() => handleStoreOnBlockchain('default', '123')}
              disabled={!connected || transactionStatus === 'pending'}
              className='px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed'
            >
              {transactionStatus === 'pending'
                ? 'Processing...'
                : 'Store Todo on Blockchain'}
            </button>

            {/* Transaction status indicator */}
            {transactionStatus === 'pending' && (
              <div className='text-yellow-600'>Transaction in progress...</div>
            )}
            {transactionStatus === 'success' && (
              <div className='text-green-600'>
                Transaction successful! Object ID: {transactionId}
              </div>
            )}
            {transactionStatus === 'error' && (
              <div className='text-red-600'>
                Transaction failed. Please try again.
              </div>
            )}
          </div>
        </div>

        {/* Transaction History */}
        <div className='mt-6'>
          <h3 className='text-lg font-medium mb-2'>Transaction History</h3>
          <TransactionHistory maxItems={3} />
        </div>
      </div>
    </div>
  );
}
