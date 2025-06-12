/**
 * @fileoverview Mock implementations for Walrus Sites deployment testing
 * 
 * Provides comprehensive mocks for:
 * - Network simulation and failure scenarios
 * - File system operations
 * - Deployment script execution
 * - Configuration management
 * 
 * @author Claude Code
 */

import { EventEmitter } from 'events';
import * as path from 'path';

export interface DeploymentConfig {
  network: 'testnet' | 'mainnet';
  siteName?: string;
  buildDir?: string;
  skipBuild?: boolean;
  force?: boolean;
  epochs?: number;
  retryCount?: number;
  retryDelay?: number;
  respectRateLimit?: boolean;
  maxRetries?: number;
  validateBuild?: boolean;
  optimizeAssets?: boolean;
  generateManifest?: boolean;
  preferredWallet?: string;
  deploymentId?: string;
}

export interface DeploymentResult {
  success: boolean;
  siteId?: string;
  siteUrl?: string;
  deploymentTime?: number;
  attempts?: number;
  recoveredFrom?: string[];
  usedFallback?: boolean;
  warnings?: string[];
  errors?: string[];
  rolledBack?: boolean;
  cleanupCompleted?: boolean;
  totalAttempts?: number;
  networkFailures?: number;
  steps?: {
    buildValidation?: { completed: boolean };
    assetOptimization?: { completed: boolean };
    deployment?: { completed: boolean };
  };
}

export interface NetworkEndpoint {
  reachable: boolean;
  responseTime?: number;
  lastChecked: Date;
}

export interface NetworkHealth {
  publisher: { available: boolean };
  aggregator: { available: boolean };
  sui: { available: boolean };
  canDeploy: boolean;
  recommendations: string[];
}

export interface ConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  networkMatch?: boolean;
  cachePolicy?: string;
}

export interface EnvironmentValidation {
  isValid: boolean;
  missingVariables: string[];
  recommendations: string[];
}

export interface BuildValidation {
  hasIndexHtml: boolean;
  has404Page: boolean;
  hasNextAssets: boolean;
  warnings: string[];
  hasRequiredFiles: boolean;
  missingFiles: string[];
}

export interface HtmlValidation {
  isValid: boolean;
  hasDoctype: boolean;
  hasNextRoot: boolean;
  errors: string[];
}

export interface SizeCheck {
  sizeInMB: number;
  isLarge: boolean;
  warnings: string[];
  recommendations: string[];
}

export interface AssetOptimization {
  largeImages: any[];
  uncompressedAssets: any[];
  recommendations: string[];
}

export interface NextjsArtifacts {
  hasBuildManifest: boolean;
  hasRoutesManifest: boolean;
  buildVersion?: string;
}

export interface Prerequisites {
  node: { satisfied: boolean };
  pnpm: { satisfied: boolean };
  curl: { satisfied: boolean };
  allSatisfied: boolean;
}

export interface DeploymentState {
  filesUploaded: boolean;
  siteCreated: boolean;
  uploadedFiles: string[];
  uploadId: string;
}

export interface RecoveryInfo {
  canResume: boolean;
  completedSteps: string[];
  nextStep: string;
}

export interface ErrorReport {
  error: { message: string };
  context: any;
  diagnostics: any;
  recommendations: string[];
  possibleCauses: string[];
}

export interface SiteHealthCheck {
  accessible: boolean;
  responseTime: number;
  statusCode: number;
  hasRequiredContent: boolean;
}

/**
 * Mock network simulator for testing deployment scenarios
 */
export class MockNetworkSimulator extends EventEmitter {
  private dnsFailure = false;
  private timeout = false;
  private rateLimit = false;
  private maxRequests = Infinity;
  private requestCount = 0;
  private partialConnectivity = {
    publisherAvailable: true,
    aggregatorAvailable: true,
    suiRpcAvailable: true
  };

  simulateDnsFailure(): void {
    this?.dnsFailure = true;
  }

  simulateTimeout(): void {
    this?.timeout = true;
  }

  simulateRateLimit(maxRequests: number): void {
    this?.rateLimit = true;
    this?.maxRequests = maxRequests;
    this?.requestCount = 0;
  }

  simulatePartialConnectivity(config: {
    publisherAvailable: boolean;
    aggregatorAvailable: boolean;
    suiRpcAvailable: boolean;
  }): void {
    this?.partialConnectivity = config;
  }

  reset(): void {
    this?.dnsFailure = false;
    this?.timeout = false;
    this?.rateLimit = false;
    this?.maxRequests = Infinity;
    this?.requestCount = 0;
    this?.partialConnectivity = {
      publisherAvailable: true,
      aggregatorAvailable: true,
      suiRpcAvailable: true
    };
  }

