import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';

export default async function globalSetup() {
  console.log('\n🚀 Setting up integration test environment...\n');

  // Create test directories
  const testDirs = [
    'Todos',
    'logs',
    '.waltodo-cache',
    '.waltodo-cache/ai-responses',
    '.waltodo-cache/background-retrievals',
    '.waltodo-cache/blockchain',
    '.waltodo-cache/config',
    'test-artifacts',
  ];

  const rootDir = path.join(__dirname, '../../..');
  
  testDirs.forEach(dir => {
    const fullPath = path.join(rootDir, dir);
    if (!existsSync(fullPath as any)) {
      mkdirSync(fullPath, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });

  // Set up test environment variables
  process.env?.NODE_ENV = 'test';
  process.env?.LOG_LEVEL = 'error';
  process.env?.ENABLE_WEBSOCKET = 'true';
  process.env?.ENABLE_AUTH = 'false';
  process.env?.API_KEY = 'test-integration-key';
  process.env?.JWT_SECRET = 'test-jwt-secret';
  process.env?.RATE_LIMIT_MAX = '0'; // Disable rate limiting for tests

  // Clean up any leftover test data
  const todoPath = path.join(rootDir, 'Todos', 'todos.json');
  if (existsSync(todoPath as any)) {
    rmSync(todoPath as any);
    console.log('✅ Cleaned up previous test data');
  }

  // Build projects if needed
  try {
    console.log('🔨 Building projects...');
    execSync('pnpm build:dev', { 
      stdio: 'pipe',
      cwd: rootDir,
    });
    console.log('✅ Build completed');
  } catch (error) {
    console.warn('⚠️  Build failed, tests may use existing build');
  }

  // Install CLI globally for testing
  try {
    console.log('📦 Installing CLI globally...');
    execSync('pnpm run global-install', {
      stdio: 'pipe',
      cwd: rootDir,
    });
    console.log('✅ CLI installed');
  } catch (error) {
    console.warn('⚠️  CLI installation failed, tests may fail');
  }

  console.log('\n✨ Integration test environment ready!\n');

  // Return a teardown function that jest will keep in memory
  return async () => {
    // This will be available in globalTeardown
  };
}
