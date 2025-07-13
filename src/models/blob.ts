/**
 * Blob model and type definitions for Walrus storage tracking
 */

/**
 * Status of a blob on the Walrus network
 */
export enum BlobStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired', 
  DELETED = 'deleted',
  ERROR = 'error',
  UNKNOWN = 'unknown'
}

/**
 * Metadata for a published blob containing TODOs
 */
export interface PublishedBlob {
  /** Unique blob ID from Walrus network */
  id: string;
  
  /** Timestamp when the blob was published */
  publishedAt: Date;
  
  /** Number of epochs the blob was stored for */
  epochs: number;
  
  /** Cost to store the blob (in SUI) */
  cost: number;
  
  /** Number of TODOs contained in the blob */
  todoCount: number;
  
  /** Size of the blob in bytes */
  size: number;
  
  /** Current status of the blob */
  status: BlobStatus;
  
  /** Last time the status was checked */
  lastStatusCheck?: Date;
  
  /** Whether the blob can be deleted */
  deletable: boolean;
  
  /** Optional description/notes about the blob */
  description?: string;
  
  /** Tags associated with this blob */
  tags: string[];
  
  /** Hash of the TODO data for integrity checking */
  dataHash?: string;
}

/**
 * Summary statistics for published blobs
 */
export interface BlobStats {
  /** Total number of published blobs */
  totalBlobs: number;
  
  /** Number of active blobs */
  activeBlobs: number;
  
  /** Number of expired blobs */
  expiredBlobs: number;
  
  /** Number of deleted blobs */
  deletedBlobs: number;
  
  /** Total storage cost (in SUI) */
  totalCost: number;
  
  /** Total number of TODOs across all blobs */
  totalTodos: number;
  
  /** Total storage size in bytes */
  totalSize: number;
  
  /** Most recent publish date */
  lastPublished?: Date;
}

/**
 * Configuration for publishing blobs
 */
export interface PublishConfig {
  /** Default number of epochs to store blobs */
  defaultEpochs: number;
  
  /** Whether blobs should be deletable by default */
  defaultDeletable: boolean;
  
  /** Maximum blob size in bytes */
  maxBlobSize: number;
  
  /** Whether to compress data before publishing */
  enableCompression: boolean;
  
  /** Whether to encrypt data before publishing */
  enableEncryption: boolean;
  
  /** Default tags to apply to published blobs */
  defaultTags: string[];
}

/**
 * Search criteria for finding blobs
 */
export interface BlobSearchCriteria {
  /** Filter by blob status */
  status?: BlobStatus;
  
  /** Filter by tags (any of these tags) */
  tags?: string[];
  
  /** Filter by minimum TODO count */
  minTodoCount?: number;
  
  /** Filter by maximum TODO count */
  maxTodoCount?: number;
  
  /** Filter by date range - from */
  publishedAfter?: Date;
  
  /** Filter by date range - to */
  publishedBefore?: Date;
  
  /** Filter by minimum cost */
  minCost?: number;
  
  /** Filter by maximum cost */
  maxCost?: number;
  
  /** Search in description text */
  descriptionSearch?: string;
}

/**
 * Result of a blob search operation
 */
export interface BlobSearchResult {
  /** Matching blobs */
  blobs: PublishedBlob[];
  
  /** Total number of matches (may be more than returned) */
  totalMatches: number;
  
  /** Search criteria used */
  criteria: BlobSearchCriteria;
  
  /** Timestamp of the search */
  searchedAt: Date;
}

/**
 * Validation functions for blob data
 */
export class BlobValidator {
  /**
   * Validate a PublishedBlob object
   */
  static validatePublishedBlob(blob: any): blob is PublishedBlob {
    if (!blob || typeof blob !== 'object') {
      return false;
    }
    
    // Required fields
    if (typeof blob.id !== 'string' || !blob.id.trim()) {
      return false;
    }
    
    if (!(blob.publishedAt instanceof Date) && typeof blob.publishedAt !== 'string') {
      return false;
    }
    
    if (typeof blob.epochs !== 'number' || blob.epochs < 1) {
      return false;
    }
    
    if (typeof blob.cost !== 'number' || blob.cost < 0) {
      return false;
    }
    
    if (typeof blob.todoCount !== 'number' || blob.todoCount < 0) {
      return false;
    }
    
    if (typeof blob.size !== 'number' || blob.size < 0) {
      return false;
    }
    
    if (!Object.values(BlobStatus).includes(blob.status)) {
      return false;
    }
    
    if (typeof blob.deletable !== 'boolean') {
      return false;
    }
    
    if (!Array.isArray(blob.tags)) {
      return false;
    }
    
    // Optional fields validation
    if (blob.description !== undefined && typeof blob.description !== 'string') {
      return false;
    }
    
    if (blob.dataHash !== undefined && typeof blob.dataHash !== 'string') {
      return false;
    }
    
    if (blob.lastStatusCheck !== undefined && 
        !(blob.lastStatusCheck instanceof Date) && 
        typeof blob.lastStatusCheck !== 'string') {
      return false;
    }
    
    return true;
  }
  
