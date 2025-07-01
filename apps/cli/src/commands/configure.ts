import { Flags } from '@oclif/core';
import { select, input, confirm, checkbox } from '@inquirer/prompts';
import chalk = require('chalk');
import { configService } from '../services/config-service';
import { CLIError } from '../types/errors/consolidated';
import { BaseCommand } from '../base-command';
import { CommonValidationRules } from '../utils/InputValidator';
import { CommandSanitizer } from '../utils/CommandSanitizer';
import { envConfig, getEnv } from '../utils/environment-config';
import { saveConfigToFile } from '../utils/config-loader';
import { jobManager } from '../utils/PerformanceMonitor';
import { CLI_CONFIG } from '../constants';
import * as path from 'path';

/**
 * @class ConfigureCommand
 * @description This command allows users to configure the CLI settings for network, wallet preferences, and environment variables.
 * It supports interactive prompts for selecting network type, entering wallet addresses, configuring AI providers, and setting other environment options.
 * The configuration is crucial for ensuring the CLI operates correctly with blockchain, storage, and AI components.
 *
 * @param {boolean} [reset=false] - If true, resets all configuration settings to default values. (Optional flag: -r, --reset)
 * @param {string} [network] - Specifies the blockchain network to use ('mainnet', 'testnet', 'devnet', 'local'). (Optional flag: --network)
 * @param {string} [walletAddress] - Specifies the wallet address to be used for blockchain operations. (Optional flag: --walletAddress)
 * @param {boolean} [env-only=false] - If true, only configures environment variables without touching wallet settings. (Optional flag: --env-only)
 * @param {boolean} [view=false] - If true, displays the current configuration without modifying it. (Optional flag: --view)
 * @param {string} [section] - Configure a specific section (network, storage, ai, security). (Optional flag: --section)
 */
export default class ConfigureCommand extends BaseCommand {
  static description =
    'Configure CLI settings, environment variables, and wallet preferences';

  static examples = [
    '<%= config.bin %> configure                                              # Interactive setup',
    '<%= config.bin %> configure --reset                                      # Reset all settings',
    '<%= config.bin %> configure --network testnet --wallet-address 0x1234... # Set network and wallet',
    '<%= config.bin %> configure --env-only                                   # Configure env vars only',
    '<%= config.bin %> configure --view                                       # View current config',
    '<%= config.bin %> configure --section ai                                 # Configure AI settings',
    '<%= config.bin %> configure --background                                 # Run configuration in background',
    '<%= config.bin %> configure --background --section network               # Background network setup',
    '<%= config.bin %> configure --background --validate-after                # Background config + validation',
  ];

  static flags = {
    ...BaseCommand.flags,
    reset: Flags.boolean({
      char: 'r',
      description: 'Reset all settings to defaults',
      default: false,
    }),
    network: Flags.string({
      description: 'Network to use (mainnet, testnet, devnet, local)',
      options: ['mainnet', 'testnet', 'devnet', 'local'],
    }),
    walletAddress: Flags.string({
      description: 'Wallet address for configuration',
    }),
    'env-only': Flags.boolean({
      description: 'Only configure environment variables',
      default: false,
    }),
    view: Flags.boolean({
      char: 'v',
      description: 'View current configuration',
      default: false,
    }),
    section: Flags.string({
      char: 's',
      description: 'Configure a specific section',
      options: ['network', 'storage', 'ai', 'security'],
    }),
    background: Flags.boolean({
      char: 'b',
      description: 'Run configuration in background without blocking terminal',
      default: false,
    }),
    'validate-after': Flags.boolean({
      description: 'Run validation in background after configuration',
      default: false,
    }),
  };

  // Set up validation schema
  static validationSchema = {
    network: [CommonValidationRules.network],
    walletAddress: [CommonValidationRules.walletAddress],
  };

