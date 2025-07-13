/**
 * Walrus client wrapper for decentralized storage using the Walrus CLI
 * Provides methods for storing, retrieving, and deleting data on Walrus
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { WalrusError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Walrus storage response
 */
export interface WalrusStoreResponse {
  blobId: string;
  size: number;
  cost: number;
}

/**
 * Metadata for stored JSON data
 */
export interface WalrusJsonMetadata {
  version: string;
  timestamp: string;
  appName: string;
  appVersion: string;
  dataType: string;
  schema?: string;
}

/**
 * JSON data wrapper for Walrus storage
 */
export interface WalrusJsonData {
  metadata: WalrusJsonMetadata;
  data: any;
}

/**
 * Cost estimation for Walrus operations
 */
export interface WalrusCostEstimate {
  estimatedSize: number;
  estimatedCost: number;
  warning?: string;
}

/**
 * Walrus CLI store output structure
 */
interface WalrusCliStoreOutput {
  blob_id: string;
  total_blob_size: number;
  sui_cost: number;
  upload_method: string;
  is_newly_stored: boolean;
}

/**
 * Walrus retrieve options
 */
export interface WalrusRetrieveOptions {
  timeout?: number;
  maxRetries?: number;
}

/**
 * Walrus client configuration
 */
export interface WalrusConfig {
  cliPath?: string; // Path to walrus CLI binary
  aggregatorUrl?: string;
  publisherUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Walrus client for interacting with the decentralized storage network via CLI
 */
export class WalrusClient {
  private config: Required<WalrusConfig>;
  private tempDir: string;

  constructor(config: WalrusConfig = {}) {
    this.config = {
      cliPath: config.cliPath || 'walrus',
      aggregatorUrl: config.aggregatorUrl || '',
      publisherUrl: config.publisherUrl || '',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
    };

    // Create a temporary directory for this instance
    this.tempDir = path.join(tmpdir(), 'waltodo-walrus', uuidv4());
  }

