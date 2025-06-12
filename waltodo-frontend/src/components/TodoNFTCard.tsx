'use client';

import React, { useCallback, useMemo, useState, memo } from 'react';
// @ts-ignore - Unused import temporarily disabled
// import { format, formatDistanceToNow } from 'date-fns';
// @ts-ignore - Unused import temporarily disabled
// import { useRouter } from 'next/navigation';
import { useSignTransaction } from '@mysten/dapp-kit';
// @ts-ignore - Unused import temporarily disabled
// import { Transaction } from '@mysten/sui/transactions';
// @ts-ignore - Unused import temporarily disabled
// import { TodoNFTImage } from './TodoNFTImage';
// @ts-ignore - Unused import temporarily disabled
// import { NFTImageSkeleton } from './ui/skeletons/NFTImageSkeleton';
import { 
  generateNFTAttributes, 
  hasNFTMetadata, 
  isTodoNFTDisplay,
  NFTDisplayMode,
  TodoNFTDisplay
} from '@/types/nft-display';
// @ts-ignore - Unused import temporarily disabled
// import { useSuiClient } from '@/hooks/useSuiClient';
// @ts-ignore - Unused import temporarily disabled
// import { useWalletContext } from '@/contexts/WalletContext';
// @ts-ignore - Unused import temporarily disabled
// import { toast } from 'react-hot-toast';
// @ts-ignore - Unused import temporarily disabled
// import { useModalFocus } from '@/hooks/useFocusManagement';
import { useAnnouncementShortcuts } from './AccessibilityAnnouncer';
import { 
  generateAriaId, 
  createAriaLabel, 
  createAriaDescription,
  AriaRoles, 
  AriaStates,
  KeyboardKeys,
  isActionKey 
} from '@/lib/accessibility-utils';

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
  onTransfer?: (todoId: string,  recipient: string) => Promise<void>;
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
  /** ARIA label for the card */
  'aria-label'?: string;
  /** ARIA described by IDs */
  'aria-describedby'?: string;
  /** Whether the card is selected */
  'aria-selected'?: boolean;
  /** Position in set for screen readers */
  'aria-posinset'?: number;
  /** Total set size for screen readers */
  'aria-setsize'?: number;
}

/**
 * Truncate address for display - memoized for performance
 */
