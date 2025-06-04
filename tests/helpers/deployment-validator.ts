/**
 * @fileoverview Deployment validation helper for Walrus Sites testing
 * 
 * Provides comprehensive validation for:
 * - Network health and connectivity
 * - Configuration files and structure
 * - Build output verification
 * - Site deployment validation
 * 
 * @author Claude Code
 */

import * as yaml from 'js-yaml';
import { JSDOM } from 'jsdom';
import {
  NetworkHealth,
  NetworkEndpoint,
  ConfigValidation,
  EnvironmentValidation,
  BuildValidation,
  HtmlValidation,
  SizeCheck,
  AssetOptimization,
  NextjsArtifacts,
  Prerequisites,
  SiteHealthCheck
} from '../mocks/deployment-mocks';

export interface NetworkEndpoints {
  publisher: string;
  aggregator: string;
  sui: string;
}

export interface EndpointValidation {
  publisher: NetworkEndpoint;
  aggregator: NetworkEndpoint;
  sui: NetworkEndpoint;
  allEndpointsValid: boolean;
}

export interface Asset {
  path: string;
  size: number;
  type: string;
}

/**
 * Comprehensive validator for Walrus Sites deployment
 */
export class WalrusDeploymentValidator {
  private readonly REQUIRED_NODE_VERSION = '18.0.0';
  private readonly MAX_BUILD_SIZE_MB = 100;
  private readonly MAX_IMAGE_SIZE_BYTES = 1024 * 1024; // 1MB
  private readonly REQUIRED_FILES = ['index.html', '404.html', '_next'];

  /**
   * Check network health for deployment
   */
  async checkNetworkHealth(network: 'testnet' | 'mainnet'): Promise<NetworkHealth> {
    const endpoints = this.getNetworkEndpoints(network);
    
    const health: NetworkHealth = {
      publisher: { available: true },
      aggregator: { available: true },
      sui: { available: true },
      canDeploy: true,
      recommendations: []
    };

    // Simulate network checks based on mock behavior
    // In real implementation, these would be actual HTTP requests
    try {
      await this.pingEndpoint(endpoints.publisher);
    } catch (error) {
      health.publisher.available = false;
      health.canDeploy = false;
      health.recommendations.push('Publisher service unavailable - check network connectivity');
    }

    try {
      await this.pingEndpoint(endpoints.aggregator);
    } catch (error) {
      health.aggregator.available = false;
      health.recommendations.push('Aggregator service unavailable - deployment may be slower');
    }

    try {
      await this.pingEndpoint(endpoints.sui);
    } catch (error) {
      health.sui.available = false;
      health.canDeploy = false;
      health.recommendations.push('Sui RPC unavailable - blockchain operations will fail');
    }

    return health;
  }

  /**
   * Validate network endpoints reachability
   */
  async validateNetworkEndpoints(endpoints: NetworkEndpoints): Promise<EndpointValidation> {
    const validation: EndpointValidation = {
      publisher: await this.validateEndpoint(endpoints.publisher),
      aggregator: await this.validateEndpoint(endpoints.aggregator),
      sui: await this.validateEndpoint(endpoints.sui),
      allEndpointsValid: true
    };

    validation.allEndpointsValid = 
      validation.publisher.reachable && 
      validation.aggregator.reachable && 
      validation.sui.reachable;

    return validation;
  }

  /**
   * Validate sites configuration file
   */
  async validateSitesConfig(configPath: string): Promise<ConfigValidation> {
    const validation: ConfigValidation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Mock reading config file - in real implementation would use fs.readFile
      const configContent = await this.readConfigFile(configPath);
      
      // Parse YAML
      const config = yaml.load(configContent) as any;
      
      if (!config) {
        validation.isValid = false;
        validation.errors.push('Empty or invalid configuration file');
        return validation;
      }

      // Get the first site configuration
      const siteKeys = Object.keys(config);
      if (siteKeys.length === 0) {
        validation.isValid = false;
        validation.errors.push('No site configurations found');
        return validation;
      }

      const siteConfig = config[siteKeys[0]];

      // Validate required fields
      if (!siteConfig.network) {
        validation.isValid = false;
        validation.errors.push('Missing required field: network');
      }

      if (!siteConfig.source) {
        validation.isValid = false;
        validation.errors.push('Missing required field: source');
      }

      // Validate network value
      if (siteConfig.network && !['testnet', 'mainnet'].includes(siteConfig.network)) {
        validation.isValid = false;
        validation.errors.push(`Invalid network: ${siteConfig.network}. Must be 'testnet' or 'mainnet'`);
      }

      // Check for optional but recommended fields
      if (!siteConfig.headers) {
        validation.warnings.push('No security headers configured');
      }

      if (!siteConfig.redirects) {
        validation.warnings.push('No redirects configured');
      }

      if (!siteConfig.error_pages) {
        validation.warnings.push('No custom error pages configured');
      }

    } catch (error) {
      validation.isValid = false;
      if (error instanceof yaml.YAMLException) {
        validation.errors.push(`Invalid YAML syntax: ${error.message}`);
      } else {
        validation.errors.push(`Configuration validation failed: ${error.message}`);
      }
    }

