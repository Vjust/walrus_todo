'use client';

import { useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';
import { useSuiTodos } from '@/hooks/useSuiTodos';
import Navbar from '@/components/navbar';
import WalrusStorageManager from '@/components/WalrusStorageManager';

export default function TestBlockchainPage() {
  const { connected, address, connect, disconnect } = useWalletContext();
  const { state, actions, isWalletReady } = useSuiTodos();
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const testCreateTodo = async () => {
    setIsLoading(true);
    setTestResult('Creating todo...');

    try {
      const result = await actions.createTodo({
        title: 'Test Todo ' + new Date().toISOString(),
        description:
          'This is a test todo created to verify blockchain connectivity',
        priority: 'high',
        tags: ['test', 'blockchain'],
      });

      if (result.success) {
        setTestResult(`✅ Success! Todo created with ID: ${result.digest}`);
      } else {
        setTestResult(`❌ Failed: ${result.error}`);
      }
    } catch (error) {
      setTestResult(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const testCompleteTodo = async () => {
    if (state.todos.length === 0) {
      setTestResult('❌ No todos to complete');
      return;
    }

    const todo = state.todos.find(t => !t.completed) || state.todos[0];

    setIsLoading(true);
    setTestResult(`Completing todo: ${todo.title}...`);

    try {
      const result = await actions.completeTodo(todo.id);

      if (result.success) {
        setTestResult(`✅ Success! Todo completed`);
      } else {
        setTestResult(`❌ Failed: ${result.error}`);
      }
    } catch (error) {
      setTestResult(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='max-w-6xl mx-auto'>
      <Navbar currentPage='test' />

      <div className='mb-8'>
        <h1 className='text-3xl font-bold mb-4 text-ocean-deep dark:text-ocean-foam'>
          Test Blockchain Connectivity
        </h1>
        <p className='text-ocean-medium dark:text-ocean-light'>
          Test page to verify blockchain operations are working correctly
        </p>
      </div>

      <div className='ocean-card mb-6'>
        <h2 className='text-xl font-semibold mb-4'>Wallet Status</h2>
        <div className='space-y-2'>
          <p>Connected: {connected ? '✅ Yes' : '❌ No'}</p>
          <p>Address: {address || 'Not connected'}</p>
          <p>Wallet Ready: {isWalletReady ? '✅ Yes' : '❌ No'}</p>

          {!connected ? (
            <button onClick={connect} className='ocean-button'>
              Connect Wallet
            </button>
          ) : (
            <button onClick={disconnect} className='ocean-button'>
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className='ocean-card mb-6'>
        <h2 className='text-xl font-semibold mb-4'>
          Todos ({state.todos.length})
        </h2>
        {state.loading ? (
          <p>Loading todos...</p>
        ) : state.todos.length === 0 ? (
          <p>No todos found</p>
        ) : (
          <ul className='space-y-2'>
            {state.todos.map(todo => (
              <li key={todo.id} className='flex items-center gap-2'>
                <span className={todo.completed ? 'line-through' : ''}>
                  {todo.title}
                </span>
                {todo.blockchainStored && (
                  <span className='text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded'>
                    NFT: {todo.objectId?.slice(0, 8)}...
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={() => actions.refreshTodos()}
          className='ocean-button mt-4'
          disabled={state.refreshing}
        >
          {state.refreshing ? 'Refreshing...' : 'Refresh Todos'}
        </button>
      </div>

      <div className='ocean-card mb-6'>
        <h2 className='text-xl font-semibold mb-4'>Test Operations</h2>

        <div className='space-y-4'>
          <button
            onClick={testCreateTodo}
            disabled={!isWalletReady || isLoading}
            className='ocean-button w-full'
          >
            Test Create Todo
          </button>

          <button
            onClick={testCompleteTodo}
            disabled={!isWalletReady || isLoading || state.todos.length === 0}
            className='ocean-button w-full'
          >
            Test Complete Todo
          </button>
        </div>

        {testResult && (
          <div className='mt-4 p-4 bg-gray-100 rounded'>
            <h3 className='font-semibold mb-2'>Test Result:</h3>
            <pre className='whitespace-pre-wrap text-sm'>{testResult}</pre>
          </div>
        )}
      </div>

      {state.error && (
        <div className='ocean-card mb-6 bg-red-50 border-red-200'>
          <h3 className='text-red-800 font-semibold mb-2'>Error:</h3>
          <p className='text-red-700'>{state.error}</p>
          <button
            onClick={() => actions.clearError()}
            className='mt-2 text-sm text-red-600 underline'
          >
            Clear Error
          </button>
        </div>
      )}

      <WalrusStorageManager />
    </div>
  );
}
