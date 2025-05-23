/**
import { Logger } from './Logger';

const logger = new Logger('ResourceManager');
 * Resource Manager - Manages lifecycle of resources requiring explicit cleanup
 * Ensures resources are properly disposed even in error scenarios
 */

import './polyfills/aggregate-error';
import { BaseAdapter, isBaseAdapter } from '../types/adapters/BaseAdapter';
import { ResourceManagerError } from '../types/errors/ResourceManagerError';

/**
 * Types of managed resources
 */
export enum ResourceType {
  ADAPTER = 'adapter',
  FILE_HANDLE = 'file_handle',
  NETWORK_CONNECTION = 'network_connection',
  BLOCKCHAIN_CONNECTION = 'blockchain_connection',
  CACHE = 'cache',
  TIMER = 'timer',
  DATABASE = 'database',
  EXTERNAL_PROCESS = 'external_process',
  OTHER = 'other'
}

/**
 * Interface for resources that need explicit cleanup
 */
export interface DisposableResource {
  /**
   * Release any resources held by this resource
   */
  dispose(): Promise<void>;

  /**
   * Check if this resource has been disposed
   */
  isDisposed(): boolean;

  /**
   * Resource manager metadata
   * @internal
   */
  _resourceManagerMetadata?: {
    id: string;
    type: ResourceType;
    description: string;
    registeredAt: Date;
    disposeWithManager: boolean;
  };
}

/**
 * Resource tracking metadata
 */
interface ResourceRegistration {
  id: string;
  type: ResourceType;
  description: string;
  disposeWithManager: boolean;
  registeredAt: Date;
  resource: DisposableResource;
}

/**
 * Manages lifecycle of resources requiring explicit cleanup
 */
export class ResourceManager {
  private static instance: ResourceManager;
  private resources: Map<string, ResourceRegistration> = new Map();
  private disposed = false;
  private readonly autoDispose: boolean;
  
