/**
 * ConnectionManager - Manages network connections and ensures proper cleanup
 * 
 * Handles connection state, timeouts, and ensures proper resource release
 * for network connections, blockchain services, and external API clients.
 */

import { Logger } from './Logger';
import { RetryManager } from './retry-manager';
import { NetworkError } from '../types/errors';
import { CONNECTION_CONFIG } from '../constants';

// Logger instance
const logger = Logger.getInstance();

/**
 * Interface for connection objects that can be properly closed
 * This ensures all connections managed by ConnectionManager can be released
 */
export interface ConnectionLike {
  /**
   * Close or release the connection and free associated resources
   */
  close(): Promise<void>;
}

/**
 * Alternative connection interfaces that might be used by external libraries
 * This type helps safely handle connections with different cleanup methods
 */
export type ConnectionWithAlternativeCleanup = {
  disconnect(): Promise<void>;
} | {
  destroy(): Promise<void>;
} | {
  release(): Promise<void>;
} | {
  end(): Promise<void>;
};

/**
 * Union type of all possible connection types
 */
export type ManagedConnection = ConnectionLike | ConnectionWithAlternativeCleanup;

interface ConnectionOptions {
  timeout?: number;        // Connection timeout in ms
  keepAlive?: boolean;     // Whether to keep the connection alive
  maxIdleTime?: number;    // Maximum idle time before closing connection
  autoReconnect?: boolean; // Whether to auto-reconnect on failure
  retryConfig?: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  };
}

const DEFAULT_OPTIONS: ConnectionOptions = {
  timeout: Number(CONNECTION_CONFIG.TIMEOUT_MS),
  keepAlive: Boolean(CONNECTION_CONFIG.KEEP_ALIVE),
  maxIdleTime: Number(CONNECTION_CONFIG.MAX_IDLE_TIME_MS),
  autoReconnect: Boolean(CONNECTION_CONFIG.AUTO_RECONNECT),
  retryConfig: {
    maxRetries: Number(CONNECTION_CONFIG.RETRY_CONFIG.MAX_RETRIES),
    baseDelay: Number(CONNECTION_CONFIG.RETRY_CONFIG.BASE_DELAY_MS),
    maxDelay: Number(CONNECTION_CONFIG.RETRY_CONFIG.MAX_DELAY_MS)
  }
};

/**
 * Manages a connection with automatic cleanup
 * @template T Type of connection to manage, must include close method
 */
export class ConnectionManager<T extends ManagedConnection> {
  private connection: T | null = null;
  private lastUsed: number = Date.now();
  private connectionTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly options: ConnectionOptions;
  private readonly retryManager: RetryManager;
  private readonly connectFn: () => Promise<T>;
  private readonly healthCheckFn?: (connection: T) => Promise<boolean>;
  
  /**
   * Create a new connection manager
   * 
   * @param connectFn Function to create a new connection (must return a ConnectionLike object)
   * @param healthCheckFn Optional function to check connection health
   * @param options Connection options
   */
  constructor(
    connectFn: () => Promise<T>,
    healthCheckFn?: (connection: T) => Promise<boolean>,
    options: Partial<ConnectionOptions> = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.connectFn = connectFn;
    this.healthCheckFn = healthCheckFn;
    
    // Create a retry manager instance
    this.retryManager = new RetryManager(['default'], {
      maxRetries: this.options.retryConfig?.maxRetries || 3,
      initialDelay: this.options.retryConfig?.baseDelay || 1000,
      maxDelay: this.options.retryConfig?.maxDelay || 10000
    });
    
    // Set up idle connection monitoring if not using keep-alive
    if (!this.options.keepAlive && this.options.maxIdleTime) {
      this.startIdleMonitoring();
    }
  }
  
  /**
   * Safely close the connection based on its interface
   * @param connection The connection to close
   */
  private async safelyCloseConnection(connection: T): Promise<void> {
    // Check each possible cleanup method
    if ('close' in connection && typeof connection.close === 'function') {
      await connection.close();
    } else if ('disconnect' in connection && typeof connection.disconnect === 'function') {
      await connection.disconnect();
    } else if ('destroy' in connection && typeof connection.destroy === 'function') {
      await connection.destroy();
    } else if ('release' in connection && typeof connection.release === 'function') {
      await connection.release();
    } else if ('end' in connection && typeof connection.end === 'function') {
      await connection.end();
    } else {
      logger.warn('Connection has no recognized close method');
    }
  }
  
