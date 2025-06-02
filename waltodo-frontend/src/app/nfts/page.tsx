'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { TodoNFTGrid } from '@/components/TodoNFTGrid';
import WalletConnectButton from '@/components/WalletConnectButton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useWalletContext } from '@/contexts/WalletContext';
import { useSuiTodos } from '@/hooks/useSuiTodos';
import toast from 'react-hot-toast';
import { Todo } from '@/types/todo-nft';
// Icons - using inline SVGs for compatibility

// Icons
const DownloadIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
  </svg>
);

const PlusIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const HelpCircleIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const Loader2Icon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const AlertCircleIcon = ({ className }: { className?: string }) => (
  <svg className={`h-6 w-6 ${className || ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Set page metadata dynamically
function NFTGalleryPage() {
  const walletContext = useWalletContext();
  const { address, connected: isConnected } = walletContext || { address: null, connected: false };
  const { state, actions } = useSuiTodos();
  const { loading, error } = state;
  const todos = useMemo(() => state.todos, [state.todos]);
  const { refreshTodos } = actions;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  // Filter NFT todos - todos with images or marked as NFTs
  const nftTodos = useMemo(() => {
    return todos.filter(todo => 
      todo.imageUrl || 
      todo.blockchainStored || 
      (todo.metadata && todo.metadata.includes('nft')) ||
      (todo.tags && todo.tags.includes('nft'))
    );
  }, [todos]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = nftTodos.length;
    const byCategory = nftTodos.reduce((acc, todo) => {
      const category = (todo.tags && todo.tags[0]) || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const totalStorage = nftTodos.reduce((sum, todo) => {
      // Estimate size based on image URL or use a default
      return sum + 100000; // 100KB average per NFT
    }, 0);

    return {
      total,
      byCategory,
      totalStorage,
      averageSize: total > 0 ? totalStorage / total : 0,
    };
  }, [nftTodos]);

  // Export functionality
  const handleExport = useCallback(() => {
    try {
      if (exportFormat === 'json') {
        const data = JSON.stringify(nftTodos, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `todo-nfts-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // CSV export
        const headers = ['ID', 'Title', 'Description', 'Category', 'Created', 'Walrus URL', 'File Size'];
        const rows = nftTodos.map(todo => [
          todo.id,
          todo.title,
          todo.description || '',
          (todo.tags && todo.tags[0]) || 'Uncategorized',
          todo.createdAt ? new Date(todo.createdAt).toISOString() : new Date().toISOString(),
          todo.imageUrl || '',
          100000, // estimated size
        ]);
        
        const csv = [headers, ...rows]
          .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `todo-nfts-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      toast.success('NFTs exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export NFTs');
    }
  }, [nftTodos, exportFormat]);

  // Error recovery
  const handleRetry = useCallback(() => {
    refreshTodos();
  }, [refreshTodos]);

  // Format storage size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header with Mobile Navigation */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">NFT Gallery</h1>
                  <p className="text-gray-600 mt-1 text-sm sm:text-base">View and manage your Todo NFTs</p>
                </div>
                <div className="sm:hidden">
                  <WalletConnectButton />
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-4">
                <WalletConnectButton />
              </div>
            </div>
          </div>
        </header>

        {/* Stats Bar */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <div className="text-xs sm:text-sm text-gray-600">Total NFTs</div>
                <div className="text-xl sm:text-2xl font-semibold text-gray-900">{stats.total}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <div className="text-xs sm:text-sm text-gray-600">Total Storage</div>
                <div className="text-xl sm:text-2xl font-semibold text-gray-900">
                  {formatBytes(stats.totalStorage)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <div className="text-xs sm:text-sm text-gray-600">Categories</div>
                <div className="text-xl sm:text-2xl font-semibold text-gray-900">
                  {Object.keys(stats.byCategory).length}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <div className="text-xs sm:text-sm text-gray-600">Avg. Size</div>
                <div className="text-xl sm:text-2xl font-semibold text-gray-900">
                  {formatBytes(stats.averageSize)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col gap-3">
              {/* Primary Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    disabled={!isConnected}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="mr-2"><PlusIcon /></span>
                    Create NFT
                  </button>
                  <button
                    onClick={() => setShowHelpModal(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <span className="mr-2"><HelpCircleIcon /></span>
                    <span className="hidden sm:inline">About Walrus Storage</span>
                    <span className="sm:hidden">Help</span>
                  </button>
                </div>
                
                {/* Export Controls */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
                    className="flex-1 sm:flex-none block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </select>
                  <button
                    onClick={handleExport}
                    disabled={nftTodos.length === 0}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="mr-2"><DownloadIcon /></span>
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 lg:pb-8">
          {!isConnected ? (
            <div className="text-center py-12">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                <AlertCircleIcon className="text-yellow-600" />
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Wallet not connected
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Connect your wallet to view your NFT collection
              </p>
              <div className="mt-6">
                <WalletConnectButton />
              </div>
            </div>
          ) : loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2Icon className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading your NFTs...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <AlertCircleIcon className="text-red-600" />
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Error loading NFTs
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {String(error) || 'Failed to load your NFT collection'}
              </p>
              <div className="mt-6">
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : nftTodos.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">
                <span className="text-gray-600"><PlusIcon /></span>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No NFTs yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Create your first Todo NFT to get started
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <span className="mr-2"><PlusIcon /></span>
                  Create NFT
                </button>
              </div>
            </div>
          ) : (
            <TodoNFTGrid className="w-full" />
          )}
        </main>

        {/* Create NFT Modal */}
        {showCreateModal && (
          <CreateNFTModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              refreshTodos();
            }}
          />
        )}

        {/* Help Modal */}
        {showHelpModal && (
          <HelpModal onClose={() => setShowHelpModal(false)} />
        )}
        
        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t lg:hidden z-30">
          <div className="grid grid-cols-4 gap-1">
            <Link href="/" className="flex flex-col items-center py-2 px-3 text-gray-600 hover:text-blue-600">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs mt-1">Home</span>
            </Link>
            <a href="/dashboard" className="flex flex-col items-center py-2 px-3 text-gray-600 hover:text-blue-600">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <span className="text-xs mt-1">Todos</span>
            </a>
            <a href="/nfts" className="flex flex-col items-center py-2 px-3 text-blue-600">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs mt-1">NFTs</span>
            </a>
            <a href="/wallet-demo" className="flex flex-col items-center py-2 px-3 text-gray-600 hover:text-blue-600">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="text-xs mt-1">Wallet</span>
            </a>
          </div>
        </nav>
      </div>
    </ErrorBoundary>
  );
}

// Create NFT Modal Component
function CreateNFTModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select an image file');
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement NFT creation logic
      toast('NFT creation not yet implemented', { icon: 'ℹ️' });
      onSuccess();
    } catch (error) {
      console.error('NFT creation error:', error);
      toast.error('Failed to create NFT');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 my-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Create Todo NFT</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <input
              type="text"
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="file" className="block text-sm font-medium text-gray-700">
              Image File
            </label>
            <input
              type="file"
              id="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />}
              Create NFT
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// Help Modal Component
function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-2xl w-full p-4 sm:p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white pb-4 mb-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">About Walrus Storage</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="prose prose-sm max-w-none">
          <h3>What is Walrus?</h3>
          <p>
            Walrus is a decentralized storage network that allows you to store data permanently
            and securely. When you create a Todo NFT, the image and metadata are stored on Walrus,
            ensuring they remain accessible forever.
          </p>
          
          <h3>Key Benefits</h3>
          <ul>
            <li><strong>Permanent Storage:</strong> Your NFT data is stored permanently on the network</li>
            <li><strong>Decentralized:</strong> No single point of failure or control</li>
            <li><strong>Cost-Effective:</strong> Efficient storage with intelligent deduplication</li>
            <li><strong>Fast Access:</strong> Content delivery through global network</li>
          </ul>
          
          <h3>How It Works</h3>
          <ol>
            <li>Upload your image when creating a Todo NFT</li>
            <li>The image is stored on Walrus and returns a unique blob ID</li>
            <li>The NFT metadata, including the Walrus blob ID, is stored on Sui blockchain</li>
            <li>Your NFT is permanently accessible through the Walrus URL</li>
          </ol>
          
          <h3>Storage Costs</h3>
          <p>
            Storage on Walrus requires WAL tokens. The cost depends on the file size and storage
            duration. WalTodo automatically calculates the optimal storage allocation for your NFTs.
          </p>
          
          <h3>Need Help?</h3>
          <p>
            For more information about Walrus storage, visit the{' '}
            <a href="https://walrus.xyz" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              official Walrus documentation
            </a>.
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default NFTGalleryPage;
