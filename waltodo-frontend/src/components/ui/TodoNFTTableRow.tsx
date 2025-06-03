'use client';

import React from 'react';
import {
  ColumnDef,
  flexRender,
  Row,
} from '@tanstack/react-table';
import { VirtualItem } from '@tanstack/react-virtual';
import { format, formatDistanceToNow } from 'date-fns';
import { TodoNFTDisplay } from '../../types/nft-display';
import { TodoNFTImage } from '../TodoNFTImage';
import { RowActions } from './TodoNFTTableActions';

// Priority color mapping
const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
};

// Status color mapping
const STATUS_COLORS = {
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
};

// Helper function to truncate address
function truncateAddress(address: string, startLength = 6, endLength = 4): string {
  if (!address || address.length <= startLength + endLength + 3) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

// Expanded Row Content Component
const ExpandedRowContent: React.FC<{ todo: TodoNFTDisplay }> = ({ todo }) => {
  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-800">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image Preview */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Image Preview</h4>
          <div className="relative h-64 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            <TodoNFTImage
              url={todo.imageUrl || todo.displayImageUrl || ''}
              alt={todo.title}
              displayMode="preview"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Detailed Information */}
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Details</h4>
            <dl className="space-y-2 text-sm">
              {todo.description && (
                <div>
                  <dt className="text-gray-600 dark:text-gray-400">Description:</dt>
                  <dd className="mt-1">{todo.description}</dd>
                </div>
              )}
              
              {todo.tags && todo.tags.length > 0 && (
                <div>
                  <dt className="text-gray-600 dark:text-gray-400">Tags:</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {todo.tags.map((tag, index) => (
                      <span key={index} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </dd>
                </div>
              )}

              {todo.dueDate && (
                <div>
                  <dt className="text-gray-600 dark:text-gray-400">Due Date:</dt>
                  <dd className="mt-1">{format(new Date(todo.dueDate), 'MMM d, yyyy')}</dd>
                </div>
              )}

              {todo.completedAt && (
                <div>
                  <dt className="text-gray-600 dark:text-gray-400">Completed At:</dt>
                  <dd className="mt-1">{format(new Date(todo.completedAt), 'MMM d, yyyy HH:mm')}</dd>
                </div>
              )}

              {todo.walrusBlobId && (
                <div>
                  <dt className="text-gray-600 dark:text-gray-400">Walrus Blob ID:</dt>
                  <dd className="mt-1 font-mono text-xs break-all">{todo.walrusBlobId}</dd>
                </div>
              )}

              {todo.objectId && (
                <div>
                  <dt className="text-gray-600 dark:text-gray-400">Object ID:</dt>
                  <dd className="mt-1 font-mono text-xs break-all">{todo.objectId}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Metadata */}
          {todo.metadata && (
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Metadata</h4>
              <pre className="bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs overflow-x-auto">
                {JSON.stringify(JSON.parse(todo.metadata), null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface TodoNFTTableRowProps {
  row: Row<TodoNFTDisplay>;
  columns: ColumnDef<TodoNFTDisplay>[];
  virtualRow: VirtualItem;
  onComplete?: (todoId: string) => Promise<void>;
  onTransfer?: (todoId: string, recipient: string) => Promise<void>;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

export const TodoNFTTableRow: React.FC<TodoNFTTableRowProps> = ({
  row,
  columns,
  virtualRow,
  onComplete,
  onTransfer,
  isProcessing,
  setIsProcessing,
}) => {
  const todo = row.original;

  const renderCellContent = (cell: any) => {
    const columnId = cell.column.id;
    
    switch (columnId) {
      case 'select':
        return (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            className="cursor-pointer"
          />
        );

      case 'expand':
        return (
          <button
            onClick={row.getToggleExpandedHandler()}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title={row.getIsExpanded() ? 'Collapse' : 'Expand'}
          >
            {row.getIsExpanded() ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        );

      case 'imageUrl':
        return (
          <div className="w-16 h-16 relative">
            <TodoNFTImage
              url={todo.imageUrl || todo.displayImageUrl || ''}
              alt={todo.title}
              displayMode="thumbnail"
              className="w-full h-full object-cover rounded-md"
            />
          </div>
        );

      case 'title':
        return (
          <div className="min-w-0">
            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {todo.title}
            </div>
            {todo.description && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {todo.description}
              </div>
            )}
          </div>
        );

      case 'completed':
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            todo.completed ? STATUS_COLORS.completed : STATUS_COLORS.pending
          }`}>
            {todo.completed ? 'Completed' : 'Pending'}
          </span>
        );

      case 'priority':
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${PRIORITY_COLORS[todo.priority as keyof typeof PRIORITY_COLORS]}`}>
            {todo.priority}
          </span>
        );

      case 'owner':
        return (
          <div className="font-mono text-xs" title={todo.owner || 'Unknown'}>
            {truncateAddress(todo.owner || 'Unknown')}
          </div>
        );

      case 'createdAt':
        const date = todo.createdAt;
        if (!date) return 'N/A';
        try {
          return (
            <div className="text-sm">
              <div>{format(new Date(date), 'MMM d, yyyy')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatDistanceToNow(new Date(date), { addSuffix: true })}
              </div>
            </div>
          );
        } catch {
          return 'Invalid date';
        }

      case 'actions':
        return (
          <RowActions
            todo={todo}
            onComplete={onComplete}
            onTransfer={onTransfer}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
          />
        );

      default:
        return flexRender(cell.column.columnDef.cell, cell.getContext());
    }
  };

  return (
    <React.Fragment key={row.id}>
      <tr
        className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
          row.getIsSelected() ? 'bg-blue-50 dark:bg-blue-900/20' : ''
        } ${todo.loadingState === 'loading' ? 'opacity-50' : ''}`}
        style={{
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start - virtualRow.index * virtualRow.size}px)`,
        }}
      >
        {row.getVisibleCells().map(cell => (
          <td
            key={cell.id}
            className="px-4 py-4 whitespace-nowrap text-sm"
            style={{ width: cell.column.getSize() }}
          >
            {renderCellContent(cell)}
          </td>
        ))}
      </tr>
      {row.getIsExpanded() && (
        <tr>
          <td colSpan={columns.length} className="p-0">
            <ExpandedRowContent todo={todo} />
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};

export { ExpandedRowContent };