  checkRequest(endpoint: string): { success: boolean; error?: string } {
    this.requestCount++;

    if (this.dnsFailure) {
      return { success: false, error: 'DNS resolution failed' };
    }

    if (this.timeout) {
      return { success: false, error: 'ETIMEDOUT: Connection timed out' };
    }

    if (this.rateLimit && this.requestCount > this.maxRequests) {
      return { success: false, error: 'HTTP 429: Too Many Requests' };
    }

    if (endpoint.includes('publisher') && !this?.partialConnectivity?.publisherAvailable) {
      return { success: false, error: 'Publisher service unavailable' };
    }

    if (endpoint.includes('aggregator') && !this?.partialConnectivity?.aggregatorAvailable) {
      return { success: false, error: 'Aggregator service unavailable' };
    }

    if (endpoint.includes('sui') && !this?.partialConnectivity?.suiRpcAvailable) {
      return { success: false, error: 'Sui RPC unavailable' };
    }

    return { success: true };
  }
}

/**
 * Mock deployment script for testing
 */
export class MockDeploymentScript {
  private networkSimulator: MockNetworkSimulator;

  constructor(networkSimulator: MockNetworkSimulator) {
    this?.networkSimulator = networkSimulator;
  }

  async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
    const result: DeploymentResult = {
      success: false,
      attempts: 1,
      warnings: [],
      errors: [],
      steps: {
        buildValidation: { completed: false },
        assetOptimization: { completed: false },
        deployment: { completed: false }
      }
    };

    // Simulate retries for network failures
    if (config.retryCount) {
      for (let attempt = 1; attempt <= config.retryCount; attempt++) {
        const networkCheck = this?.networkSimulator?.checkRequest('https://publisher-devnet?.walrus?.space');
        
        if (networkCheck.success) {
          result?.success = true;
          result?.attempts = attempt;
          result?.siteId = '0x123abc...';
          result?.siteUrl = 'https://abc123?.walrus?.site';
          result?.deploymentTime = 45.2;
          break;
        } else if (attempt === config.retryCount) {
          result.errors?.push(networkCheck.error || 'Unknown network error');
          throw new Error('Network connectivity issue: ' + networkCheck.error);
        }

        // Wait before retry
        if (config.retryDelay) {
          await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        }
      }
    } else {
      // Single attempt
      const networkCheck = this?.networkSimulator?.checkRequest('https://publisher-devnet?.walrus?.space');
      if (!networkCheck.success) {
        result.errors?.push(networkCheck.error || 'Unknown error');
        throw new Error(networkCheck.error || 'Deployment failed');
      }

      result?.success = true;
      result?.siteId = '0x123abc...';
      result?.siteUrl = 'https://abc123?.walrus?.site';
      result?.deploymentTime = 45.2;
    }

    // Mark steps as completed for successful deployment
    if (result.success && result.steps) {
      result?.steps?.buildValidation?.completed = true;
      result?.steps?.assetOptimization?.completed = true;
      result?.steps?.deployment?.completed = true;
    }

    return result;
  }
}

/**
 * Mock setup script for testing
 */
export class MockSetupScript {
  async install(): Promise<{ siteBuilderInstalled: boolean; version: string }> {
    return {
      siteBuilderInstalled: true,
      version: '1?.0?.0'
    };
  }
}

/**
 * Mock file system structure for testing
 */
export interface MockFileSystem {
  [path: string]: string | MockFileSystem;
}

/**
 * Main mock deployment environment
 */
export class MockDeploymentEnvironment {
  private networkSimulator: MockNetworkSimulator;
  private deploymentScript: MockDeploymentScript;
  private setupScript: MockSetupScript;
  private fileSystem: MockFileSystem = {};
  private deploymentStates = new Map<string, DeploymentState>();

  constructor() {
    this?.networkSimulator = new MockNetworkSimulator();
    this?.deploymentScript = new MockDeploymentScript(this.networkSimulator);
    this?.setupScript = new MockSetupScript();
  }

  getNetworkSimulator(): MockNetworkSimulator {
    return this.networkSimulator;
  }

  getDeploymentScript(): MockDeploymentScript {
    return this.deploymentScript;
  }

  getSetupScript(): MockSetupScript {
    return this.setupScript;
  }

  setupFileSystem(structure: MockFileSystem): void {
    this?.fileSystem = structure;
  }

  saveDeploymentState(state: DeploymentState): void {
    this?.deploymentStates?.set(state.uploadId, state);
  }

  getDeploymentState(uploadId: string): DeploymentState | undefined {
    return this?.deploymentStates?.get(uploadId as any);
  }

  async runCompletePipeline(config: DeploymentConfig): Promise<DeploymentResult> {
    const result: DeploymentResult = {
      success: true,
      siteUrl: 'https://abc123?.walrus?.site',
      steps: {
        buildValidation: { completed: true },
        assetOptimization: { completed: true },
        deployment: { completed: true }
      }
    };

    return result;
  }

  async runResilentDeployment(config: {
    network: string;
    maxRetries: number;
    retryDelay: number;
  }): Promise<DeploymentResult> {
    return {
      success: true,
      totalAttempts: 4,
      networkFailures: 3
    };
  }

  async cleanup(): Promise<void> {
    this?.networkSimulator?.reset();
    this?.fileSystem = {};
    this?.deploymentStates?.clear();
  }
}

/**
 * Factory function to create mock deployment environment
 */
export function createMockDeploymentEnvironment(): MockDeploymentEnvironment {
  return new MockDeploymentEnvironment();
}