  /**
   * Validate publish configuration
   */
  static validatePublishConfig(config: any): config is PublishConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }
    
    if (typeof config.defaultEpochs !== 'number' || config.defaultEpochs < 1) {
      return false;
    }
    
    if (typeof config.defaultDeletable !== 'boolean') {
      return false;
    }
    
    if (typeof config.maxBlobSize !== 'number' || config.maxBlobSize < 1) {
      return false;
    }
    
    if (typeof config.enableCompression !== 'boolean') {
      return false;
    }
    
    if (typeof config.enableEncryption !== 'boolean') {
      return false;
    }
    
    if (!Array.isArray(config.defaultTags)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Sanitize and normalize blob data
   */
  static sanitizeBlob(blob: any): PublishedBlob {
    return {
      id: String(blob.id).trim(),
      publishedAt: blob.publishedAt instanceof Date ? blob.publishedAt : new Date(blob.publishedAt),
      epochs: Number(blob.epochs),
      cost: Number(blob.cost),
      todoCount: Number(blob.todoCount),
      size: Number(blob.size),
      status: blob.status as BlobStatus,
      lastStatusCheck: blob.lastStatusCheck ? 
        (blob.lastStatusCheck instanceof Date ? blob.lastStatusCheck : new Date(blob.lastStatusCheck)) : 
        undefined,
      deletable: Boolean(blob.deletable),
      description: blob.description ? String(blob.description) : undefined,
      tags: Array.isArray(blob.tags) ? blob.tags.map(String) : [],
      dataHash: blob.dataHash ? String(blob.dataHash) : undefined,
    };
  }
}

/**
 * Utility functions for working with blobs
 */
export class BlobUtils {
  /**
   * Calculate expiration date for a blob
   */
  static calculateExpirationDate(publishedAt: Date, epochs: number): Date {
    // Assuming each epoch is approximately 24 hours
    // This is a rough estimate - actual epoch duration may vary
    const epochDurationMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    return new Date(publishedAt.getTime() + (epochs * epochDurationMs));
  }
  
  /**
   * Check if a blob is expired based on current time
   */
  static isExpired(blob: PublishedBlob): boolean {
    const expirationDate = this.calculateExpirationDate(blob.publishedAt, blob.epochs);
    return new Date() > expirationDate;
  }
  
  /**
   * Get human-readable size string
   */
  static formatSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    
    return `${size.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  }
  
  /**
   * Format cost for display
   */
  static formatCost(cost: number): string {
    return `${cost.toFixed(6)} SUI`;
  }
  
  /**
   * Generate a short blob ID for display
   */
  static shortBlobId(blobId: string, length: number = 8): string {
    return blobId.length > length ? `${blobId.substring(0, length)}...` : blobId;
  }
  
  /**
   * Sort blobs by various criteria
   */
  static sortBlobs(blobs: PublishedBlob[], sortBy: 'date' | 'cost' | 'size' | 'todos' | 'status', ascending: boolean = true): PublishedBlob[] {
    const sorted = [...blobs].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = a.publishedAt.getTime() - b.publishedAt.getTime();
          break;
        case 'cost':
          comparison = a.cost - b.cost;
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'todos':
          comparison = a.todoCount - b.todoCount;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        default:
          comparison = 0;
      }
      
      return ascending ? comparison : -comparison;
    });
    
    return sorted;
  }
  
  /**
   * Filter blobs based on search criteria
   */
  static filterBlobs(blobs: PublishedBlob[], criteria: BlobSearchCriteria): PublishedBlob[] {
    return blobs.filter(blob => {
      // Status filter
      if (criteria.status && blob.status !== criteria.status) {
        return false;
      }
      
      // Tags filter (any of the specified tags)
      if (criteria.tags && criteria.tags.length > 0) {
        const hasMatchingTag = criteria.tags.some(tag => blob.tags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }
      
      // TODO count filters
      if (criteria.minTodoCount !== undefined && blob.todoCount < criteria.minTodoCount) {
        return false;
      }
      
      if (criteria.maxTodoCount !== undefined && blob.todoCount > criteria.maxTodoCount) {
        return false;
      }
      
      // Date range filters
      if (criteria.publishedAfter && blob.publishedAt < criteria.publishedAfter) {
        return false;
      }
      
      if (criteria.publishedBefore && blob.publishedAt > criteria.publishedBefore) {
        return false;
      }
      
      // Cost filters
      if (criteria.minCost !== undefined && blob.cost < criteria.minCost) {
        return false;
      }
      
      if (criteria.maxCost !== undefined && blob.cost > criteria.maxCost) {
        return false;
      }
      
      // Description search
      if (criteria.descriptionSearch && blob.description) {
        const searchTerm = criteria.descriptionSearch.toLowerCase();
        if (!blob.description.toLowerCase().includes(searchTerm)) {
          return false;
        }
      }
      
      return true;
    });
  }
}