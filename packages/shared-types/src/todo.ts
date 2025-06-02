/**
 * Core Todo interface used across CLI and frontend
 */
export interface Todo {
  id: string;
  title: string;
  description: string; // Using description field, not content
  completed: boolean;
  createdAt: Date | string;
  updatedAt?: Date | string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  dueDate?: Date | string;
  
  // Storage information
  storageLocation?: 'local' | 'walrus' | 'blockchain';
  walrusUrls?: string[];
  blobId?: string;
  transactionId?: string;
  
  // NFT information
  nftId?: string;
  nftMetadata?: TodoNFTMetadata;
}

/**
 * NFT metadata for todos stored on blockchain
 */
export interface TodoNFTMetadata {
  name: string;
  description: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

/**
 * Todo creation input
 */
export interface CreateTodoInput {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  dueDate?: Date | string;
}

/**
 * Todo update input
 */
export interface UpdateTodoInput {
  title?: string;
  description?: string;
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  dueDate?: Date | string;
}

/**
 * Todo list filters
 */
export interface TodoFilters {
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  storageLocation?: 'local' | 'walrus' | 'blockchain';
  search?: string;
  startDate?: Date | string;
  endDate?: Date | string;
}

/**
 * Todo list sorting options
 */
export interface TodoSortOptions {
  field: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'title';
  order: 'asc' | 'desc';
}