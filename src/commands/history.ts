import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { commandHistory } from '../utils/CommandHistory';
import chalk from 'chalk';

/**
 * Show command history
 */
export default class HistoryCommand extends BaseCommand {
  static description = 'Show command history';

  static examples = [
    '<%= config.bin %> history                         # Show recent command history',
    '<%= config.bin %> history --limit 20              # Show last 20 commands',
    '<%= config.bin %> history --stats                 # Show command usage statistics',
    '<%= config.bin %> history --search "add"          # Search for specific commands',
    '<%= config.bin %> history --clear                 # Clear command history',
    '<%= config.bin %> history --export history.txt    # Export history to file',
    '<%= config.bin %> history --filter success        # Show only successful commands',
    '<%= config.bin %> history --date 2024-01-01      # Show history from specific date',
  ];

  static flags = {
    ...BaseCommand.flags,
    limit: Flags.integer({
      char: 'l',
      description: 'Number of commands to show',
      default: 10,
    }),
    stats: Flags.boolean({
      char: 's',
      description: 'Show command usage statistics',
    }),
    search: Flags.string({
      description: 'Search for commands containing pattern',
    }),
    clear: Flags.boolean({
      description: 'Clear command history',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(HistoryCommand);

    if (flags.clear) {
      commandHistory.clearHistory();
      this.success('Command history cleared');
      return;
    }

    if (flags.stats) {
      this.showStatistics();
      return;
    }

    if (flags.search) {
      this.showSearchResults(flags.search);
      return;
    }

    this.showRecentHistory(flags.limit);
  }

  private showRecentHistory(limit: number): void {
    const history = commandHistory.getHistory(limit);
    
    if (history.length === 0) {
      this.info('No command history found');
      return;
    }

    this.section('Recent Commands', history.map((cmd, index) => 
      `${chalk.dim(`${index + 1}.`)} ${chalk.cyan(cmd)}`
    ).join('\n'));
  }

  private showStatistics(): void {
    const stats = commandHistory.getMostFrequent(10);
    
    if (stats.length === 0) {
      this.info('No command statistics available');
      return;
    }

    const maxCount = Math.max(...stats.map(s => s.count));
    const barMaxLength = 30;

    this.section('Command Usage Statistics', stats.map(({ command, count }) => {
      const percentage = (count / maxCount) * 100;
      const barLength = Math.round((count / maxCount) * barMaxLength);
      const bar = '█'.repeat(barLength) + '▒'.repeat(barMaxLength - barLength);
      
      return `${chalk.cyan(command.padEnd(15))} ${chalk.gray(bar)} ${chalk.yellow(count.toString().padStart(3))} (${percentage.toFixed(1)}%)`;
    }).join('\n'));
  }

  private showSearchResults(pattern: string): void {
    const results = commandHistory.searchHistory(pattern);
    
    if (results.length === 0) {
      this.info(`No commands found matching "${pattern}"`);
      return;
    }

    this.section(`Commands matching "${pattern}"`, results.map((cmd, index) => 
      `${chalk.dim(`${index + 1}.`)} ${this.highlightPattern(cmd, pattern)}`
    ).join('\n'));
  }

  private highlightPattern(text: string, pattern: string): string {
    const regex = new RegExp(`(${this.escapeRegex(pattern)})`, 'gi');
    return text.replace(regex, chalk.yellow.bold('$1'));
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}