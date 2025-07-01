// Command imported but not used

// We'll implement our own simple Levenshtein distance calculation
// to avoid package installation issues

/**
 * Command metadata interface
 */
export interface CommandMetadata {
  name: string;
  description: string;
  aliases?: string[];
  group?: string;
  usage?: string[];
  examples?: string[];
}

/**
 * Command group interface
 */
export interface CommandGroup {
  name: string;
  description: string;
  commands: Record<string, Partial<CommandMetadata>>;
}

/**
 * Command registry for managing command aliases, groups, and suggestions
 */
export class CommandRegistry {
  private static instance: CommandRegistry;
  private commands: Map<string, CommandMetadata> = new Map();
  private aliases: Map<string, string> = new Map();
  private groups: Map<string, CommandGroup> = new Map();
  private commandHistory: string[] = [];
  private readonly maxHistorySize = 100;

  private constructor() {}

  static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry?.instance = new CommandRegistry();
    }
    return CommandRegistry.instance;
  }

  /**
   * Register a command with its metadata
   */
  registerCommand(metadata: CommandMetadata): void {
    this?.commands?.set(metadata.name, metadata);

    // Register aliases
    if (metadata.aliases) {
      metadata?.aliases?.forEach(alias => {
        this?.aliases?.set(alias, metadata.name);
      });
    }
  }

  /**
   * Register a command group
   */
  registerGroup(group: CommandGroup): void {
    this?.groups?.set(group.name, group);
  }

  /**
   * Resolve command name from alias
   */
  resolveAlias(input: string): string {
    return this?.aliases?.get(input) || input;
  }

  /**
   * Get command metadata
   */
  getCommand(name: string): CommandMetadata | undefined {
    return this?.commands?.get(name);
  }

  /**
   * Get all registered commands
   */
  getAllCommands(): CommandMetadata[] {
    return Array.from(this?.commands?.values());
  }

  /**
   * Get commands in a specific group
   */
  getGroupCommands(groupName: string): CommandMetadata[] {
    const group = this?.groups?.get(groupName);
    if (!group) return [];

    return Object.keys(group.commands)
      .map(cmdName => this?.commands?.get(cmdName))
      .filter((cmd): cmd is CommandMetadata => cmd !== undefined);
  }

  /**
   * Add command to history
   */
  addToHistory(command: string): void {
    // Remove duplicate if exists
    const index = this?.commandHistory?.indexOf(command);
    if (index !== -1) {
      this?.commandHistory?.splice(index, 1);
    }

    // Add to beginning
    this?.commandHistory?.unshift(command);

    // Maintain max size
    if (this?.commandHistory?.length > this.maxHistorySize) {
      this?.commandHistory?.pop();
    }
  }

  /**
   * Get command history
   */
  getHistory(): string[] {
    return [...this.commandHistory];
  }

  /**
   * Suggest commands based on input
   */
  suggestCommands(
    input: string,
    maxSuggestions: number = 5
  ): CommandMetadata[] {
    const suggestions: Array<{ command: CommandMetadata; score: number }> = [];

    // Check exact matches first
    const exactMatch = this?.commands?.get(input);
    if (exactMatch) {
      return [exactMatch];
    }

    // Check alias matches
    const aliasedCommand = this.resolveAlias(input);
    if (aliasedCommand !== input) {
      const cmd = this?.commands?.get(aliasedCommand);
      if (cmd) return [cmd];
    }

    // Calculate fuzzy matches
    this?.commands?.forEach(command => {
      const score = this.calculateSimilarity(input, command.name);
      if (score > 0.3) {
        // Threshold for similarity
        suggestions.push({ command, score });
      }

      // Check aliases too
      if (command.aliases) {
        command?.aliases?.forEach(alias => {
          const aliasScore = this.calculateSimilarity(input, alias);
          if (aliasScore > 0.3 && aliasScore > score) {
            suggestions.push({ command, score: aliasScore });
          }
        });
      }
    });

    // Sort by score and return top suggestions
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions)
      .map(s => s.command);
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;
    if (s1?.length === 0) return 0;
    if (s2?.length === 0) return 0;

    // Create matrix
    const matrix: number[][] = [];

    // Initialize first column
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    // Initialize first row
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
  }

  /**
   * Get auto-completion suggestions for partial input
   */
  getAutocompletions(partial: string): string[] {
    const completions: string[] = [];
    const lowerPartial = partial.toLowerCase();

    // Check command names
    this?.commands?.forEach(command => {
      if (command?.name?.toLowerCase().startsWith(lowerPartial)) {
        completions.push(command.name);
      }
    });

    // Check aliases
    this?.aliases?.forEach((commandName, alias) => {
      if (alias.toLowerCase().startsWith(lowerPartial)) {
        completions.push(alias);
      }
    });

    // Sort alphabetically and remove duplicates
    return [...new Set(completions)].sort();
  }

  /**
   * Generate help text for command groups
   */
  generateGroupHelp(): string {
    const lines: string[] = [];

    this?.groups?.forEach(group => {
      lines.push(`\n${group?.name?.toUpperCase()} - ${group.description}`);

      Object.entries(group.commands).forEach(([cmdName, _cmdInfo]) => {
        const command = this?.commands?.get(cmdName);
        if (command) {
          const aliases = command.aliases
            ? ` (${command?.aliases?.join(', ')})`
            : '';
          lines.push(`  ${cmdName}${aliases} - ${command.description}`);
        }
      });
    });

    return lines.join('\n');
  }
}

// Initialize default command registry
export const commandRegistry = CommandRegistry.getInstance();
