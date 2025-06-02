import { existsSync, rmSync } from 'fs';
import path from 'path';

export default async function globalTeardown() {
  console.log('\n🧹 Cleaning up integration test environment...\n');

  const rootDir = path.join(__dirname, '../../..');

  // Clean up test artifacts
  const cleanupPaths = [
    'test-artifacts',
    'Todos/todos.json',
    'logs/test.log',
  ];

  cleanupPaths.forEach(relativePath => {
    const fullPath = path.join(rootDir, relativePath);
    if (existsSync(fullPath)) {
      try {
        rmSync(fullPath, { recursive: true, force: true });
        console.log(`✅ Cleaned up: ${relativePath}`);
      } catch (error) {
        console.warn(`⚠️  Failed to clean up: ${relativePath}`);
      }
    }
  });

  // Kill any hanging processes
  try {
    // Kill any node processes that might be hanging
    if (process.platform !== 'win32') {
      const { execSync } = require('child_process');
      execSync("pkill -f 'node.*waltodo' || true", { stdio: 'ignore' });
    }
  } catch (error) {
    // Ignore errors from pkill
  }

  console.log('\n✨ Integration test cleanup complete!\n');
}