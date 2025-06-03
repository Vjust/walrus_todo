#!/usr/bin/env node

/**
 * Comprehensive Walrus Sites Configuration Verification Script
 * Validates all configuration files and dependencies for site-builder
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PROJECT_DIR = path.join(__dirname, '..');
const CONFIG_FILE = path.join(PROJECT_DIR, 'sites-config.yaml');
const BUILD_DIR = path.join(PROJECT_DIR, 'out');

// Colors for output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Logging functions
const log = {
    info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
    error: (msg) => console.error(`${colors.red}[ERROR]${colors.reset} ${msg}`)
};

/**
 * Check if command exists
 */
function commandExists(command) {
    try {
        execSync(`which ${command}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Load and validate YAML configuration
 */
function validateYamlConfig() {
    log.info(`Validating sites configuration: ${CONFIG_FILE}`);
    
    if (!fs.existsSync(CONFIG_FILE)) {
        log.error(`Configuration file not found: ${CONFIG_FILE}`);
        return false;
    }
    
    try {
        const content = fs.readFileSync(CONFIG_FILE, 'utf8');
        
        // Basic YAML structure validation
        const lines = content.split('\n');
        let hasPackage = false;
        let hasGeneralConfig = false;
        let hasSitesConfig = false;
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('package:')) hasPackage = true;
            if (trimmed.startsWith('general:')) hasGeneralConfig = true;
            if (trimmed.startsWith('sites:')) hasSitesConfig = true;
        });
        
        if (!hasPackage) {
            log.error('Missing required "package" field in configuration');
            return false;
        }
        
        if (!hasSitesConfig) {
            log.error('Missing required "sites" configuration');
            return false;
        }
        
        log.success('Configuration file structure is valid');
        
        // Extract package ID
        const packageMatch = content.match(/package:\s*([0x[a-fA-F0-9]+)/);
        if (packageMatch) {
            const packageId = packageMatch[1];
            if (packageId.length === 66) { // 0x + 64 chars
                log.success(`Package ID: ${packageId}`);
            } else {
                log.warning(`Package ID format might be incorrect: ${packageId}`);
            }
        }
        
        return true;
    } catch (error) {
        log.error(`Configuration validation failed: ${error.message}`);
        return false;
    }
}

/**
 * Validate build directory
 */
function validateBuildDirectory() {
    log.info('Validating build directory...');
    
    if (!fs.existsSync(BUILD_DIR)) {
        log.error(`Build directory not found: ${BUILD_DIR}`);
        log.info('Run "pnpm run build:export" to create the build');
        return false;
    }
    
    // Check for essential files
    const essentialFiles = ['index.html', '404.html'];
    const optionalFiles = ['_next', 'icons', 'config'];
    
    const missingEssential = essentialFiles.filter(file => 
        !fs.existsSync(path.join(BUILD_DIR, file))
    );
    
    if (missingEssential.length > 0) {
        log.error(`Missing essential files: ${missingEssential.join(', ')}`);
        return false;
    }
    
    log.success('Essential build files found');
    
    // Check optional files
    const foundOptional = optionalFiles.filter(file =>
        fs.existsSync(path.join(BUILD_DIR, file))
    );
    
    if (foundOptional.length > 0) {
        log.success(`Optional files found: ${foundOptional.join(', ')}`);
    }
    
    // Check build size
    try {
        const stats = execSync(`du -sh "${BUILD_DIR}"`, { encoding: 'utf8' });
        const size = stats.split('\t')[0];
        log.success(`Build directory size: ${size}`);
        
        // Warn if build is very large
        const sizeInKB = parseInt(execSync(`du -sk "${BUILD_DIR}"`, { encoding: 'utf8' }).split('\t')[0]);
        if (sizeInKB > 102400) { // 100MB
            log.warning('Build size is quite large. Consider optimizing assets.');
        }
    } catch (error) {
        log.warning('Could not determine build size');
    }
    
    return true;
}

/**
 * Validate site-builder installation
 */
function validateSiteBuilder() {
    log.info('Validating site-builder installation...');
    
    if (!commandExists('site-builder')) {
        log.error('site-builder not found in PATH');
        log.info('Install options:');
        log.info('1. Run "./scripts/setup-walrus-site.sh"');
        log.info('2. Download from: https://github.com/MystenLabs/walrus-sites/releases');
        return false;
    }
    
    try {
        const version = execSync('site-builder --version', { encoding: 'utf8' }).trim();
        log.success(`site-builder version: ${version}`);
    } catch (error) {
        log.warning('Could not get site-builder version');
    }
    
    // Test basic functionality
    try {
        execSync('site-builder --help', { stdio: 'ignore' });
        log.success('site-builder help command works');
    } catch (error) {
        log.error('site-builder help command failed - binary might be corrupted');
        return false;
    }
    
    // Test publish command help
    try {
        execSync('site-builder publish --help', { stdio: 'ignore' });
        log.success('site-builder publish command available');
    } catch (error) {
        log.warning('site-builder publish command help failed');
    }
    
    return true;
}

/**
 * Validate network connectivity
 */
function validateNetworkConnectivity() {
    log.info('Validating network connectivity...');
    
    const endpoints = [
        { name: 'Sui Testnet RPC', url: 'https://fullnode.testnet.sui.io:443' },
        { name: 'Sui Mainnet RPC', url: 'https://fullnode.mainnet.sui.io:443' },
        { name: 'Walrus Testnet Publisher', url: 'https://publisher-testnet.walrus.site' },
        { name: 'Walrus Testnet Aggregator', url: 'https://aggregator-testnet.walrus.site' }
    ];
    
    let connectivityErrors = 0;
    
    endpoints.forEach(endpoint => {
        try {
            execSync(`curl -s -f --connect-timeout 10 "${endpoint.url}"`, { stdio: 'ignore' });
            log.success(`✓ ${endpoint.name}`);
        } catch (error) {
            log.warning(`✗ ${endpoint.name} - connection failed`);
            connectivityErrors++;
        }
    });
    
    if (connectivityErrors === endpoints.length) {
        log.error('All network endpoints are unreachable');
        log.info('Check your internet connection and firewall settings');
        return false;
    } else if (connectivityErrors > 0) {
        log.warning(`${connectivityErrors}/${endpoints.length} endpoints unreachable`);
        log.info('Some services may be temporarily unavailable');
    }
    
    return true;
}

/**
 * Validate Sui CLI (optional but recommended)
 */
function validateSuiCli() {
    log.info('Validating Sui CLI (optional)...');
    
    if (!commandExists('sui')) {
        log.warning('Sui CLI not found - wallet operations may be limited');
        log.info('Install: curl -fsSL https://sui.io/install | sh');
        return true; // Not required for site-builder
    }
    
    try {
        const version = execSync('sui --version', { encoding: 'utf8' }).trim();
        log.success(`Sui CLI version: ${version}`);
    } catch (error) {
        log.warning('Could not get Sui CLI version');
    }
    
    // Check if client is configured
    try {
        const address = execSync('sui client active-address', { encoding: 'utf8' }).trim();
        log.success(`Active address: ${address}`);
        
        // Try to get gas objects (this will show balance)
        try {
            const gasOutput = execSync('sui client gas --json', { encoding: 'utf8' });
            const gasObjects = JSON.parse(gasOutput);
            const totalBalance = gasObjects.reduce((sum, obj) => sum + parseInt(obj.balance), 0);
            log.success(`Wallet balance: ${totalBalance / 1000000000} SUI`);
            
            if (totalBalance < 100000000) { // Less than 0.1 SUI
                log.warning('Low wallet balance - may not be sufficient for deployment');
            }
        } catch (error) {
            log.warning('Could not verify wallet balance');
        }
    } catch (error) {
        log.warning('Sui client not configured');
        log.info('Run "sui client" to configure wallet');
    }
    
    return true;
}

/**
 * Validate dependencies
 */
function validateDependencies() {
    log.info('Validating dependencies...');
    
    const requiredCommands = ['node', 'pnpm', 'curl'];
    const optionalCommands = ['python3'];
    
    let allRequired = true;
    
    requiredCommands.forEach(cmd => {
        if (commandExists(cmd)) {
            try {
                const version = execSync(`${cmd} --version`, { encoding: 'utf8' }).split('\n')[0];
                log.success(`${cmd}: ${version}`);
            } catch {
                log.success(`${cmd}: available`);
            }
        } else {
            log.error(`Required command not found: ${cmd}`);
            allRequired = false;
        }
    });
    
    optionalCommands.forEach(cmd => {
        if (commandExists(cmd)) {
            log.success(`${cmd}: available (optional)`);
        } else {
            log.info(`${cmd}: not found (optional)`);
        }
    });
    
    return allRequired;
}

/**
 * Check system resources
 */
function checkSystemResources() {
    log.info('Checking system resources...');
    
    // Check disk space
    try {
        const df = execSync(`df -h "${PROJECT_DIR}"`, { encoding: 'utf8' });
        const lines = df.split('\n');
        if (lines.length > 1) {
            const parts = lines[1].split(/\s+/);
            const available = parts[3];
            log.success(`Available disk space: ${available}`);
        }
    } catch (error) {
        log.warning('Could not check disk space');
    }
    
    // Check memory (Linux/Mac)
    try {
        if (process.platform === 'darwin') {
            // macOS
            const memory = execSync('sysctl -n hw.memsize', { encoding: 'utf8' });
            const memoryGB = Math.round(parseInt(memory) / 1024 / 1024 / 1024);
            log.success(`System memory: ${memoryGB} GB`);
        } else {
            // Linux
            const memory = execSync('free -h', { encoding: 'utf8' });
            const lines = memory.split('\n');
            if (lines.length > 1) {
                const memLine = lines[1].split(/\s+/);
                log.success(`System memory: ${memLine[1]} total, ${memLine[6]} available`);
            }
        }
    } catch (error) {
        log.info('Could not check memory information');
    }
}

/**
 * Main validation function
 */
function main() {
    console.log(`${colors.blue}Walrus Sites Configuration & Environment Verification${colors.reset}`);
    console.log('======================================================\n');
    
    let allCriticalValid = true;
    let allOptionalValid = true;
    
    // Critical validations (must pass)
    console.log(`${colors.blue}=== Critical Validations ===${colors.reset}`);
    
    if (!validateDependencies()) {
        allCriticalValid = false;
    }
    
    if (!validateSiteBuilder()) {
        allCriticalValid = false;
    }
    
    if (!validateYamlConfig()) {
        allCriticalValid = false;
    }
    
    if (!validateBuildDirectory()) {
        allCriticalValid = false;
    }
    
    if (!validateNetworkConnectivity()) {
        allCriticalValid = false;
    }
    
    // Optional validations (warnings only)
    console.log(`\n${colors.blue}=== Optional Validations ===${colors.reset}`);
    
    if (!validateSuiCli()) {
        allOptionalValid = false;
    }
    
    checkSystemResources();
    
    // Summary
    console.log('\n' + '='.repeat(60));
    
    if (allCriticalValid) {
        log.success('✅ All critical validations passed! Ready for deployment.');
        
        if (!allOptionalValid) {
            log.warning('⚠️  Some optional features may not work optimally.');
        }
        
        console.log('\n📋 Next steps:');
        log.info('1. Run "./scripts/deploy-walrus-site.sh" to deploy');
        log.info('2. Monitor deployment progress');
        log.info('3. Check site URL after deployment');
        
        process.exit(0);
    } else {
        log.error('❌ Critical validation failed. Please fix the issues above.');
        
        console.log('\n🔧 Common fixes:');
        log.info('1. Run "./scripts/setup-walrus-site.sh" to install site-builder');
        log.info('2. Run "pnpm run build:export" to create the build');
        log.info('3. Check network connectivity and firewall settings');
        log.info('4. Verify configuration file syntax');
        
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    validateYamlConfig,
    validateBuildDirectory,
    validateSiteBuilder,
    validateNetworkConnectivity,
    validateSuiCli,
    validateDependencies
};