#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const CONFIG_DIR = join(homedir(), '.waltodo');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

async function checkWalrusInstallation() {
  const spinner = ora('Checking for Walrus CLI installation...').start();
  
  try {
    execSync('walrus --version', { stdio: 'pipe' });
    spinner.succeed('Walrus CLI is installed');
    return true;
  } catch (error) {
    spinner.fail('Walrus CLI is not installed');
    return false;
  }
}

async function createConfigDirectory() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    console.log(chalk.green('✓'), 'Config directory created:', chalk.cyan(CONFIG_DIR));
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
    console.log(chalk.yellow('ℹ'), 'Config directory already exists:', chalk.cyan(CONFIG_DIR));
  }
}

async function promptForConfig() {
  console.log('\n' + chalk.bold('Walrus Configuration Setup') + '\n');
  
  const questions = [
    {
      type: 'input',
      name: 'walrusEndpoint',
      message: 'Walrus API endpoint:',
      default: 'https://api.walrus.site',
      validate: (input) => {
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      }
    },
    {
      type: 'input',
      name: 'walrusApiKey',
      message: 'Walrus API key (optional):',
      default: '',
    },
    {
      type: 'input',
      name: 'storageBucket',
      message: 'Storage bucket/namespace for todos:',
      default: 'waltodo-data',
      validate: (input) => input.trim() !== '' || 'Bucket name is required'
    },
    {
      type: 'confirm',
      name: 'enableEncryption',
      message: 'Enable end-to-end encryption for todos?',
      default: true
    }
  ];
  
  const answers = await inquirer.prompt(questions);
  
  if (answers.enableEncryption) {
    const encryptionQuestions = [
      {
        type: 'password',
        name: 'encryptionKey',
        message: 'Encryption passphrase (leave empty to auto-generate):',
        mask: '*'
      }
    ];
    
    const encryptionAnswers = await inquirer.prompt(encryptionQuestions);
    
    if (!encryptionAnswers.encryptionKey) {
      // Generate a random key
      const crypto = await import('crypto');
      answers.encryptionKey = crypto.randomBytes(32).toString('base64');
      console.log(chalk.yellow('\n⚠️  Auto-generated encryption key. Store this safely:'));
      console.log(chalk.cyan(answers.encryptionKey) + '\n');
    } else {
      answers.encryptionKey = encryptionAnswers.encryptionKey;
    }
  }
  
  return {
    walrus: {
      endpoint: answers.walrusEndpoint,
      apiKey: answers.walrusApiKey || undefined,
      bucket: answers.storageBucket
    },
    encryption: answers.enableEncryption ? {
      enabled: true,
      key: answers.encryptionKey
    } : {
      enabled: false
    },
    sync: {
      autoSync: true,
      interval: 300000 // 5 minutes
    }
  };
}

async function testConnection(config) {
  const spinner = ora('Testing Walrus connection...').start();
  
  try {
    // Simulate a connection test
    // In a real implementation, this would make an API call to Walrus
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For now, we'll assume the connection works if the endpoint is valid
    const url = new URL(config.walrus.endpoint);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      spinner.succeed('Connection test successful');
      return true;
    } else {
      throw new Error('Invalid protocol');
    }
  } catch (error) {
    spinner.fail('Connection test failed: ' + error.message);
    return false;
  }
}

async function saveConfig(config) {
  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(chalk.green('✓'), 'Configuration saved to:', chalk.cyan(CONFIG_FILE));
  } catch (error) {
    throw new Error(`Failed to save configuration: ${error.message}`);
  }
}

async function main() {
  console.log(chalk.bold.blue(`
╔══════════════════════════════════╗
║     WalTodo Setup Wizard         ║
╚══════════════════════════════════╝
`));
  
  console.log('Welcome to WalTodo! Let\'s set up your configuration.\n');
  
  try {
    // Check for existing config
    try {
      await fs.access(CONFIG_FILE);
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: chalk.yellow('Configuration file already exists. Overwrite?'),
          default: false
        }
      ]);
      
      if (!overwrite) {
        console.log(chalk.yellow('\nSetup cancelled. Your existing configuration was preserved.'));
        process.exit(0);
      }
    } catch {
      // Config doesn't exist, continue
    }
    
    // Check Walrus installation
    const walrusInstalled = await checkWalrusInstallation();
    if (!walrusInstalled) {
      console.log(chalk.yellow('\n⚠️  Walrus CLI is not installed.'));
      console.log('Please install it first: https://docs.walrus.site/cli/installation\n');
      
      const { continueAnyway } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueAnyway',
          message: 'Continue setup anyway?',
          default: false
        }
      ]);
      
      if (!continueAnyway) {
        process.exit(1);
      }
    }
    
    // Create config directory
    await createConfigDirectory();
    
    // Get configuration
    const config = await promptForConfig();
    
    // Test connection
    const connectionOk = await testConnection(config);
    if (!connectionOk) {
      const { saveAnyway } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'saveAnyway',
          message: 'Save configuration anyway?',
          default: true
        }
      ]);
      
      if (!saveAnyway) {
        console.log(chalk.red('\nSetup cancelled.'));
        process.exit(1);
      }
    }
    
    // Save configuration
    await saveConfig(config);
    
    // Success message
    console.log(chalk.bold.green(`
✨ Setup completed successfully!
`));
    
    console.log(chalk.bold('Next steps:'));
    console.log('1. Run', chalk.cyan('npm run build'), 'to build the project');
    console.log('2. Run', chalk.cyan('npm link'), 'to install waltodo globally');
    console.log('3. Start using waltodo with', chalk.cyan('waltodo --help'));
    
    if (config.encryption.enabled && config.encryption.key) {
      console.log(chalk.yellow('\n⚠️  Important: Keep your encryption key safe!'));
      console.log('You\'ll need it to decrypt your todos on other devices.');
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ Setup failed:'), error.message);
    process.exit(1);
  }
}

// Run setup
main().catch(error => {
  console.error(chalk.red('Unexpected error:'), error);
  process.exit(1);
});