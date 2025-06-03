#!/usr/bin/env node

/**
 * Enhanced Configuration Validation Script
 * 
 * Comprehensive validation for Walrus Sites configuration including:
 * - Duplicate key detection
 * - Network-specific validation
 * - Performance optimization checks
 * - Security header validation
 * - Build configuration verification
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Configuration constants
const NETWORKS = ['testnet', 'mainnet', 'devnet'];
const REQUIRED_FIELDS = {
  network: ['name', 'url', 'chainId'],
  walrus: ['packageId', 'networkUrl', 'publisherUrl'],
  deployment: ['packageId', 'timestamp'],
  contracts: ['todoNft']
};

const SECURITY_HEADERS = [
  'X-Content-Type-Options',
  'X-Frame-Options', 
  'X-XSS-Protection',
  'Referrer-Policy'
];

const PERFORMANCE_HEADERS = [
  'Cache-Control',
  'Accept-Ranges'
];

// Official package IDs
const OFFICIAL_PACKAGE_IDS = {
  mainnet: {
    walrusSites: '0x26eb7ee8688da02c5f671679524e379f0b837a12f1d1d799f255b7eea260ad27',
    walrus: '0xfdc88f7d7cf30afab2f82e8380d11ee8f70efb90e863d1de8616fae1bb09ea77'
  },
  testnet: {
    walrusSites: '0xf99aee9f21493e1590e7e5a9aea6f343a1f381031a04a732724871fc294be799',
    walrus: '0xd84704c17fc870b8764832c535aa6b11f21a95cd6f5bb38a9b07d2cf42220c66'
  }
};

// Colors for output
const colors = {
  red: '\033[0;31m',
  green: '\033[0;32m',
  yellow: '\033[1;33m',
  blue: '\033[0;34m',
  cyan: '\033[0;36m',
  reset: '\033[0m'
};

// Logging functions
function log(level, message) {
  const timestamp = new Date().toISOString();
  let color = colors.reset;
  let prefix = '';
  
  switch (level) {
    case 'error':
      color = colors.red;
      prefix = '❌';
      break;
    case 'warn':
      color = colors.yellow;
      prefix = '⚠️ ';
      break;
    case 'success':
      color = colors.green;
      prefix = '✅';
      break;
    case 'info':
      color = colors.blue;
      prefix = 'ℹ️ ';
      break;
    case 'debug':
      color = colors.cyan;
      prefix = '🔍';
      break;
  }
  
  console.log(`${color}${prefix} ${message}${colors.reset}`);
}

class ConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.suggestions = [];
  }

  // Load JSON configuration with duplicate key detection
  loadJsonConfig(configPath) {
    if (!fs.existsSync(configPath)) {
      this.errors.push(`Configuration file not found: ${configPath}`);
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf8');
      
      // Check for duplicate keys using regex
      const duplicateKeyRegex = /"(\w+)"\s*:\s*[^,}]+,[\s\S]*?"\\1"\s*:/g;
      let match;
      const duplicates = [];
      
      while ((match = duplicateKeyRegex.exec(content)) !== null) {
        duplicates.push(match[1]);
      }
      
      if (duplicates.length > 0) {
        this.errors.push(`Duplicate keys found in ${configPath}: ${duplicates.join(', ')}`);
      }
      
      const config = JSON.parse(content);
      log('success', `Loaded configuration: ${configPath}`);
      return config;
      
    } catch (error) {
      this.errors.push(`Failed to parse ${configPath}: ${error.message}`);
      return null;
    }
  }

  // Load YAML configuration
  loadYamlConfig(configPath) {
    if (!fs.existsSync(configPath)) {
      this.warnings.push(`YAML configuration file not found: ${configPath}`);
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(content);
      log('success', `Loaded YAML configuration: ${configPath}`);
      return config;
    } catch (error) {
      this.errors.push(`Failed to parse YAML ${configPath}: ${error.message}`);
      return null;
    }
  }

  // Validate required fields
  validateRequiredFields(config, network) {
    log('info', `Validating required fields for ${network}...`);
    
    for (const [section, fields] of Object.entries(REQUIRED_FIELDS)) {
      if (!config[section]) {
        this.errors.push(`Missing required section: ${section}`);
        continue;
      }
      
      for (const field of fields) {
        if (!config[section][field]) {
          this.errors.push(`Missing required field: ${section}.${field}`);
        }
      }
    }
  }

  // Validate package IDs
  validatePackageIds(config, network) {
    log('info', `Validating package IDs for ${network}...`);
    
    const expectedIds = OFFICIAL_PACKAGE_IDS[network];
    if (!expectedIds) {
      this.warnings.push(`No official package IDs defined for network: ${network}`);
      return;
    }

    // Check Walrus package ID
    if (config.walrus?.packageId) {
      if (config.walrus.packageId === expectedIds.walrus) {
        log('success', `Correct Walrus package ID: ${config.walrus.packageId}`);
      } else {
        this.warnings.push(`Walrus package ID may be incorrect. Expected: ${expectedIds.walrus}, Got: ${config.walrus.packageId}`);
      }
    }

    // Check deployment package ID
    if (config.deployment?.packageId) {
      if (config.deployment.packageId === expectedIds.walrusSites) {
        log('success', `Correct deployment package ID: ${config.deployment.packageId}`);
      } else {
        this.warnings.push(`Deployment package ID may be incorrect. Expected: ${expectedIds.walrusSites}, Got: ${config.deployment.packageId}`);
      }
    }
  }

  // Validate network configuration
  validateNetworkConfig(config, network) {
    log('info', `Validating network configuration for ${network}...`);
    
    if (config.network?.name !== network) {
      this.warnings.push(`Network name mismatch. Expected: ${network}, Got: ${config.network?.name}`);
    }

    // Validate URLs
    const urlFields = ['url', 'faucetUrl', 'explorerUrl', 'websocketUrl'];
    for (const field of urlFields) {
      const url = config.network?.[field];
      if (url && !this.isValidUrl(url)) {
        this.errors.push(`Invalid URL in network.${field}: ${url}`);
      }
    }

    // Validate fallback URLs
    if (config.network?.fallbackUrls) {
      for (let i = 0; i < config.network.fallbackUrls.length; i++) {
        const url = config.network.fallbackUrls[i];
        if (!this.isValidUrl(url)) {
          this.errors.push(`Invalid fallback URL at index ${i}: ${url}`);
        }
      }
    }
  }

  // Validate Walrus configuration
  validateWalrusConfig(config) {
    log('info', 'Validating Walrus configuration...');
    
    if (!config.walrus) {
      this.errors.push('Missing walrus configuration section');
      return;
    }

    // Validate Walrus URLs
    const walrusUrlFields = ['networkUrl', 'publisherUrl', 'aggregatorUrl', 'apiPrefix'];
    for (const field of walrusUrlFields) {
      const url = config.walrus[field];
      if (url && !this.isValidUrl(url)) {
        this.errors.push(`Invalid Walrus URL in walrus.${field}: ${url}`);
      }
    }

    // Validate fallback publisher URLs
    if (config.walrus.fallbackPublisherUrls) {
      for (let i = 0; i < config.walrus.fallbackPublisherUrls.length; i++) {
        const url = config.walrus.fallbackPublisherUrls[i];
        if (!this.isValidUrl(url)) {
          this.errors.push(`Invalid fallback publisher URL at index ${i}: ${url}`);
        }
      }
    }

    // Validate performance settings
    if (config.walrus.performance) {
      this.validatePerformanceConfig(config.walrus.performance);
    }
  }

  // Validate performance configuration
  validatePerformanceConfig(perfConfig) {
    log('info', 'Validating performance configuration...');
    
    if (perfConfig.cacheDuration && perfConfig.cacheDuration < 300) {
      this.warnings.push('Cache duration is very low, consider increasing for better performance');
    }

    if (perfConfig.timeoutMs && perfConfig.timeoutMs > 60000) {
      this.warnings.push('Timeout is very high, consider reducing for better user experience');
    }

    if (perfConfig.retryAttempts && perfConfig.retryAttempts > 5) {
      this.warnings.push('Too many retry attempts may cause poor user experience');
    }
  }

  // Validate YAML sites configuration
  validateSitesConfig(yamlConfig) {
    log('info', 'Validating Walrus Sites YAML configuration...');
    
    if (!yamlConfig) {
      this.warnings.push('No YAML sites configuration found');
      return;
    }

    // Check for site configurations
    const siteNames = Object.keys(yamlConfig).filter(key => !key.startsWith('_'));
    if (siteNames.length === 0) {
      this.errors.push('No site configurations found in YAML');
      return;
    }

    for (const siteName of siteNames) {
      this.validateSiteConfig(siteName, yamlConfig[siteName]);
    }
  }

  // Validate individual site configuration
  validateSiteConfig(siteName, siteConfig) {
    log('info', `Validating site configuration: ${siteName}`);
    
    // Check required fields
    if (!siteConfig.source) {
      this.errors.push(`Site ${siteName} missing source directory`);
    } else if (!fs.existsSync(siteConfig.source)) {
      this.warnings.push(`Source directory does not exist: ${siteConfig.source}`);
    }

    if (!siteConfig.network) {
      this.errors.push(`Site ${siteName} missing network specification`);
    } else if (!NETWORKS.includes(siteConfig.network)) {
      this.errors.push(`Site ${siteName} has invalid network: ${siteConfig.network}`);
    }

    // Validate headers
    if (siteConfig.headers) {
      this.validateHeaders(siteName, siteConfig.headers);
    }

    // Validate redirects
    if (siteConfig.redirects) {
      this.validateRedirects(siteName, siteConfig.redirects);
    }
  }

  // Validate HTTP headers
  validateHeaders(siteName, headers) {
    log('debug', `Validating headers for site: ${siteName}`);
    
    for (const [pattern, headerList] of Object.entries(headers)) {
      if (!Array.isArray(headerList)) {
        this.errors.push(`Headers for pattern ${pattern} must be an array`);
        continue;
      }

      const headerNames = headerList.map(header => header.split(':')[0].trim());
      
      // Check for security headers
      const hasSecurityHeaders = SECURITY_HEADERS.some(header => 
        headerNames.includes(header)
      );
      
      if (!hasSecurityHeaders && pattern.includes('html')) {
        this.warnings.push(`Missing security headers for HTML pattern: ${pattern}`);
      }

      // Check for performance headers
      const hasPerformanceHeaders = PERFORMANCE_HEADERS.some(header => 
        headerNames.includes(header)
      );
      
      if (!hasPerformanceHeaders && pattern.includes('static')) {
        this.warnings.push(`Missing performance headers for static pattern: ${pattern}`);
      }
    }
  }

  // Validate redirects
  validateRedirects(siteName, redirects) {
    log('debug', `Validating redirects for site: ${siteName}`);
    
    for (let i = 0; i < redirects.length; i++) {
      const redirect = redirects[i];
      
      if (!redirect.from || !redirect.to) {
        this.errors.push(`Redirect ${i} missing 'from' or 'to' field`);
        continue;
      }

      if (redirect.status && ![301, 302, 307, 308].includes(redirect.status)) {
        this.warnings.push(`Redirect ${i} has unusual status code: ${redirect.status}`);
      }

      // Check for external redirects
      if (redirect.to.startsWith('http') && !redirect.to.includes('waltodo')) {
        this.warnings.push(`Redirect ${i} points to external domain: ${redirect.to}`);
      }
    }
  }

  // Validate build output
  validateBuildOutput(buildPath) {
    log('info', `Validating build output: ${buildPath}`);
    
    if (!fs.existsSync(buildPath)) {
      this.errors.push(`Build directory does not exist: ${buildPath}`);
      return;
    }

    const requiredFiles = ['index.html', '404.html'];
    const requiredDirs = ['_next'];
    
    for (const file of requiredFiles) {
      const filePath = path.join(buildPath, file);
      if (!fs.existsSync(filePath)) {
        this.warnings.push(`Missing expected file: ${file}`);
      }
    }

    for (const dir of requiredDirs) {
      const dirPath = path.join(buildPath, dir);
      if (!fs.existsSync(dirPath)) {
        this.warnings.push(`Missing expected directory: ${dir}`);
      }
    }

    // Check build size
    const stats = this.getBuildStats(buildPath);
    if (stats.totalSize > 100 * 1024 * 1024) { // 100MB
      this.warnings.push(`Build size is large (${this.formatBytes(stats.totalSize)}), consider optimization`);
    }

    this.suggestions.push(`Build contains ${stats.fileCount} files (${this.formatBytes(stats.totalSize)})`);
  }

  // Helper methods
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  getBuildStats(buildPath) {
    let totalSize = 0;
    let fileCount = 0;

    function traverseDir(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          traverseDir(filePath);
        } else {
          totalSize += stat.size;
          fileCount++;
        }
      }
    }

    try {
      traverseDir(buildPath);
    } catch (error) {
      // Ignore errors
    }

    return { totalSize, fileCount };
  }

  formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Generate report
  generateReport() {
    console.log(`\n${colors.cyan}📊 Configuration Validation Report${colors.reset}`);
    console.log('='.repeat(50));

    if (this.errors.length > 0) {
      console.log(`\n${colors.red}❌ Errors (${this.errors.length}):${colors.reset}`);
      this.errors.forEach((error, i) => console.log(`  ${i + 1}. ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log(`\n${colors.yellow}⚠️  Warnings (${this.warnings.length}):${colors.reset}`);
      this.warnings.forEach((warning, i) => console.log(`  ${i + 1}. ${warning}`));
    }

    if (this.suggestions.length > 0) {
      console.log(`\n${colors.blue}💡 Suggestions (${this.suggestions.length}):${colors.reset}`);
      this.suggestions.forEach((suggestion, i) => console.log(`  ${i + 1}. ${suggestion}`));
    }

    console.log(`\n${colors.cyan}Summary:${colors.reset}`);
    console.log(`  Errors: ${this.errors.length}`);
    console.log(`  Warnings: ${this.warnings.length}`);
    console.log(`  Suggestions: ${this.suggestions.length}`);

    const isValid = this.errors.length === 0;
    if (isValid) {
      log('success', 'Configuration validation passed!');
    } else {
      log('error', 'Configuration validation failed!');
    }

    return isValid;
  }
}

// Main function
function main() {
  const validator = new ConfigValidator();
  
  console.log(`${colors.cyan}🔍 Enhanced Walrus Sites Configuration Validator${colors.reset}`);
  console.log('='.repeat(60));

  const baseDir = path.join(__dirname, '..');
  
  // Validate JSON configurations
  for (const network of NETWORKS) {
    const configPath = path.join(baseDir, 'public', 'config', `${network}.json`);
    const config = validator.loadJsonConfig(configPath);
    
    if (config) {
      validator.validateRequiredFields(config, network);
      validator.validatePackageIds(config, network);
      validator.validateNetworkConfig(config, network);
      validator.validateWalrusConfig(config);
    }
  }

  // Validate YAML sites configuration
  const yamlConfigPath = path.join(baseDir, 'sites-config.optimized.yaml');
  const yamlConfig = validator.loadYamlConfig(yamlConfigPath);
  validator.validateSitesConfig(yamlConfig);

  // Validate build output
  const buildPath = path.join(baseDir, 'out');
  validator.validateBuildOutput(buildPath);

  // Generate and display report
  const isValid = validator.generateReport();
  
  process.exit(isValid ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { ConfigValidator };