  /**
   * Get a connection, creating one if needed
   */
  async getConnection(): Promise<T> {
    try {
      // Check if we have a valid connection
      if (this.connection !== null) {
        // Update last used time
        this.lastUsed = Date.now();
        
        // Verify connection health if health check is available
        if (this.healthCheckFn) {
          const isHealthy = await this.healthCheckFn(this.connection);
          if (isHealthy) {
            return this.connection;
          }
          
          // Connection is not healthy, close it and create a new one
          logger.warn('Connection health check failed, reconnecting...');
          await this.closeConnection();
        } else {
          // No health check, assume connection is valid
          return this.connection;
        }
      }
      
      // Create a new connection with retry logic using the instance retry manager
      const connectFnWithNode = (_node: any) => this.connectFn();
      this.connection = await this.retryManager.execute(
        connectFnWithNode,
        'connection_establishment'
      );
      
      this.lastUsed = Date.now();
      return this.connection;
    } catch (error) {
      logger.error('Failed to establish connection',
        error instanceof Error ? error : new Error(String(error)),
        { network: 'unknown' } as Record<string, unknown>
      );
      throw new NetworkError('Connection failed', {
        network: 'unknown',
        operation: 'connect',
        recoverable: !!this.options.autoReconnect,
        cause: error instanceof Error ? error : new Error(String(error))
      });
    }
  }
  
  /**
   * Execute an operation with a connection, ensuring proper cleanup
   * 
   * @param operation Function that receives the connection and performs operations
   * @returns The result of the operation
   */
  async withConnection<R>(operation: (connection: T) => Promise<R>): Promise<R> {
    try {
      const connection = await this.getConnection();
      return await operation(connection);
    } catch (error) {
      // If it's a connection error and auto-reconnect is enabled, schedule reconnection
      if (error instanceof NetworkError && this.options.autoReconnect) {
        this.scheduleReconnect();
      }
      throw error;
    } finally {
      // If not using keep-alive, close the connection after use
      if (!this.options.keepAlive) {
        await this.closeConnection();
      } else {
        // Update last used time for idle monitoring
        this.lastUsed = Date.now();
      }
    }
  }
  
  /**
   * Close the current connection if it exists
   */
  async closeConnection(): Promise<void> {
    if (this.connection !== null) {
      try {
        await this.safelyCloseConnection(this.connection);
        logger.debug('Connection closed successfully');
      } catch (error) {
        logger.warn('Error closing connection',
          { error: String(error) }
        );
      } finally {
        this.connection = null;
      }
    }
    
    // Clear any pending timers
    this.clearTimers();
  }
  
  /**
   * Start monitoring for idle connections
   */
  private startIdleMonitoring(): void {
    // Clear any existing timer
    if (this.connectionTimer !== null) {
      clearInterval(this.connectionTimer);
    }
    
    // Set up a new timer to check for idle connections
    this.connectionTimer = setInterval(() => {
      this.checkIdleConnection();
    }, Math.min(30000, this.options.maxIdleTime || 60000)); // Check at most every 30 seconds
  }
  
  /**
   * Check if the connection has been idle for too long
   */
  private checkIdleConnection(): void {
    if (this.connection === null) return;
    
    const idleTime = Date.now() - this.lastUsed;
    if (idleTime > (this.options.maxIdleTime || 60000)) {
      logger.debug(`Closing idle connection (idle for ${idleTime}ms)`);
      this.closeConnection().catch(error => {
        logger.warn(
          'Error closing idle connection',
          { error: String(error) }
        );
      });
    }
  }
  
  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    // Clear any existing reconnect timer
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
    }
    
    // Set up a new reconnect timer
    this.reconnectTimer = setTimeout(() => {
      logger.debug('Attempting reconnection...');
      this.getConnection().catch(error => {
        logger.error('Reconnection failed',
          error instanceof Error ? error : new Error(String(error)),
          { network: 'unknown' } as Record<string, unknown>
        );
      });
    }, this.options.retryConfig?.baseDelay || 1000); // Start with base delay
  }
  
  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.connectionTimer !== null) {
      clearInterval(this.connectionTimer);
      this.connectionTimer = null;
    }
    
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  /**
   * Clean up all resources
   */
  async cleanup(): Promise<void> {
    await this.closeConnection();
    this.clearTimers();
  }
}