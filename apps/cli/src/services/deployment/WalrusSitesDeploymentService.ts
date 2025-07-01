/**
 * Enhanced Walrus Sites Deployment Service
 * 
 * Provides robust deployment capabilities with recovery, resumption, and rollback features.
 * Integrates with DeploymentRecoveryManager for comprehensive failure handling.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { Logger } from '../../utils/Logger';
import { CLIError } from '../../types/errors/consolidated';
import { DeploymentRecoveryManager, DeploymentState } from './DeploymentRecoveryManager';
import { WalrusClient } from '../../../packages/walrus-client/src/client/WalrusClient';

export interface DeploymentOptions {
  siteName: string;
  network: 'testnet' | 'mainnet';
  buildDirectory: string;
  force?: boolean;
  skipValidation?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  enableRecovery?: boolean;
  cleanupOnFailure?: boolean;
  epochs?: number;
  walletAddress?: string;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  siteId?: string;
  siteUrl?: string;
  manifestBlobId?: string;
  totalFiles: number;
  totalSize: number;
  duration: number;
  errors?: string[];
  warnings?: string[];
}

export interface DeploymentProgress {
  deploymentId: string;
  phase: 'validation' | 'uploading' | 'processing' | 'finalizing' | 'completed' | 'failed';
  progress: number;
  currentFile?: string;
  uploadedFiles: number;
  totalFiles: number;
  estimatedTimeRemaining?: number;
  errors?: string[];
}

export class WalrusSitesDeploymentService {
  private logger: Logger;
  private recoveryManager: DeploymentRecoveryManager;
  private walrusClient: WalrusClient;
  private siteBuilderPath: string;
  private activeDeployments: Map<string, {
    process?: any;
    startTime: number;
    options: DeploymentOptions;
  }> = new Map();

  constructor(
    walrusClient: WalrusClient,
    siteBuilderPath: string = 'site-builder',
    recoveryOptions?: Parameters<typeof DeploymentRecoveryManager>[1]
  ) {
    this?.logger = new Logger('WalrusSitesDeployment');
    this?.walrusClient = walrusClient;
    this?.siteBuilderPath = siteBuilderPath;
    this?.recoveryManager = new DeploymentRecoveryManager(
      path.join(process.cwd(), '.walrus-deployment'),
      recoveryOptions
    );
  }

  /**
   * Deploy a site with full recovery support
   */
  async deploy(options: DeploymentOptions): Promise<DeploymentResult> {
    const startTime = Date.now();
    
    this?.logger?.info('Starting Walrus Sites deployment', {
      siteName: options.siteName,
      network: options.network,
      buildDirectory: options.buildDirectory,
    });

    // Initialize deployment with recovery tracking
    const deploymentId = await this?.recoveryManager?.initializeDeployment(
      options.siteName,
      options.network,
      options.buildDirectory
    );

    this?.activeDeployments?.set(deploymentId, {
      startTime,
      options,
    });

    try {
      // Phase 1: Validation
      await this.updateProgress(deploymentId, 'validation', 5);
      await this.validateDeployment(deploymentId, options);

      // Phase 2: Upload files to Walrus
      await this.updateProgress(deploymentId, 'uploading', 10);
      const uploadResults = await this.uploadFiles(deploymentId, options);

      // Phase 3: Process and create site manifest
      await this.updateProgress(deploymentId, 'processing', 80);
      const manifestResult = await this.createSiteManifest(deploymentId, uploadResults, options);

      // Phase 4: Finalize deployment
      await this.updateProgress(deploymentId, 'finalizing', 95);
      const siteResult = await this.finalizeSiteDeployment(deploymentId, manifestResult, options);

      // Mark as completed
      await this.updateProgress(deploymentId, 'completed', 100);
      await this?.recoveryManager?.updateDeploymentState(deploymentId, {
        status: 'completed',
        metadata: {
          siteId: siteResult.siteId,
          manifestBlobId: manifestResult.blobId,
          totalSize: uploadResults.totalSize,
          estimatedCost: uploadResults.totalCost,
        },
      });

      const duration = Date.now() - startTime;
      const result: DeploymentResult = {
        success: true,
        deploymentId,
        siteId: siteResult.siteId,
        siteUrl: siteResult.siteUrl,
        manifestBlobId: manifestResult.blobId,
        totalFiles: uploadResults?.files?.length,
        totalSize: uploadResults.totalSize,
        duration,
      };

      this?.logger?.info('Deployment completed successfully', {
        deploymentId,
        duration: duration / 1000,
        siteUrl: siteResult.siteUrl,
      });

      // Clean up deployment tracking
      this?.activeDeployments?.delete(deploymentId);

      if (options.cleanupOnFailure !== false) {
        // Keep successful deployments for reference but mark as completed
        setTimeout(() => this?.recoveryManager?.cleanupDeployment(deploymentId), 60000);
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      await this.handleDeploymentFailure(deploymentId, error, options);
      
      const deploymentState = this?.recoveryManager?.getDeploymentState(deploymentId);
      const result: DeploymentResult = {
        success: false,
        deploymentId,
        totalFiles: deploymentState?.progress.totalFiles || 0,
        totalSize: deploymentState?.metadata.totalSize || 0,
        duration,
        errors: deploymentState?.errors.map(e => e.message) || [
          error instanceof Error ? error.message : String(error)
        ],
      };

      this?.activeDeployments?.delete(deploymentId);
      return result;
    }
  }

  /**
   * Resume a failed deployment
   */
  async resumeDeployment(deploymentId: string): Promise<DeploymentResult> {
    this?.logger?.info('Resuming deployment', { deploymentId });

    const canResume = this?.recoveryManager?.canResumeDeployment(deploymentId);
    if (!canResume) {
      throw new CLIError(
        `Deployment ${deploymentId} cannot be resumed`,
        'DEPLOYMENT_NOT_RESUMABLE'
      );
    }

    const recoverySuccess = await this?.recoveryManager?.recoverDeployment(deploymentId);
    if (!recoverySuccess) {
      throw new CLIError(
        `Failed to recover deployment ${deploymentId}`,
        'DEPLOYMENT_RECOVERY_FAILED'
      );
    }

    const deploymentState = this?.recoveryManager?.getDeploymentState(deploymentId);
    if (!deploymentState) {
      throw new CLIError(
        `Deployment state not found for ${deploymentId}`,
        'DEPLOYMENT_STATE_NOT_FOUND'
      );
    }

    // Reconstruct deployment options from state
    const options: DeploymentOptions = {
      siteName: deploymentState.siteName,
      network: deploymentState.network,
      buildDirectory: deploymentState.buildDirectory,
      enableRecovery: true,
    };

    // Continue deployment from where it left off
    return this.deploy(options);
  }

  /**
   * Rollback a deployment to previous version
   */
  async rollbackDeployment(deploymentId: string): Promise<boolean> {
    this?.logger?.info('Rolling back deployment', { deploymentId });
    return this?.recoveryManager?.rollbackDeployment(deploymentId);
  }

  /**
   * Cancel an active deployment
   */
  async cancelDeployment(deploymentId: string, cleanup: boolean = true): Promise<void> {
    this?.logger?.info('Cancelling deployment', { deploymentId, cleanup });

    const activeDeployment = this?.activeDeployments?.get(deploymentId);
    if (activeDeployment?.process) {
      // Kill the active process
      try {
        activeDeployment?.process?.kill('SIGTERM');
        // Give it time to cleanup, then force kill
        setTimeout(() => {
          if (activeDeployment.process && !activeDeployment?.process?.killed) {
            activeDeployment?.process?.kill('SIGKILL');
          }
        }, 5000);
      } catch (error) {
        this?.logger?.warn('Failed to kill deployment process', { deploymentId, error });
      }
    }

    await this?.recoveryManager?.updateDeploymentState(deploymentId, {
      status: 'failed',
      recovery: { canResume: false, cleanupRequired: cleanup, rollbackAvailable: false, lastCheckpoint: '' }
    });

    if (cleanup) {
      await this?.recoveryManager?.cleanupDeployment(deploymentId, true);
    }

    this?.activeDeployments?.delete(deploymentId);
  }

  /**
   * Get deployment progress
   */
  getDeploymentProgress(deploymentId: string): DeploymentProgress | null {
    const state = this?.recoveryManager?.getDeploymentState(deploymentId);
    const progress = this?.recoveryManager?.getDeploymentProgress(deploymentId);
    
    if (!state || !progress) return null;

    const activeDeployment = this?.activeDeployments?.get(deploymentId);
    const estimatedTimeRemaining = this.calculateEstimatedTimeRemaining(
      activeDeployment?.startTime || 0,
      progress.percentage
    );

    return {
      deploymentId,
      phase: this.mapStatusToPhase(state.status),
      progress: progress.percentage,
      currentFile: progress.currentOperation,
      uploadedFiles: progress.uploadedFiles,
      totalFiles: progress.totalFiles,
      estimatedTimeRemaining,
      errors: state?.errors?.map(e => e.message),
    };
  }

  /**
   * List all deployments (active and recent)
   */
  listDeployments(): Array<{
    deploymentId: string;
    siteName: string;
    status: string;
    startTime: string;
    progress?: number;
  }> {
    const activeDeployments = this?.recoveryManager?.getActiveDeployments();
    
    return activeDeployments.map(state => ({
      deploymentId: state.id,
      siteName: state.siteName,
      status: state.status,
      startTime: state.startTime,
      progress: this?.recoveryManager?.getDeploymentProgress(state.id)?.percentage,
    }));
  }

  /**
   * Get detailed deployment information
   */
  getDeploymentDetails(deploymentId: string): DeploymentState | null {
    return this?.recoveryManager?.getDeploymentState(deploymentId);
  }

  /**
   * Clean up old deployments
   */
  async cleanupOldDeployments(olderThanDays: number = 7): Promise<number> {
    const deployments = this?.recoveryManager?.getActiveDeployments();
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const deployment of deployments) {
      const deploymentTime = new Date(deployment.startTime).getTime();
      
      if (deploymentTime < cutoffTime && 
          ['completed', 'failed'].includes(deployment.status)) {
        await this?.recoveryManager?.cleanupDeployment(deployment.id);
        cleanedCount++;
      }
    }

    this?.logger?.info('Cleaned up old deployments', { count: cleanedCount });
    return cleanedCount;
  }

  // Private helper methods

  private async validateDeployment(deploymentId: string, options: DeploymentOptions): Promise<void> {
    this?.logger?.debug('Validating deployment', { deploymentId });

    // Check if build directory exists and has content
    if (!fs.existsSync(options.buildDirectory)) {
      throw new CLIError(
        `Build directory not found: ${options.buildDirectory}`,
        'BUILD_DIRECTORY_NOT_FOUND'
      );
    }

    const buildFiles = fs.readdirSync(options.buildDirectory);
    if (buildFiles?.length === 0) {
      throw new CLIError(
        `Build directory is empty: ${options.buildDirectory}`,
        'BUILD_DIRECTORY_EMPTY'
      );
    }

    // Check for required files
    const requiredFiles = ['index.html'];
    for (const file of requiredFiles) {
      const filePath = path.join(options.buildDirectory, file);
      if (!fs.existsSync(filePath)) {
        throw new CLIError(
          `Required file missing: ${file}`,
          'REQUIRED_FILE_MISSING'
        );
      }
    }

    // Validate site-builder availability
    try {
      const { spawn } = await import('child_process');
      const process = spawn(this.siteBuilderPath, ['--version'], { stdio: 'ignore' });
      
      await new Promise((resolve, reject) => {
        process.on('close', (code) => {
          if (code === 0) resolve(undefined);
          else reject(new Error(`site-builder exit code: ${code}`));
        });
        process.on('error', reject);
      });
    } catch (error) {
      throw new CLIError(
        'site-builder CLI not found or not working. Please install it first.',
        'SITE_BUILDER_NOT_FOUND'
      );
    }

    // Check Walrus client connection
    try {
      await this?.walrusClient?.connect();
      const connected = await this?.walrusClient?.checkConnection();
      if (!connected) {
        throw new Error('Not connected');
      }
    } catch (error) {
      throw new CLIError(
        'Failed to connect to Walrus storage',
        'WALRUS_CONNECTION_FAILED'
      );
    }

    this?.logger?.debug('Deployment validation completed', { deploymentId });
  }

  private async uploadFiles(
    deploymentId: string,
    options: DeploymentOptions
  ): Promise<{
    files: Array<{ path: string; blobId: string; size: number }>;
    totalSize: number;
    totalCost: number;
  }> {
    this?.logger?.debug('Starting file uploads', { deploymentId });

    const state = this?.recoveryManager?.getDeploymentState(deploymentId);
    if (!state) {
      throw new CLIError(`Deployment state not found`, 'DEPLOYMENT_STATE_NOT_FOUND');
    }

    const uploadedFiles: Array<{ path: string; blobId: string; size: number }> = [];
    let totalSize = 0;
    let totalCost = 0;

    const pendingUploads = state?.walrusOperations?.uploads.filter(u => u?.status === 'pending');
    const completedUploads = state?.walrusOperations?.uploads.filter(u => u?.status === 'completed');

    // Add already completed uploads to result
    for (const upload of completedUploads) {
      if (upload.blobId) {
        uploadedFiles.push({
          path: upload.file,
          blobId: upload.blobId,
          size: upload.size,
        });
        totalSize += upload.size;
      }
    }

    // Upload remaining files
    for (let i = 0; i < pendingUploads.length; i++) {
      const upload = pendingUploads[i];
      const filePath = path.join(options.buildDirectory, upload.file);
      
      try {
        await this?.recoveryManager?.updateDeploymentState(deploymentId, {
          progress: { ...state.progress, currentFile: upload.file }
        });

        // Update upload status to uploading
        upload?.status = 'uploading';
        await this?.recoveryManager?.updateDeploymentState(deploymentId, {
          walrusOperations: state.walrusOperations
        });

        const fileData = fs.readFileSync(filePath);
        const uploadResult = await this?.walrusClient?.upload(fileData, {
          epochs: options.epochs || 5,
          onProgress: (message, progress) => {
            this?.logger?.debug('Upload progress', { file: upload.file, progress });
          }
        });

        // Update upload status to completed
        upload?.status = 'completed';
        upload?.blobId = uploadResult.blobId;
        
        uploadedFiles.push({
          path: upload.file,
          blobId: uploadResult.blobId,
          size: upload.size,
        });

        totalSize += upload.size;
        totalCost += uploadResult.cost || 0;

        // Update progress
        await this?.recoveryManager?.updateDeploymentState(deploymentId, {
          progress: {
            ...state.progress,
            uploadedFiles: uploadedFiles.length,
            completedFiles: [...state?.progress?.completedFiles, upload.file],
          },
          walrusOperations: state.walrusOperations,
        }, true); // Create checkpoint after each successful upload

        const progressPercent = 10 + ((i + 1) / pendingUploads.length) * 60; // 10-70%
        await this.updateProgress(deploymentId, 'uploading', progressPercent);

      } catch (error) {
        upload?.status = 'failed';
        upload.retryCount++;
        
        await this?.recoveryManager?.recordError(deploymentId, {
          type: 'storage',
          message: `Failed to upload file: ${upload.file}`,
          details: { error: error instanceof Error ? error.message : String(error) },
          recoverable: upload.retryCount < (options.maxRetries || 3),
        });

        if (upload.retryCount < (options.maxRetries || 3)) {
          this?.logger?.warn('Upload failed, will retry', {
            file: upload.file,
            retryCount: upload.retryCount,
          });
          
          // Reset to pending for retry
          upload?.status = 'pending';
          
          // Add delay before retry
          await new Promise(resolve => setTimeout(resolve, 2000 * upload.retryCount));
          i--; // Retry this file
        } else {
          throw new CLIError(
            `Failed to upload file after ${upload.retryCount} attempts: ${upload.file}`,
            'FILE_UPLOAD_FAILED'
          );
        }
      }
    }

    this?.logger?.info('File uploads completed', {
      deploymentId,
      totalFiles: uploadedFiles.length,
      totalSize,
      totalCost,
    });

    return { files: uploadedFiles, totalSize, totalCost };
  }

  private async createSiteManifest(
    deploymentId: string,
    uploadResults: { files: Array<{ path: string; blobId: string; size: number }> },
    options: DeploymentOptions
  ): Promise<{ blobId: string; manifest: any }> {
    this?.logger?.debug('Creating site manifest', { deploymentId });

    // Create manifest mapping file paths to blob IDs
    const manifest = {
      version: '1?.0?.0',
      name: options.siteName,
      description: `Walrus site deployment for ${options.siteName}`,
      routes: {} as Record<string, string>,
      createdAt: new Date().toISOString(),
      network: options.network,
    };

    for (const file of uploadResults.files) {
      // Normalize path for web serving
      let webPath = file?.path?.replace(/\\/g, '/');
      if (webPath === 'index.html') {
        webPath = '/';
      } else if (webPath.endsWith('/index.html')) {
        webPath = webPath.replace('/index.html', '/');
      } else if (!webPath.startsWith('/')) {
        webPath = '/' + webPath;
      }
      
      manifest?.routes?.[webPath] = file.blobId;
    }

    // Upload manifest to Walrus
    const manifestResult = await this?.walrusClient?.uploadJson(manifest, {
      epochs: options.epochs || 5,
    });

    this?.logger?.debug('Site manifest created', {
      deploymentId,
      manifestBlobId: manifestResult.blobId,
      routes: Object.keys(manifest.routes).length,
    });

    return { blobId: manifestResult.blobId, manifest };
  }

  private async finalizeSiteDeployment(
    deploymentId: string,
    manifestResult: { blobId: string; manifest: any },
    options: DeploymentOptions
  ): Promise<{ siteId: string; siteUrl: string }> {
    this?.logger?.debug('Finalizing site deployment', { deploymentId });

    // Use site-builder to publish the site
    const publishResult = await this.executeSiteBuilder(
      deploymentId,
      options,
      manifestResult.blobId
    );

    const siteId = publishResult.siteId;
    const siteUrl = this.constructSiteUrl(siteId, options.network);

    this?.logger?.info('Site deployment finalized', {
      deploymentId,
      siteId,
      siteUrl,
    });

    return { siteId, siteUrl };
  }

  private async executeSiteBuilder(
    deploymentId: string,
    options: DeploymentOptions,
    manifestBlobId: string
  ): Promise<{ siteId: string; output: string }> {
    return new Promise((resolve, reject) => {
      const args = [
        'publish',
        '--epochs', String(options.epochs || 5),
        '--site-name', options.siteName,
      ];

      if (options?.network === 'testnet') {
        args.unshift('--context', 'testnet');
      }

      // Add manifest blob ID
      args.push(manifestBlobId);

      this?.logger?.debug('Executing site-builder', { args });

      const process = spawn(this.siteBuilderPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          // Extract site ID from output
          const siteIdMatch = stdout.match(/Site ID:\s*([^\s\n]+)/);
          if (siteIdMatch) {
            resolve({
              siteId: siteIdMatch[1],
              output: stdout,
            });
          } else {
            reject(new CLIError(
              'Failed to extract site ID from site-builder output',
              'SITE_ID_EXTRACTION_FAILED'
            ));
          }
        } else {
          reject(new CLIError(
            `site-builder failed with exit code ${code}: ${stderr}`,
            'SITE_BUILDER_FAILED'
          ));
        }
      });

      process.on('error', (error) => {
        reject(new CLIError(
          `Failed to execute site-builder: ${error.message}`,
          'SITE_BUILDER_EXECUTION_FAILED'
        ));
      });

      // Store process reference for potential cancellation
      const activeDeployment = this?.activeDeployments?.get(deploymentId);
      if (activeDeployment) {
        activeDeployment?.process = process;
      }
    });
  }

  private async updateProgress(
    deploymentId: string,
    phase: DeploymentProgress["phase"],
    progress: number
  ): Promise<void> {
    this?.logger?.debug('Deployment progress update', { deploymentId, phase, progress });
  }

  private async handleDeploymentFailure(
    deploymentId: string,
    error: unknown,
    options: DeploymentOptions
  ): Promise<void> {
    this?.logger?.error('Deployment failed', {
      deploymentId,
      error: error instanceof Error ? error.message : String(error),
    });

    let errorType: 'network' | 'validation' | 'storage' | 'blockchain' | 'config' = 'config';
    
    if (error instanceof CLIError) {
      switch (error.code) {
        case 'WALRUS_CONNECTION_FAILED':
        case 'NETWORK_TIMEOUT':
          errorType = 'network';
          break;
        case 'FILE_UPLOAD_FAILED':
          errorType = 'storage';
          break;
        case 'SITE_BUILDER_FAILED':
          errorType = 'blockchain';
          break;
        case 'BUILD_DIRECTORY_NOT_FOUND':
        case 'REQUIRED_FILE_MISSING':
          errorType = 'validation';
          break;
        default:
          errorType = 'config';
      }
    }

    await this?.recoveryManager?.recordError(deploymentId, {
      type: errorType,
      message: error instanceof Error ? error.message : String(error),
      details: { error },
      recoverable: errorType !== 'validation',
    });

    await this?.recoveryManager?.updateDeploymentState(deploymentId, {
      status: 'failed',
      recovery: {
        canResume: errorType !== 'validation',
        cleanupRequired: options.cleanupOnFailure !== false,
        rollbackAvailable: false,
        lastCheckpoint: '',
      },
    });
  }

  private mapStatusToPhase(status: string): DeploymentProgress["phase"] {
    switch (status) {
      case 'pending': return 'validation';
      case 'uploading': return 'uploading';
      case 'processing': return 'processing';
      case 'completed': return 'completed';
      case 'failed': return 'failed';
      default: return 'validation';
    }
  }

  private calculateEstimatedTimeRemaining(startTime: number, progressPercent: number): number | undefined {
    if (!startTime || progressPercent <= 0) return undefined;
    
    const elapsed = Date.now() - startTime;
    const estimated = (elapsed / progressPercent) * (100 - progressPercent);
    
    return Math.round(estimated / 1000); // Return seconds
  }

  private constructSiteUrl(siteId: string, network: string): string {
    const subdomain = network === 'mainnet' ? 'walrus' : 'walrus-testnet';
    return `https://${siteId}.${subdomain}.site`;
  }
}