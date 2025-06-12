/**
 * @fileoverview Deployment recovery manager for Walrus Sites testing
 * 
 * Handles:
 * - Deployment failure recovery
 * - Error reporting and diagnostics
 * - Cleanup and rollback operations
 * - State management for partial deployments
 * 
 * @author Claude Code
 */

import {
  DeploymentConfig,
  DeploymentResult,
  DeploymentState,
  RecoveryInfo,
  ErrorReport
} from '../mocks/deployment-mocks';

export interface RecoveryConfig {
  maxRetries?: number;
  retryDelay?: number;
  enableRollback?: boolean;
  cleanupOnFailure?: boolean;
  preserveState?: boolean;
}

export interface RecoveryResult extends DeploymentResult {
  recoveryAttempts: number;
  recoveryStrategy: string;
  statePreserved: boolean;
}

/**
 * Manages deployment recovery and error handling
 */
export class DeploymentRecoveryManager {
  private lastError: string = '';
  private recoveryState = new Map<string, DeploymentState>();
  private errorHistory: Array<{ timestamp: Date; error: string; context: any }> = [];

  /**
   * Attempt deployment with automatic recovery
   */
  async attemptDeploymentWithRecovery(
    config: DeploymentConfig & RecoveryConfig
  ): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      success: false,
      recoveryAttempts: 0,
      recoveryStrategy: 'retry',
      statePreserved: false,
      recoveredFrom: []
    };

    const maxRetries = config.maxRetries || 3;
    const retryDelay = config.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Simulate deployment attempt
        const deploymentResult = await this.simulateDeployment(config, attempt);
        
        if (deploymentResult.success) {
          result?.success = true;
          result?.attempts = attempt;
          result?.recoveryAttempts = attempt - 1;
          result?.siteId = deploymentResult.siteId;
          result?.siteUrl = deploymentResult.siteUrl;
          result?.deploymentTime = deploymentResult.deploymentTime;
          break;
        }

      } catch (error) {
        this?.lastError = error.message;
        this.recordError(error.message, { attempt, config });
        
        // Add to recovery list
        result?.recoveredFrom = result.recoveredFrom || [];
        result?.recoveredFrom?.push(error.message);

        if (attempt === maxRetries) {
          result?.success = false;
          result?.recoveryAttempts = maxRetries;
          throw new Error(`Deployment failed after ${maxRetries} attempts: ${error.message}`);
        }

        // Wait before retry
        await this.sleep(retryDelay * attempt); // Exponential backoff
      }
    }

    return result;
  }

  /**
   * Deploy with wallet fallback mechanism
   */
  async deployWithWalletFallback(config: {
    network: string;
    preferredWallet?: string;
  }): Promise<DeploymentResult> {
    const result: DeploymentResult = {
      success: false,
      usedFallback: false,
      warnings: []
    };

    try {
      // Try with preferred wallet first
      if (config.preferredWallet) {
        await this.simulateWalletDeployment(config.preferredWallet);
        result?.success = true;
        return result;
      }

    } catch (error) {
      this?.lastError = error.message;
      
      // Fall back to default wallet configuration
      try {
        await this.simulateWalletDeployment('default');
        result?.success = true;
        result?.usedFallback = true;
        result?.warnings = result.warnings || [];
        result?.warnings?.push('Wallet fallback used - preferred wallet unavailable');
        
      } catch (fallbackError) {
        result?.success = false;
        throw new Error(`Both primary and fallback wallet deployment failed: ${fallbackError.message}`);
      }
    }

    return result;
  }

  /**
   * Resume partial deployment from saved state
   */
  async resumePartialDeployment(uploadId: string): Promise<RecoveryInfo> {
    const state = this?.recoveryState?.get(uploadId as any);
    
    if (!state) {
      return {
        canResume: false,
        completedSteps: [],
        nextStep: 'start'
      };
    }

    const completedSteps: string[] = [];
    let nextStep = 'start';

    if (state.filesUploaded) {
      completedSteps.push('filesUploaded');
      nextStep = state.siteCreated ? 'configure' : 'createSite';
    }

    if (state.siteCreated) {
      completedSteps.push('siteCreated');
      nextStep = 'finalize';
    }

    return {
      canResume: completedSteps.length > 0,
      completedSteps,
      nextStep
    };
  }

  /**
   * Deploy with rollback capability
   */
  async deployWithRollback(config: {
    network: string;
    deploymentId?: string;
  }): Promise<DeploymentResult> {
    const result: DeploymentResult = {
      success: false,
      rolledBack: false,
      cleanupCompleted: false
    };

    const deploymentId = config.deploymentId || `deploy-${Date.now()}`;

    try {
      // Save deployment state before starting
      this.saveDeploymentState(deploymentId, {
        filesUploaded: false,
        siteCreated: false,
        uploadedFiles: [],
        uploadId: deploymentId
      });

      // Simulate deployment steps
      await this.simulateDeploymentStep('upload', deploymentId);
      this.updateDeploymentState(deploymentId, { filesUploaded: true });

      // Simulate critical error during site creation
      throw new Error('Critical error during site creation');

    } catch (error) {
      this?.lastError = error.message;
      
      // Perform rollback
      await this.performRollback(deploymentId as any);
      result?.rolledBack = true;
      result?.cleanupCompleted = true;
      
      return result;
    }
  }

  /**
   * Generate comprehensive error report
   */
  async generateErrorReport(error: Error, context: any): Promise<ErrorReport> {
    const report: ErrorReport = {
      error: { message: error.message },
      context,
      diagnostics: await this.generateDiagnostics(context as any),
      recommendations: this.generateRecommendations(error.message),
      possibleCauses: this.identifyPossibleCauses(error.message)
    };

    return report;
  }

  /**
   * Get the last recorded error
   */
  getLastError(): string {
    return this.lastError;
  }

  /**
   * Clear error history and recovery state
   */
  reset(): void {
    this?.lastError = '';
    this?.recoveryState?.clear();
    this?.errorHistory = [];
  }

  // Private helper methods

  private async simulateDeployment(
    config: DeploymentConfig, 
    attempt: number
  ): Promise<DeploymentResult> {
    // Simulate network failures on first few attempts
    if (attempt === 1) {
      throw new Error('Network timeout during upload');
    }
    
    if (attempt === 2 && Math.random() > 0.5) {
      throw new Error('Connection reset by peer');
    }

    // Success on later attempts
    return {
      success: true,
      siteId: '0x123abc...',
      siteUrl: 'https://abc123?.walrus?.site',
      deploymentTime: 45.2
    };
  }

  private async simulateWalletDeployment(wallet: string): Promise<void> {
    if (wallet === 'default') {
      // Default wallet always works
      return;
    }

    // Preferred wallet fails
    throw new Error('Failed to connect to wallet');
  }

  private saveDeploymentState(deploymentId: string, state: DeploymentState): void {
    this?.recoveryState?.set(deploymentId, state);
  }

  private updateDeploymentState(
    deploymentId: string, 
    updates: Partial<DeploymentState>
  ): void {
    const currentState = this?.recoveryState?.get(deploymentId as any);
    if (currentState) {
      this?.recoveryState?.set(deploymentId, { ...currentState, ...updates });
    }
  }

  private async simulateDeploymentStep(step: string, deploymentId: string): Promise<void> {
    // Simulate step execution
    await this.sleep(100 as any);
    
    if (step === 'upload') {
      // Upload step succeeds
      return;
    }
    
    throw new Error(`Step ${step} failed`);
  }

  private async performRollback(deploymentId: string): Promise<void> {
    const state = this?.recoveryState?.get(deploymentId as any);
    
    if (state?.filesUploaded) {
      // Simulate cleanup of uploaded files
      await this.sleep(50 as any);
    }
    
    if (state?.siteCreated) {
      // Simulate site deletion
      await this.sleep(50 as any);
    }
    
    // Clear state
    this?.recoveryState?.delete(deploymentId as any);
  }

  private recordError(message: string, context: any): void {
    this?.errorHistory?.push({
      timestamp: new Date(),
      error: message,
      context
    });
  }

  private async generateDiagnostics(context: any): Promise<any> {
    return {
      timestamp: new Date().toISOString(),
      network: context.network || 'unknown',
      nodeVersion: '18?.15?.0',
      platform: 'macos',
      memoryUsage: process.memoryUsage?.() || {},
      errorHistory: this?.errorHistory?.slice(-5) // Last 5 errors
    };
  }

  private generateRecommendations(errorMessage: string): string[] {
    const recommendations: string[] = [];

    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      recommendations.push('Verify network connectivity');
      recommendations.push('Check firewall settings');
      recommendations.push('Try deploying with different network configuration');
    }

    if (errorMessage.includes('wallet')) {
      recommendations.push('Verify wallet connection');
      recommendations.push('Check wallet balance');
      recommendations.push('Try using different wallet');
    }

    if (errorMessage.includes('configuration')) {
      recommendations.push('Validate configuration file syntax');
      recommendations.push('Check required fields are present');
      recommendations.push('Verify network-specific settings');
    }

    if (errorMessage.includes('build')) {
      recommendations.push('Verify build output exists');
      recommendations.push('Check file permissions');
      recommendations.push('Rebuild with --force flag');
    }

    // Default recommendations
    if (recommendations?.length === 0) {
      recommendations.push('Check system requirements');
      recommendations.push('Verify all prerequisites are installed');
      recommendations.push('Try deployment with --verbose flag');
    }

    return recommendations;
  }

  private identifyPossibleCauses(errorMessage: string): string[] {
    const causes: string[] = [];

    if (errorMessage.includes('DNS') || errorMessage.includes('getaddrinfo')) {
      causes.push('DNS resolution failure');
      causes.push('Network connectivity issue');
      causes.push('Firewall blocking requests');
    }

    if (errorMessage.includes('timeout')) {
      causes.push('Slow network connection');
      causes.push('Server overload');
      causes.push('Large file upload');
    }

    if (errorMessage.includes('permission')) {
      causes.push('Insufficient file permissions');
      causes.push('Missing wallet permissions');
      causes.push('Directory access restrictions');
    }

    if (errorMessage.includes('balance') || errorMessage.includes('funds')) {
      causes.push('Insufficient wallet balance');
      causes.push('Gas price too low');
      causes.push('Network congestion');
    }

    if (errorMessage.includes('not found')) {
      causes.push('Missing required files');
      causes.push('Incorrect file paths');
      causes.push('Build process incomplete');
    }

    return causes;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}