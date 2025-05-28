import { watch, FSWatcher } from 'fs';
import { readFile, writeFile, stat } from 'fs/promises';
import { join, resolve, relative } from 'path';
import { EventEmitter } from 'events';
import { Logger } from './Logger';
import { debounce } from 'lodash';

export interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted';
  filePath: string;
  relativePath: string;
  timestamp: number;
  stats?: {
    size: number;
    mtime: Date;
  };
}

export interface FileWatcherOptions {
  recursive?: boolean;
  ignoreInitial?: boolean;
  debounceMs?: number;
  fileExtensions?: string[];
  excludePatterns?: RegExp[];
}

/**
 * File system watcher for monitoring changes to the Todos directory
 * Provides real-time detection of file changes for sync operations
 */
export class FileWatcher extends EventEmitter {
  private logger: Logger;
  private watchers: Map<string, FSWatcher> = new Map();
  private watchedPaths: Set<string> = new Set();
  private options: Required<FileWatcherOptions>;
  private debouncedEmit: Function;
  private isWatching = false;
  private lastChangeMap = new Map<string, number>();

  constructor(options: FileWatcherOptions = {}) {
    super();
    this.logger = new Logger('FileWatcher');
    
    this.options = {
      recursive: true,
      ignoreInitial: true,
      debounceMs: 500,
      fileExtensions: ['.json'],
      excludePatterns: [/\.tmp$/, /\.swp$/, /~$/, /\.DS_Store$/],
      ...options
    };

    this.debouncedEmit = debounce(this.emitChange.bind(this), this.options.debounceMs);
    
    this.logger.info('FileWatcher initialized', { options: this.options });
  }

  /**
   * Start watching a directory
   */
  async startWatching(directoryPath: string): Promise<void> {
    const resolvedPath = resolve(directoryPath);
    
    if (this.watchedPaths.has(resolvedPath)) {
      this.logger.warn(`Already watching path: ${resolvedPath}`);
      return;
    }

    try {
      await stat(resolvedPath);
    } catch (error) {
      throw new Error(`Directory does not exist: ${resolvedPath}`);
    }

    this.logger.info(`Starting file watcher for: ${resolvedPath}`);

    const watcher = watch(
      resolvedPath,
      { 
        recursive: this.options.recursive,
        persistent: true
      },
      (eventType: string, filename: string | null) => {
        if (!filename) return;
        
        const fullPath = join(resolvedPath, filename);
        this.handleFileChange(eventType, fullPath, resolvedPath);
      }
    );

    watcher.on('error', (error) => {
      this.logger.error(`File watcher error for ${resolvedPath}:`, error);
      this.emit('error', error);
    });

    this.watchers.set(resolvedPath, watcher);
    this.watchedPaths.add(resolvedPath);
    this.isWatching = true;

    this.emit('watchStarted', { path: resolvedPath });
    this.logger.info(`File watcher started for: ${resolvedPath}`);
  }

  /**
   * Stop watching a specific directory
   */
  async stopWatching(directoryPath?: string): Promise<void> {
    if (directoryPath) {
      const resolvedPath = resolve(directoryPath);
      const watcher = this.watchers.get(resolvedPath);
      
      if (watcher) {
        watcher.close();
        this.watchers.delete(resolvedPath);
        this.watchedPaths.delete(resolvedPath);
        this.logger.info(`Stopped watching: ${resolvedPath}`);
        this.emit('watchStopped', { path: resolvedPath });
      }
    } else {
      // Stop all watchers
      for (const [path, watcher] of this.watchers) {
        watcher.close();
        this.logger.info(`Stopped watching: ${path}`);
      }
      
      this.watchers.clear();
      this.watchedPaths.clear();
      this.isWatching = false;
      this.emit('watchStopped', { path: 'all' });
      this.logger.info('Stopped all file watchers');
    }
  }

