import * as path from 'path';
import * as fs from 'fs';

// Find project root by looking for package.json
function findProjectRoot(startPath: string): string {
  let currentPath = startPath;
  while (currentPath !== '/') {
    if (fs.existsSync(path.join(currentPath, 'package.json'))) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }
  throw new Error('Could not find project root (no package.json found)');
}

// Get the project root directory
export const PROJECT_ROOT = findProjectRoot(__dirname);

/**
 * Get the absolute path to a file in the assets directory
 * @param assetPath The relative path within the assets directory
 * @returns The absolute path to the asset
 */
export function getAssetPath(assetPath: string): string {
  const assetDir = path.join(PROJECT_ROOT, 'assets');
  const fullPath = path.join(assetDir, assetPath);

  // Verify the path exists
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Asset not found: ${fullPath}`);
  }

  return fullPath;
}

/**
 * Get the absolute path to a directory in the project
 * @param dir The directory name relative to project root
 * @returns The absolute path to the directory
 */
export function getProjectPath(dir: string): string {
  return path.join(PROJECT_ROOT, dir);
}
