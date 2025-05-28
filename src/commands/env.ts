import { Flags, Args } from '@oclif/core';
import BaseCommand from '../base-command';
import { CLIError } from '../types/errors/consolidated';
import chalk = require('chalk');
import { envConfig } from '../utils/environment-config';
import { generateEnvTemplate, loadEnvironment } from '../utils/env-loader';
import {
  generateEnvironmentDocs,
  validateEnvironmentFull,
  validateOrThrow,
} from '../utils/env-validator';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Environment Management Command
 *
 * This command provides utilities for environment variable management,
 * validation, and documentation generation with intuitive positional syntax.
 * 
 * Positional Usage:
 * - waltodo env                           # Show current environment (default)
 * - waltodo env show                      # Show current environment
 * - waltodo env validate                  # Validate .env file
 * - waltodo env set VAR value             # Set environment variable
 * - waltodo env generate                  # Generate .env template
 * 
 * Legacy Flag Usage (still supported):
 * - waltodo env --validate                # Validate configuration
 * - waltodo env --generate                # Generate template
 */
export default class EnvironmentCommand extends BaseCommand {
  static description = 'Manage environment variables and configuration';

  static examples = [
    // Positional syntax (new, intuitive)
    '<%= config.bin %> env                             # Show current environment (default)',
    '<%= config.bin %> env show                        # Display current env vars',
    '<%= config.bin %> env validate                    # Validate .env file',
    '<%= config.bin %> env set NODE_ENV production     # Set environment variable',
    '<%= config.bin %> env generate                    # Generate .env template',
    '<%= config.bin %> env docs                        # Show env var documentation',
    '<%= config.bin %> env check                       # Check env configuration health',
    '<%= config.bin %> env show --reveal               # Show with secrets revealed',
    '<%= config.bin %> env show --format=json          # Show as JSON',
    '<%= config.bin %> env validate --strict           # Enforce stricter validation',
    
    // Legacy flag syntax (backward compatibility)
    '<%= config.bin %> env --validate                  # Legacy: validate configuration',
    '<%= config.bin %> env --generate                  # Legacy: generate template',
    '<%= config.bin %> env --show-all                  # Legacy: show all variables',
  ];

  static flags = {
    ...BaseCommand.flags,
    format: Flags.string({
      char: 'f',
      description: 'Output format (json, table, env)',
      options: ['json', 'table', 'env'],
      default: 'table',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output file path',
      default: '',
    }),
    strict: Flags.boolean({
      char: 's',
      description: 'Enforce stricter validation',
      default: false,
    }),
    reveal: Flags.boolean({
      char: 'r',
      description: 'Reveal sensitive values (use with caution)',
      default: false,
    }),
    fix: Flags.boolean({
      description: 'Auto-fix environment issues when validating',
      default: false,
    }),
    minimal: Flags.boolean({
      char: 'm',
      description: 'Generate minimal .env file',
      default: false,
    }),
    // Legacy flags for backward compatibility
    validate: Flags.boolean({
      description: 'Validate configuration (legacy flag)',
      default: false,
      hidden: true,
    }),
    generate: Flags.boolean({
      description: 'Generate .env template (legacy flag)',
      default: false,
      hidden: true,
    }),
    'show-all': Flags.boolean({
      description: 'Show all variables including defaults (legacy flag)',
      default: false,
      hidden: true,
    }),
  };