  /**
   * Create a new ResourceManager
   * @param options Configuration options
   */
  private constructor(options: { autoDispose?: boolean } = {}) {
    this.autoDispose = options.autoDispose ?? true;
    
    // Register automatic cleanup if enabled
    if (this.autoDispose) {
      // Handle normal exit
      process.on('exit', () => {
        this.disposeAll().catch(err => {
          logger.error('Error during resource cleanup on exit:', err);
        });
      });
      
      // Handle signals
      ['SIGINT', 'SIGTERM'].forEach(signal => {
        process.on(signal, () => {
          this.disposeAll()
            .then(() => {
              process.exit(0);
            })
            .catch(err => {
              logger.error(`Error during resource cleanup on ${signal}:`, err);
              process.exit(1);
            });
        });
      });
      
      // Handle uncaught exceptions
      process.on('uncaughtException', (err) => {
        logger.error('Uncaught exception:', err);
        this.disposeAll()
          .then(() => {
            process.exit(1);
          })
          .catch(cleanupErr => {
            logger.error('Error during resource cleanup after uncaught exception:', cleanupErr);
            process.exit(1);
          });
      });
      
      // Handle unhandled promise rejections
      process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled promise rejection:', reason);
        this.disposeAll()
          .then(() => {
            process.exit(1);
          })
          .catch(cleanupErr => {
            logger.error('Error during resource cleanup after unhandled rejection:', cleanupErr);
            process.exit(1);
          });
      });
    }
  }
  
  /**
   * Get the singleton instance of ResourceManager
   */
  public static getInstance(options?: { autoDispose?: boolean }): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager(options);
    }
    return ResourceManager.instance;
  }
  
  /**
   * Register a resource for management
   * @param resource Resource to register
   * @param options Registration options
   * @returns Resource wrapped with safety checks
   */
  public registerResource<T extends DisposableResource | BaseAdapter<unknown>>(
    resource: T,
    options: {
      id?: string;
      type?: ResourceType;
      description?: string;
      disposeWithManager?: boolean;
    } = {}
  ): T {
    if (this.disposed) {
      throw new ResourceManagerError('ResourceManager has been disposed');
    }

    const {
      id = `resource-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type = isBaseAdapter(resource) ? ResourceType.ADAPTER : ResourceType.OTHER,
      description = `Resource ${id}`,
      disposeWithManager = true
    } = options;

    // Handle BaseAdapter resources
    if (isBaseAdapter(resource)) {
      // Don't register already disposed adapters
      if (resource.isDisposed()) {
        logger.warn(`Attempted to register already disposed adapter: ${id}`);
        return resource;
      }

      // Create a DisposableResource wrapper for the adapter
      const adapterWrapper: DisposableResource = {
        dispose: async () => await resource.dispose(),
        isDisposed: () => resource.isDisposed(),
        _resourceManagerMetadata: {
          id,
          type,
          description,
          disposeWithManager,
          registeredAt: new Date()
        }
      };

      // Register the wrapper
      this.resources.set(id, {
        id,
        type,
        description,
        disposeWithManager,
        registeredAt: new Date(),
        resource: adapterWrapper
      });

      // Return the original adapter
      return resource;
    }

    // Handle standard DisposableResource
    // Don't register already disposed resources
    if (resource.isDisposed()) {
      logger.warn(`Attempted to register already disposed resource: ${id}`);
      return resource;
    }

    // Add metadata to resource
    resource._resourceManagerMetadata = {
      id,
      type,
      description,
      disposeWithManager,
      registeredAt: new Date()
    };

    // Register resource
    this.resources.set(id, {
      id,
      type,
      description,
      disposeWithManager,
      registeredAt: new Date(),
      resource
    });

    // Return resource
    return resource;
  }
  
  /**
   * Dispose a specific resource
   * @param id Resource ID
   * @returns true if resource was disposed successfully
   * @throws ResourceManagerError if resource disposal fails and throwOnError is true
   */
  public async disposeResource(
    id: string,
    options: { throwOnError?: boolean } = {}
  ): Promise<boolean> {
    const registration = this.resources.get(id);
    if (!registration) {
      if (options.throwOnError) {
        throw new ResourceManagerError(`Resource with ID "${id}" not found`);
      }
      return false;
    }

    try {
      if (!registration.resource.isDisposed()) {
        await registration.resource.dispose();
      }
      this.resources.delete(id);
      return true;
    } catch (error) {
      const errorMessage = `Error disposing resource ${id} (${registration.description}): ${error instanceof Error ? error.message : String(error)}`;

      if (options.throwOnError) {
        throw new ResourceManagerError(
          errorMessage,
          error instanceof Error ? error : undefined
        );
      }

      logger.error(errorMessage);
      return false;
    }
  }
  
  /**
   * Dispose all resources of a specific type
   * @param type Resource type to dispose
   * @param options Options for disposal
   * @returns Number of resources disposed
   * @throws ResourceManagerError if disposal fails and throwOnError is true
   */
  public async disposeResourcesByType(
    type: ResourceType,
    options: {
      throwOnError?: boolean;
      continueOnError?: boolean;
    } = {}
  ): Promise<number> {
    let disposed = 0;
    const errors: Error[] = [];

    // Get all resources of type
    const resources = Array.from(this.resources.values())
      .filter(r => r.type === type);

    if (resources.length === 0) {
      return 0;
    }

    // Dispose in reverse order of registration (LIFO)
    resources.sort((a, b) => b.registeredAt.getTime() - a.registeredAt.getTime());

    for (const registration of resources) {
      try {
        if (!registration.resource.isDisposed() && registration.disposeWithManager) {
          await registration.resource.dispose();
          disposed++;
        }
        this.resources.delete(registration.id);
      } catch (error) {
        const wrappedError = new ResourceManagerError(
          `Error disposing resource ${registration.id} (${registration.description}): ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined
        );

        if (options.continueOnError) {
          errors.push(wrappedError);
          logger.error(wrappedError.message);
        } else if (options.throwOnError) {
          throw wrappedError;
        } else {
          logger.error(wrappedError.message);
          return disposed;
        }
      }
    }

    // If we collected errors and should throw, create an aggregate error
    if (errors.length > 0 && options.throwOnError) {
      throw new ResourceManagerError(
        `Failed to dispose ${errors.length} out of ${resources.length} resources of type "${type}"`,
        new AggregateError(errors)
      );
    }

    return disposed;
  }
  
  /**
   * Dispose all managed resources
   *
   * @param options Options for disposal
   * @returns Promise that resolves when all resources are disposed
   * @throws ResourceManagerError if disposal fails and throwOnError is true
   */
  public async disposeAll(
    options: {
      throwOnError?: boolean;
      continueOnError?: boolean;
      onlyAutoDispose?: boolean;
    } = {}
  ): Promise<void> {
    if (this.disposed) return;

    // Mark as disposed to prevent new registrations
    if (!options.onlyAutoDispose) {
      this.disposed = true;
    }

    const errors: Error[] = [];

    // Define resource type priority for disposal
    const priorityOrder = [
      ResourceType.FILE_HANDLE,
      ResourceType.NETWORK_CONNECTION,
      ResourceType.BLOCKCHAIN_CONNECTION,
      ResourceType.ADAPTER, // Add adapter type with high priority
      ResourceType.CACHE,
      ResourceType.TIMER,
      ResourceType.DATABASE,
      ResourceType.EXTERNAL_PROCESS,
      ResourceType.OTHER
    ];

    // Dispose in priority order
    for (const type of priorityOrder) {
      try {
        await this.disposeResourcesByType(type, {
          continueOnError: options.continueOnError,
          throwOnError: false // We'll handle errors aggregated at this level
        });
      } catch (error) {
        if (options.continueOnError) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        } else if (options.throwOnError) {
          throw error instanceof ResourceManagerError ? error : new ResourceManagerError(
            `Failed to dispose resources of type ${type}: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error : undefined
          );
        } else {
          logger.error(`Error during disposeAll (type ${type}):`, error);
          break;
        }
      }
    }

    // If we're only disposing auto-dispose resources, we're done
    if (options.onlyAutoDispose) {
      return;
    }

    // Clear resources
    this.resources.clear();

    // If we collected errors and should throw, create an aggregate error
    if (errors.length > 0 && options.throwOnError) {
      throw new ResourceManagerError(
        `Failed to dispose ${errors.length} resources during disposeAll`,
        new AggregateError(errors)
      );
    }
  }
  
  /**
   * Get active resources for debugging
   */
  public getActiveResources(): Array<{
    id: string;
    type: ResourceType;
    description: string;
    registeredAt: Date;
  }> {
    return Array.from(this.resources.values())
      .filter(r => !r.resource.isDisposed())
      .map(r => ({
        id: r.id,
        type: r.type,
        description: r.description,
        registeredAt: r.registeredAt
      }));
  }
  
  /**
   * Get statistics about managed resources
   */
  public getStats(): {
    total: number;
    active: number;
    disposed: number;
    byType: Record<ResourceType, number>;
  } {
    const stats = {
      total: this.resources.size,
      active: 0,
      disposed: 0,
      byType: Object.values(ResourceType).reduce((acc, type) => {
        acc[type] = 0;
        return acc;
      }, {} as Record<ResourceType, number>)
    };
    
    // Calculate stats
    for (const registration of this.resources.values()) {
      if (!registration.resource.isDisposed()) {
        stats.active++;
      } else {
        stats.disposed++;
      }
      stats.byType[registration.type]++;
    }
    
    return stats;
  }
}

/**
 * Get the singleton instance of ResourceManager
 */
export function getResourceManager(options?: { autoDispose?: boolean }): ResourceManager {
  return ResourceManager.getInstance(options);
}

/**
 * Register an adapter with the ResourceManager
 *
 * @param adapter Adapter to register
 * @param options Registration options
 * @returns The registered adapter
 */
export function registerAdapter<T extends BaseAdapter<unknown>>(
  adapter: T,
  options: {
    id?: string;
    description?: string;
    disposeWithManager?: boolean;
  } = {}
): T {
  const resourceManager = getResourceManager();
  return resourceManager.registerResource(adapter, {
    id: options.id,
    type: ResourceType.ADAPTER,
    description: options.description || 'Adapter',
    disposeWithManager: options.disposeWithManager ?? true
  });
}

/**
 * Dispose all adapters managed by the ResourceManager
 *
 * @param options Disposal options
 * @returns Promise that resolves when all adapters are disposed
 */
export async function disposeAllAdapters(
  options: {
    throwOnError?: boolean;
    continueOnError?: boolean;
  } = {}
): Promise<number> {
  const resourceManager = getResourceManager();
  return resourceManager.disposeResourcesByType(ResourceType.ADAPTER, options);
}