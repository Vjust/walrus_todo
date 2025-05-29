import * as path from 'path';
import * as os from 'os';

/**
 * Shared constants for data storage paths between CLI and API
 */
export const SHARED_STORAGE_CONFIG = {
  /**
   * Get the absolute path to the Todos directory
   * Priority order:
   * 1. TODO_DATA_PATH environment variable
   * 2. Default: ~/Documents/Projects/walrus_todo/Todos
   */
  getTodosPath(): string {
    if (process.env.TODO_DATA_PATH) {
      return path.resolve(process.env.TODO_DATA_PATH);
    }
    
    // Default to project root Todos directory
    // This ensures both CLI and API use the same directory
    // Go up from shared-constants/dist to find the project root
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    return path.join(projectRoot, 'Todos');
  },
  
  /**
   * File extension for todo files
   */
  FILE_EXT: '.json',
  
  /**
   * Default list name
   */
  DEFAULT_LIST: 'default',
} as const;

/**
 * Ensure the Todos directory exists
 */
export async function ensureTodosDirectory(): Promise<string> {
  const fs = await import('fs/promises');
  const todosPath = SHARED_STORAGE_CONFIG.getTodosPath();
  
  try {
    await fs.mkdir(todosPath, { recursive: true });
  } catch (error) {
    // Directory might already exist, that's fine
  }
  
  return todosPath;
}