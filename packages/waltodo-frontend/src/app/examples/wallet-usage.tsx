'use client';

/**
 * Example: How to use wallet integration in components
 */

import { useWalletContext } from '@/lib/walletContext';
import { storeTodoOnBlockchain } from '@/lib/todo-service';

export default function WalletUsageExample() {
  const {
    connected,
    publicKey,
    walletType,
    suiAccount,
    phantomPublicKey,
  } = useWalletContext();

  const handleStoreOnBlockchain = async (listName: string, todoId: string) => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }

    // Create a wallet signer object based on wallet type
    const signer = walletType === 'sui' 
      ? {
          address: suiAccount?.address,
          signAndExecuteTransaction: async (tx: any) => {
            // Sui signing logic here
            console.log('Signing with Sui wallet');
          }
        }
      : walletType === 'phantom'
      ? {
          publicKey: phantomPublicKey,
          signTransaction: async (tx: any) => {
            // Phantom signing logic here
            console.log('Signing with Phantom wallet');
          }
        }
      : undefined;

    const objectId = await storeTodoOnBlockchain(listName, todoId, signer);
    
    if (objectId) {
      console.log('Todo stored with ID:', objectId);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Wallet Usage Example</h2>
      
      <div className="space-y-4">
        <div>
          <p>Connected: {connected ? 'Yes' : 'No'}</p>
          <p>Wallet Type: {walletType || 'None'}</p>
          <p>Address: {publicKey || 'Not connected'}</p>
        </div>

        <button
          onClick={() => handleStoreOnBlockchain('default', '123')}
          disabled={!connected}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          Store Todo on Blockchain
        </button>
      </div>
    </div>
  );
}