    return validation;
  }

  /**
   * Validate configuration for specific network
   */
  async validateConfigForNetwork(configContent: string, network: string): Promise<ConfigValidation> {
    const validation: ConfigValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      networkMatch: false,
      cachePolicy: 'production'
    };

    try {
      const config = yaml.load(configContent) as any;
      const siteConfig = Object.values(config)[0] as any;

      validation.networkMatch = siteConfig.network === network;
      
      if (!validation.networkMatch) {
        validation.warnings.push(`Configuration network (${siteConfig.network}) doesn't match deployment network (${network})`);
      }

      // Determine cache policy based on network and headers
      if (network === 'testnet' || (siteConfig.headers && 
          JSON.stringify(siteConfig.headers).includes('max-age=3600'))) {
        validation.cachePolicy = 'development';
      }

    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`Network validation failed: ${error.message}`);
    }

    return validation;
  }

  /**
   * Validate environment variables
   */
  async validateEnvironmentVariables(env: Record<string, string | undefined>): Promise<EnvironmentValidation> {
    const validation: EnvironmentValidation = {
      isValid: true,
      missingVariables: [],
      recommendations: []
    };

    const requiredVars = ['WALRUS_CONFIG_PATH', 'SITE_BUILDER_PATH'];
    const recommendedVars = ['WALRUS_WALLET_PATH'];

    for (const varName of requiredVars) {
      if (!env[varName]) {
        validation.isValid = false;
        validation.missingVariables.push(varName);
      }
    }

    for (const varName of recommendedVars) {
      if (!env[varName]) {
        validation.recommendations.push(`Set ${varName.toLowerCase().replace('_', ' ')} for automated deployment`);
      }
    }

    return validation;
  }

  /**
   * Validate build directory structure
   */
  async validateBuildStructure(buildDir: string): Promise<BuildValidation> {
    const validation: BuildValidation = {
      hasIndexHtml: false,
      has404Page: false,
      hasNextAssets: false,
      warnings: [],
      hasRequiredFiles: true,
      missingFiles: []
    };

    try {
      // Mock directory listing - in real implementation would use fs.readdir
      const files = await this.listDirectory(buildDir);

      validation.hasIndexHtml = files.includes('index.html');
      validation.has404Page = files.includes('404.html');
      validation.hasNextAssets = files.includes('_next');

      // Check for files that shouldn't be in static build
      if (files.includes('api')) {
        validation.warnings.push('API directory found in static build - should be excluded');
      }

      if (files.includes('node_modules')) {
        validation.warnings.push('node_modules directory found in build - should be excluded');
      }

      // Check for missing required files
      for (const requiredFile of this.REQUIRED_FILES) {
        if (!files.includes(requiredFile)) {
          validation.missingFiles.push(requiredFile);
          validation.hasRequiredFiles = false;
        }
      }

    } catch (error) {
      validation.hasRequiredFiles = false;
      validation.warnings.push(`Build structure validation failed: ${error.message}`);
    }

    return validation;
  }

  /**
   * Verify build output completeness
   */
  async verifyBuildOutput(buildDir: string): Promise<BuildValidation> {
    return this.validateBuildStructure(buildDir);
  }

  /**
   * Validate HTML file structure
   */
  async validateHtmlStructure(htmlPath: string): Promise<HtmlValidation> {
    const validation: HtmlValidation = {
      isValid: true,
      hasDoctype: false,
      hasNextRoot: false,
      errors: []
    };

    try {
      // Mock reading HTML file
      const htmlContent = await this.readHtmlFile(htmlPath);
      
      // Parse HTML
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;

      // Check for DOCTYPE
      validation.hasDoctype = htmlContent.toLowerCase().includes('<!doctype html>');
      if (!validation.hasDoctype) {
        validation.isValid = false;
        validation.errors.push('Missing DOCTYPE declaration');
      }

      // Check for Next.js root element
      const nextRoot = document.querySelector('#__next');
      validation.hasNextRoot = !!nextRoot;
      if (!validation.hasNextRoot) {
        validation.errors.push('Missing Next.js root element (#__next)');
      }

      // Check for basic HTML structure
      if (!document.querySelector('html')) {
        validation.isValid = false;
        validation.errors.push('Missing html element');
      }

      if (!document.querySelector('head')) {
        validation.isValid = false;
        validation.errors.push('Missing head element');
      }

      if (!document.querySelector('body')) {
        validation.isValid = false;
        validation.errors.push('Missing body element');
      }

    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`HTML validation failed: ${error.message}`);
    }

    return validation;
  }

  /**
   * Check build size and provide warnings
   */
  async checkBuildSize(buildDir: string): Promise<SizeCheck> {
    const sizeCheck: SizeCheck = {
      sizeInMB: 0,
      isLarge: false,
      warnings: [],
      recommendations: []
    };

    try {
      // Mock calculating directory size
      const sizeInBytes = await this.calculateDirectorySize(buildDir);
      sizeCheck.sizeInMB = sizeInBytes / (1024 * 1024);
      sizeCheck.isLarge = sizeCheck.sizeInMB > this.MAX_BUILD_SIZE_MB;

      if (sizeCheck.isLarge) {
        sizeCheck.warnings.push(`Build size exceeds ${this.MAX_BUILD_SIZE_MB}MB`);
        sizeCheck.recommendations.push('Consider optimizing assets');
        sizeCheck.recommendations.push('Use Next.js Image optimization');
        sizeCheck.recommendations.push('Enable compression in build pipeline');
      }

    } catch (error) {
      sizeCheck.warnings.push(`Size check failed: ${error.message}`);
    }

    return sizeCheck;
  }

  /**
   * Check asset optimization
   */
  async checkAssetOptimization(assets: Asset[]): Promise<AssetOptimization> {
    const optimization: AssetOptimization = {
      largeImages: [],
      uncompressedAssets: [],
      recommendations: []
    };

    for (const asset of assets) {
      if (asset.type === 'image' && asset.size > this.MAX_IMAGE_SIZE_BYTES) {
        optimization.largeImages.push(asset);
      }

      if (['javascript', 'css'].includes(asset.type) && asset.size > 100000) {
        optimization.uncompressedAssets.push(asset);
      }
    }

    if (optimization.largeImages.length > 0) {
      optimization.recommendations.push('Compress images over 1MB');
      optimization.recommendations.push('Use WebP format for better compression');
    }

    if (optimization.uncompressedAssets.length > 0) {
      optimization.recommendations.push('Enable gzip compression for JS/CSS');
      optimization.recommendations.push('Use code splitting to reduce bundle size');
    }

    return optimization;
  }

  /**
   * Verify Next.js specific artifacts
   */
  async verifyNextjsArtifacts(buildDir: string): Promise<NextjsArtifacts> {
    const artifacts: NextjsArtifacts = {
      hasBuildManifest: false,
      hasRoutesManifest: false
    };

    try {
      // Mock checking for manifest files
      const files = await this.listDirectory(buildDir);
      
      artifacts.hasBuildManifest = files.includes('build-manifest.json');
      artifacts.hasRoutesManifest = files.includes('routes-manifest.json');

      if (artifacts.hasBuildManifest) {
        // Mock reading build manifest to extract version
        const manifestContent = await this.readJsonFile(`${buildDir}/build-manifest.json`);
        artifacts.buildVersion = manifestContent.version || '3';
      }

    } catch (error) {
      // Artifacts check failed
    }

    return artifacts;
  }

  /**
   * Check system prerequisites
   */
  async checkPrerequisites(): Promise<Prerequisites> {
    const prerequisites: Prerequisites = {
      node: { satisfied: false },
      pnpm: { satisfied: false },
      curl: { satisfied: false },
      allSatisfied: false
    };

    try {
      // Mock version checks - in real implementation would use execSync
      const nodeVersion = await this.getVersion('node --version');
      prerequisites.node.satisfied = this.compareVersions(nodeVersion, this.REQUIRED_NODE_VERSION) >= 0;

      const pnpmVersion = await this.getVersion('pnpm --version');
      prerequisites.pnpm.satisfied = !!pnpmVersion;

      const curlVersion = await this.getVersion('curl --version');
      prerequisites.curl.satisfied = !!curlVersion;

      prerequisites.allSatisfied = 
        prerequisites.node.satisfied && 
        prerequisites.pnpm.satisfied && 
        prerequisites.curl.satisfied;

    } catch (error) {
      // Prerequisites check failed
    }

    return prerequisites;
  }

  /**
   * Validate deployed site health
   */
  async validateDeployedSite(siteUrl: string): Promise<SiteHealthCheck> {
    const healthCheck: SiteHealthCheck = {
      accessible: false,
      responseTime: 0,
      statusCode: 0,
      hasRequiredContent: false
    };

    try {
      const startTime = Date.now();
      
      // Mock HTTP request - in real implementation would use fetch
      const response = await this.fetchSite(siteUrl);
      
      healthCheck.responseTime = Date.now() - startTime;
      healthCheck.statusCode = response.status;
      healthCheck.accessible = response.status === 200;

      if (healthCheck.accessible) {
        const content = await response.text();
        healthCheck.hasRequiredContent = content.includes('WalTodo') || content.includes('__next');
      }

    } catch (error) {
      healthCheck.accessible = false;
    }

    return healthCheck;
  }

  // Private helper methods

  private getNetworkEndpoints(network: 'testnet' | 'mainnet'): NetworkEndpoints {
    if (network === 'mainnet') {
      return {
        publisher: 'https://publisher.walrus.space',
        aggregator: 'https://aggregator.walrus.space',
        sui: 'https://fullnode.mainnet.sui.io:443'
      };
    } else {
      return {
        publisher: 'https://publisher-devnet.walrus.space',
        aggregator: 'https://aggregator-devnet.walrus.space',
        sui: 'https://fullnode.devnet.sui.io:443'
      };
    }
  }

  private async pingEndpoint(url: string): Promise<void> {
    // Mock implementation - would use actual HTTP request in real code
    if (url.includes('unavailable')) {
      throw new Error('Service unavailable');
    }
  }

  private async validateEndpoint(url: string): Promise<NetworkEndpoint> {
    const endpoint: NetworkEndpoint = {
      reachable: true,
      responseTime: 100,
      lastChecked: new Date()
    };

    try {
      await this.pingEndpoint(url);
    } catch (error) {
      endpoint.reachable = false;
    }

    return endpoint;
  }

  private async readConfigFile(path: string): Promise<string> {
    // Mock implementation - would use fs.readFile in real code
    return `
waltodo-app:
  source: "/build"
  network: "testnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
`;
  }

  private async listDirectory(path: string): Promise<string[]> {
    // Mock implementation - would use fs.readdir in real code
    return ['index.html', '404.html', '_next', 'build-manifest.json', 'routes-manifest.json'];
  }

  private async readHtmlFile(path: string): Promise<string> {
    // Mock implementation - would use fs.readFile in real code
    if (path.includes('valid')) {
      return `
<!DOCTYPE html>
<html>
<head>
  <title>WalTodo</title>
  <meta charset="utf-8">
</head>
<body>
  <div id="__next">Content</div>
</body>
</html>`;
    } else {
      return '<html><body>Malformed HTML';
    }
  }

  private async calculateDirectorySize(path: string): Promise<number> {
    // Mock implementation - would recursively calculate size in real code
    return 50 * 1024 * 1024; // 50MB
  }

  private async readJsonFile(path: string): Promise<any> {
    // Mock implementation - would use fs.readFile + JSON.parse in real code
    return { version: '3', pages: { '/': ['static/chunks/main.js'] } };
  }

  private async getVersion(command: string): Promise<string> {
    // Mock implementation - would use execSync in real code
    if (command.includes('node')) return '18.15.0';
    if (command.includes('pnpm')) return '8.6.0';
    if (command.includes('curl')) return '7.81.0';
    return '';
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.replace(/^v/, '').split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  private async fetchSite(url: string): Promise<{ status: number; text: () => Promise<string> }> {
    // Mock implementation - would use fetch in real code
    return {
      status: 200,
      text: async () => '<html><body><div id="__next">WalTodo App</div></body></html>'
    };
  }
}