/**
 * ResultCache - Caching system for AI operation results
 * 
 * Improves performance by caching AI responses for identical requests.
 * Implements:
 * - Time-based expiration
 * - LRU (Least Recently Used) cache eviction
 * - Input normalization to increase cache hits
 */

import crypto from 'crypto';
import { AIResponse } from '../../types/adapters/AIModelAdapter';
import { Todo } from '../../types/todo';

interface CacheEntry<T> {
  result: T;
  timestamp: number;
  hash: string;
  operationType: string;
}

interface CacheConfig {
  enabled: boolean;
  ttlMs: number;
  maxEntries: number;
}

export class ResultCache {
  private static instance: ResultCache;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig = {
    enabled: true,
    ttlMs: 15 * 60 * 1000, // 15 minutes default TTL
    maxEntries: 100
  };
  
  // LRU tracking
  private accessOrder: string[] = [];
  
  private constructor() {
    // Private constructor for singleton
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ResultCache {
    if (!ResultCache.instance) {
      ResultCache.instance = new ResultCache();
    }
    
    return ResultCache.instance;
  }
  
  /**
   * Configure cache behavior
   */
  public configure(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    
    // If cache is disabled, clear it
    if (!this.config.enabled) {
      this.clear();
    }
  }
  
  /**
   * Get current cache configuration
   */
  public getConfig(): CacheConfig {
    return { ...this.config };
  }
  
  /**
   * Get a cached result for an operation
   */
  public get<T>(
    operation: string,
    todos: Todo[],
    additionalParams: Record<string, any> = {}
  ): AIResponse<T> | null {
    if (!this.config.enabled) {
      return null;
    }
    
    const hash = this.createHash(operation, todos, additionalParams);
    const cacheKey = `${operation}:${hash}`;
    
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return null;
    }
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(cacheKey);
      this.accessOrder = this.accessOrder.filter(key => key !== cacheKey);
      return null;
    }
    
    // Update LRU tracking
    this.updateAccessOrder(cacheKey);
    
    return entry.result;
  }
  
  /**
   * Store a result in the cache
   */
  public set<T>(
    operation: string,
    todos: Todo[],
    result: AIResponse<T>,
    additionalParams: Record<string, any> = {}
  ): void {
    if (!this.config.enabled) {
      return;
    }
    
    // Enforce cache size limits
    if (this.cache.size >= this.config.maxEntries) {
      // Remove least recently used entry
      const lruKey = this.accessOrder[0];
      if (lruKey) {
        this.cache.delete(lruKey);
        this.accessOrder.shift();
      }
    }
    
    const hash = this.createHash(operation, todos, additionalParams);
    const cacheKey = `${operation}:${hash}`;
    
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      hash,
      operationType: operation
    });
    
    // Update LRU tracking
    this.updateAccessOrder(cacheKey);
  }
  
  /**
   * Clear all cached results
   */
  public clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }
  
  /**
   * Clear cached results for a specific operation
   */
  public clearOperation(operation: string): void {
    // Find and remove all entries for this operation
    const keysToRemove: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (key.startsWith(`${operation}:`)) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    });
  }
  
  /**
   * Get cache statistics
   */
  public getStats(): {
    size: number;
    hitRate: number;
    operations: Record<string, number>;
  } {
    const operations: Record<string, number> = {};
    
    this.cache.forEach(entry => {
      const op = entry.operationType;
      operations[op] = (operations[op] || 0) + 1;
    });
    
    return {
      size: this.cache.size,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      operations
    };
  }
  
  // Tracking cache performance
  private hits: number = 0;
  private misses: number = 0;
  
  /**
   * Record a cache hit
   */
  public recordHit(): void {
    this.hits++;
  }
  
  /**
   * Record a cache miss
   */
  public recordMiss(): void {
    this.misses++;
  }
  
  /**
   * Create a hash from input parameters
   */
  private createHash(
    operation: string,
    todos: Todo[],
    additionalParams: Record<string, any> = {}
  ): string {
    // Normalize todos - sort by ID to ensure consistent ordering
    const normalizedTodos = [...todos].sort((a, b) => a.id.localeCompare(b.id));
    
    // Extract only the necessary fields from todos to reduce hash sensitivity
    const todoData = normalizedTodos.map(todo => ({
      id: todo.id,
      title: todo.title,
      description: todo.description,
      completed: todo.completed
    }));
    
    // Create input object with all parameters
    const input = {
      operation,
      todos: todoData,
      params: additionalParams
    };
    
    // Create hash
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
      
    return hash;
  }
  
  /**
   * Update the access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    // Remove key from current position (if it exists)
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    
    // Add key to the end (most recently used)
    this.accessOrder.push(key);
  }
}