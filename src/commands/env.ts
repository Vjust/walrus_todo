import { Command, Flags, Args } from '@oclif/core';
import { CLIError } from '../types/error';
import chalk from 'chalk';
import { envConfig } from '../utils/environment-config';
import { generateEnvTemplate, loadEnvironment, saveConfigToFile } from '../utils/env-loader';
import { generateEnvironmentDocs, validateEnvironmentFull, validateOrThrow } from '../utils/env-validator';
import fs from 'fs';
import path from 'path';

/**
 * Environment Management Command
 *
 * This command provides utilities for environment variable management,
 * validation, and documentation generation.
 */
export default class EnvironmentCommand extends Command {
  static description = 'Manage environment variables and configuration';

  static examples = [
    '$ waltodo env validate',
    '$ waltodo env generate',
    '$ waltodo env docs',
    '$ waltodo env show',
    '$ waltodo env check'
  ];

  static flags = {
    help: Flags.help({ char: 'h' }),
    format: Flags.string({
      char: 'f',
      description: 'Output format (json, table, env)',
      options: ['json', 'table', 'env'],
      default: 'table'
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output file path',
      default: ''
    }),
    strict: Flags.boolean({
      char: 's',
      description: 'Enforce stricter validation',
      default: false
    })
  };

  static args = {
    action: Args.string({
      name: 'action',
      description: 'Action to perform (validate, generate, docs, show, check)',
      required: true,
      options: ['validate', 'generate', 'docs', 'show', 'check']
    })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(EnvironmentCommand);
    
    try {
      // Load environment configuration
      loadEnvironment();
      
      switch (args.action) {
        case 'validate':
          await this.validateEnvironment(flags.strict);
          break;
        case 'generate':
          await this.generateTemplate(flags.output || '.env.template');
          break;
        case 'docs':
          await this.generateDocs(flags.output || path.join('docs', 'environment-variables.md'));
          break;
        case 'show':
          await this.showEnvironment(flags.format);
          break;
        case 'check':
          await this.checkEnvironment();
          break;
        default:
          this.error(`Unknown action: ${args.action}`);
      }
    } catch (error) {
      this.error(`Error processing environment command: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate environment configuration
   */
  private async validateEnvironment(strict: boolean): Promise<void> {
    this.log(chalk.blue('Validating environment configuration...'));

    try {
      validateOrThrow({
        requireAll: strict,
        showWarnings: true,
        exitOnWarning: strict
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
  private async generateTemplate(templatePath: string): Promise<void> {
    this.log(chalk.blue(`Generating environment template file at ${templatePath}...`));

    try {
      generateEnvTemplate(templatePath);
      this.log(chalk.green(`✓ Environment template generated at ${templatePath}`));
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
    this.log(chalk.blue(`Generating environment documentation at ${docsPath}...`));

    try {
      const docs = generateEnvironmentDocs();
      
      // Create directory if it doesn't exist
      const dir = path.dirname(docsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(docsPath, docs);
      this.log(chalk.green(`✓ Environment documentation generated at ${docsPath}`));
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
  private async showEnvironment(format: string): Promise<void> {
    this.log(chalk.blue('Current environment configuration:'));
    
    if (format === 'json') {
      // Display as JSON
      this.log(JSON.stringify(envConfig.toJSON(), null, 2));
    } else if (format === 'env') {
      // Display as .env file format
      const config = envConfig.getAllVariables();
      for (const [key, value] of Object.entries(config)) {
        // Skip printing sensitive values
        if (value.sensitive && value.value) {
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
      const categories: Record<string, any[]> = {
        'Common': [],
        'Blockchain': [],
        'Storage': [],
        'AI': [],
        'Security': [],
        'Advanced': [],
        'Other': []
      };
      
      for (const [key, value] of Object.entries(config)) {
        let category = 'Other';
        if (key.startsWith('AI_') || key.endsWith('_API_KEY')) {
          category = 'AI';
        } else if (key.includes('STORAGE') || key.includes('FILE') || key.includes('DIR')) {
          category = 'Storage';
        } else if (key.includes('NETWORK') || key.includes('BLOCKCHAIN') || key.includes('WALLET')) {
          category = 'Blockchain';
        } else if (key.includes('SECURITY') || key.includes('VERIFICATION') || key.includes('CRYPTO')) {
          category = 'Security';
        } else if (key === 'NODE_ENV' || key === 'LOG_LEVEL') {
          category = 'Common';
        } else if (key.includes('RETRY') || key.includes('TIMEOUT') || key.includes('CREDENTIAL')) {
          category = 'Advanced';
        }

        // Format the value for display
        let displayValue = value.value;
        if (value.sensitive && value.value) {
          displayValue = '********';
        } else if (value.value === undefined || value.value === null) {
          displayValue = chalk.gray('<not set>');
        } else if (value.value === '') {
          displayValue = chalk.gray('<empty string>');
        }
        
        categories[category].push({
          name: key,
          value: displayValue,
          source: metaData[key].source,
          required: metaData[key].required ? chalk.red('Yes') : 'No',
          sensitive: metaData[key].sensitive ? chalk.yellow('Yes') : 'No'
        });
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
      validationResult.missingVars.forEach(v => this.log(chalk.red(`  - ${v}`)));
    } else {
      this.log(chalk.green('\n✓ All required variables are set'));
    }
    
    // Invalid variables
    if (validationResult.invalidVars.length > 0) {
      this.log(chalk.red('\nInvalid variables:'));
      validationResult.invalidVars.forEach(v => this.log(chalk.red(`  - ${v}`)));
    } else {
      this.log(chalk.green('✓ All variables have valid values'));
    }
    
    // Deprecated variables
    if (validationResult.deprecatedVars.length > 0) {
      this.log(chalk.yellow('\nDeprecated variables:'));
      validationResult.deprecatedVars.forEach(v => this.log(chalk.yellow(`  - ${v}`)));
    }
    
    // Insecure variables
    if (validationResult.insecureVars.length > 0) {
      this.log(chalk.yellow('\nInsecure storage of sensitive variables:'));
      validationResult.insecureVars.forEach(v => this.log(chalk.yellow(`  - ${v}`)));
    }
    
    // Other warnings
    if (validationResult.warnings.length > 0) {
      this.log(chalk.yellow('\nWarnings:'));
      validationResult.warnings.forEach(w => this.log(chalk.yellow(`  - ${w}`)));
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
      this.log(chalk.dim('- Add missing required variables to your .env file or environment'));
    }
    
    if (validationResult.invalidVars.length > 0) {
      this.log(chalk.dim('- Fix invalid variable values according to their validation rules'));
    }
    
    if (validationResult.insecureVars.length > 0) {
      this.log(chalk.dim('- Move sensitive variables from config files to environment variables'));
    }
    
    if (validationResult.deprecatedVars.length > 0) {
      this.log(chalk.dim('- Update deprecated variables to their newer alternatives'));
    }
    
    this.log(chalk.dim('- Run `waltodo env generate` to create a template .env file'));
    this.log(chalk.dim('- Run `waltodo env docs` to generate detailed environment documentation'));
  }
}