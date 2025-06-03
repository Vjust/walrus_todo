'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useSignTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { TodoNFTImage } from './TodoNFTImage';
import { NFTImageSkeleton } from './ui/skeletons/NFTImageSkeleton';
import { 
  generateNFTAttributes, 
  hasNFTMetadata, 
  isTodoNFTDisplay,
  NFTDisplayMode,
  TodoNFTDisplay
} from '@/types/nft-display';
import { useSuiClient } from '@/hooks/useSuiClient';
import { useWalletContext } from '@/contexts/WalletContext';
import { toast } from 'react-hot-toast';

export interface TodoNFTCardProps {
  /** The Todo NFT to display */
  todo: TodoNFTDisplay;
  /** Display mode for the card */
  displayMode?: NFTDisplayMode;
  /** Variant of the card (default or list) */
  variant?: 'default' | 'list';
  /** Callback when the todo is completed */
  onComplete?: (todoId: string) => Promise<void>;
  /** Callback when the todo is transferred */
  onTransfer?: (todoId: string, recipient: string) => Promise<void>;
  /** Callback when the card is clicked */
  onClick?: (todo: TodoNFTDisplay) => void;
  /** Whether to show action buttons */
  showActions?: boolean;
  /** Whether to enable flip animation */
  enableFlip?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether the card is in a loading state */
  loading?: boolean;
}

/**
 * Truncate address for display
 */
function truncateAddress(address: string, startLength = 6, endLength = 4): string {
  if (!address || address.length <= startLength + endLength + 3) {return address;}
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

/**
 * Priority color mapping
 */
const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200'
};

/**
 * Status color mapping
 */
const STATUS_COLORS = {
  completed: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-gray-100 text-gray-800 border-gray-200'
};

/**
 * Loading skeleton component
 */
const CardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
    <div className="h-48 bg-gray-200" />
    <div className="p-4 space-y-3">
      <div className="h-6 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="flex gap-2 mt-4">
        <div className="h-8 bg-gray-200 rounded w-20" />
        <div className="h-8 bg-gray-200 rounded w-20" />
      </div>
    </div>
  </div>
);

/**
 * Error state component
 */
const CardError: React.FC<{ message?: string }> = ({ message = 'Failed to load NFT' }) => (
  <div className="bg-white rounded-lg shadow-md overflow-hidden border-2 border-red-200">
    <div className="h-48 bg-red-50 flex items-center justify-center">
      <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
        />
      </svg>
    </div>
    <div className="p-4">
      <p className="text-red-600 font-medium">{message}</p>
    </div>
  </div>
);

/**
 * TodoNFTCard Component
 * 
 * A comprehensive NFT card component that displays todo NFTs with
 * rich metadata, interactive features, and flip animation.
 */
