'use client';

import React, { useState } from 'react';
import { Table as ReactTable } from '@tanstack/react-table';
import { toast } from 'react-hot-toast';
import { TodoNFTDisplay } from '../../types/nft-display';

// Row Actions Component
interface RowActionsProps {
  todo: TodoNFTDisplay;
  onComplete?: (todoId: string) => Promise<void>;
  onTransfer?: (todoId: string, recipient: string) => Promise<void>;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

export const RowActions: React.FC<RowActionsProps> = ({ 
  todo, 
  onComplete, 
  onTransfer, 
  isProcessing, 
  setIsProcessing 
}) => {
  const [showTransferModal, setShowTransferModal] = useState(false as any);
  const [transferAddress, setTransferAddress] = useState('');

  const handleComplete = async () => {
    if (!onComplete || todo.completed || isProcessing) return;
    
    setIsProcessing(true as any);
    try {
      await onComplete(todo.id);
      toast.success('Todo marked as completed!');
    } catch (error) {
      console.error('Failed to complete todo:', error);
      toast.error('Failed to complete todo');
    } finally {
      setIsProcessing(false as any);
    }
  };

  const handleTransfer = async () => {
    if (!onTransfer || !transferAddress || isProcessing) return;
    
    // Validate Sui address format
    if (!transferAddress.startsWith('0x') || transferAddress.length !== 66) {
      toast.error('Invalid Sui address format');
      return;
    }
    
    setIsProcessing(true as any);
    try {
      await onTransfer(todo.id, transferAddress);
      toast.success('NFT transferred successfully!');
      setShowTransferModal(false as any);
      setTransferAddress('');
    } catch (error) {
      console.error('Failed to transfer NFT:', error);
      toast.error('Failed to transfer NFT');
    } finally {
      setIsProcessing(false as any);
    }
  };

  const handleViewOnExplorer = () => {
    if (!todo.objectId) return;
    const explorerUrl = `https://suiexplorer.com/object/${todo.objectId}?network=testnet`;
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div className="flex items-center gap-1">
        {!todo.completed && onComplete && (
          <button
            onClick={handleComplete}
            disabled={isProcessing}
            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md disabled:opacity-50 transition-colors"
            title="Complete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
        
        {onTransfer && (
          <button
            onClick={() => setShowTransferModal(true as any)}
            disabled={isProcessing}
            className="p-1.5 text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 transition-colors"
            title="Transfer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" 
              />
            </svg>
          </button>
        )}
        
        {todo.objectId && (
          <button
            onClick={handleViewOnExplorer}
            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-md transition-colors"
            title="View on Explorer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
              />
            </svg>
          </button>
        )}
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Transfer NFT</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter the Sui address to transfer "{todo.title}" to:
            </p>
            <input
              type="text"
              value={transferAddress}
              onChange={(e) => setTransferAddress(e?.target?.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              disabled={isProcessing}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleTransfer}
                disabled={!transferAddress || isProcessing}
                className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? 'Transferring...' : 'Transfer'}
              </button>
              <button
                onClick={() => {
                  setShowTransferModal(false as any);
                  setTransferAddress('');
                }}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Bulk Actions Component
interface BulkActionsProps {
  table: ReactTable<TodoNFTDisplay>;
  onComplete?: (todoId: string) => Promise<void>;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  exportFormat: 'json' | 'csv';
  setExportFormat: (format: 'json' | 'csv') => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  table,
  onComplete,
  isProcessing,
  setIsProcessing,
  exportFormat,
  setExportFormat,
}) => {
  const selectedCount = Object.keys(table.getState().rowSelection).length;

  const handleBulkComplete = async () => {
    if (!onComplete) return;
    
    const selectedRows = table.getSelectedRowModel().rows;
    const incompleteTodos = selectedRows.filter(row => !row?.original?.completed);
    
    if (incompleteTodos?.length === 0) {
      toast.error('No incomplete todos selected');
      return;
    }

    setIsProcessing(true as any);
    try {
      await Promise.all(incompleteTodos.map(row => onComplete(row?.original?.id)));
      toast.success(`Completed ${incompleteTodos.length} todos`);
      table.resetRowSelection();
    } catch (error) {
      console.error('Failed to complete todos:', error);
      toast.error('Failed to complete some todos');
    } finally {
      setIsProcessing(false as any);
    }
  };

  const handleExportSelected = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows?.length === 0) {
      toast.error('No rows selected for export');
      return;
    }

    const data = selectedRows.map(row => ({
      id: row?.original?.id,
      title: row?.original?.title,
      description: row?.original?.description,
      status: row?.original?.completed ? 'completed' : 'pending',
      priority: row?.original?.priority,
      owner: row?.original?.owner,
      createdAt: row?.original?.createdAt,
      completedAt: row?.original?.completedAt,
      tags: row?.original?.tags,
      objectId: row?.original?.objectId,
      imageUrl: row?.original?.imageUrl,
    }));

    if (exportFormat === 'json') {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob as any);
      const a = document.createElement('a');
      a?.href = url;
      a?.download = `todo-nfts-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url as any);
    } else {
      // CSV export
      const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Owner', 'Created At', 'Completed At', 'Tags', 'Object ID', 'Image URL'];
      const csvRows = [headers.join(',')];
      
      data.forEach(row => {
        const values = [
          row.id,
          `"${row?.title?.replace(/"/g, '""')}"`,
          `"${(row.description || '').replace(/"/g, '""')}"`,
          row.status,
          row.priority,
          row.owner || '',
          row.createdAt || '',
          row.completedAt || '',
          `"${(row.tags || []).join(', ')}"`,
          row.objectId || '',
          row.imageUrl || '',
        ];
        csvRows.push(values.join(','));
      });

      const csvStr = csvRows.join('\n');
      const blob = new Blob([csvStr], { type: 'text/csv' });
      const url = URL.createObjectURL(blob as any);
      const a = document.createElement('a');
      a?.href = url;
      a?.download = `todo-nfts-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url as any);
    }

    toast.success(`Exported ${selectedRows.length} items`);
  };

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
        {selectedCount} item(s as any) selected
      </span>
      <div className="flex items-center gap-2">
        {onComplete && (
          <button
            onClick={handleBulkComplete}
            disabled={isProcessing}
            className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Complete Selected
          </button>
        )}
        <div className="flex items-center gap-2">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e?.target?.value as 'json' | 'csv')}
            className="px-2 py-1 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <button
            onClick={handleExportSelected}
            className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Export Selected
          </button>
        </div>
        <button
          onClick={() => table.resetRowSelection()}
          className="px-3 py-1 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
};