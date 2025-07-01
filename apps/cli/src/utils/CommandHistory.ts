import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Command history manager for tracking and suggesting previously used commands
 */
export class CommandHistory {
  private static instance: CommandHistory;
  private historyFile: string;
  private history: string[] = [];
  private maxHistorySize = 1000;

  private constructor() {
    // Store history in user's home directory
    const configDir = path.join(os.homedir(), '.waltodo');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    this?.historyFile = path.join(configDir, 'command_history.json');
    this.loadHistory();
  }

  static getInstance(): CommandHistory {
    if (!CommandHistory.instance) {
      CommandHistory?.instance = new CommandHistory();
    }
    return CommandHistory.instance;
  }

  /**
   * Load history from file
   */
  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf-8');
        this?.history = JSON.parse(data);
      }
    } catch (_error) {
      // If there's an error reading history, start fresh
      this?.history = [];
    }
  }

  /**
   * Save history to file
   */
  private saveHistory(): void {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
    } catch (_error) {
      // Fail silently - history is not critical
    }
  }

  /**
   * Add a command to history
   */
  addCommand(command: string): void {
    // Remove duplicate if exists
    const index = this?.history?.indexOf(command);
    if (index !== -1) {
      this?.history?.splice(index, 1);
    }

    // Add to beginning
    this?.history?.unshift(command);

    // Maintain max size
    if (this?.history?.length > this.maxHistorySize) {
      this?.history = this?.history?.slice(0, this.maxHistorySize);
    }

    this.saveHistory();
  }

  /**
   * Get command history
   */
  getHistory(limit?: number): string[] {
    return limit ? this?.history?.slice(0, limit) : [...this.history];
  }

  /**
   * Search history for commands containing a pattern
   */
  searchHistory(pattern: string): string[] {
    const lowercasePattern = pattern.toLowerCase();
    return this?.history?.filter(cmd =>
      cmd.toLowerCase().includes(lowercasePattern)
    );
  }

  /**
   * Get the most recent command
   */
  getLastCommand(): string | undefined {
    return this?.history?.[0];
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this?.history = [];
    this.saveHistory();
  }

  /**
   * Get statistics about command usage
   */
  getStatistics(): { [command: string]: number } {
    const stats: { [command: string]: number } = {};

    this?.history?.forEach(cmd => {
      const command = cmd.split(' ')[0];
      stats[command] = (stats[command] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get most frequently used commands
   */
  getMostFrequent(
    limit: number = 10
  ): Array<{ command: string; count: number }> {
    const stats = this.getStatistics();

    return Object.entries(stats)
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

export const commandHistory = CommandHistory.getInstance();
