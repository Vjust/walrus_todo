/**
 * NFT Display Types
 * Extends existing Todo types with NFT-specific display properties
 * Based on the todo_nft.move smart contract structure
 */

import { Todo } from './todo-nft';

/**
 * Loading states for NFT image display
 */
export type NFTLoadingState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Display modes for NFT images
 */
export type NFTDisplayMode = 'thumbnail' | 'full' | 'gallery' | 'card' | 'preview';

/**
 * NFT display configuration
 */
export interface NFTDisplayConfig {
  mode: NFTDisplayMode;
  showMetadata: boolean;
  showOwner: boolean;
  showTimestamps: boolean;
  enableLazyLoading: boolean;
  fallbackImageUrl?: string;
}

export interface NFTAttribute {
  trait_type: string;
  value: string | number | boolean;
  display_type?: 'string' | 'number' | 'date' | 'boost_percentage' | 'boost_number';
}

export interface NFTDisplayMetadata {
  title: string;
  description?: string;
  imageUrl: string;
  attributes: NFTAttribute[];
  properties?: Record<string, any>;
}

export interface NFTImageMetadata {
  url: string;
  width?: number;
  height?: number;
  mimeType?: string;
  size?: number;
  checksum?: string;
  compressed?: boolean;
  originalSize?: number;
}

export interface NFTStorageInfo {
  walrusBlobId: string;
  storageEpochs: number;
  expirationDate: Date;
  storageCost: {
    total: string;
    perEpoch: string;
    currency: 'WAL';
  };
  dataSize: number;
}

export interface NFTTransferHistory {
  from: string;
  to: string;
  timestamp: Date;
  transactionDigest: string;
}

/**
 * Extended Todo interface with NFT display properties
 */
export interface TodoNFTDisplay extends Todo {
  /** Converted HTTP URL for display (from Walrus blob ID) */
  displayImageUrl: string;
  /** Original Walrus blob ID for the image */
  walrusImageBlobId?: string;
  /** NFT token ID on Sui blockchain */
  nftTokenId?: string;
  /** Current loading state of the NFT image */
  loadingState: NFTLoadingState;
  /** Error message if image loading failed */
  imageLoadError?: string;
  /** Additional content data stored in Walrus (parsed from metadata) */
  contentData?: {
    attachments?: string[];
    links?: string[];
    checklist?: Array<{ text: string; completed: boolean }>;
    customFields?: Record<string, any>;
  };
  /** Display configuration for this NFT */
  displayConfig?: NFTDisplayConfig;
  /** Cached thumbnail URLs for different sizes */
  thumbnails?: {
    small?: string;
    medium?: string;
    large?: string;
  };
  /** Blockchain-specific metadata */
  blockchainMetadata?: {
    transactionDigest?: string;
    objectVersion?: string;
    previousTransaction?: string;
    storageRebate?: string;
  };
}

/**
 * Helper function to convert Walrus blob ID to display URL
 */
export function convertToDisplayUrl(walrusBlobId: string, aggregator?: string): string {
  const defaultAggregator = aggregator || 'https://aggregator.walrus-testnet.walrus.space';
  return `${defaultAggregator}/v1/${walrusBlobId}`;
}

/**
 * Helper function to extract blob ID from Walrus URL
 */
export function extractBlobId(walrusUrl: string): string | undefined {
  const match = walrusUrl.match(/\/v1\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : undefined;
}

/**
 * Helper function to parse metadata JSON string
 */
export function parseNFTMetadata(metadataStr: string): any {
  try {
    return JSON.parse(metadataStr);
  } catch {
    return null;
  }
}

/**
 * Helper function to create default display config
 */
export function createDefaultDisplayConfig(): NFTDisplayConfig {
  return {
    mode: 'card',
    showMetadata: true,
    showOwner: false,
    showTimestamps: true,
    enableLazyLoading: true,
    fallbackImageUrl: '/images/default-todo-nft.png'
  };
}

/**
 * Helper function to convert Todo to TodoNFTDisplay
 */
export function todoToNFTDisplay(
  todo: Todo, 
  config?: Partial<NFTDisplayConfig>
): TodoNFTDisplay {
  const walrusBlobId = todo.imageUrl && extractBlobId(todo.imageUrl);
  const displayConfig = { ...createDefaultDisplayConfig(), ...config };
  
  return {
    ...todo,
    displayImageUrl: todo.imageUrl ? convertToDisplayUrl(walrusBlobId || '') : '',
    ...(walrusBlobId && { walrusImageBlobId: walrusBlobId }),
    nftTokenId: todo.objectId,
    loadingState: 'idle' as NFTLoadingState,
    ...(todo.metadata && { contentData: parseNFTMetadata(todo.metadata) }),
    displayConfig,
    thumbnails: {},
    blockchainMetadata: {}
  };
}

/**
 * Generate NFT attributes for display
 */
export function generateNFTAttributes(todo: TodoNFTDisplay): NFTAttribute[] {
  const attributes: NFTAttribute[] = [
    {
      trait_type: 'Status',
      value: todo.completed ? 'Completed' : 'Pending',
    },
    {
      trait_type: 'Priority',
      value: todo.priority,
    },
  ];
  
  if (todo.tags && todo.tags.length > 0) {
    attributes.push({
      trait_type: 'Tags',
      value: todo.tags.join(', '),
    });
  }
  
  if (todo.dueDate) {
    attributes.push({
      trait_type: 'Due Date',
      value: new Date(todo.dueDate).getTime() / 1000,
      display_type: 'date',
    });
  }
  
  if (todo.completed && todo.completedAt) {
    attributes.push({
      trait_type: 'Completed Date',
      value: new Date(todo.completedAt).getTime() / 1000,
      display_type: 'date',
    });
  }

  if (todo.createdAt) {
    attributes.push({
      trait_type: 'Created Date',
      value: new Date(todo.createdAt).getTime() / 1000,
      display_type: 'date',
    });
  }
  
  return attributes;
}

/**
 * Type guard to check if a Todo has NFT properties
 */
export function isNFTTodo(todo: Todo): todo is Todo & { objectId: string; imageUrl: string } {
  return Boolean(todo.objectId && todo.imageUrl);
}

/**
 * Type guard to check if object is TodoNFTDisplay
 */
export function isTodoNFTDisplay(obj: any): obj is TodoNFTDisplay {
  return (
    obj &&
    typeof obj === 'object' &&
    'displayImageUrl' in obj &&
    'loadingState' in obj &&
    'id' in obj &&
    'title' in obj
  );
}

/**
 * Type guard to check if metadata matches NFT metadata structure
 */
export function hasNFTMetadata(todo: Todo): boolean {
  return Boolean(todo.metadata && todo.imageUrl && todo.objectId);
}

// Legacy helper functions for compatibility
export const formatNFTAttributes = generateNFTAttributes;

export const formatStorageCost = (costInMist: bigint): string => {
  const walAmount = Number(costInMist) / 1e9;
  return walAmount.toFixed(6);
};

export const calculateStorageExpiration = (epochs: number, epochDurationDays = 30): Date => {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + (epochs * epochDurationDays));
  return expirationDate;
};