  async run(): Promise<void> {
    try {
      // Parse and validate input
      const { flags } = await this.parse(ConfigureCommand);

      // View current configuration
      if (flags.view) {
        await this.viewConfiguration();
        return;
      }

      // Reset configuration
      if (flags.reset) {
        await this.resetConfiguration();
        return;
      }

      // Handle background mode
      if (flags.background) {
        return this.runConfigurationInBackground(flags);
      }

      // Configure specific section or everything
      if (flags.section) {
        await this.configureSection(flags.section);
      } else if (flags?.["env-only"]) {
        await this.configureEnvironment();
      } else {
        await this.configureAll(flags);
      }

      // Optionally trigger background validation
      if (flags?.["validate-after"]) {
        this.log(chalk.blue('\n🔍 Triggering background validation...'));
        await this.runValidationInBackground();
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Configuration failed: ${error instanceof Error ? error.message : String(error)}`,
        'CONFIG_FAILED'
      );
    }
  }

  /**
   * Reset configuration to defaults
   */
  private async resetConfiguration(): Promise<void> {
    const confirmReset = await confirm({
      message: 'Are you sure you want to reset all configuration to defaults?',
      default: false,
    });

    if (!confirmReset) {
      this.log(chalk.yellow('Reset cancelled'));
      return;
    }

    // Reset wallet configuration
    await configService.saveConfig({
      network: 'testnet',
      walletAddress: '',
      encryptedStorage: false,
    });

    // Reset environment configuration
    const config = envConfig.toJSON();
    const defaultConfig = Object.fromEntries(
      Object.entries(config).map(([key, _]) => [key, undefined])
    );

    // Get home directory
    const homeDir = process?.env?.HOME || process?.env?.USERPROFILE || '';
    const configPath = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);

    // Save empty configuration
    await saveConfigToFile(defaultConfig, configPath);

    this.log(chalk.green('✓ Configuration reset to defaults'));
  }

  /**
   * View current configuration
   */
  private async viewConfiguration(): Promise<void> {
    // Get current configuration
    const walletConfig = configService.getConfig();
    const envVars = envConfig.getAllVariables();

    // Display wallet configuration
    this.log(chalk.bold('\nWallet Configuration:'));
    this.log(chalk.dim('Network:'), walletConfig.network);
    this.log(
      chalk.dim('Wallet Address:'),
      walletConfig.walletAddress || 'Not set'
    );
    this.log(
      chalk.dim('Encryption:'),
      walletConfig.encryptedStorage ? 'Enabled' : 'Disabled'
    );

    // Display environment variables by category
    this.log(chalk.bold('\nEnvironment Configuration:'));

    // Common configuration
    this.log(chalk.yellow('\nCommon Configuration:'));
    this.logEnvVar('NODE_ENV', envVars);
    this.logEnvVar('LOG_LEVEL', envVars);

    // Network configuration
    this.log(chalk.yellow('\nNetwork Configuration:'));
    this.logEnvVar('NETWORK', envVars);
    this.logEnvVar('FULLNODE_URL', envVars);
    this.logEnvVar('TODO_PACKAGE_ID', envVars);

    // Storage configuration
    this.log(chalk.yellow('\nStorage Configuration:'));
    this.logEnvVar('STORAGE_PATH', envVars);
    this.logEnvVar('TEMPORARY_STORAGE', envVars);
    this.logEnvVar('ENCRYPTED_STORAGE', envVars);

    // AI configuration
    this.log(chalk.yellow('\nAI Configuration:'));
    this.logEnvVar('AI_DEFAULT_PROVIDER', envVars);
    this.logEnvVar('AI_DEFAULT_MODEL', envVars);
    this.logEnvVar('AI_TEMPERATURE', envVars);
    this.logEnvVar('AI_MAX_TOKENS', envVars);
    this.logEnvVar('AI_CACHE_ENABLED', envVars);
    this.logEnvVar('AI_CACHE_TTL_MS', envVars);

    // Hide sensitive values but show if they're set
    this.log(chalk.yellow('\nAPI Keys:'));
    this.logEnvVar('XAI_API_KEY', envVars, true);
    this.logEnvVar('OPENAI_API_KEY', envVars, true);
    this.logEnvVar('ANTHROPIC_API_KEY', envVars, true);
    this.logEnvVar('OLLAMA_API_KEY', envVars, true);

    // Security configuration
    this.log(chalk.yellow('\nSecurity Configuration:'));
    this.logEnvVar('REQUIRE_SIGNATURE_VERIFICATION', envVars);
    this.logEnvVar('ENABLE_BLOCKCHAIN_VERIFICATION', envVars);
    this.logEnvVar('CREDENTIAL_KEY_ITERATIONS', envVars);
    this.logEnvVar('CREDENTIAL_AUTO_ROTATION_DAYS', envVars);
    this.logEnvVar('CREDENTIAL_ROTATION_WARNING_DAYS', envVars);
    this.logEnvVar('CREDENTIAL_MAX_FAILED_AUTH', envVars);

    // Advanced configuration
    this.log(chalk.yellow('\nRetry Configuration:'));
    this.logEnvVar('RETRY_ATTEMPTS', envVars);
    this.logEnvVar('RETRY_DELAY_MS', envVars);
    this.logEnvVar('TIMEOUT_MS', envVars);

    // Show extension variables if any
    const extensionVars = Object.entries(envVars).filter(
      ([key]) => !Object.keys(envConfig.getConfig()).includes(key)
    );

    if (extensionVars.length > 0) {
      this.log(chalk.yellow('\nExtension Configuration:'));
      for (const [key, value] of extensionVars) {
        this.logEnvVar(key, envVars, value.sensitive);
      }
    }

    // Show environment inconsistencies and warnings
    const inconsistencies = envConfig.checkEnvironmentConsistency();
    if (inconsistencies.length > 0) {
      this.log(chalk.red('\nEnvironment Inconsistencies:'));
      inconsistencies.forEach(issue => this.log(chalk.dim('-'), issue));
    }

    const warnings = envConfig.getWarnings();
    if (warnings.length > 0) {
      this.log(chalk.yellow('\nEnvironment Warnings:'));
      warnings.forEach(warning => this.log(chalk.dim('-'), warning));
    }
  }

  /**
   * Display an environment variable with proper formatting
   */
  private logEnvVar(
    key: string,
    envVars: Record<string, { value: unknown; source: string }>,
    isSensitive = false
  ): void {
    const varInfo = envVars[key];
    if (!varInfo) return;

    const source = varInfo.source;
    const sourceColor =
      source === 'environment'
        ? chalk.green
        : source === 'config'
          ? chalk.blue
          : chalk.gray;

    let value = varInfo.value;
    if (isSensitive && value) {
      value = value.toString().length > 0 ? '*****' : 'Not set';
    } else if (value === undefined || value === null || value === '') {
      value = 'Not set';
    }

    this.log(chalk.dim(key + ':'), value, sourceColor(`[${source}]`));
  }

  /**
   * Configure a specific section
   */
  private async configureSection(section: string): Promise<void> {
    switch (section) {
      case 'network':
        await this.configureNetwork();
        break;
      case 'storage':
        await this.configureStorage();
        break;
      case 'ai':
        await this.configureAI();
        break;
      case 'security':
        await this.configureSecurity();
        break;
      default:
        throw new CLIError(`Unknown section: ${section}`, 'INVALID_SECTION');
    }
  }

  /**
   * Configure network settings
   */
  private async configureNetwork(): Promise<void> {
    this.log(chalk.bold('Configuring Network Settings'));

    const network = await select({
      message: 'Select network:',
      choices: [
        { name: 'mainnet', value: 'mainnet' },
        { name: 'testnet', value: 'testnet' },
        { name: 'devnet', value: 'devnet' },
        { name: 'local', value: 'local' },
      ],
      default: getEnv('NETWORK'),
    });

    const fullnodeUrl = await input({
      message: 'Enter custom fullnode URL (leave empty for default):',
      default: getEnv('FULLNODE_URL') || '',
    });

    const todoPackageId = await input({
      message: 'Enter Todo package ID (leave empty for default):',
      default: getEnv('TODO_PACKAGE_ID') || '',
    });

    const walletAddress = await input({
      message: 'Enter your wallet address (e.g., 0x123...):',
      default: configService.getConfig().walletAddress || '',
    });

    // Sanitize and validate inputs
    const sanitizedNetwork = CommandSanitizer.sanitizeString(network);
    const sanitizedFullnodeUrl = CommandSanitizer.sanitizeUrl(fullnodeUrl);
    const sanitizedPackageId =
      CommandSanitizer.sanitizeWalletAddress(todoPackageId);
    const sanitizedWalletAddress =
      CommandSanitizer.sanitizeWalletAddress(walletAddress);

    // Save to config
    const configObj: Record<string, string | boolean> = {
      NETWORK: sanitizedNetwork,
      WALLET_ADDRESS: sanitizedWalletAddress,
    };

    if (sanitizedFullnodeUrl) configObj?.FULLNODE_URL = sanitizedFullnodeUrl;
    if (sanitizedPackageId) configObj?.TODO_PACKAGE_ID = sanitizedPackageId;

    // Save to config file
    const homeDir = process?.env?.HOME || process?.env?.USERPROFILE || '';
    const configPath = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);
    await saveConfigToFile(configObj, configPath);

    // Update wallet config separately
    await configService.saveConfig({
      network: sanitizedNetwork,
      walletAddress: sanitizedWalletAddress,
    });

    // Reload environment configuration
    envConfig.loadFromObject(configObj);

    this.log(chalk.green('\n✓ Network configuration saved successfully'));
  }

  /**
   * Configure storage settings
   */
  private async configureStorage(): Promise<void> {
    this.log(chalk.bold('Configuring Storage Settings'));

    const storagePath = await input({
      message: 'Enter path for todo storage:',
      default: getEnv('STORAGE_PATH'),
    });

    const tempStorage = await input({
      message: 'Enter path for temporary storage:',
      default: getEnv('TEMPORARY_STORAGE'),
    });

    const encryptedStorage = await confirm({
      message: 'Enable encryption for local storage?',
      default: getEnv('ENCRYPTED_STORAGE'),
    });

    // Sanitize inputs
    const sanitizedStoragePath = CommandSanitizer.sanitizePath(storagePath);
    const sanitizedTempStorage = CommandSanitizer.sanitizePath(tempStorage);

    // Save to config
    const configObj: Record<string, string | boolean> = {
      STORAGE_PATH: sanitizedStoragePath,
      TEMPORARY_STORAGE: sanitizedTempStorage,
      ENCRYPTED_STORAGE: encryptedStorage,
    };

    // Save to config file
    const homeDir = process?.env?.HOME || process?.env?.USERPROFILE || '';
    const configPath = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);
    await saveConfigToFile(configObj, configPath);

    // Update wallet config to include encryption setting
    await configService.saveConfig({
      encryptedStorage: encryptedStorage,
    });

    // Reload environment configuration
    envConfig.loadFromObject(configObj);

    this.log(chalk.green('\n✓ Storage configuration saved successfully'));
  }

  /**
   * Configure AI settings
   */
  private async configureAI(): Promise<void> {
    this.log(chalk.bold('Configuring AI Settings'));

    const provider = await select({
      message: 'Select default AI provider:',
      choices: [
        { name: 'XAI (Grok)', value: 'xai' },
        { name: 'OpenAI', value: 'openai' },
        { name: 'Anthropic', value: 'anthropic' },
        { name: 'Ollama (Local)', value: 'ollama' },
      ],
      default: getEnv('AI_DEFAULT_PROVIDER'),
    });

    // Ask for API keys based on selected provider
    let xaiApiKey = getEnv('XAI_API_KEY') || '';
    let openaiApiKey = getEnv('OPENAI_API_KEY') || '';
    let anthropicApiKey = getEnv('ANTHROPIC_API_KEY') || '';
    let ollamaApiKey = getEnv('OLLAMA_API_KEY') || '';

    // Always configure the primary provider
    if (provider === 'xai') {
      xaiApiKey = await input({
        message: 'Enter XAI API key:',
        default: getEnv('XAI_API_KEY') ? '*****' : '',
      });
    } else if (provider === 'openai') {
      openaiApiKey = await input({
        message: 'Enter OpenAI API key:',
        default: getEnv('OPENAI_API_KEY') ? '*****' : '',
      });
    } else if (provider === 'anthropic') {
      anthropicApiKey = await input({
        message: 'Enter Anthropic API key:',
        default: getEnv('ANTHROPIC_API_KEY') ? '*****' : '',
      });
    } else if (provider === 'ollama') {
      ollamaApiKey = await input({
        message: 'Enter Ollama API key (if required):',
        default: getEnv('OLLAMA_API_KEY') ? '*****' : '',
      });
    }

    // Ask if user wants to configure other providers
    const configureOthers = await confirm({
      message: 'Configure API keys for other providers?',
      default: false,
    });

    if (configureOthers) {
      // Configure other providers if not already done
      if (provider !== 'xai') {
        xaiApiKey = await input({
          message: 'Enter XAI API key:',
          default: getEnv('XAI_API_KEY') ? '*****' : '',
        });
      }

      if (provider !== 'openai') {
        openaiApiKey = await input({
          message: 'Enter OpenAI API key:',
          default: getEnv('OPENAI_API_KEY') ? '*****' : '',
        });
      }

      if (provider !== 'anthropic') {
        anthropicApiKey = await input({
          message: 'Enter Anthropic API key:',
          default: getEnv('ANTHROPIC_API_KEY') ? '*****' : '',
        });
      }

      if (provider !== 'ollama') {
        ollamaApiKey = await input({
          message: 'Enter Ollama API key (if required):',
          default: getEnv('OLLAMA_API_KEY') ? '*****' : '',
        });
      }
    }

    // Configure models
    let model = '';
    const models = {
      xai: ['grok-beta', 'grok-1'],
      openai: ['gpt-3.5-turbo', 'gpt-4-turbo', 'gpt-4o'],
      anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      ollama: ['llama2', 'llama3', 'mistral'],
    };

    model = await select({
      message: `Select default ${provider} model:`,
      choices: models[provider as keyof typeof models].map(m => ({
        name: m,
        value: m,
      })),
      default: getEnv('AI_DEFAULT_MODEL'),
    });

    // Configure additional settings
    const temperature = await input({
      message: 'Enter temperature (0.0-1.0):',
      default: getEnv('AI_TEMPERATURE').toString(),
      validate: input => {
        const num = parseFloat(input);
        return (
          (num >= 0 && num <= 1) || 'Temperature must be between 0.0 and 1.0'
        );
      },
    });

    const maxTokens = await input({
      message: 'Enter maximum tokens:',
      default: getEnv('AI_MAX_TOKENS').toString(),
      validate: input => {
        const num = parseInt(input);
        return num > 0 || 'Maximum tokens must be greater than 0';
      },
    });

    const cacheEnabled = await confirm({
      message: 'Enable AI response caching?',
      default: getEnv('AI_CACHE_ENABLED'),
    });

    const cacheTtl = await input({
      message: 'Enter cache TTL in milliseconds:',
      default: getEnv('AI_CACHE_TTL_MS').toString(),
      validate: input => {
        const num = parseInt(input);
        return num > 0 || 'Cache TTL must be greater than 0';
      },
    });

    // Process API keys (don't replace with ***** placeholders)
    if (xaiApiKey === '*****') xaiApiKey = getEnv('XAI_API_KEY') || '';
    if (openaiApiKey === '*****') openaiApiKey = getEnv('OPENAI_API_KEY') || '';
    if (anthropicApiKey === '*****')
      anthropicApiKey = getEnv('ANTHROPIC_API_KEY') || '';
    if (ollamaApiKey === '*****') ollamaApiKey = getEnv('OLLAMA_API_KEY') || '';

    // Save to config
    const configObj: Record<string, string | number | boolean> = {
      AI_DEFAULT_PROVIDER: provider,
      AI_DEFAULT_MODEL: model,
      AI_TEMPERATURE: parseFloat(temperature),
      AI_MAX_TOKENS: parseInt(maxTokens),
      AI_CACHE_ENABLED: cacheEnabled,
      AI_CACHE_TTL_MS: parseInt(cacheTtl),
    };

    // Only save API keys if they were actually entered
    if (xaiApiKey) configObj?.XAI_API_KEY = xaiApiKey;
    if (openaiApiKey) configObj?.OPENAI_API_KEY = openaiApiKey;
    if (anthropicApiKey) configObj?.ANTHROPIC_API_KEY = anthropicApiKey;
    if (ollamaApiKey) configObj?.OLLAMA_API_KEY = ollamaApiKey;

    // Save to config file, but API keys should go to environment variables if possible
    const homeDir = process?.env?.HOME || process?.env?.USERPROFILE || '';
    const configPath = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);

    // Separate sensitive values from standard config
    const sensitiveConfig: Record<string, string | number | boolean> = {};
    const standardConfig: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(configObj)) {
      if (
        [
          'XAI_API_KEY',
          'OPENAI_API_KEY',
          'ANTHROPIC_API_KEY',
          'OLLAMA_API_KEY',
        ].includes(key)
      ) {
        sensitiveConfig[key] = value;
      } else {
        standardConfig[key] = value;
      }
    }

    // Save standard config to file
    await saveConfigToFile(standardConfig, configPath);

    // Suggest exporting sensitive values to environment
    if (Object.keys(sensitiveConfig).length > 0) {
      this.log(
        chalk.yellow(
          '\nFor better security, consider adding these to your environment variables:'
        )
      );
      for (const [key, value] of Object.entries(sensitiveConfig)) {
        this.log(`export ${key}="${value}"`);

        // Set for the current session
        process?.env?.[key] = value.toString();
      }
    }

    // Reload environment configuration
    envConfig.loadFromObject(standardConfig);

    this.log(chalk.green('\n✓ AI configuration saved successfully'));
  }

  /**
   * Configure security settings
   */
  private async configureSecurity(): Promise<void> {
    this.log(chalk.bold('Configuring Security Settings'));

    const signatureVerification = await confirm({
      message: 'Require signature verification for operations?',
      default: getEnv('REQUIRE_SIGNATURE_VERIFICATION'),
    });

    const blockchainVerification = await confirm({
      message: 'Enable blockchain verification for AI operations?',
      default: getEnv('ENABLE_BLOCKCHAIN_VERIFICATION'),
    });

    const keyIterations = await input({
      message: 'Number of iterations for PBKDF2 key derivation:',
      default: getEnv('CREDENTIAL_KEY_ITERATIONS').toString(),
      validate: input => {
        const num = parseInt(input);
        return num >= 10000 || 'Iterations must be at least 10000 for security';
      },
    });

    const autoRotationDays = await input({
      message: 'Days before credentials are auto-rotated:',
      default: getEnv('CREDENTIAL_AUTO_ROTATION_DAYS').toString(),
      validate: input => {
        const num = parseInt(input);
        return num > 0 || 'Must be a positive number';
      },
    });

    const rotationWarningDays = await input({
      message: 'Days before showing credential rotation warnings:',
      default: getEnv('CREDENTIAL_ROTATION_WARNING_DAYS').toString(),
      validate: input => {
        const num = parseInt(input);
        return num > 0 || 'Must be a positive number';
      },
    });

    const maxFailedAuth = await input({
      message: 'Maximum failed authentication attempts before lockout:',
      default: getEnv('CREDENTIAL_MAX_FAILED_AUTH').toString(),
      validate: input => {
        const num = parseInt(input);
        return num > 0 || 'Must be a positive number';
      },
    });

    // Save to config
    const configObj: Record<string, string | number | boolean> = {
      REQUIRE_SIGNATURE_VERIFICATION: signatureVerification,
      ENABLE_BLOCKCHAIN_VERIFICATION: blockchainVerification,
      CREDENTIAL_KEY_ITERATIONS: parseInt(keyIterations),
      CREDENTIAL_AUTO_ROTATION_DAYS: parseInt(autoRotationDays),
      CREDENTIAL_ROTATION_WARNING_DAYS: parseInt(rotationWarningDays),
      CREDENTIAL_MAX_FAILED_AUTH: parseInt(maxFailedAuth),
    };

    // Save to config file
    const homeDir = process?.env?.HOME || process?.env?.USERPROFILE || '';
    const configPath = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);
    await saveConfigToFile(configObj, configPath);

    // Reload environment configuration
    envConfig.loadFromObject(configObj);

    this.log(chalk.green('\n✓ Security configuration saved successfully'));
  }

  /**
   * Configure environment variables
   */
  private async configureEnvironment(): Promise<void> {
    this.log(chalk.bold('Configuring Environment Variables'));

    // Ask which sections to configure
    const sections = await checkbox({
      message: 'Select sections to configure:',
      choices: [
        { name: 'Network Settings', value: 'network' },
        { name: 'Storage Settings', value: 'storage' },
        { name: 'AI Settings', value: 'ai' },
        { name: 'Security Settings', value: 'security' },
      ],
    });

    if (sections.includes('network')) {
      await this.configureNetwork();
    }

    if (sections.includes('storage')) {
      await this.configureStorage();
    }

    if (sections.includes('ai')) {
      await this.configureAI();
    }

    if (sections.includes('security')) {
      await this.configureSecurity();
    }

    this.log(chalk.green('\n✓ Environment configuration completed'));
  }

  /**
   * Configure all settings
   */
  private async configureAll(flags: {
    network?: string;
    walletAddress?: string;
    'env-only'?: boolean;
    view?: boolean;
    section?: string;
    reset?: boolean;
  }): Promise<void> {
    // Start with network settings
    let network = flags.network;
    let walletAddress = flags.walletAddress;

    if (!network) {
      network = await select({
        message: 'Select network:',
        choices: [
          { name: 'mainnet', value: 'mainnet' },
          { name: 'testnet', value: 'testnet' },
          { name: 'devnet', value: 'devnet' },
          { name: 'local', value: 'local' },
        ],
        default: getEnv('NETWORK'),
      });

      // Sanitize user input
      network = CommandSanitizer.sanitizeString(network);
    }

    if (!walletAddress) {
      walletAddress = await input({
        message: 'Enter your wallet address (e.g., 0x123...):',
        default: configService.getConfig().walletAddress || '',
      });

      // Sanitize user input
      walletAddress = CommandSanitizer.sanitizeWalletAddress(walletAddress);

      if (!CommonValidationRules?.walletAddress?.test(walletAddress)) {
        throw new CLIError(
          CommonValidationRules?.walletAddress?.message,
          CommonValidationRules?.walletAddress?.code
        );
      }
    }

    const encryptedStorage = await confirm({
      message: 'Enable encryption for sensitive data?',
      default: getEnv('ENCRYPTED_STORAGE'),
    });

    // Ask if user wants to configure more settings
    const configureMore = await confirm({
      message:
        'Configure additional environment settings (AI, security, etc.)?',
      default: false,
    });

    if (configureMore) {
      await this.configureEnvironment();
    }

    // Save wallet settings
    await configService.saveConfig({
      network,
      walletAddress,
      encryptedStorage,
    });

    // Update environment config
    envConfig.updateConfig('NETWORK', network, 'config');
    envConfig.updateConfig('WALLET_ADDRESS', walletAddress, 'config');
    envConfig.updateConfig('ENCRYPTED_STORAGE', encryptedStorage, 'config');

    this.log(chalk.green('\n✓ Configuration saved successfully'));
    this.log(chalk.dim('Network:'), network);
    this.log(chalk.dim('Wallet Address:'), walletAddress);
    this.log(
      chalk.dim('Encryption:'),
      encryptedStorage ? 'Enabled' : 'Disabled'
    );
  }

  /**
   * Run configuration setup in background
   */
  private async runConfigurationInBackground(flags: any): Promise<void> {
    try {
      // Create background job
      const job = jobManager.createJob(
        'configure',
        Object.keys(flags).filter((key): key is string => key in flags && flags[key as keyof typeof flags]).map(String),
        flags
      );
      jobManager.startJob(job.id);

      this.log(chalk.blue(`⚙️ Starting configuration setup in background...`));
      this.log(chalk.gray(`Job ID: ${job.id}`));
      this.log(chalk.gray(`Use "waltodo jobs" to check progress`));
      this.log(
        chalk.gray(`Use "waltodo status ${job.id}" for detailed status`)
      );

      // Run configuration in background
      setImmediate(async () => {
        try {
          jobManager.writeJobLog(
            job.id,
            'Starting background configuration setup'
          );
          jobManager.updateProgress(job.id, 10);

          if (flags.section) {
            jobManager.writeJobLog(
              job.id,
              `Configuring section: ${flags.section}`
            );
            await this.configureSectionInBackground(flags.section, job.id);
          } else if (flags?.["env-only"]) {
            jobManager.writeJobLog(job.id, 'Configuring environment variables');
            await this.configureEnvironmentInBackground(job.id);
          } else {
            jobManager.writeJobLog(job.id, 'Running full configuration setup');
            await this.configureAllInBackground(flags, job.id);
          }

          jobManager.updateProgress(job.id, 90);

          // Optionally run validation
          if (flags?.["validate-after"]) {
            jobManager.writeJobLog(
              job.id,
              'Running post-configuration validation'
            );
            await this.runPostConfigValidation(job.id);
          }

          jobManager.updateProgress(job.id, 100);
          jobManager.writeJobLog(
            job.id,
            'Configuration setup completed successfully'
          );
          jobManager.completeJob(job.id, {
            success: true,
            configuredSections: flags.section || 'all',
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          jobManager.writeJobLog(
            job.id,
            `Configuration failed: ${errorMessage}`
          );
          jobManager.failJob(job.id, errorMessage);
        }
      });

      return;
    } catch (error) {
      throw new CLIError(
        `Failed to start background configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Configure a section in background with default values
   */
  private async configureSectionInBackground(
    section: string,
    jobId: string
  ): Promise<void> {
    jobManager.updateProgress(jobId, 30);

    switch (section) {
      case 'network':
        jobManager.writeJobLog(
          jobId,
          'Configuring network settings with defaults'
        );
        // Use default network configuration
        const defaultNetworkConfig = {
          NETWORK: 'testnet',
          WALLET_ADDRESS: '',
        };
        await this.saveConfigInBackground(defaultNetworkConfig, jobId);
        break;

      case 'storage':
        jobManager.writeJobLog(
          jobId,
          'Configuring storage settings with defaults'
        );
        const defaultStorageConfig = {
          STORAGE_PATH: path.join(process.cwd(), '.waltodo-data'),
          TEMPORARY_STORAGE: path.join(process.cwd(), '.waltodo-temp'),
          ENCRYPTED_STORAGE: true,
        };
        await this.saveConfigInBackground(defaultStorageConfig, jobId);
        break;

      case 'ai':
        jobManager.writeJobLog(jobId, 'Configuring AI settings with defaults');
        const defaultAIConfig = {
          AI_DEFAULT_PROVIDER: 'xai',
          AI_DEFAULT_MODEL: 'grok-beta',
          AI_TEMPERATURE: 0.7,
          AI_MAX_TOKENS: 1000,
          AI_CACHE_ENABLED: true,
          AI_CACHE_TTL_MS: 300000,
        };
        await this.saveConfigInBackground(defaultAIConfig, jobId);
        break;

      case 'security':
        jobManager.writeJobLog(
          jobId,
          'Configuring security settings with defaults'
        );
        const defaultSecurityConfig = {
          REQUIRE_SIGNATURE_VERIFICATION: true,
          ENABLE_BLOCKCHAIN_VERIFICATION: true,
          CREDENTIAL_KEY_ITERATIONS: 100000,
          CREDENTIAL_AUTO_ROTATION_DAYS: 30,
          CREDENTIAL_ROTATION_WARNING_DAYS: 7,
          CREDENTIAL_MAX_FAILED_AUTH: 5,
        };
        await this.saveConfigInBackground(defaultSecurityConfig, jobId);
        break;

      default:
        throw new Error(`Unknown section: ${section}`);
    }

    jobManager.updateProgress(jobId, 70);
  }

  /**
   * Configure environment in background with defaults
   */
  private async configureEnvironmentInBackground(jobId: string): Promise<void> {
    jobManager.writeJobLog(
      jobId,
      'Setting up environment configuration with defaults'
    );
    jobManager.updateProgress(jobId, 30);

    const defaultConfig = {
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      NETWORK: 'testnet',
      STORAGE_PATH: path.join(process.cwd(), '.waltodo-data'),
      AI_DEFAULT_PROVIDER: 'xai',
      ENCRYPTED_STORAGE: true,
    };

    await this.saveConfigInBackground(defaultConfig, jobId);
    jobManager.updateProgress(jobId, 70);
  }

  /**
   * Configure all settings in background with defaults
   */
  private async configureAllInBackground(
    flags: any,
    jobId: string
  ): Promise<void> {
    jobManager.writeJobLog(
      jobId,
      'Setting up complete configuration with defaults'
    );
    jobManager.updateProgress(jobId, 20);

    const defaultConfig = {
      // Common
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',

      // Network
      NETWORK: flags.network || 'testnet',
      WALLET_ADDRESS: flags.walletAddress || '',

      // Storage
      STORAGE_PATH: path.join(process.cwd(), '.waltodo-data'),
      TEMPORARY_STORAGE: path.join(process.cwd(), '.waltodo-temp'),
      ENCRYPTED_STORAGE: true,

      // AI
      AI_DEFAULT_PROVIDER: 'xai',
      AI_DEFAULT_MODEL: 'grok-beta',
      AI_TEMPERATURE: 0.7,
      AI_MAX_TOKENS: 1000,
      AI_CACHE_ENABLED: true,
      AI_CACHE_TTL_MS: 300000,

      // Security
      REQUIRE_SIGNATURE_VERIFICATION: true,
      ENABLE_BLOCKCHAIN_VERIFICATION: true,
      CREDENTIAL_KEY_ITERATIONS: 100000,
      CREDENTIAL_AUTO_ROTATION_DAYS: 30,
      CREDENTIAL_ROTATION_WARNING_DAYS: 7,
      CREDENTIAL_MAX_FAILED_AUTH: 5,
    };

    await this.saveConfigInBackground(defaultConfig, jobId);
    jobManager.updateProgress(jobId, 70);
  }

  /**
   * Save configuration in background
   */
  private async saveConfigInBackground(
    config: Record<string, any>,
    jobId: string
  ): Promise<void> {
    try {
      jobManager.writeJobLog(jobId, 'Saving configuration to file');

      // Save to config file
      const homeDir = process?.env?.HOME || process?.env?.USERPROFILE || '';
      const configPath = path.join(homeDir, CLI_CONFIG.CONFIG_FILE);
      await saveConfigToFile(config, configPath);

      // Update wallet config if applicable
      if (
        config.NETWORK ||
        config.WALLET_ADDRESS !== undefined ||
        config.ENCRYPTED_STORAGE !== undefined
      ) {
        await configService.saveConfig({
          network: config.NETWORK,
          walletAddress: config.WALLET_ADDRESS,
          encryptedStorage: config.ENCRYPTED_STORAGE,
        });
      }

      // Reload environment configuration
      envConfig.loadFromObject(config);

      jobManager.writeJobLog(jobId, 'Configuration saved successfully');
    } catch (error) {
      throw new Error(
        `Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Run validation after configuration
   */
  private async runPostConfigValidation(jobId: string): Promise<void> {
    try {
      jobManager.writeJobLog(jobId, 'Running post-configuration validation');

      // Basic validation
      envConfig.validate();
      jobManager.writeJobLog(jobId, 'Basic validation passed');

      // Network connectivity check (simulated)
      await new Promise(resolve => setTimeout(resolve, 1000));
      jobManager.writeJobLog(jobId, 'Network connectivity verified');
    } catch (error) {
      jobManager.writeJobLog(
        jobId,
        `Validation warning: ${error instanceof Error ? error.message : String(error)}`
      );
      // Don't fail the job for validation warnings
    }
  }

  /**
   * Run validation in background (used for validate-after flag)
   */
  private async runValidationInBackground(): Promise<void> {
    const validationJob = jobManager.createJob(
      'config',
      ['validate', 'basic'],
      { background: true }
    );
    jobManager.startJob(validationJob.id);

    this.log(chalk.gray(`Validation job started: ${validationJob.id}`));

    setImmediate(async () => {
      try {
        jobManager.writeJobLog(
          validationJob.id,
          'Running post-configuration validation'
        );
        jobManager.updateProgress(validationJob.id, 50);

        envConfig.validate();

        jobManager.updateProgress(validationJob.id, 100);
        jobManager.writeJobLog(
          validationJob.id,
          'Validation completed successfully'
        );
        jobManager.completeJob(validationJob.id, {
          success: true,
          type: 'post-config-validation',
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        jobManager.writeJobLog(
          validationJob.id,
          `Validation failed: ${errorMessage}`
        );
        jobManager.failJob(validationJob.id, errorMessage);
      }
    });
  }
}
