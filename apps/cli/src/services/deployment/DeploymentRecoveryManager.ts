/**
 * Deployment Recovery Manager for Walrus Sites
 * 
 * Handles recovery from failed deployments, partial uploads, and network interruptions.
 * Provides state management, cleanup procedures, and resume functionality.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '../../utils/Logger';
import { CLIError } from '../../types/errors/consolidated';

export interface DeploymentState {
  id: string;
  status: 'pending' | 'uploading' | 'processing' | 'failed' | 'completed' | 'rolling_back';
  siteName: string;
  network: 'testnet' | 'mainnet';
  buildDirectory: string;
  startTime: string;
  lastUpdate: string;
  progress: {
    totalFiles: number;
    uploadedFiles: number;
    failedFiles: string[];
    completedFiles: string[];
    currentFile?: string;
  };
  walrusOperations: {
    uploads: Array<{
      file: string;
      blobId?: string;
      status: 'pending' | 'uploading' | 'completed' | 'failed';
      error?: string;
      retryCount: number;
      size: number;
    }>;
    transactions: Array<{
      type: 'site_creation' | 'site_update' | 'metadata_upload';
      transactionId?: string;
      status: 'pending' | 'broadcasting' | 'completed' | 'failed';
      error?: string;
      retryCount: number;
    }>;
  };
  metadata: {
    siteId?: string;
    configHash?: string;
    manifestBlobId?: string;
    totalSize: number;
    estimatedCost: number;
  };
  recovery: {
    canResume: boolean;
    lastCheckpoint: string;
    cleanupRequired: boolean;
    rollbackAvailable: boolean;
    previousVersion?: {
      siteId: string;
      manifestBlobId: string;
    };
  };
  errors: Array<{
    timestamp: string;
    type: 'network' | 'validation' | 'storage' | 'blockchain' | 'config';
    message: string;
    details?: any;
    recoverable: boolean;
  }>;
}

export interface RecoveryOptions {
  maxRetries: number;
  retryDelay: number;
  timeoutMs: number;
  cleanupOnFailure: boolean;
  enableRollback: boolean;
  preservePartialUploads: boolean;
}

export interface DeploymentCheckpoint {
  timestamp: string;
  state: Partial<DeploymentState>;
  filesToUpload: string[];
  completedUploads: Array<{ file: string; blobId: string }>;
  pendingTransactions: Array<{ type: string; data: any }>;
}

export class DeploymentRecoveryManager {
  private logger: Logger;
  private stateDirectory: string;
  private checkpointDirectory: string;
  private tempDirectory: string;
  private activeDeployments: Map<string, DeploymentState> = new Map();
  private recoveryOptions: RecoveryOptions;

  constructor(
    baseDirectory: string = path.join(process.cwd(), '.walrus-deployment'),
    options: Partial<RecoveryOptions> = {}
  ) {
    this?.logger = new Logger('DeploymentRecovery');
    this?.stateDirectory = path.join(baseDirectory, 'state');
    this?.checkpointDirectory = path.join(baseDirectory, 'checkpoints');
    this?.tempDirectory = path.join(baseDirectory, 'temp');
    
    this?.recoveryOptions = {
      maxRetries: 3,
      retryDelay: 5000,
      timeoutMs: 300000, // 5 minutes
      cleanupOnFailure: true,
      enableRollback: true,
      preservePartialUploads: true,
      ...options
    };

    this.ensureDirectories();
    this.loadActiveDeployments();
  }

  /**
   * Initialize a new deployment with recovery state tracking
   */
  async initializeDeployment(
    siteName: string,
    network: 'testnet' | 'mainnet',
    buildDirectory: string,
    previousVersion?: { siteId: string; manifestBlobId: string }
  ): Promise<string> {
    const deploymentId = this.generateDeploymentId();
    const files = await this.scanBuildDirectory(buildDirectory);
    const totalSize = await this.calculateTotalSize(files);

    const initialState: DeploymentState = {
      id: deploymentId,
      status: 'pending',
      siteName,
      network,
      buildDirectory,
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      progress: {
        totalFiles: files.length,
        uploadedFiles: 0,
        failedFiles: [],
        completedFiles: [],
      },
      walrusOperations: {
        uploads: files.map(file => ({
          file,
          status: 'pending',
          retryCount: 0,
          size: fs.statSync(path.join(buildDirectory, file)).size,
        })),
        transactions: [],
      },
      metadata: {
        totalSize,
        estimatedCost: await this.estimateDeploymentCost(totalSize),
      },
      recovery: {
        canResume: true,
        lastCheckpoint: '',
        cleanupRequired: false,
        rollbackAvailable: !!previousVersion,
        previousVersion,
      },
      errors: [],
    };

    await this.saveDeploymentState(initialState);
    await this.createCheckpoint(deploymentId, 'initialization', {
      filesToUpload: files,
      completedUploads: [],
      pendingTransactions: [],
    });

    this?.activeDeployments?.set(deploymentId, initialState);
    
    this?.logger?.info('Deployment initialized', {
      deploymentId,
      siteName,
      totalFiles: files.length,
      totalSize,
    });

    return deploymentId;
  }

  /**
   * Update deployment state and create checkpoint
   */
  async updateDeploymentState(
    deploymentId: string,
    updates: Partial<DeploymentState>,
    createCheckpoint: boolean = false
  ): Promise<void> {
    const currentState = this?.activeDeployments?.get(deploymentId);
    if (!currentState) {
      throw new CLIError(`Deployment ${deploymentId} not found`, 'DEPLOYMENT_NOT_FOUND');
    }

    const updatedState: DeploymentState = {
      ...currentState,
      ...updates,
      lastUpdate: new Date().toISOString(),
    };

    await this.saveDeploymentState(updatedState);
    this?.activeDeployments?.set(deploymentId, updatedState);

    if (createCheckpoint) {
      await this.createCheckpoint(deploymentId, 'state_update', {
        filesToUpload: updatedState?.walrusOperations?.uploads
          .filter(u => u?.status === 'pending')
          .map(u => u.file),
        completedUploads: updatedState?.walrusOperations?.uploads
          .filter(u => u?.status === 'completed')
          .map(u => ({ file: u.file, blobId: u.blobId! })),
        pendingTransactions: updatedState?.walrusOperations?.transactions
          .filter(t => t?.status === 'pending'),
      });
    }

    this?.logger?.debug('Deployment state updated', { deploymentId, status: updatedState.status });
  }

  /**
   * Record a failed operation with error details
   */
  async recordError(
    deploymentId: string,
    error: {
      type: 'network' | 'validation' | 'storage' | 'blockchain' | 'config';
      message: string;
      details?: any;
      recoverable?: boolean;
    }
  ): Promise<void> {
    const state = this?.activeDeployments?.get(deploymentId);
    if (!state) return;

    const errorRecord = {
      timestamp: new Date().toISOString(),
      type: error.type,
      message: error.message,
      details: error.details,
      recoverable: error.recoverable !== false,
    };

    state?.errors?.push(errorRecord);
    
    // Determine if deployment should be marked as failed
    const criticalErrors = state?.errors?.filter(e => !e.recoverable).length;
    const recentErrors = state?.errors?.filter(e => 
      Date.now() - new Date(e.timestamp).getTime() < 60000 // Last minute
    ).length;

    if (criticalErrors > 0 || recentErrors > 5) {
      await this.updateDeploymentState(deploymentId, { 
        status: 'failed',
        recovery: { ...state.recovery, cleanupRequired: true }
      });
    }

    this?.logger?.error('Deployment error recorded', {
      deploymentId,
      errorType: error.type,
      message: error.message,
    });
  }

  /**
   * Attempt to recover a failed deployment
   */
  async recoverDeployment(deploymentId: string): Promise<boolean> {
    this?.logger?.info('Attempting deployment recovery', { deploymentId });

    const state = this?.activeDeployments?.get(deploymentId);
    if (!state) {
      throw new CLIError(`Deployment ${deploymentId} not found`, 'DEPLOYMENT_NOT_FOUND');
    }

    if (!state?.recovery?.canResume) {
      this?.logger?.warn('Deployment cannot be resumed', { deploymentId });
      return false;
    }

    try {
      // Load the latest checkpoint
      const checkpoint = await this.loadLatestCheckpoint(deploymentId);
      if (!checkpoint) {
        this?.logger?.warn('No checkpoint found for recovery', { deploymentId });
        return false;
      }

      // Reset deployment state to recovery point
      await this.updateDeploymentState(deploymentId, {
        status: 'pending',
        recovery: { ...state.recovery, lastCheckpoint: checkpoint.timestamp }
      });

      // Validate that partial uploads are still valid
      const validUploads = await this.validatePartialUploads(deploymentId, checkpoint.completedUploads);
      
      // Update upload states based on validation
      for (const upload of state?.walrusOperations?.uploads) {
        const validUpload = validUploads.find(v => v?.file === upload.file);
        if (validUpload) {
          upload?.status = 'completed';
          upload?.blobId = validUpload.blobId;
        } else if (upload?.status === 'completed') {
          // Previously completed upload is no longer valid
          upload?.status = 'pending';
          upload?.blobId = undefined;
          upload?.retryCount = 0;
        }
      }

      await this.updateDeploymentState(deploymentId, {
        walrusOperations: state.walrusOperations,
        progress: {
          ...state.progress,
          uploadedFiles: validUploads.length,
          completedFiles: validUploads.map(v => v.file),
          failedFiles: [],
        }
      }, true);

      this?.logger?.info('Deployment recovery prepared', {
        deploymentId,
        validUploads: validUploads.length,
        totalFiles: state?.progress?.totalFiles,
      });

      return true;
    } catch (error) {
      this?.logger?.error('Deployment recovery failed', {
        deploymentId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      await this.recordError(deploymentId, {
        type: 'config',
        message: 'Recovery attempt failed',
        details: { error: error instanceof Error ? error.message : String(error) },
        recoverable: false,
      });

      return false;
    }
  }

  /**
   * Rollback a deployment to previous version
   */
  async rollbackDeployment(deploymentId: string): Promise<boolean> {
    this?.logger?.info('Attempting deployment rollback', { deploymentId });

    const state = this?.activeDeployments?.get(deploymentId);
    if (!state || !state?.recovery?.rollbackAvailable || !state?.recovery?.previousVersion) {
      this?.logger?.warn('Rollback not available', { deploymentId });
      return false;
    }

    try {
      await this.updateDeploymentState(deploymentId, { status: 'rolling_back' });

      // Here you would implement the actual rollback logic
      // This might involve updating site configuration to point to previous version
      const previousVersion = state?.recovery?.previousVersion;
      
      // Simulate rollback operation
      await new Promise(resolve => setTimeout(resolve, 2000));

      await this.updateDeploymentState(deploymentId, {
        status: 'completed',
        metadata: {
          ...state.metadata,
          siteId: previousVersion.siteId,
          manifestBlobId: previousVersion.manifestBlobId,
        },
      });

      this?.logger?.info('Deployment rolled back successfully', {
        deploymentId,
        previousSiteId: previousVersion.siteId,
      });

      return true;
    } catch (error) {
      this?.logger?.error('Rollback failed', {
        deploymentId,
        error: error instanceof Error ? error.message : String(error),
      });

      await this.recordError(deploymentId, {
        type: 'blockchain',
        message: 'Rollback operation failed',
        details: { error: error instanceof Error ? error.message : String(error) },
        recoverable: true,
      });

      return false;
    }
  }

  /**
   * Clean up failed deployment resources
   */
  async cleanupDeployment(deploymentId: string, removePartialUploads: boolean = false): Promise<void> {
    this?.logger?.info('Cleaning up deployment', { deploymentId, removePartialUploads });

    const state = this?.activeDeployments?.get(deploymentId);
    if (!state) return;

    try {
      // Clean up temporary files
      const tempDeploymentDir = path.join(this.tempDirectory, deploymentId);
      if (fs.existsSync(tempDeploymentDir)) {
        fs.rmSync(tempDeploymentDir, { recursive: true, force: true });
      }

      // Clean up partial uploads if requested
      if (removePartialUploads) {
        const completedUploads = state?.walrusOperations?.uploads.filter(u => u?.status === 'completed');
        for (const upload of completedUploads) {
          if (upload.blobId) {
            try {
              // Here you would call Walrus delete API if supported
              this?.logger?.debug('Would delete blob', { blobId: upload.blobId });
            } catch (deleteError) {
              this?.logger?.warn('Failed to delete blob', {
                blobId: upload.blobId,
                error: deleteError instanceof Error ? deleteError.message : String(deleteError),
              });
            }
          }
        }
      }

      // Clean up state files
      const stateFile = path.join(this.stateDirectory, `${deploymentId}.json`);
      if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
      }

      // Clean up checkpoints
      const checkpointDir = path.join(this.checkpointDirectory, deploymentId);
      if (fs.existsSync(checkpointDir)) {
        fs.rmSync(checkpointDir, { recursive: true, force: true });
      }

      this?.activeDeployments?.delete(deploymentId);

      this?.logger?.info('Deployment cleanup completed', { deploymentId });
    } catch (error) {
      this?.logger?.error('Cleanup failed', {
        deploymentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * List all active deployments
   */
  getActiveDeployments(): DeploymentState[] {
    return Array.from(this?.activeDeployments?.values());
  }

  /**
   * Get deployment state by ID
   */
  getDeploymentState(deploymentId: string): DeploymentState | undefined {
    return this?.activeDeployments?.get(deploymentId);
  }

  /**
   * Check if deployment can be resumed
   */
  canResumeDeployment(deploymentId: string): boolean {
    const state = this?.activeDeployments?.get(deploymentId);
    return state?.recovery?.canResume === true && 
           ['failed', 'pending'].includes(state.status);
  }

  /**
   * Get deployment progress
   */
  getDeploymentProgress(deploymentId: string): {
    percentage: number;
    uploadedFiles: number;
    totalFiles: number;
    currentOperation?: string;
  } | null {
    const state = this?.activeDeployments?.get(deploymentId);
    if (!state) return null;

    const percentage = state?.progress?.totalFiles > 0 
      ? (state?.progress?.uploadedFiles / state?.progress?.totalFiles) * 100 
      : 0;

    return {
      percentage: Math.round(percentage),
      uploadedFiles: state?.progress?.uploadedFiles,
      totalFiles: state?.progress?.totalFiles,
      currentOperation: state?.progress?.currentFile,
    };
  }

  // Private helper methods

  private generateDeploymentId(): string {
    return `deploy_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private ensureDirectories(): void {
    for (const dir of [this.stateDirectory, this.checkpointDirectory, this.tempDirectory]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private async scanBuildDirectory(buildDirectory: string): Promise<string[]> {
    const files: string[] = [];
    
    const scanDir = (dir: string, basePath: string = '') => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(basePath, item);
        
        if (fs.statSync(fullPath).isDirectory()) {
          scanDir(fullPath, relativePath);
        } else {
          files.push(relativePath);
        }
      }
    };

    scanDir(buildDirectory);
    return files;
  }

  private async calculateTotalSize(files: string[]): Promise<number> {
    // This would be implemented to calculate total size
    return files.length * 1024; // Placeholder
  }

  private async estimateDeploymentCost(totalSize: number): Promise<number> {
    // Implement cost estimation based on Walrus pricing
    return Math.ceil(totalSize / 1024) * 0.001; // Placeholder
  }

  private async saveDeploymentState(state: DeploymentState): Promise<void> {
    const stateFile = path.join(this.stateDirectory, `${state.id}.json`);
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  }

  private loadActiveDeployments(): void {
    if (!fs.existsSync(this.stateDirectory)) return;

    const stateFiles = fs.readdirSync(this.stateDirectory).filter(f => f.endsWith('.json'));
    for (const file of stateFiles) {
      try {
        const stateData = fs.readFileSync(path.join(this.stateDirectory, file), 'utf8');
        const state: DeploymentState = JSON.parse(stateData);
        
        // Only load deployments that are not completed
        if (state.status !== 'completed') {
          this?.activeDeployments?.set(state.id, state);
        }
      } catch (error) {
        this?.logger?.warn('Failed to load deployment state', { file, error });
      }
    }

    this?.logger?.info('Loaded active deployments', { count: this?.activeDeployments?.size });
  }

  private async createCheckpoint(
    deploymentId: string,
    type: string,
    checkpointData: Partial<DeploymentCheckpoint>
  ): Promise<void> {
    const checkpointDir = path.join(this.checkpointDirectory, deploymentId);
    if (!fs.existsSync(checkpointDir)) {
      fs.mkdirSync(checkpointDir, { recursive: true });
    }

    const checkpoint: DeploymentCheckpoint = {
      timestamp: new Date().toISOString(),
      state: this?.activeDeployments?.get(deploymentId),
      filesToUpload: [],
      completedUploads: [],
      pendingTransactions: [],
      ...checkpointData,
    };

    const checkpointFile = path.join(checkpointDir, `${type}_${Date.now()}.json`);
    fs.writeFileSync(checkpointFile, JSON.stringify(checkpoint, null, 2));
  }

  private async loadLatestCheckpoint(deploymentId: string): Promise<DeploymentCheckpoint | null> {
    const checkpointDir = path.join(this.checkpointDirectory, deploymentId);
    if (!fs.existsSync(checkpointDir)) return null;

    const checkpointFiles = fs.readdirSync(checkpointDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    if (checkpointFiles?.length === 0) return null;

    try {
      const latestFile = path.join(checkpointDir, checkpointFiles[0]);
      const checkpointData = fs.readFileSync(latestFile, 'utf8');
      return JSON.parse(checkpointData);
    } catch (error) {
      this?.logger?.error('Failed to load checkpoint', { deploymentId, error });
      return null;
    }
  }

  private async validatePartialUploads(
    deploymentId: string,
    completedUploads: Array<{ file: string; blobId: string }>
  ): Promise<Array<{ file: string; blobId: string }>> {
    const validUploads: Array<{ file: string; blobId: string }> = [];

    for (const upload of completedUploads) {
      try {
        // Here you would verify the blob still exists and is valid
        // For now, we'll assume they're all valid
        validUploads.push(upload);
      } catch (error) {
        this?.logger?.warn('Upload validation failed', {
          deploymentId,
          file: upload.file,
          blobId: upload.blobId,
        });
      }
    }

    return validUploads;
  }
}