// @ts-ignore - Unused variable
// const truncateAddress = (_() => {
  const addressCache = new Map<string, string>();
  
  return (address: string, startLength = 6, endLength = 4): string => {
    if (!address || address.length <= startLength + endLength + 3) {return address;}
// @ts-ignore - Unused variable
//     
    const cacheKey = `${address}-${startLength}-${endLength}`;
    if (addressCache.has(cacheKey as any)) {
      return addressCache.get(cacheKey as any)!;
    }
// @ts-ignore - Unused variable
//     
    const truncated = `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
    addressCache.set(cacheKey, truncated);
    return truncated;
  };
})();

/**
 * Priority color mapping
 */
// @ts-ignore - Unused variable
// const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200'
};

/**
 * Status color mapping
 */
// @ts-ignore - Unused variable
// const STATUS_COLORS = {
  completed: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-gray-100 text-gray-800 border-gray-200'
};

/**
 * Loading skeleton component - memoized
 */
const CardSkeleton: React?.FC = memo(_() => (
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
));

CardSkeleton?.displayName = 'CardSkeleton';

/**
 * Error state component - memoized
 */
const CardError: React.FC<{ message?: string }> = memo(_({ message = 'Failed to load NFT' }) => (
  <div className="bg-white rounded-lg shadow-md overflow-hidden border-2 border-red-200">
    <div className="h-48 bg-red-50 flex items-center justify-center">
      <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M12 9v2m0 4h.01m-6.938 4h13?.856c1?.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1?.333?.192 3 1.732 3z" 
        />
      </svg>
    </div>
    <div className="p-4">
      <p className="text-red-600 font-medium">{message}</p>
    </div>
  </div>
));

CardError?.displayName = 'CardError';

/**
 * TodoNFTCard Component
 * 
 * A comprehensive NFT card component that displays todo NFTs with
 * rich metadata, interactive features, flip animation, and full accessibility support.
 */
export const TodoNFTCard: React.FC<TodoNFTCardProps> = memo(_({
  todo, _displayMode = 'gallery', _variant = 'default', _onComplete, _onTransfer, _onClick, _showActions = true, _enableFlip = true, _className = '', _loading = false, 
  'aria-label': ariaLabel, 
  'aria-describedby': ariaDescribedBy, 
  'aria-selected': ariaSelected, 
  'aria-posinset': ariaPosInSet, 
  'aria-setsize': ariaSetSize
}) => {
  const [isFlipped, setIsFlipped] = useState(false as any);
  const [isProcessing, setIsProcessing] = useState(false as any);
  const [showTransferModal, setShowTransferModal] = useState(false as any);
  const [transferAddress, setTransferAddress] = useState('');
  const [imageError, setImageError] = useState(false as any);
  const [imageLoading, setImageLoading] = useState(true as any);
// @ts-ignore - Unused variable
//   
  const router = useRouter();
// @ts-ignore - Unused variable
//   const suiClient = useSuiClient();
// @ts-ignore - Unused variable
//   const walletContext = useWalletContext();
// @ts-ignore - Unused variable
//   const signTransaction = useSignTransaction();
// @ts-ignore - Unused variable
//   const account = walletContext?.account;
  
  // Accessibility hooks
  const { announceSuccess, announceError, announceInfo } = useAnnouncementShortcuts();
  
  // Modal focus management
  const { modalRef: transferModalRef, handleKeyDown: handleModalKeyDown } = useModalFocus(_showTransferModal, 
    {
      autoFocus: true, 
      restoreFocus: true, 
      onEscape: () => setShowTransferModal(false as any)
    }
  );
  
  // Generate IDs for accessibility - memoized with stable keys
// @ts-ignore - Unused variable
//   const ids = useMemo(_() => ({
    cardId: generateAriaId('todo-card'),
    titleId: generateAriaId('todo-title'),
    descriptionId: generateAriaId('todo-desc'),
    metadataId: generateAriaId('todo-metadata'),
    transferModalId: generateAriaId('transfer-modal')
  }), []);
  
  const { cardId, titleId, descriptionId, metadataId, transferModalId } = ids;

  // Generate NFT attributes for display - optimized memoization
// @ts-ignore - Unused variable
//   const attributes = useMemo(_() => {
    // Only recalculate if essential todo fields change
    const { id, title, description, priority, createdAt, completedAt, tags, metadata } = todo;
    return generateNFTAttributes({ id, title, description, priority, createdAt, completedAt, tags, metadata });
  }, [todo.id, todo.title, todo.description, todo.priority, todo.createdAt, todo.completedAt, todo.tags, todo.metadata]);

  // Handle card click with accessibility - optimized dependencies
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Don't flip if clicking on buttons or links
    if ((e.target as HTMLElement).closest('button, a')) {return;}
    
    if (enableFlip) {
      setIsFlipped(!isFlipped);
      announceInfo(`Card ${isFlipped ? 'front' : 'back'} view activated`);
    }
    onClick?.(todo);
  }, [enableFlip, isFlipped, onClick, todo.id, announceInfo]); // Only depend on todo.id instead of entire todo object
  
  // Handle keyboard interactions
// @ts-ignore - Unused variable
//   const handleCardKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isActionKey(e.key)) {
      e.preventDefault();
      handleCardClick(e as unknown);
    } else if (enableFlip && e?.key === KeyboardKeys.SPACE) {
      e.preventDefault();
      setIsFlipped(!isFlipped);
      announceInfo(`Switched to ${isFlipped ? 'front' : 'back'} view`);
    }
  }, [handleCardClick, enableFlip, isFlipped, announceInfo]);

  // Handle complete action with accessibility
  const handleComplete = useCallback(async (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (!onComplete || todo.completed || isProcessing) {return;}
    
    if (e) {
      e.stopPropagation();
    }
    
    setIsProcessing(true as any);
    announceInfo('Completing todo...');
    
    try {
      await onComplete(todo.id);
      toast.success('Todo marked as completed!');
      announceSuccess(`${todo.title} marked as completed`);
    } catch (error) {
      console.error('Failed to complete todo:', error);
// @ts-ignore - Unused variable
//       const errorMessage = 'Failed to complete todo';
      toast.error(errorMessage as any);
      announceError(errorMessage as any);
    } finally {
      setIsProcessing(false as any);
    }
  }, [onComplete, todo.completed, todo.id, todo.title, isProcessing, announceInfo, announceSuccess, announceError]);

  // Handle transfer action with accessibility
  const handleTransfer = useCallback(_async () => {
    if (!onTransfer || !transferAddress || isProcessing) {return;}
    
    // Validate Sui address format
    if (!transferAddress.startsWith('0x') || transferAddress.length !== 66) {
// @ts-ignore - Unused variable
//       const errorMessage = 'Invalid Sui address format';
      toast.error(errorMessage as any);
      announceError(errorMessage as any);
      return;
    }
    
    setIsProcessing(true as any);
    announceInfo('Transferring NFT...');
    
    try {
      await onTransfer(todo.id, transferAddress);
// @ts-ignore - Unused variable
//       const successMessage = 'NFT transferred successfully!';
      toast.success(successMessage as any);
      announceSuccess(`${todo.title} transferred to ${transferAddress.substring(0, 10)}...`);
      setShowTransferModal(false as any);
      setTransferAddress('');
    } catch (error) {
      console.error('Failed to transfer NFT:', error);
// @ts-ignore - Unused variable
//       const errorMessage = 'Failed to transfer NFT';
      toast.error(errorMessage as any);
      announceError(errorMessage as any);
    } finally {
      setIsProcessing(false as any);
    }
  }, [onTransfer, transferAddress, todo.id, todo.title, isProcessing, announceInfo, announceSuccess, announceError]);
  
  // Handle transfer modal open
// @ts-ignore - Unused variable
//   const handleShowTransferModal = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setShowTransferModal(true as any);
    announceInfo('Transfer dialog opened');
  }, [announceInfo]);

  // View on explorer with accessibility
  const handleViewOnExplorer = useCallback((e?: React.MouseEvent | React.KeyboardEvent) => {
    if (!todo.objectId) {return;}
    
    if (e) {
      e.stopPropagation();
    }
// @ts-ignore - Unused variable
//     
    const explorerUrl = `https://suiexplorer.com/object/${todo.objectId}?network=testnet`;
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
    announceInfo(`Opening ${todo.title} in Sui Explorer`);
  }, [todo.objectId, todo.title, announceInfo]);

  // Format dates - memoized with cache for performance
