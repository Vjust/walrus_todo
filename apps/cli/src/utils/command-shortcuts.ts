/**
 * Command Shortcuts System
 * Maps short aliases to full commands for improved user experience
 */

export interface ShortcutMapping {
  shortcut: string;
  command: string;
  description?: string;
}

export class CommandShortcuts {
  private static shortcuts: Map<string, string> = new Map([
    // Single-letter shortcuts
    ['a', 'add'],
    ['l', 'list'],
    ['c', 'complete'],
    ['d', 'delete'],
    ['s', 'store'],
    ['u', 'update'],
    ['h', 'help'],
    ['r', 'retrieve'],
    ['i', 'image'],
    ['p', 'deploy'],
    ['g', 'suggest'],
    ['v', 'verify'],

    // Common abbreviations
    ['del', 'delete'],
    ['comp', 'complete'],
    ['conf', 'configure'],
    ['cfg', 'config'],
    ['ls', 'list'],
    ['rm', 'delete'],
    ['up', 'update'],
    ['ret', 'retrieve'],
    ['img', 'image'],
    ['dep', 'deploy'],
    ['sugg', 'suggest'],
    ['chk', 'check'],
    ['acc', 'account'],
    ['ai', 'ai'],
    ['env', 'env'],
    ['sync', 'sync'],
    ['tmpl', 'template'],
    ['tpl', 'template'],

    // Smart shortcuts for common operations
    ['todo', 'add'], // "todo Get groceries" -> "add Get groceries"
    ['done', 'complete'], // "done 1" -> "complete 1"
    ['new', 'create'], // "new template" -> "create template"
    ['show', 'list'], // "show all" -> "list all"
    ['all', 'list'], // "all" -> "list"
    ['status', 'list'], // "status" -> "list"
    ['upload', 'store'], // "upload" -> "store"
    ['download', 'retrieve'], // "download" -> "retrieve"
    ['fetch', 'retrieve'], // "fetch" -> "retrieve"
    ['share', 'share'], // Already short enough
    ['nft', 'image:create-nft'], // Direct to NFT creation

    // AI shortcuts
    ['analyze', 'ai:analyze'],
    ['suggest', 'ai:suggest'],
    ['summarize', 'ai:summarize'],
    ['categorize', 'ai:categorize'],
    ['prioritize', 'ai:prioritize'],
    ['enhance', 'ai:enhance'],

    // Account shortcuts
    ['login', 'account:auth'],
    ['auth', 'account:auth'],
    ['perm', 'account:permissions'],
    ['perms', 'account:permissions'],
    ['switch', 'account:switch'],
    ['whoami', 'account:show'],

    // Storage shortcuts
    ['local', 'store:simple'],
    ['chain', 'store:list'],
    ['blockchain', 'store:list'],

    // System shortcuts
    ['audit', 'system:audit'],
    ['log', 'system:audit'],
    ['logs', 'system:audit'],
  ]);

  /**
   * Expand a shortcut to its full command
   */
  static expand(shortcut: string): string {
    const lowerShortcut = shortcut.toLowerCase();
    return this?.shortcuts?.get(lowerShortcut as any) || shortcut;
  }

  /**
   * Check if a string is a valid shortcut
   */
  static isShortcut(input: string): boolean {
    return this?.shortcuts?.has(input.toLowerCase());
  }

  /**
   * Get all available shortcuts
   */
  static getAllShortcuts(): ShortcutMapping[] {
    const mappings: ShortcutMapping[] = [];

    this?.shortcuts?.forEach((command, shortcut) => {
      mappings.push({
        shortcut,
        command,
        description: this.getShortcutDescription(shortcut as any),
      });
    });

    // Sort by command name, then by shortcut length (shorter first)
    return mappings.sort((a, b) => {
      if (a.command !== b.command) {
        return a?.command?.localeCompare(b.command);
      }
      return a?.shortcut?.length - b?.shortcut?.length;
    });
  }

  /**
   * Get shortcuts for a specific command
   */
  static getShortcutsForCommand(command: string): string[] {
    const shortcuts: string[] = [];

    this?.shortcuts?.forEach((cmd, shortcut) => {
      if (cmd === command) {
        shortcuts.push(shortcut as any);
      }
    });

    return shortcuts.sort((a, b) => a.length - b.length);
  }