export const TodoNFTCard: React.FC<TodoNFTCardProps> = ({
  todo,
  displayMode = 'gallery',
  variant = 'default',
  onComplete,
  onTransfer,
  onClick,
  showActions = true,
  enableFlip = true,
  className = '',
  loading = false
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAddress, setTransferAddress] = useState('');
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  
  const router = useRouter();
  const suiClient = useSuiClient();
  const walletContext = useWalletContext();
  const signTransaction = useSignTransaction();
  const account = walletContext?.account;

  // Generate NFT attributes for display
  const attributes = useMemo(() => generateNFTAttributes(todo), [todo]);

  // Handle card click
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Don't flip if clicking on buttons or links
    if ((e.target as HTMLElement).closest('button, a')) {return;}
    
    if (enableFlip) {
      setIsFlipped(!isFlipped);
    }
    onClick?.(todo);
  }, [enableFlip, isFlipped, onClick, todo]);

  // Handle complete action
  const handleComplete = useCallback(async () => {
    if (!onComplete || todo.completed || isProcessing) {return;}
    
    setIsProcessing(true);
    try {
      await onComplete(todo.id);
      toast.success('Todo marked as completed!');
    } catch (error) {
      console.error('Failed to complete todo:', error);
      toast.error('Failed to complete todo');
    } finally {
      setIsProcessing(false);
    }
  }, [onComplete, todo.completed, todo.id, isProcessing]);

  // Handle transfer action
  const handleTransfer = useCallback(async () => {
    if (!onTransfer || !transferAddress || isProcessing) {return;}
    
    // Validate Sui address format
    if (!transferAddress.startsWith('0x') || transferAddress.length !== 66) {
      toast.error('Invalid Sui address format');
      return;
    }
    
    setIsProcessing(true);
    try {
      await onTransfer(todo.id, transferAddress);
      toast.success('NFT transferred successfully!');
      setShowTransferModal(false);
      setTransferAddress('');
    } catch (error) {
      console.error('Failed to transfer NFT:', error);
      toast.error('Failed to transfer NFT');
    } finally {
      setIsProcessing(false);
    }
  }, [onTransfer, transferAddress, todo.id, isProcessing]);

  // View on explorer
  const handleViewOnExplorer = useCallback(() => {
    if (!todo.objectId) {return;}
    
    const explorerUrl = `https://suiexplorer.com/object/${todo.objectId}?network=testnet`;
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
  }, [todo.objectId]);

  // Format dates
  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) {return 'N/A';}
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  }, []);

  const formatRelativeTime = useCallback((dateString?: string) => {
    if (!dateString) {return '';}
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return '';
    }
  }, []);

  // Loading state
  if (loading) {
    return <CardSkeleton />;
  }

  // Error state
  if (todo.loadingState === 'error' || imageError) {
    return <CardError message={todo.imageLoadError} />;
  }

  // List variant
  if (variant === 'list') {
    return (
      <div className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4 ${className}`}>
        <div className="flex items-center gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-20 h-20 relative">
            {imageLoading && (
              <NFTImageSkeleton
                displayMode="thumbnail"
                showOverlay={false}
                animationSpeed="normal"
                className="absolute inset-0 rounded-md"
              />
            )}
            <TodoNFTImage
              url={todo.imageUrl || todo.displayImageUrl || ''}
              alt={todo.title}
              displayMode="thumbnail"
              className={`w-full h-full object-cover rounded-md transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
              priority={false}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
            />
            {/* Priority Badge */}
            <div className="absolute -top-2 -left-2">
              <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[todo.priority]}`}>
                {todo.priority[0].toUpperCase()}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 truncate">
                  {todo.title}
                </h3>
                {todo.description && (
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                    {todo.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className={`font-medium ${todo.completed ? 'text-green-600' : 'text-gray-600'}`}>
                    {todo.completed ? 'Completed' : 'Pending'}
                  </span>
                  <span>{formatDate(todo.createdAt)}</span>
                  {todo.tags && todo.tags.length > 0 && (
                    <span>{todo.tags.length} tag{todo.tags.length > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {showActions && (
                <div className="flex items-center gap-1 ml-4">
                  {!todo.completed && onComplete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleComplete();
                      }}
                      disabled={isProcessing}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50"
                      title="Complete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                  
                  {onTransfer && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTransferModal(true);
                      }}
                      disabled={isProcessing}
                      className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-md disabled:opacity-50"
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewOnExplorer();
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
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
              )}
            </div>
          </div>
        </div>

        {/* Transfer Modal for list variant */}
        {showTransferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div 
              className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Transfer NFT</h3>
              <p className="text-sm text-gray-600 mb-4">
                Enter the Sui address to transfer this NFT to:
              </p>
              <input
                type="text"
                value={transferAddress}
                onChange={(e) => setTransferAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isProcessing}
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleTransfer}
                  disabled={!transferAddress || isProcessing}
                  className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Transferring...' : 'Transfer'}
                </button>
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferAddress('');
                  }}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const cardClasses = [
    'relative w-full h-full preserve-3d transition-transform duration-700',
    isFlipped && 'rotate-y-180',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="relative perspective-1000">
      <div className={cardClasses} onClick={handleCardClick}>
        {/* Front of card */}
        <div className="absolute inset-0 backface-hidden">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full flex flex-col hover:shadow-xl transition-shadow duration-300">
            {/* Image Section */}
            <div className="relative h-48 bg-gray-100">
              {imageLoading && (
                <NFTImageSkeleton
                  displayMode="preview"
                  showOverlay={true}
                  animationSpeed="normal"
                  className="absolute inset-0"
                />
              )}
              <TodoNFTImage
                url={todo.imageUrl || todo.displayImageUrl || ''}
                alt={todo.title}
                displayMode={displayMode === 'thumbnail' ? 'thumbnail' : 'preview'}
                className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                priority={displayMode === 'thumbnail'}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true);
                  setImageLoading(false);
                }}
              />
              
              {/* Status Badge */}
              <div className="absolute top-2 right-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  todo.completed ? STATUS_COLORS.completed : STATUS_COLORS.pending
                }`}>
                  {todo.completed ? 'Completed' : 'Pending'}
                </span>
              </div>
              
              {/* Priority Badge */}
              <div className="absolute top-2 left-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${PRIORITY_COLORS[todo.priority]}`}>
                  {todo.priority}
                </span>
              </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 p-4 flex flex-col">
              {/* Title and Description */}
              <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-1">
                {todo.title}
              </h3>
              {todo.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {todo.description}
                </p>
              )}

              {/* Metadata */}
              <div className="flex-1 space-y-2 text-sm">
                {/* Owner */}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
                    />
                  </svg>
                  <span className="text-gray-600">
                    Owner: 
                    <span 
                      className="ml-1 font-mono text-xs cursor-help"
                      title={todo.owner || account?.address || 'Unknown'}
                    >
                      {truncateAddress(todo.owner || account?.address || 'Unknown')}
                    </span>
                  </span>
                </div>

                {/* Created Date */}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
                    />
                  </svg>
                  <span className="text-gray-600">
                    Created: {formatDate(todo.createdAt)}
                    <span className="text-xs text-gray-400 ml-1">
                      ({formatRelativeTime(todo.createdAt)})
                    </span>
                  </span>
                </div>

                {/* Completed Date */}
                {todo.completed && todo.completedAt && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    <span className="text-gray-600">
                      Completed: {formatDate(todo.completedAt)}
                    </span>
                  </div>
                )}

                {/* Tags */}
                {todo.tags && todo.tags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" 
                      />
                    </svg>
                    <div className="flex flex-wrap gap-1">
                      {todo.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {showActions && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  {!todo.completed && onComplete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleComplete();
                      }}
                      disabled={isProcessing}
                      className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isProcessing ? 'Processing...' : 'Complete'}
                    </button>
                  )}
                  
                  {onTransfer && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTransferModal(true);
                      }}
                      disabled={isProcessing}
                      className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Transfer
                    </button>
                  )}
                  
                  {todo.objectId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewOnExplorer();
                      }}
                      className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      title="View on Sui Explorer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                        />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Back of card - Detailed Metadata */}
        {enableFlip && (
          <div className="absolute inset-0 backface-hidden rotate-y-180">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-900">NFT Metadata</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto max-h-[calc(100%-3rem)]">
                {/* NFT Details */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">NFT Details</h4>
                  <dl className="space-y-1 text-sm">
                    {todo.objectId && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Object ID:</dt>
                        <dd className="font-mono text-xs">{truncateAddress(todo.objectId, 8, 6)}</dd>
                      </div>
                    )}
                    {todo.nftTokenId && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Token ID:</dt>
                        <dd className="font-mono text-xs">{truncateAddress(todo.nftTokenId, 8, 6)}</dd>
                      </div>
                    )}
                    {todo.walrusImageBlobId && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Image Blob ID:</dt>
                        <dd className="font-mono text-xs">{truncateAddress(todo.walrusImageBlobId, 8, 6)}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Attributes */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Attributes</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {attributes.map((attr, index) => (
                      <div key={index} className="bg-gray-50 rounded p-2">
                        <div className="text-xs text-gray-600">{attr.trait_type}</div>
                        <div className="text-sm font-medium">
                          {attr.display_type === 'date' && typeof attr.value === 'number'
                            ? format(new Date(attr.value * 1000), 'MMM d, yyyy')
                            : String(attr.value)
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Metadata */}
                {todo.metadata && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Additional Metadata</h4>
                    <pre className="bg-gray-50 rounded p-2 text-xs overflow-x-auto">
                      {JSON.stringify(JSON.parse(todo.metadata), null, 2)}
                    </pre>
                  </div>
                )}

                {/* Content Data */}
                {todo.contentData && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Content Data</h4>
                    <dl className="space-y-1 text-sm">
                      {todo.contentData.attachments && todo.contentData.attachments.length > 0 && (
                        <div>
                          <dt className="text-gray-600">Attachments:</dt>
                          <dd>{todo.contentData.attachments.length} file(s)</dd>
                        </div>
                      )}
                      {todo.contentData.checklist && todo.contentData.checklist.length > 0 && (
                        <div>
                          <dt className="text-gray-600">Checklist Items:</dt>
                          <dd>
                            {todo.contentData.checklist.filter(item => item.completed).length}/
                            {todo.contentData.checklist.length} completed
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div 
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Transfer NFT</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter the Sui address to transfer this NFT to:
            </p>
            <input
              type="text"
              value={transferAddress}
              onChange={(e) => setTransferAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleTransfer}
                disabled={!transferAddress || isProcessing}
                className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Transferring...' : 'Transfer'}
              </button>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferAddress('');
                }}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        .line-clamp-1 {
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
        }
        .line-clamp-2 {
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
      `}</style>
    </div>
  );
};

export default TodoNFTCard;