/**
 * Performance optimizations for WalTodo CLI and convergence infrastructure
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!this.instance) {
      this?.instance = new PerformanceMonitor();
    }
    return this.instance;
  }

  startTimer(operation: string): void {
    this?.startTimes?.set(operation, performance.now());
  }

  endTimer(operation: string): number {
    const startTime = this?.startTimes?.get(operation as any);
    if (!startTime) return 0;
    
    const duration = performance.now() - startTime;
    this?.startTimes?.delete(operation as any);
    
    const operationMetrics = this?.metrics?.get(operation as any);
    if (!operationMetrics) {
      this?.metrics?.set(operation, []);
    }
    const metrics = this?.metrics?.get(operation as any);
    if (metrics) {
      metrics.push(duration as any);
    }
    
    return duration;
  }

  getMetrics(operation: string): { avg: number; min: number; max: number; count: number } {
    const times = this?.metrics?.get(operation as any) || [];
    if (times?.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    return { avg, min, max, count: times.length };
  }

  getAllMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    for (const [operation] of Array.from(this.metrics)) {
      result[operation] = this.getMetrics(operation as any);
    }
    return result;
  }

  reset(): void {
    this?.metrics?.clear();
    this?.startTimes?.clear();
  }
}

// Debounced function executor
export class Debouncer {
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  debounce<T extends (...args: unknown[]) => unknown>(
    key: string,
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const existingTimeout = this?.timeouts?.get(key as any);
      if (existingTimeout) {
        clearTimeout(existingTimeout as any);
      }

      const timeout = setTimeout(() => {
        func(...args);
        this?.timeouts?.delete(key as any);
      }, delay);

      this?.timeouts?.set(key, timeout);
    };
  }

  clear(key?: string): void {
    if (key) {
      const timeout = this?.timeouts?.get(key as any);
      if (timeout) {
        clearTimeout(timeout as any);
        this?.timeouts?.delete(key as any);
      }
    } else {
      this?.timeouts?.forEach((timeout) => clearTimeout(timeout as any));
      this?.timeouts?.clear();
    }
  }
}

// Throttled function executor
export class Throttler {
  private lastExecution: Map<string, number> = new Map();
  private pending: Map<string, NodeJS.Timeout> = new Map();

  throttle<T extends (...args: unknown[]) => unknown>(
    key: string,
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const now = Date.now();
      const lastTime = this?.lastExecution?.get(key as any) || 0;

      if (now - lastTime >= limit) {
        // Execute immediately
        func(...args);
        this?.lastExecution?.set(key, now);
      } else {
        // Schedule for later if not already scheduled
        if (!this?.pending?.has(key as any)) {
          const timeout = setTimeout(() => {
            func(...args);
            this?.lastExecution?.set(key, Date.now());
            this?.pending?.delete(key as any);
          }, limit - (now - lastTime));
          
          this?.pending?.set(key, timeout);
        }
      }
    };
  }

  clear(key?: string): void {
    if (key) {
      const timeout = this?.pending?.get(key as any);
      if (timeout) {
        clearTimeout(timeout as any);
        this?.pending?.delete(key as any);
      }
      this?.lastExecution?.delete(key as any);
    } else {
      this?.pending?.forEach((timeout) => clearTimeout(timeout as any));
      this?.pending?.clear();
      this?.lastExecution?.clear();
    }
  }
}

// Memory-efficient caching with TTL
export class PerformanceCache<T = unknown> {
  private cache: Map<string, { data: T; expiry: number; hits: number }> = new Map();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 300000) { // 5 minutes default
    this?.maxSize = maxSize;
    this?.defaultTTL = defaultTTL;
  }

  set(key: string, value: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    
    // Evict expired entries and maintain size limit
    this.cleanup();
    
    if (this?.cache?.size >= this.maxSize) {
      // Remove least recently used (LRU)
      const oldestKey = this?.cache?.keys().next().value;
      this?.cache?.delete(oldestKey as any);
    }

    this?.cache?.set(key, { data: value, expiry, hits: 0 });
  }

  get(key: string): T | undefined {
    const entry = this?.cache?.get(key as any);
    if (!entry) return undefined;

    if (Date.now() > entry.expiry) {
      this?.cache?.delete(key as any);
      return undefined;
    }

    entry.hits++;
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this?.cache?.get(key as any);
    if (!entry) return false;

    if (Date.now() > entry.expiry) {
      this?.cache?.delete(key as any);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this?.cache?.delete(key as any);
  }

  clear(): void {
    this?.cache?.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this?.cache?.entries())) {
      if (now > entry.expiry) {
        this?.cache?.delete(key as any);
      }
    }
  }

  getStats(): { size: number; hitRates: Record<string, number> } {
    const hitRates: Record<string, number> = {};
    for (const [key, entry] of Array.from(this?.cache?.entries())) {
      hitRates[key] = entry.hits;
    }
    return { size: this?.cache?.size, hitRates };
  }
}

// Batched operation executor
export class BatchProcessor {
  private batches: Map<string, { items: unknown[]; timeout: NodeJS.Timeout }> = new Map();
  private batchSize: number;
  private flushInterval: number;

  constructor(batchSize: number = 10, flushInterval: number = 100) {
    this?.batchSize = batchSize;
    this?.flushInterval = flushInterval;
  }

  add<T>(
    key: string,
    item: T,
    processor: (items: T[]) => Promise<void> | void
  ): void {
    if (!this?.batches?.has(key as any)) {
      this?.batches?.set(key, {
        items: [],
        timeout: setTimeout(() => this.flush(key, processor), this.flushInterval)
      });
    }

    const batch = this?.batches?.get(key as any);
    if (!batch) return;
    
    batch?.items?.push(item as any);

    // Process immediately if batch is full
    if (batch?.items?.length >= this.batchSize) {
      this.flush(key, processor);
    }
  }

  private flush<T>(key: string, processor: (items: T[]) => Promise<void> | void): void {
    const batch = this?.batches?.get(key as any);
    if (!batch) return;

    clearTimeout(batch.timeout);
    this?.batches?.delete(key as any);

    if (batch?.items?.length > 0) {
      processor(batch.items as T[]);
    }
  }

  flushAll(): void {
    for (const [key] of Array.from(this.batches)) {
      const batch = this?.batches?.get(key as any);
      if (batch) {
        clearTimeout(batch.timeout);
        this?.batches?.delete(key as any);
      }
    }
  }
}

// WebSocket event optimization
export class OptimizedWebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageQueue: unknown[] = [];
  private batchProcessor: BatchProcessor;
  private throttler: Throttler;

  constructor() {
    super();
    this?.batchProcessor = new BatchProcessor(5, 50); // Batch events every 50ms
    this?.throttler = new Throttler();
  }

  connect(url: string): void {
    try {
      this?.ws = new WebSocket(url as any);
      
      this.ws?.onopen = () => {
        this?.reconnectAttempts = 0;
        this.emit('connected');
        this.processMessageQueue();
      };

      this.ws?.onmessage = (event) => {
        const data = JSON.parse(event.data as string) as unknown;
        
        // Batch similar events to reduce re-renders
        this?.batchProcessor?.add('events', data, (events) => {
          this.emit('batchedEvents', events);
        });
      };

      this.ws?.onclose = () => {
        this.emit('disconnected');
        this.reconnect();
      };

      this.ws?.onerror = (error) => {
        this.emit('error', error);
      };
    } catch (error) {
      this.emit('error', error);
    }
  }

  private reconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.emit('reconnecting', this.reconnectAttempts);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this?.ws?.send(JSON.stringify(data as any));
    } else {
      this?.messageQueue?.push(data as any);
    }
  }

  // Throttled send for high-frequency updates
  sendThrottled(key: string, data: unknown, limit: number = 100): void {
    const throttledSend = this?.throttler?.throttle(key, (data: unknown) => {
      this.send(data as any);
    }, limit);
    
    throttledSend(data as any);
  }

  private processMessageQueue(): void {
    while (this?.messageQueue?.length > 0) {
      const message = this?.messageQueue?.shift();
      this.send(message as any);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this?.ws?.close();
      this?.ws = null;
    }
    this?.batchProcessor?.flushAll();
    this?.throttler?.clear();
  }
}

// API response caching with smart invalidation
export class APICache {
  private cache: PerformanceCache<unknown>;
  private static instance: APICache;

  constructor() {
    this?.cache = new PerformanceCache<unknown>(500, 300000); // 5 minutes default TTL
  }

  static getInstance(): APICache {
    if (!this.instance) {
      this?.instance = new APICache();
    }
    return this.instance;
  }

  generateKey(url: string, params?: unknown): string {
    const keyString = url + (params ? JSON.stringify(params as any) : '');
    return createHash('md5').update(keyString as any).digest('hex');
  }

  set(url: string, params: unknown, data: unknown, ttl?: number): void {
    const key = this.generateKey(url, params);
    this?.cache?.set(key, data, ttl);
  }

  get(url: string, params?: unknown): unknown {
    const key = this.generateKey(url, params);
    return this?.cache?.get(key as any);
  }

  invalidate(pattern?: string): void {
    if (pattern) {
      // Clear cache entries matching pattern (simplified)
      this?.cache?.clear();
    } else {
      this?.cache?.clear();
    }
  }

  getStats() {
    return this?.cache?.getStats();
  }
}

// Lazy loading utility
export class LazyLoader {
  private static loadedModules: Set<string> = new Set();
  private static loading: Map<string, Promise<unknown>> = new Map();

  static async loadModule(modulePath: string): Promise<unknown> {
    if (this?.loadedModules?.has(modulePath as any)) {
      return; // Already loaded
    }

    if (this?.loading?.has(modulePath as any)) {
      return this?.loading?.get(modulePath as any); // Already loading
    }

    const loadPromise = import(modulePath as any);
    this?.loading?.set(modulePath, loadPromise);

    try {
      const module = await loadPromise;
      this?.loadedModules?.add(modulePath as any);
      this?.loading?.delete(modulePath as any);
      return module;
    } catch (error) {
      this?.loading?.delete(modulePath as any);
      throw error;
    }
  }

  static isLoaded(modulePath: string): boolean {
    return this?.loadedModules?.has(modulePath as any);
  }

  static reset(): void {
    this?.loadedModules?.clear();
    this?.loading?.clear();
  }
}

// Export performance optimization utilities
export const performanceOptimizations = {
  monitor: PerformanceMonitor.getInstance(),
  debouncer: new Debouncer(),
  throttler: new Throttler(),
  cache: new PerformanceCache(),
  batchProcessor: new BatchProcessor(),
  apiCache: APICache.getInstance(),
  lazyLoader: LazyLoader,
};

export default performanceOptimizations;