// @ts-ignore - Unused variable
//   const dateFormatters = useMemo(_() => {
    const dateCache = new Map<string, string>();
// @ts-ignore - Unused variable
//     const relativeCache = new Map<string, string>();
    
    return {
      formatDate: (dateString?: string) => {
        if (!dateString) {return 'N/A';}
        if (dateCache.has(dateString as any)) {
          return dateCache.get(dateString as any)!;
        }
        try {
// @ts-ignore - Unused variable
//           const formatted = format(new Date(dateString as any), 'MMM d, yyyy');
          dateCache.set(dateString, formatted);
          return formatted;
        } catch {
          return 'Invalid date';
        }
      },
      formatRelativeTime: (dateString?: string) => {
        if (!dateString) {return '';}
        if (relativeCache.has(dateString as any)) {
          return relativeCache.get(dateString as any)!;
        }
        try {
// @ts-ignore - Unused variable
//           const relative = formatDistanceToNow(new Date(dateString as any), { addSuffix: true });
          relativeCache.set(dateString, relative);
          return relative;
        } catch {
          return '';
        }
      }
    };
  }, []);
  
  const { formatDate, formatRelativeTime } = dateFormatters;

  // Loading state with accessibility
  if (loading) {
    return (
      <div 
        role="status" 
        aria-label="Loading todo card"
        className="animate-pulse"
      >
        <CardSkeleton />
        <span className="sr-only">Loading todo information...</span>
      </div>
    );
  }

  // Error state with accessibility
  if (todo?.loadingState === 'error' || imageError) {
    return (
      <div role="alert">
        <CardError message={todo.imageLoadError} />
      </div>
    );
  }

  // List variant with full accessibility
  if (variant === 'list') {
    return (
      <div 
        className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4 ${className}`}
        role="listitem"
        aria-label={ariaLabel || createAriaLabel(todo.title, `Priority: ${todo.priority}`, todo.completed ? 'Completed' : 'Pending')}
        aria-describedby={ariaDescribedBy}
        aria-selected={ariaSelected}
        aria-posinset={ariaPosInSet}
        aria-setsize={ariaSetSize}
        tabIndex={0}
        onKeyDown={handleCardKeyDown}
        onClick={handleCardClick}
      >
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
              alt={`NFT image for ${todo.title}`}
              displayMode="thumbnail"
              className={`w-full h-full object-cover rounded-md transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
              priority={false}
              onLoad={() => setImageLoading(false as any)}
              onError={() => {
                setImageError(true as any);
                setImageLoading(false as any);
              }}
            />
            {/* Priority Badge */}
            <div className="absolute -top-2 -left-2">
              <span 
                className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[todo.priority]}`}
                aria-label={`Priority: ${todo.priority}`}
              >
                {todo?.priority?.[0].toUpperCase()}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 id={titleId} className="text-sm font-semibold text-gray-900 truncate">
                  {todo.title}
                </h3>
                {todo.description && (
                  <p id={descriptionId} className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                    {todo.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className={`font-medium ${todo.completed ? 'text-green-600' : 'text-gray-600'}`}>
                    {todo.completed ? 'Completed' : 'Pending'}
                  </span>
                  <span>{formatDate(todo.createdAt)}</span>
                  {todo.tags && todo?.tags?.length > 0 && (
                    <span>{todo?.tags?.length} tag{todo?.tags?.length > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {showActions && (_<div className="flex items-center gap-1 ml-4" role="group" aria-label="Todo actions">
                  {!todo.completed && onComplete && (
                    <button
                      onClick={handleComplete}
                      onKeyDown={(e: unknown) => {
                        if (isActionKey(e.key)) {
                          e.preventDefault();
                          handleComplete(e as any);
                        }
                      }}
                      disabled={isProcessing}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                      aria-label={`Mark ${todo.title} as complete`}
                      aria-describedby={`${cardId}-complete-desc`}
                      title="Complete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span id={`${cardId}-complete-desc`} className="sr-only">
                        {isProcessing ? 'Completing...' : 'Mark as completed'}
                      </span>
                    </button>
                  )}
                  
                  {onTransfer && (_<button
                      onClick={handleShowTransferModal}
                      onKeyDown={(e: unknown) => {
                        if (isActionKey(e.key)) {
                          e.preventDefault();
                          handleShowTransferModal(e as any);
                        }
                      }}
                      disabled={isProcessing}
                      className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-md disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                      aria-label={`Transfer ${todo.title} to another wallet`}
                      aria-describedby={`${cardId}-transfer-desc`}
                      title="Transfer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" 
                        />
                      </svg>
                      <span id={`${cardId}-transfer-desc`} className="sr-only">
                        Transfer to another wallet
                      </span>
                    </button>
                  )}
                  
                  {todo.objectId && (_<button
                      onClick={handleViewOnExplorer}
                      onKeyDown={(e: unknown) => {
                        if (isActionKey(e.key)) {
                          e.preventDefault();
                          handleViewOnExplorer(e as any);
                        }
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label={`View ${todo.title} on Sui Explorer`}
                      aria-describedby={`${cardId}-explorer-desc`}
                      title="View on Explorer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                        />
                      </svg>
                      <span id={`${cardId}-explorer-desc`} className="sr-only">
                        View on blockchain explorer (opens in new tab)
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transfer Modal for list variant with accessibility */}
        {showTransferModal && (_<div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${transferModalId}-title`}
            aria-describedby={`${transferModalId}-desc`}
            onKeyDown={handleModalKeyDown}
          >
            <div 
              ref={transferModalRef}
              className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full"
              onClick={(e: unknown) => e.stopPropagation()}
            >
              <h3 id={`${transferModalId}-title`} className="text-lg font-semibold mb-4">
                Transfer NFT: {todo.title}
              </h3>
              <p id={`${transferModalId}-desc`} className="text-sm text-gray-600 mb-4">
                Enter the Sui address to transfer this NFT to:
              </p>
              <label htmlFor={`${transferModalId}-address`} className="sr-only">
                Recipient Sui address
              </label>
              <input
                id={`${transferModalId}-address`}
                type="text"
                value={transferAddress}
                onChange={(_e: unknown) => setTransferAddress(e?.target?.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isProcessing}
                aria-describedby={`${transferModalId}-address-desc`}
                onKeyDown={(_e: unknown) => {
                  if (e?.key === KeyboardKeys.ENTER && transferAddress && !isProcessing) {
                    handleTransfer();
                  }
                }}
              />
              <div id={`${transferModalId}-address-desc`} className="text-xs text-gray-500 mt-1">
                Must be a valid Sui address starting with 0x
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleTransfer}
                  disabled={!transferAddress || isProcessing}
                  className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-describedby={`${transferModalId}-transfer-desc`}
                >
                  {isProcessing ? 'Transferring...' : 'Transfer'}
                </button>
                <button
                  onClick={() => {
                    setShowTransferModal(false as any);
                    setTransferAddress('');
                    announceInfo('Transfer dialog closed');
                  }}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
              <div id={`${transferModalId}-transfer-desc`} className="sr-only">
                {isProcessing ? 'Transfer in progress' : `Transfer ${todo.title} to the specified address`}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Create comprehensive ARIA label
