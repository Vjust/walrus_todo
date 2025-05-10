import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { envConfig, getEnvironment } from '../utils/environment-config';
import chalk from 'chalk';

/**
 * Config command to display and validate environment configuration
 */
export default class ConfigCommand extends BaseCommand {
  static description = 'Display or validate environment configuration';

  static examples = [
    'waltodo config',
    'waltodo config --validate',
    'waltodo config --show-all',
    'waltodo config --section=ai'
  ];

  static flags = {
    ...BaseCommand.flags,
    validate: Flags.boolean({
      char: 'v',
      description: 'Validate configuration values',
      default: false,
    }),
    'show-all': Flags.boolean({
      char: 'a',
      description: 'Show all configuration values including empty ones',
      default: false,
    }),
    section: Flags.string({
      char: 's',
      description: 'Show only a specific section of the configuration',
      options: ['common', 'blockchain', 'storage', 'ai', 'security', 'advanced'],
    }),
    format: Flags.string({
      char: 'f',
      description: 'Output format',
      options: ['pretty', 'json', 'env'],
      default: 'pretty',
    }),
  };

  /**
   * Get the section of a configuration key
   */
  private getSection(key: string): string {
    if (key === 'NODE_ENV' || key === 'LOG_LEVEL') {
      return 'common';
    }
    if (key.startsWith('AI_') || ['XAI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OLLAMA_API_KEY'].includes(key)) {
      return 'ai';
    }
    if (key === 'NETWORK' || key === 'FULLNODE_URL' || key === 'TODO_PACKAGE_ID' || key === 'WALLET_ADDRESS') {
      return 'blockchain';
    }
    if (key === 'STORAGE_PATH' || key === 'TEMPORARY_STORAGE' || key === 'ENCRYPTED_STORAGE') {
      return 'storage';
    }
    if (key.startsWith('CREDENTIAL_') || key === 'REQUIRE_SIGNATURE_VERIFICATION' || key === 'ENABLE_BLOCKCHAIN_VERIFICATION') {
      return 'security';
    }
    return 'advanced';
  }

  /**
   * Get section title for display
   */
  private getSectionTitle(section: string): string {
    switch (section) {
      case 'common':
        return 'Common Configuration';
      case 'blockchain':
        return 'Blockchain Configuration';
      case 'storage':
        return 'Storage Configuration';
      case 'ai':
        return 'AI Configuration';
      case 'security':
        return 'Security Configuration';
      case 'advanced':
        return 'Advanced Configuration';
      default:
        return `${section.charAt(0).toUpperCase() + section.slice(1)} Configuration`;
    }
  }

  /**
   * Format a value for display
   */
  private formatValue(value: any): string {
    if (value === undefined || value === null) {
      return chalk.gray('(not set)');
    }
    if (value === '') {
      return chalk.gray('(empty)');
    }
    if (typeof value === 'boolean') {
      return value ? chalk.green('true') : chalk.red('false');
    }
    if (typeof value === 'number') {
      return chalk.yellow(value.toString());
    }
    if (typeof value === 'string') {
      // Check if it's an API key - if so, mask it
      if (/API_KEY/.test(value) || value.startsWith('sk-')) {
        return chalk.magenta(`${value.substring(0, 4)}...${value.substring(value.length - 4)}`);
      }
      return chalk.blue(value);
    }
    return String(value);
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(ConfigCommand);
    
    // Get the environment configuration
    const config = envConfig.getConfig();
    const metadata = envConfig.getMetadata();
    const currentEnv = getEnvironment();
    
    // Validate if requested
    if (flags.validate) {
      try {
        envConfig.validate();
        this.log(chalk.green('✓ Configuration validation successful'));
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error));
      }
    }
    
    // Output in requested format
    if (flags.format === 'json') {
      // JSON output format
      this.log(JSON.stringify(envConfig.toJSON(), null, 2));
      return;
    }
    
    if (flags.format === 'env') {
      // .env output format
      const entries = Object.entries(config).map(([key, value]) => {
        return `${key}=${typeof value.value === 'string' ? value.value : JSON.stringify(value.value)}`;
      });
      this.log(entries.join('\n'));
      return;
    }
    
    // Pretty output format (default)
    this.log(chalk.bold(`Environment Configuration (${chalk.cyan(currentEnv)})`));
    this.log('');
    
    // Group by section
    const sections: Record<string, Array<[string, any]>> = {};
    
    for (const [key, value] of Object.entries(config)) {
      const section = this.getSection(key);
      
      // Skip if we're only showing a specific section
      if (flags.section && section !== flags.section) {
        continue;
      }
      
      // Skip empty values if not showing all
      if (!flags['show-all'] && (value.value === undefined || value.value === null || value.value === '')) {
        continue;
      }
      
      // Initialize section array if it doesn't exist
      if (!sections[section]) {
        sections[section] = [];
      }
      
      sections[section].push([key, value]);
    }
    
    // Display each section
    for (const [section, entries] of Object.entries(sections)) {
      this.log(chalk.bold.underline(this.getSectionTitle(section)));
      
      for (const [key, value] of entries) {
        const source = metadata[key]?.source;
        const sourceColor = 
          source === 'environment' ? chalk.green :
          source === 'config' ? chalk.yellow :
          chalk.gray;
        
        const requiredStar = metadata[key]?.required ? chalk.red(' *') : '';
        
        this.log(`${chalk.bold(key)}${requiredStar}: ${this.formatValue(value.value)} ${sourceColor(`[${source}]`)}`);
        
        // Show description if available
        if (value.description) {
          this.log(`  ${chalk.gray(value.description)}`);
        }
        
        // Show example if available
        if (value.example) {
          this.log(`  ${chalk.gray(`Example: ${value.example}`)}`);
        }
      }
      
      this.log(''); // Add space between sections
    }
    
    // Show legend
    this.log(chalk.dim('Legend:'));
    this.log(chalk.dim(`  [${chalk.green('environment')}] - Set from environment variable`));
    this.log(chalk.dim(`  [${chalk.yellow('config')}] - Set from configuration file`));
    this.log(chalk.dim(`  [${chalk.gray('default')}] - Using default value`));
    this.log(chalk.dim(`  ${chalk.red('*')} - Required value`));
  }
}