  /**
   * Execute a Walrus CLI command
   */
  private async executeCommand(
    args: string[],
    options: { input?: string | Buffer; timeout?: number } = {}
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      logger.debug('Executing Walrus CLI command:', {
        command: this.config.cliPath,
        args: args.filter(arg => !arg.startsWith('--blob-id')), // Don't log blob IDs
      });

      const walrusProcess = spawn(this.config.cliPath, args, {
        timeout: options.timeout || this.config.timeout,
        env: {
          ...process.env,
          // Add aggregator/publisher URLs if provided
          ...(this.config.aggregatorUrl && { WALRUS_AGGREGATOR_URL: this.config.aggregatorUrl }),
          ...(this.config.publisherUrl && { WALRUS_PUBLISHER_URL: this.config.publisherUrl }),
        },
      });

      let stdout = '';
      let stderr = '';

      walrusProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      walrusProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      if (options.input) {
        walrusProcess.stdin.write(options.input);
        walrusProcess.stdin.end();
      }

      walrusProcess.on('error', (error) => {
        logger.error('Failed to execute Walrus CLI:', error);
        reject(new WalrusError(`Failed to execute Walrus CLI: ${error.message}`));
      });

      walrusProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          logger.error('Walrus CLI command failed:', { code, stderr });
          reject(new WalrusError(`Walrus CLI command failed with code ${code}: ${stderr}`));
        }
      });
    });
  }

  /**
   * Ensure the temporary directory exists
   */
  private async ensureTempDir(): Promise<void> {
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  /**
   * Estimate the cost of storing data
   */
  async estimateCost(data: string | Buffer): Promise<WalrusCostEstimate> {
    const size = data.length;
    
    // Basic cost estimation (this is a rough estimate)
    // Actual costs depend on Walrus network conditions
    const baseCostPerKB = 0.001; // SUI tokens per KB
    const estimatedCost = Math.ceil(size / 1024) * baseCostPerKB;
    
    const result: WalrusCostEstimate = {
      estimatedSize: size,
      estimatedCost,
    };

    // Add warnings for large data
    if (size > 10 * 1024 * 1024) { // 10MB
      result.warning = 'Large data size may result in higher costs and longer upload times';
    }

    return result;
  }

  /**
   * Store data in Walrus
   */
  async store(data: string | Buffer): Promise<WalrusStoreResponse> {
    try {
      logger.debug('Storing data in Walrus', { size: data.length });

      // Ensure temp directory exists
      await this.ensureTempDir();

      // Write data to a temporary file
      const tempFile = path.join(this.tempDir, `upload-${uuidv4()}.tmp`);
      await fs.writeFile(tempFile, data);

      try {
        // Execute walrus store command
        const { stdout, stderr } = await this.executeCommand(['store', tempFile]);

        // Parse the JSON output
        let storeResult: WalrusCliStoreOutput;
        try {
          storeResult = JSON.parse(stdout);
        } catch (parseError) {
          logger.error('Failed to parse Walrus CLI output:', { stdout, stderr });
          throw new WalrusError(`Failed to parse Walrus response: ${parseError}`);
        }

        logger.debug('Data stored successfully', { 
          blobId: storeResult.blob_id,
          isNewlyStored: storeResult.is_newly_stored,
        });

        return {
          blobId: storeResult.blob_id,
          size: storeResult.total_blob_size,
          cost: storeResult.sui_cost,
        };
      } finally {
        // Clean up temporary file
        try {
          await fs.unlink(tempFile);
        } catch (error) {
          logger.warn('Failed to clean up temporary file:', error);
        }
      }
    } catch (error) {
      if (error instanceof WalrusError) {
        throw error;
      }
      throw new WalrusError(`Failed to store data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store a JavaScript object as JSON in Walrus with metadata
   */
  async storeJson(
    data: any, 
    metadata: Partial<WalrusJsonMetadata> = {},
    options: { estimateCost?: boolean } = {}
  ): Promise<WalrusStoreResponse> {
    try {
      logger.debug('Storing JSON data in Walrus', { 
        dataType: metadata.dataType, 
        estimateCost: options.estimateCost 
      });

      // Create metadata with defaults
      const fullMetadata: WalrusJsonMetadata = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        appName: 'waltodo',
        appVersion: '1.0.0',
        dataType: 'unknown',
        ...metadata,
      };

      // Wrap data with metadata
      const wrappedData: WalrusJsonData = {
        metadata: fullMetadata,
        data,
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(wrappedData, null, 2);
      const jsonBuffer = Buffer.from(jsonString, 'utf-8');

      // Estimate cost if requested
      if (options.estimateCost) {
        const estimate = await this.estimateCost(jsonBuffer);
        logger.info('Cost estimate for JSON storage:', estimate);
        
        if (estimate.warning) {
          logger.warn('Storage warning:', estimate.warning);
        }
      }

      // Store the JSON data
      const result = await this.store(jsonBuffer);
      
      logger.info('JSON data stored successfully', { 
        blobId: result.blobId,
        size: result.size,
        actualCost: result.cost,
        dataType: fullMetadata.dataType
      });

      return result;
    } catch (error) {
      if (error instanceof WalrusError) {
        throw error;
      }
      throw new WalrusError(`Failed to store JSON data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve and parse JSON data from Walrus
   */
  async retrieveJson(blobId: string, options?: WalrusRetrieveOptions): Promise<WalrusJsonData> {
    try {
      logger.debug('Retrieving JSON data from Walrus', { blobId });

      const jsonString = await this.retrieve(blobId, options);
      
      try {
        const parsedData = JSON.parse(jsonString) as WalrusJsonData;
        
        // Validate structure
        if (!parsedData.metadata || !parsedData.data) {
          throw new WalrusError('Invalid JSON data structure: missing metadata or data');
        }

        logger.debug('JSON data retrieved successfully', { 
          blobId,
          dataType: parsedData.metadata.dataType,
          timestamp: parsedData.metadata.timestamp
        });

        return parsedData;
      } catch (parseError) {
        throw new WalrusError(`Failed to parse JSON data: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
      }
    } catch (error) {
      if (error instanceof WalrusError) {
        throw error;
      }
      throw new WalrusError(`Failed to retrieve JSON data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Publish TODO data to Walrus with proper formatting and metadata
   */
  async publishTodos(
    todos: any[],
    options: {
      includeStats?: boolean;
      estimateCost?: boolean;
      batchSize?: number;
    } = {}
  ): Promise<WalrusStoreResponse> {
    try {
      logger.debug('Publishing TODO data to Walrus', { 
        todoCount: todos.length,
        options 
      });

      // Prepare metadata specific to TODO data
      const metadata: WalrusJsonMetadata = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        appName: 'waltodo',
        appVersion: '1.0.0',
        dataType: 'todos',
        schema: 'todo-v1',
      };

      // Prepare the data payload
      const payload: any = {
        todos,
        count: todos.length,
      };

      // Add statistics if requested
      if (options.includeStats) {
        const stats = {
          total: todos.length,
          pending: todos.filter((t: any) => t.status === 'pending').length,
          done: todos.filter((t: any) => t.status === 'done').length,
          priorities: {
            high: todos.filter((t: any) => t.priority === 'high').length,
            medium: todos.filter((t: any) => t.priority === 'medium').length,
            low: todos.filter((t: any) => t.priority === 'low').length,
          },
          publishedAt: new Date().toISOString(),
        };
        payload.statistics = stats;
      }

      // Handle large datasets with batching
      if (options.batchSize && todos.length > options.batchSize) {
        logger.warn(`Large TODO dataset (${todos.length} items) exceeds batch size (${options.batchSize}). Consider using TodoPublisher for batch processing.`);
      }

      // Store the TODO data
      const result = await this.storeJson(payload, metadata, {
        estimateCost: options.estimateCost
      });

      logger.info('TODO data published successfully', {
        blobId: result.blobId,
        todoCount: todos.length,
        size: result.size,
        cost: result.cost
      });

      return result;
    } catch (error) {
      if (error instanceof WalrusError) {
        throw error;
      }
      throw new WalrusError(`Failed to publish TODO data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve data from Walrus
   */
  async retrieve(blobId: string, options?: WalrusRetrieveOptions): Promise<string> {
    const maxRetries = options?.maxRetries || this.config.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Retrieving data from Walrus (attempt ${attempt})`, { blobId });

        // Ensure temp directory exists
        await this.ensureTempDir();

        // Create a temporary file for output
        const outputFile = path.join(this.tempDir, `download-${uuidv4()}.tmp`);

        try {
          // Execute walrus read command
          const { stderr } = await this.executeCommand(
            ['read', blobId, '--output', outputFile],
            { timeout: options?.timeout }
          );

          if (stderr && stderr.includes('error')) {
            throw new WalrusError(`Walrus read failed: ${stderr}`);
          }

          // Read the retrieved data
          const data = await fs.readFile(outputFile, 'utf-8');

          logger.debug('Data retrieved successfully', { blobId });
          return data;
        } finally {
          // Clean up temporary file
          try {
            await fs.unlink(outputFile);
          } catch (error) {
            // File might not exist if retrieval failed
            logger.debug('Temporary file cleanup skipped:', error);
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`Retrieval attempt ${attempt} failed:`, lastError.message);

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          logger.debug(`Waiting ${delay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new WalrusError(
      `Failed to retrieve data after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Delete data from Walrus
   */
  async delete(blobId: string): Promise<void> {
    try {
      logger.debug('Deleting data from Walrus', { blobId });

      // Execute walrus delete command
      const { stdout, stderr } = await this.executeCommand(['delete', '--blob-id', blobId]);

      if (stderr && stderr.includes('error')) {
        // Check if it's a "not found" error
        if (stderr.toLowerCase().includes('not found') || stderr.toLowerCase().includes('does not exist')) {
          logger.debug('Blob not found, may already be deleted', { blobId });
          return;
        }
        throw new WalrusError(`Walrus delete failed: ${stderr}`);
      }

      logger.debug('Data deleted successfully', { blobId });
    } catch (error) {
      if (error instanceof WalrusError) {
        throw error;
      }
      throw new WalrusError(`Failed to delete data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a blob exists in Walrus by attempting to read its metadata
   */
  async exists(blobId: string): Promise<boolean> {
    try {
      logger.debug('Checking if blob exists', { blobId });

      // Ensure temp directory exists
      await this.ensureTempDir();

      // Try to read the blob with a small timeout
      // Note: This is not ideal but Walrus CLI doesn't have a "check" command
      const outputFile = path.join(this.tempDir, `check-${uuidv4()}.tmp`);

      try {
        await this.executeCommand(
          ['read', blobId, '--output', outputFile],
          { timeout: 5000 } // Short timeout for existence check
        );

        // If command succeeds, blob exists
        logger.debug('Blob exists', { blobId });
        return true;
      } finally {
        // Clean up
        try {
          await fs.unlink(outputFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      if (error instanceof WalrusError && 
          (error.message.includes('not found') || error.message.includes('does not exist'))) {
        logger.debug('Blob does not exist', { blobId });
        return false;
      }
      throw error;
    }
  }

  /**
   * Get the version of the Walrus CLI
   */
  async getVersion(): Promise<string> {
    try {
      const { stdout } = await this.executeCommand(['--version']);
      return stdout.trim();
    } catch (error) {
      throw new WalrusError(`Failed to get Walrus CLI version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up temporary files and directory
   */
  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      logger.debug('Cleaned up temporary directory');
    } catch (error) {
      logger.warn('Failed to clean up temporary directory:', error);
    }
  }
}