  /**
   * Handle file system change events
   */
  private async handleFileChange(
    eventType: string, 
    filePath: string, 
    watchedRoot: string
  ): Promise<void> {
    try {
      // Check if file should be ignored
      if (!this.shouldProcessFile(filePath)) {
        return;
      }

      // Debounce rapid changes to the same file
      const now = Date.now();
      const lastChange = this.lastChangeMap.get(filePath) || 0;
      if (now - lastChange < 100) { // 100ms minimum between events for same file
        return;
      }
      this.lastChangeMap.set(filePath, now);

      const relativePath = relative(watchedRoot, filePath);
      
      // Determine change type and get file stats
      let changeType: 'created' | 'modified' | 'deleted' = 'modified';
      let fileStats;

      try {
        const stats = await stat(filePath);
        fileStats = {
          size: stats.size,
          mtime: stats.mtime
        };
        
        // For new files, eventType is usually 'rename'
        if (eventType === 'rename') {
          changeType = 'created';
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          changeType = 'deleted';
        } else {
          this.logger.error(`Error getting file stats for ${filePath}:`, error);
          return;
        }
      }

      const changeEvent: FileChangeEvent = {
        type: changeType,
        filePath,
        relativePath,
        timestamp: now,
        stats: fileStats
      };

      this.logger.debug('File change detected', {
        type: changeType,
        path: relativePath,
        size: fileStats?.size
      });

      // Use debounced emit to handle rapid file changes
      this.debouncedEmit(changeEvent);
      
    } catch (error) {
      this.logger.error(`Error handling file change for ${filePath}:`, error);
    }
  }

  /**
   * Check if a file should be processed based on filters
   */
  private shouldProcessFile(filePath: string): boolean {
    const fileName = filePath.split('/').pop() || '';
    
    // Check exclude patterns
    if (this.options.excludePatterns.some(pattern => pattern.test(fileName))) {
      return false;
    }

    // Check file extensions
    if (this.options.fileExtensions.length > 0) {
      const hasValidExtension = this.options.fileExtensions.some(ext => 
        fileName.endsWith(ext)
      );
      if (!hasValidExtension) {
        return false;
      }
    }

    return true;
  }

  /**
   * Emit change event (called by debounced function)
   */
  private emitChange(changeEvent: FileChangeEvent): void {
    this.emit('change', changeEvent);
    this.emit(changeEvent.type, changeEvent);
  }

  /**
   * Get current watching status
   */
  getStatus(): {
    isWatching: boolean;
    watchedPaths: string[];
    watcherCount: number;
  } {
    return {
      isWatching: this.isWatching,
      watchedPaths: Array.from(this.watchedPaths),
      watcherCount: this.watchers.size
    };
  }

  /**
   * Manually trigger a file scan (useful for initial sync)
   */
  async scanDirectory(directoryPath: string): Promise<FileChangeEvent[]> {
    const resolvedPath = resolve(directoryPath);
    const changes: FileChangeEvent[] = [];
    
    this.logger.info(`Scanning directory: ${resolvedPath}`);
    
    try {
      const { readdir } = await import('fs/promises');
      const files = await readdir(resolvedPath, { recursive: this.options.recursive });
      
      for (const file of files) {
        const filePath = join(resolvedPath, file.toString());
        const relativePath = relative(resolvedPath, filePath);
        
        if (!this.shouldProcessFile(filePath)) {
          continue;
        }
        
        try {
          const stats = await stat(filePath);
          
          if (stats.isFile()) {
            changes.push({
              type: 'created',
              filePath,
              relativePath,
              timestamp: Date.now(),
              stats: {
                size: stats.size,
                mtime: stats.mtime
              }
            });
          }
        } catch (error) {
          this.logger.warn(`Error reading file ${filePath}:`, error);
        }
      }
      
      this.logger.info(`Directory scan complete: ${changes.length} files found`);
      return changes;
      
    } catch (error) {
      this.logger.error(`Error scanning directory ${resolvedPath}:`, error);
      return [];
    }
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.stopWatching();
    this.removeAllListeners();
    this.lastChangeMap.clear();
    this.logger.info('FileWatcher destroyed');
  }
}