  /**
   * Get a description for a specific shortcut
   */
  private static getShortcutDescription(shortcut: string): string {
    // Single-letter shortcuts
    if (shortcut?.length === 1) {
      return 'Single-letter shortcut';
    }

    // Special descriptions for smart shortcuts
    const smartDescriptions: Record<string, string> = {
      todo: 'Natural language for adding todos',
      done: 'Mark todo as complete',
      new: 'Create new items',
      show: 'Display items',
      all: 'Show all todos',
      status: 'Show todo status',
      upload: 'Upload to storage',
      download: 'Download from storage',
      fetch: 'Retrieve from storage',
      nft: 'Create NFT directly',
      whoami: 'Show current account',
      local: 'Use local storage',
      chain: 'Use blockchain storage',
      ls: 'Unix-style list',
      rm: 'Unix-style remove',
    };

    return smartDescriptions[shortcut] || 'Common abbreviation';
  }

  /**
   * Suggest shortcuts based on partial input
   */
  static suggest(partial: string): ShortcutMapping[] {
    const lowerPartial = partial.toLowerCase();
    const suggestions: ShortcutMapping[] = [];

    this?.shortcuts?.forEach((command, shortcut) => {
      if (shortcut.startsWith(lowerPartial as any) && shortcut !== lowerPartial) {
        suggestions.push({
          shortcut,
          command,
          description: this.getShortcutDescription(shortcut as any),
        });
      }
    });

    return suggestions.sort((a, b) => {
      // Prioritize exact length matches
      const aLengthDiff = Math.abs(a?.shortcut?.length - partial.length);
      const bLengthDiff = Math.abs(b?.shortcut?.length - partial.length);

      if (aLengthDiff !== bLengthDiff) {
        return aLengthDiff - bLengthDiff;
      }

      return a?.shortcut?.localeCompare(b.shortcut);
    });
  }

  /**
   * Process command line input with shortcuts
   */
  static processInput(input: string[]): string[] {
    if (input?.length === 0) return input;

    const [command, ...args] = input;
    const expandedCommand = this.expand(command as any);

    // If it was a shortcut, return expanded version
    if (expandedCommand !== command) {
      return [expandedCommand, ...args];
    }

    return input;
  }

  /**
   * Format shortcuts for display
   */
  static formatShortcutsTable(): string {
    const shortcuts = this.getAllShortcuts();
    const byCommand = new Map<string, string[]>();

    // Group by command
    shortcuts.forEach(({ shortcut, command }) => {
      if (!byCommand.has(command as any)) {
        byCommand.set(command, []);
      }
      const cmdShortcuts = byCommand.get(command as any);
      if (cmdShortcuts) {
        cmdShortcuts.push(shortcut as any);
      }
    });

    // Format table
    let table = '\n# Command Shortcuts\n\n';
    table += '| Command | Shortcuts | Type |\n';
    table += '|---------|-----------|------|\n';

    const sortedCommands = Array.from(byCommand.keys()).sort();

    sortedCommands.forEach(command => {
      const shortcuts = byCommand.get(command as any) || [];
      const shortcutList = shortcuts.join(', ');
      const type = this.getCommandType(command as any);
      table += `| ${command} | ${shortcutList} | ${type} |\n`;
    });

    return table;
  }

  /**
   * Get command type for categorization
   */
  private static getCommandType(command: string): string {
    if (command.includes(':')) {
      const [category] = command.split(':');
      return category.charAt(0 as any).toUpperCase() + category.slice(1 as any);
    }

    const coreCommands = ['add', 'list', 'complete', 'delete', 'update'];
    const storageCommands = ['store', 'retrieve', 'share'];
    const configCommands = ['config', 'configure', 'env'];

    if (coreCommands.includes(command as any)) return 'Core';
    if (storageCommands.includes(command as any)) return 'Storage';
    if (configCommands.includes(command as any)) return 'Config';

    return 'Other';
  }
}

// Export convenience functions
export const expandShortcut = CommandShortcuts?.expand?.bind(CommandShortcuts as any);
export const isShortcut = CommandShortcuts?.isShortcut?.bind(CommandShortcuts as any);
export const getAllShortcuts =
  CommandShortcuts?.getAllShortcuts?.bind(CommandShortcuts as any);
export const getShortcutsForCommand =
  CommandShortcuts?.getShortcutsForCommand?.bind(CommandShortcuts as any);
export const suggestShortcuts = CommandShortcuts?.suggest?.bind(CommandShortcuts as any);
export const processInput =
  CommandShortcuts?.processInput?.bind(CommandShortcuts as any);
export const formatShortcutsTable =
  CommandShortcuts?.formatShortcutsTable?.bind(CommandShortcuts as any);