  static args = {
    action: Args.string({
      name: 'action',
      description: 'Action to perform: show (default), validate, set, generate, docs, check',
      options: ['show', 'validate', 'set', 'generate', 'docs', 'check'],
      required: false,
    }),
    key: Args.string({
      name: 'key',
      description: 'Environment variable key (for set action)',
      required: false,
    }),
    value: Args.string({
      name: 'value',
      description: 'Environment variable value (for set action)',
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(EnvironmentCommand);

    try {
      // Load environment configuration
      loadEnvironment();

      // Handle legacy flags for backward compatibility
      let action = args.action;
      if (!action) {
        if (flags.validate) {
          action = 'validate';
        } else if (flags.generate) {
          action = 'generate';
        } else if (flags['show-all']) {
          action = 'show';
        } else {
          // Default action is 'show' when no action specified
          action = 'show';
        }
      }

      // Execute the action
      switch (action) {
        case 'validate':
          await this.validateEnvironment(flags.strict, flags.fix);
          break;
        case 'generate':
          await this.generateTemplate(flags.output || '.env.template', flags.minimal);
          break;
        case 'docs':
          await this.generateDocs(
            flags.output || path.join('docs', 'environment-variables.md')
          );
          break;
        case 'show':
          await this.showEnvironment(flags.format, flags.reveal || flags['show-all']);
          break;
        case 'check':
          await this.checkEnvironment();
          break;
        case 'set':
          await this.setEnvironmentVariable(args.key, args.value);
          break;
        default:
          this.error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.error(
        `Error processing environment command: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate environment configuration
   */
  private async validateEnvironment(strict: boolean, fix: boolean = false): Promise<void> {
    this.log(chalk.blue('Validating environment configuration...'));

    try {
      if (fix) {
        // TODO: Implement auto-fix functionality
        this.log(chalk.yellow('Auto-fix functionality coming soon...'));
      }

      validateOrThrow({
        requireAll: strict,
        showWarnings: true,
        exitOnWarning: strict,
      });

      this.log(chalk.green('✓ Environment configuration is valid'));
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Environment validation failed: ${error instanceof Error ? error.message : String(error)}`,
        'ENV_VALIDATION_FAILED'
      );
    }
  }

  /**
   * Generate environment template file
   */
  private async generateTemplate(templatePath: string, minimal: boolean = false): Promise<void> {
    this.log(
      chalk.blue(`Generating ${minimal ? 'minimal ' : ''}environment template file at ${templatePath}...`)
    );

    try {
      // TODO: Add minimal template generation support
      if (minimal) {
        this.log(chalk.yellow('Minimal template generation coming soon, using full template...'));
      }
      
      generateEnvTemplate(templatePath);
      this.log(
        chalk.green(`✓ Environment template generated at ${templatePath}`)
      );
    } catch (error) {
      throw new CLIError(
        `Failed to generate template: ${error instanceof Error ? error.message : String(error)}`,
        'TEMPLATE_GENERATION_FAILED'
      );
    }
  }

  /**
   * Generate environment documentation
   */
  private async generateDocs(docsPath: string): Promise<void> {
    this.log(
      chalk.blue(`Generating environment documentation at ${docsPath}...`)
    );

    try {
      const docs = generateEnvironmentDocs();

      // Create directory if it doesn't exist
      const dir = path.dirname(docsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(docsPath, docs);
      this.log(
        chalk.green(`✓ Environment documentation generated at ${docsPath}`)
      );
    } catch (error) {
      throw new CLIError(
        `Failed to generate documentation: ${error instanceof Error ? error.message : String(error)}`,
        'DOCS_GENERATION_FAILED'
      );
    }
  }

  /**
   * Show current environment configuration
   */
  private async showEnvironment(format: string, reveal: boolean = false): Promise<void> {
    this.log(chalk.blue('Current environment configuration:'));

    if (format === 'json') {
      // Display as JSON
      const jsonConfig = envConfig.toJSON();
      // Mask sensitive values unless reveal is true
      if (!reveal) {
        for (const [key, value] of Object.entries(jsonConfig)) {
          const varConfig = envConfig.getAllVariables()[key];
          if (varConfig?.sensitive && value) {
            jsonConfig[key] = '********';
          }
        }
      }
      this.log(JSON.stringify(jsonConfig, null, 2));
    } else if (format === 'env') {
      // Display as .env file format
      const config = envConfig.getAllVariables();
      for (const [key, value] of Object.entries(config)) {
        // Skip printing sensitive values unless reveal is true
        if (value.sensitive && value.value && !reveal) {
          this.log(`${key}=********`);
        } else {
          this.log(`${key}=${value.value}`);
        }
      }
    } else {
      // Display as table (default)
      const config = envConfig.getAllVariables();
      const metaData = envConfig.getMetadata();

      // Group variables by category
      const categories: Record<string, Array<{name: string; value: unknown; source: string; required: string; sensitive: string}>> = {
        Common: [],
        Blockchain: [],
        Storage: [],
        AI: [],
        Security: [],
        Advanced: [],
        Other: [],
      };

      for (const [key, value] of Object.entries(config)) {
        let category = 'Other';
        if (key.startsWith('AI_') || key.endsWith('_API_KEY')) {
          category = 'AI';
        } else if (
          key.includes('STORAGE') ||
          key.includes('FILE') ||
          key.includes('DIR')
        ) {
          category = 'Storage';
        } else if (
          key.includes('NETWORK') ||
          key.includes('BLOCKCHAIN') ||
          key.includes('WALLET')
        ) {
          category = 'Blockchain';
        } else if (
          key.includes('SECURITY') ||
          key.includes('VERIFICATION') ||
          key.includes('CRYPTO')
        ) {
          category = 'Security';
        } else if (key === 'NODE_ENV' || key === 'LOG_LEVEL') {
          category = 'Common';
        } else if (
          key.includes('RETRY') ||
          key.includes('TIMEOUT') ||
          key.includes('CREDENTIAL')
        ) {
          category = 'Advanced';
        }

        // Format the value for display
        let displayValue = value.value;
        if (value.sensitive && value.value && !reveal) {
          displayValue = '********';
        } else if (value.value === undefined || value.value === null) {
          displayValue = chalk.gray('<not set>');
        } else if (value.value === '') {
          displayValue = chalk.gray('<empty string>');
        }

        const envMetadata = (metaData as Record<string, {source: string; required: boolean; sensitive?: boolean}>)[key];
        if (envMetadata) {
          categories[category]?.push({
            name: key,
            value: displayValue,
            source: envMetadata.source,
            required: envMetadata.required ? chalk.red('Yes') : 'No',
            sensitive: envMetadata.sensitive ? chalk.yellow('Yes') : 'No',
          });
        }
      }

      // Display each category
      for (const [category, values] of Object.entries(categories)) {
        if (values.length === 0) continue;

        this.log('\n' + chalk.green.bold(category));
        this.log('─'.repeat(category.length));

        // Create a table-like output
        this.log(
          chalk.bold('Variable'.padEnd(30)) +
            chalk.bold('Value'.padEnd(30)) +
            chalk.bold('Source'.padEnd(15)) +
            chalk.bold('Required'.padEnd(10)) +
            chalk.bold('Sensitive')
        );

        this.log('─'.repeat(100));

        for (const item of values) {
          this.log(
            chalk.cyan(item.name.padEnd(30)) +
              String(item.value).substring(0, 28).padEnd(30) +
              chalk.gray(item.source.padEnd(15)) +
              item.required.padEnd(10) +
              item.sensitive
          );
        }
      }
    }
  }

  /**
   * Check environment health and provide a summary
   */
  private async checkEnvironment(): Promise<void> {
    this.log(chalk.blue('Checking environment health...'));

    const validationResult = validateEnvironmentFull();

    // Display summary
    this.log('\n' + chalk.bold('Environment Health Summary:'));

    // Overall status
    if (validationResult.isValid) {
      this.log(chalk.green('✓ Environment configuration is valid'));
    } else {
      this.log(chalk.red('✗ Environment configuration has issues'));
    }

    // Missing variables
    if (validationResult.missingVars.length > 0) {
      this.log(chalk.red('\nMissing required variables:'));
      validationResult.missingVars.forEach(v =>
        this.log(chalk.red(`  - ${v}`))
      );
    } else {
      this.log(chalk.green('\n✓ All required variables are set'));
    }

    // Invalid variables
    if (validationResult.invalidVars.length > 0) {
      this.log(chalk.red('\nInvalid variables:'));
      validationResult.invalidVars.forEach(v =>
        this.log(chalk.red(`  - ${v}`))
      );
    } else {
      this.log(chalk.green('✓ All variables have valid values'));
    }

    // Deprecated variables
    if (validationResult.deprecatedVars.length > 0) {
      this.log(chalk.yellow('\nDeprecated variables:'));
      validationResult.deprecatedVars.forEach(v =>
        this.log(chalk.yellow(`  - ${v}`))
      );
    }

    // Insecure variables
    if (validationResult.insecureVars.length > 0) {
      this.log(chalk.yellow('\nInsecure storage of sensitive variables:'));
      validationResult.insecureVars.forEach(v =>
        this.log(chalk.yellow(`  - ${v}`))
      );
    }

    // Other warnings
    if (validationResult.warnings.length > 0) {
      this.log(chalk.yellow('\nWarnings:'));
      validationResult.warnings.forEach(w =>
        this.log(chalk.yellow(`  - ${w}`))
      );
    }

    // Check environment consistency
    const inconsistencies = envConfig.checkEnvironmentConsistency();
    if (inconsistencies.length > 0) {
      this.log(chalk.yellow('\nEnvironment inconsistencies:'));
      inconsistencies.forEach(i => this.log(chalk.yellow(`  - ${i}`)));
    }

    // Suggestions
    this.log('\n' + chalk.bold('Suggestions:'));

    if (validationResult.missingVars.length > 0) {
      this.log(
        chalk.dim(
          '- Add missing required variables to your .env file or environment'
        )
      );
    }

    if (validationResult.invalidVars.length > 0) {
      this.log(
        chalk.dim(
          '- Fix invalid variable values according to their validation rules'
        )
      );
    }

    if (validationResult.insecureVars.length > 0) {
      this.log(
        chalk.dim(
          '- Move sensitive variables from config files to environment variables'
        )
      );
    }

    if (validationResult.deprecatedVars.length > 0) {
      this.log(
        chalk.dim('- Update deprecated variables to their newer alternatives')
      );
    }

    this.log(
      chalk.dim('- Run `waltodo env generate` to create a template .env file')
    );
    this.log(
      chalk.dim(
        '- Run `waltodo env docs` to generate detailed environment documentation'
      )
    );
  }

  /**
   * Set environment variable
   */
  private async setEnvironmentVariable(key: string | undefined, value: string | undefined): Promise<void> {
    if (!key || !value) {
      throw new CLIError(
        'Both key and value are required for set action. Usage: waltodo env set KEY value',
        'MISSING_ARGUMENTS'
      );
    }

    this.log(chalk.blue(`Setting environment variable ${key}...`));

    try {
      // Check if .env file exists
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';
      
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      // Parse existing content
      const lines = envContent.split('\n');
      let found = false;
      
      // Update existing variable or add new one
      const newLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith(`${key}=`) || trimmed.startsWith(`${key} =`)) {
          found = true;
          return `${key}=${value}`;
        }
        return line;
      });

      if (!found) {
        // Add new variable at the end
        if (newLines[newLines.length - 1] !== '') {
          newLines.push(''); // Add empty line before new variable
        }
        newLines.push(`${key}=${value}`);
      }

      // Write back to file
      fs.writeFileSync(envPath, newLines.join('\n'));

      // Set in current process
      process.env[key] = value;

      this.log(chalk.green(`✓ Environment variable ${key} has been set to ${value}`));
      this.log(chalk.dim('Note: The change has been saved to .env file'));

      // Validate the new configuration
      try {
        validateOrThrow({
          requireAll: false,
          showWarnings: true,
          exitOnWarning: false,
        });
      } catch (error) {
        this.log(chalk.yellow(`\nWarning: The new configuration may have validation issues:`));
        this.log(chalk.yellow(error instanceof Error ? error.message : String(error)));
      }
    } catch (error) {
      throw new CLIError(
        `Failed to set environment variable: ${error instanceof Error ? error.message : String(error)}`,
        'SET_VARIABLE_FAILED'
      );
    }
  }
}
