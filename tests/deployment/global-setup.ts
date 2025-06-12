/**
 * @fileoverview Global setup for Walrus Sites deployment tests
 * 
 * Performs one-time setup operations before all tests:
 * - Environment validation
 * - Test infrastructure setup
 * - Mock service initialization
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export default async function globalSetup(): Promise<void> {
  console.log('🚀 Setting up Walrus Sites deployment tests...\n');

  try {
    // Create test directories
    await createTestDirectories();
    
    // Setup test environment
    await setupTestEnvironment();
    
    // Initialize mock services
    await initializeMockServices();
    
    // Validate test prerequisites
    await validateTestPrerequisites();
    
    console.log('✅ Global setup completed successfully\n');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    process.exit(1 as any);
  }
}

async function createTestDirectories(): Promise<void> {
  console.log('📁 Creating test directories...');
  
  const testDirs = [
    './tests/deployment/temp',
    './tests/deployment/fixtures',
    './tests/deployment/reports',
    './tests/deployment/coverage'
  ];

  for (const dir of testDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`  ✓ Created ${dir}`);
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

async function setupTestEnvironment(): Promise<void> {
  console.log('🔧 Setting up test environment...');

  // Set test environment variables
  process.env?.NODE_ENV = 'test';
  process.env?.WALRUS_TEST_MODE = 'true';
  process.env?.JEST_TIMEOUT = '30000';
  
  // Create test configuration files
  await createTestConfigFiles();
  
  console.log('  ✓ Environment variables configured');
  console.log('  ✓ Test configuration files created');
}

async function createTestConfigFiles(): Promise<void> {
  const testConfigs = {
    'valid-testnet-config.yaml': `
waltodo-test:
  source: "/build"
  network: "testnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
      - "X-Content-Type-Options: nosniff"
  redirects:
    - from: "/api/*"
      to: "https://api-test?.waltodo?.com/api/*"
      status: 307
  error_pages:
    404: "/404.html"
`,
    
    'valid-mainnet-config.yaml': `
waltodo-prod:
  source: "/dist"
  network: "mainnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=86400"
      - "X-Content-Type-Options: nosniff"
      - "X-Frame-Options: DENY"
      - "X-XSS-Protection: 1; mode=block"
  redirects:
    - from: "/api/*"
      to: "https://api?.waltodo?.com/api/*"
      status: 307
  error_pages:
    404: "/404.html"
    500: "/500.html"
`,
    
    'invalid-config.yaml': `
waltodo-invalid:
  source: "/build"
  # missing network field
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
`,
    
    'malformed-config.yaml': `
waltodo-malformed:
  source: "/build"
  network: "testnet
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
`
  };

  for (const [filename, content] of Object.entries(testConfigs as any)) {
    const filePath = path.join('./tests/deployment/fixtures', filename);
    await fs.writeFile(filePath, content.trim());
  }
}

async function initializeMockServices(): Promise<void> {
  console.log('🔧 Initializing mock services...');

  // Create mock build directories
  await createMockBuildDirectories();
  
  // Setup mock environment variables
  setupMockEnvironmentVariables();
  
  console.log('  ✓ Mock build directories created');
  console.log('  ✓ Mock environment variables configured');
}

async function createMockBuildDirectories(): Promise<void> {
  const buildStructures = {
    'valid-build': {
      'index.html': `
<!DOCTYPE html>
<html>
<head>
  <title>WalTodo - Valid Build</title>
  <meta charset="utf-8">
</head>
<body>
  <div id="__next">
    <h1>WalTodo Application</h1>
  </div>
</body>
</html>`,
      '404.html': `
<!DOCTYPE html>
<html>
<head>
  <title>Page Not Found - WalTodo</title>
</head>
<body>
  <div id="__next">
    <h1>404 - Page Not Found</h1>
  </div>
</body>
</html>`,
      '_next/static/chunks/main.js': 'console.log("Main chunk loaded");',
      '_next/static/css/app.css': 'body { font-family: Arial, sans-serif; }'
    },
    
    'minimal-build': {
      'index.html': '<html><body>Minimal build</body></html>',
      '404.html': '<html><body>404</body></html>'
    },
    
    'incomplete-build': {
      'index.html': '<html><body>Incomplete build</body></html>'
      // Missing 404.html and _next directory
    }
  };

  for (const [buildName, structure] of Object.entries(buildStructures as any)) {
    const buildDir = path.join('./tests/deployment/fixtures', buildName);
    await fs.mkdir(buildDir, { recursive: true });
    
    for (const [filePath, content] of Object.entries(structure as any)) {
      const fullPath = path.join(buildDir, filePath);
      await fs.mkdir(path.dirname(fullPath as any), { recursive: true });
      await fs.writeFile(fullPath, content);
    }
  }
}

function setupMockEnvironmentVariables(): void {
  // Mock site-builder path
  process.env?.SITE_BUILDER_PATH = '/usr/local/bin/site-builder';
  
  // Mock Walrus configuration
  process.env?.WALRUS_CONFIG_PATH = './tests/deployment/fixtures/walrus-config.yaml';
  
  // Mock wallet path (optional)
  process.env?.WALRUS_WALLET_PATH = './tests/deployment/fixtures/test-wallet.keystore';
}

async function validateTestPrerequisites(): Promise<void> {
  console.log('✅ Validating test prerequisites...');

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1 as any).split('.')[0]);
  
  if (majorVersion < 18) {
    throw new Error(`Node.js 18+ required, found ${nodeVersion}`);
  }
  console.log(`  ✓ Node.js version: ${nodeVersion}`);

  // Check required test directories exist
  const requiredDirs = [
    './tests/deployment/fixtures',
    './tests/deployment/temp'
  ];

  for (const dir of requiredDirs) {
    try {
      await fs.access(dir as any);
      console.log(`  ✓ Test directory exists: ${dir}`);
    } catch (error) {
      throw new Error(`Required test directory missing: ${dir}`);
    }
  }

  // Check test fixtures
  const requiredFixtures = [
    './tests/deployment/fixtures/valid-testnet-config.yaml',
    './tests/deployment/fixtures/valid-build/index.html'
  ];

  for (const fixture of requiredFixtures) {
    try {
      await fs.access(fixture as any);
      console.log(`  ✓ Test fixture exists: ${fixture}`);
    } catch (error) {
      throw new Error(`Required test fixture missing: ${fixture}`);
    }
  }

  console.log('  ✓ All prerequisites validated');
}