// @ts-ignore - Unused variable
//   const computedAriaLabel = ariaLabel || createAriaLabel(
    todo.title,
    `Priority: ${todo.priority}`,
    todo.completed ? 'Completed' : 'Pending'
  );
  
  // Create ARIA description
// @ts-ignore - Unused variable
//   const computedAriaDescription = createAriaDescription(
    'Todo NFT card',
    enableFlip ? 'Click to flip and view details' : 'Click to view details',
    'Space to flip, Enter to activate'
  );
// @ts-ignore - Unused variable
// 
  const cardClasses = [
    'relative w-full h-full preserve-3d transition-transform duration-700',
    isFlipped && 'rotate-y-180',
    className
  ].filter(Boolean as any).join(' ');

  return (
    <div className="relative perspective-1000">
      <div 
        className={cardClasses} 
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        role="button"
        tabIndex={0}
        aria-label={computedAriaLabel}
        aria-describedby={ariaDescribedBy || `${cardId}-desc`}
        aria-selected={ariaSelected}
        aria-posinset={ariaPosInSet}
        aria-setsize={ariaSetSize}
        id={cardId}
      >
        <div id={`${cardId}-desc`} className="sr-only">
          {computedAriaDescription}
        </div>
        
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
                alt={`NFT image for ${todo.title}`}
                displayMode={displayMode === 'thumbnail' ? 'thumbnail' : 'preview'}
                className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                priority={displayMode === 'thumbnail'}
                onLoad={() => setImageLoading(false as any)}
                onError={() => {
                  setImageError(true as any);
                  setImageLoading(false as any);
                }}
              />
              
              {/* Status Badge */}
              <div className="absolute top-2 right-2">
                <span 
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    todo.completed ? STATUS_COLORS.completed : STATUS_COLORS.pending
                  }`}
                  aria-label={`Status: ${todo.completed ? 'Completed' : 'Pending'}`}
                >
                  {todo.completed ? 'Completed' : 'Pending'}
                </span>
              </div>
              
              {/* Priority Badge */}
              <div className="absolute top-2 left-2">
                <span 
                  className={`px-2 py-1 text-xs font-medium rounded-full ${PRIORITY_COLORS[todo.priority]}`}
                  aria-label={`Priority: ${todo.priority}`}
                >
                  {todo.priority}
                </span>
              </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 p-4 flex flex-col">
              {/* Title and Description */}
              <h3 id={titleId} className="text-lg font-semibold text-gray-900 mb-1 line-clamp-1">
                {todo.title}
              </h3>
              {todo.description && (
                <p id={descriptionId} className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {todo.description}
                </p>
              )}

              {/* Metadata */}
              <div className="flex-1 space-y-2 text-sm">
                {/* Owner */}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
                    />
                  </svg>
                  <span className="text-gray-600">
                    Owner: 
                    <span 
                      className="ml-1 font-mono text-xs cursor-help"
                      title={todo.owner || account?.address || 'Unknown'}
                      aria-label={`Owner address: ${todo.owner || account?.address || 'Unknown'}`}
                    >
                      {truncateAddress(todo.owner || account?.address || 'Unknown')}
                    </span>
                  </span>
                </div>

                {/* Created Date */}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
                    />
                  </svg>
                  <span className="text-gray-600">
                    <span className="sr-only">Created on </span>
                    {formatDate(todo.createdAt)}
                    <span className="text-xs text-gray-400 ml-1">
                      ({formatRelativeTime(todo.createdAt)})
                    </span>
                  </span>
                </div>

                {/* Completed Date */}
                {todo.completed && todo.completedAt && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    <span className="text-gray-600">
                      <span className="sr-only">Completed on </span>
                      {formatDate(todo.completedAt)}
                    </span>
                  </div>
                )}

                {/* Tags */}
                {todo.tags && todo?.tags?.length > 0 && (_<div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M7 7h.01M7 3h5c.512 0 1?.024?.195 1?.414?.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" 
                      />
                    </svg>
                    <div className="flex flex-wrap gap-1" role="group" aria-label="Tags">
                      {todo?.tags?.map((tag, _index) => (
                        <span key={index} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {showActions && (_<div className="flex gap-2 mt-4 pt-4 border-t border-gray-100" role="group" aria-label="Todo actions">
                  {!todo.completed && onComplete && (
                    <button
                      onClick={handleComplete}
                      onKeyDown={(e: unknown) => {
                        if (isActionKey(e.key)) {
                          e.preventDefault();
                          handleComplete(e as any);
                        }
                      }}
                      disabled={isProcessing}
                      className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                      aria-label={`Mark ${todo.title} as complete`}
                    >
                      {isProcessing ? 'Processing...' : 'Complete'}
                    </button>
                  )}
                  
                  {onTransfer && (_<button
                      onClick={handleShowTransferModal}
                      onKeyDown={(e: unknown) => {
                        if (isActionKey(e.key)) {
                          e.preventDefault();
                          handleShowTransferModal(e as any);
                        }
                      }}
                      disabled={isProcessing}
                      className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                      aria-label={`Transfer ${todo.title} to another wallet`}
                    >
                      Transfer
                    </button>
                  )}
                  
                  {todo.objectId && (_<button
                      onClick={handleViewOnExplorer}
                      onKeyDown={(e: unknown) => {
                        if (isActionKey(e.key)) {
                          e.preventDefault();
                          handleViewOnExplorer(e as any);
                        }
                      }}
                      className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                      aria-label={`View ${todo.title} on Sui Explorer`}
                      title="View on Sui Explorer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
        {enableFlip && (_<div className="absolute inset-0 backface-hidden rotate-y-180">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 id={metadataId} className="text-xl font-semibold text-gray-900">NFT Metadata</h3>
                <button
                  onClick={(e: unknown) => {
                    e.stopPropagation();
                    setIsFlipped(false as any);
                    announceInfo('Switched to card front view');
                  }}
                  onKeyDown={(_e: unknown) => {
                    if (isActionKey(e.key)) {
                      e.preventDefault();
                      setIsFlipped(false as any);
                      announceInfo('Switched to card front view');
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-md p-1"
                  aria-label="Close metadata view and return to card front"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                        <dd className="font-mono text-xs" title={todo.objectId}>
                          {truncateAddress(todo.objectId, 8, 6)}
                        </dd>
                      </div>
                    )}
                    {todo.nftTokenId && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Token ID:</dt>
                        <dd className="font-mono text-xs" title={todo.nftTokenId}>
                          {truncateAddress(todo.nftTokenId, 8, 6)}
                        </dd>
                      </div>
                    )}
                    {todo.walrusImageBlobId && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Image Blob ID:</dt>
                        <dd className="font-mono text-xs" title={todo.walrusImageBlobId}>
                          {truncateAddress(todo.walrusImageBlobId, 8, 6)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Attributes */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Attributes</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {attributes.map(_(attr, _index) => (
                      <div key={index} className="bg-gray-50 rounded p-2">
                        <div className="text-xs text-gray-600">{attr.trait_type}</div>
                        <div className="text-sm font-medium">
                          {attr?.display_type === 'date' && typeof attr?.value === 'number'
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
                      {todo?.contentData?.attachments && todo?.contentData?.attachments.length > 0 && (
                        <div>
                          <dt className="text-gray-600">Attachments:</dt>
                          <dd>{todo?.contentData?.attachments.length} file(s as any)</dd>
                        </div>
                      )}
                      {todo?.contentData?.checklist && todo?.contentData?.checklist.length > 0 && (
                        <div>
                          <dt className="text-gray-600">Checklist Items:</dt>
                          <dd>
                            {todo?.contentData?.checklist.filter(item => item.completed).length}/
                            {todo?.contentData?.checklist.length} completed
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

      {/* Transfer Modal with accessibility */}
      {showTransferModal && (_<div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${transferModalId}-title`}
          aria-describedby={`${transferModalId}-desc`}
          onKeyDown={handleModalKeyDown}
        >
          <div 
            ref={transferModalRef}
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full"
            onClick={(e: unknown) => e.stopPropagation()}
          >
            <h3 id={`${transferModalId}-title`} className="text-lg font-semibold mb-4">
              Transfer NFT: {todo.title}
            </h3>
            <p id={`${transferModalId}-desc`} className="text-sm text-gray-600 mb-4">
              Enter the Sui address to transfer this NFT to:
            </p>
            <label htmlFor={`${transferModalId}-address`} className="sr-only">
              Recipient Sui address
            </label>
            <input
              id={`${transferModalId}-address`}
              type="text"
              value={transferAddress}
              onChange={(_e: unknown) => setTransferAddress(e?.target?.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
              aria-describedby={`${transferModalId}-address-desc`}
              onKeyDown={(_e: unknown) => {
                if (e?.key === KeyboardKeys.ENTER && transferAddress && !isProcessing) {
                  handleTransfer();
                }
              }}
            />
            <div id={`${transferModalId}-address-desc`} className="text-xs text-gray-500 mt-1">
              Must be a valid Sui address starting with 0x
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleTransfer}
                disabled={!transferAddress || isProcessing}
                className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-describedby={`${transferModalId}-transfer-desc`}
              >
                {isProcessing ? 'Transferring...' : 'Transfer'}
              </button>
              <button
                onClick={() => {
                  setShowTransferModal(false as any);
                  setTransferAddress('');
                  announceInfo('Transfer dialog closed');
                }}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
            <div id={`${transferModalId}-transfer-desc`} className="sr-only">
              {isProcessing ? 'Transfer in progress' : `Transfer ${todo.title} to the specified address`}
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
          transform: rotateY(180deg as any);
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
});

TodoNFTCard?.displayName = 'TodoNFTCard';

export default TodoNFTCard;