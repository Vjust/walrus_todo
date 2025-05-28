import { Flags, Args } from '@oclif/core';
import BaseCommand from '../base-command';
import {
  AIVerifierAdapter,
  VerificationRecord,
} from '../types/adapters/AIVerifierAdapter';
import chalk = require('chalk');
import * as fs from 'fs';
import * as path from 'path';
import { configService } from '../services/config-service';
import { CLIError } from '../types/errors/consolidated';
import { 
  createBackgroundAIOperationsManager, 
  BackgroundAIOperations, 
  BackgroundAIUtils
} from '../utils/background-ai-operations';

export default class Verify extends BaseCommand {
  static description = 'Manage blockchain verifications for AI operations';

  static flags = {
    ...BaseCommand.flags,

    format: Flags.string({
      description: 'Output format (table, json)',
      default: 'table',
      options: ['table', 'json'],
    }),

    output: Flags.string({
      description: 'Output file path for export action',
      char: 'o',
    }),

    content: Flags.boolean({
      description: 'Include content in export (if available)',
      default: false,
    }),

    background: Flags.boolean({
      char: 'b',
      description: 'Run verification check in background',
      required: false,
      default: false,
    }),

    wait: Flags.boolean({
      char: 'w',
      description: 'Wait for background operation to complete',
      required: false,
      default: false,
    }),

    jobId: Flags.string({
      char: 'j',
      description: 'Check status of specific background verification job',
      required: false,
    }),
  };

  static args = {
    action: Args.string({
      name: 'action',
      description: 'Action to perform (list, show, export)',
      required: true,
      options: ['list', 'show', 'export'],
    }),
    id: Args.string({
      name: 'id',
      description: 'Verification ID (required for show and export)',
      required: false,
    }),
  };

  private verifierAdapter!: AIVerifierAdapter;
  private configService = configService;

  async init() {
    await super.init();

    // Initialize the verifier adapter
    // const _config = await this.configService.getConfig();
    // packageId and registryId would be used in real implementation
    // const packageId = config.packageId || '';
    // const registryId = config.registryId || '';

    // This would be properly initialized in a real implementation
    this.verifierAdapter = {} as AIVerifierAdapter;
  }

  async run() {
    const { args, flags } = await this.parse(Verify);

    // Handle background job status check
    if (flags.jobId) {
      return this.handleJobStatus(flags.jobId, flags);
    }

    switch (args.action) {
      case 'list':
        if (flags.background) {
          await this.listVerificationsInBackground(flags);
        } else {
          await this.listVerifications(flags.format);
        }
        break;

      case 'show':
        if (!args.id) {
          this.error('Verification ID is required for show action');
        }
        if (flags.background) {
          await this.showVerificationInBackground(args.id, flags);
        } else {
          await this.showVerification(args.id, flags.format);
        }
        break;

      case 'export':
        if (!args.id) {
          this.error('Verification ID is required for export action');
        }
        if (flags.background) {
          await this.exportVerificationInBackground(args.id, flags);
        } else {
          await this.exportVerification(args.id, flags.output, flags.content);
        }
        break;

      default:
        this.error(`Unknown action: ${args.action}`);
    }
  }

  private async listVerifications(format: string) {
    this.log(chalk.bold('Fetching AI operation verifications...'));

    try {
      const verifications = await this.verifierAdapter.listVerifications();

      if (verifications.length === 0) {
        this.log('No verifications found.');
        return;
      }

      if (format === 'json') {
        this.log(JSON.stringify(verifications, null, 2));
        return;
      }

      // Table format (default)
      const tableData = verifications.map(v => ({
        id: v.id.slice(0, 8) + '...',
        type: this.formatVerificationType(v.verificationType),
        timestamp: new Date(v.timestamp).toLocaleString(),
        provider: v.provider.slice(0, 8) + '...',
      }));

      this.log(chalk.bold(`Found ${verifications.length} verifications:`));
      this.log(this.formatTable(tableData));
    } catch (error) {
      this.error(`Failed to list verifications: ${error}`);
    }
  }

  private async showVerification(id: string, format: string) {
    this.log(chalk.bold(`Fetching verification details for ${id}...`));

    try {
      // In a real implementation, we would:
      // 1. Fetch the verification record from the blockchain
      // 2. Try to fetch associated content from Walrus

      // For now, use a mock verification record
      const verification: VerificationRecord = {
        id,
        requestHash: 'mock_request_hash',
        responseHash: 'mock_response_hash',
        user: 'mock_user_address',
        provider: 'mock_provider_address',
        timestamp: Date.now(),
        verificationType: 0, // SUMMARIZE
        metadata: {
          todoCount: '5',
          timestamp: Date.now().toString(),
        },
      };

      if (format === 'json') {
        this.log(JSON.stringify(verification, null, 2));
        return;
      }

      // Table format (default)
      this.log(chalk.bold('Verification Details:'));
      this.log(`ID:          ${verification.id}`);
      this.log(
        `Type:        ${this.formatVerificationType(verification.verificationType)}`
      );
      this.log(`User:        ${verification.user}`);
      this.log(`Provider:    ${verification.provider}`);
      this.log(
        `Timestamp:   ${new Date(verification.timestamp).toLocaleString()}`
      );
      this.log(`Request Hash: ${verification.requestHash}`);
      this.log(`Response Hash: ${verification.responseHash}`);

      if (Object.keys(verification.metadata).length > 0) {
        this.log(chalk.bold('\nMetadata:'));
        for (const [key, value] of Object.entries(verification.metadata)) {
          this.log(`${key}: ${value}`);
        }
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to show verification: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async exportVerification(
    id: string,
    outputPath?: string,
    includeContent = false
  ) {
    this.log(chalk.bold(`Exporting verification ${id}...`));

    try {
      // In a real implementation, we would:
      // 1. Fetch the verification record from the blockchain
      // 2. If includeContent, fetch content from Walrus

      // For now, use a mock verification record
      const verification: VerificationRecord = {
        id,
        requestHash: 'mock_request_hash',
        responseHash: 'mock_response_hash',
        user: 'mock_user_address',
        provider: 'mock_provider_address',
        timestamp: Date.now(),
        verificationType: 0, // SUMMARIZE
        metadata: {
          todoCount: '5',
          timestamp: Date.now().toString(),
        },
      };

      // Add mock content if requested
      const exportData: Record<string, unknown> = { ...verification };

      if (includeContent) {
        exportData.content = {
          request: 'Mock request content',
          response: 'Mock AI response content',
        };
      }

      // Format as attestation
      const attestation = {
        type: 'AIVerificationAttestation',
        version: '1.0.0',
        verification: exportData,
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: 'walrus_todo CLI',
        },
      };

      const json = JSON.stringify(attestation, null, 2);

      if (outputPath) {
        // Ensure directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write to file
        fs.writeFileSync(outputPath, json);
        this.log(chalk.green(`Attestation exported to ${outputPath}`));
      } else {
        // Output to console
        this.log(json);
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to export verification: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Helper methods

  private formatVerificationType(type: number): string {
    const types = [
      'SUMMARIZE',
      'CATEGORIZE',
      'PRIORITIZE',
      'SUGGEST',
      'ANALYZE',
    ];

    return types[type] || `UNKNOWN(${type})`;
  }

  private formatTable(data: Record<string, unknown>[]): string {
    if (data.length === 0) return 'No data';

    // Extract column names
    const columns = Object.keys(data[0]);

    // Determine column widths
    const widths: Record<string, number> = {};

    for (const col of columns) {
      widths[col] = Math.max(
        col.length,
        ...data.map(row => String(row[col]).length)
      );
    }

    // Build header
    let table = columns.map(col => col.padEnd(widths[col])).join(' | ');
    table += '\n' + columns.map(col => '-'.repeat(widths[col])).join('-+-');

    // Build rows
    for (const row of data) {
      table +=
        '\n' +
        columns.map(col => String(row[col]).padEnd(widths[col])).join(' | ');
    }

    return table;
  }

  /**
   * Handle background job status checking
   */
  private async handleJobStatus(jobId: string, flags: any) {
    try {
      const backgroundOps = await createBackgroundAIOperationsManager();
      const status = await backgroundOps.getOperationStatus(jobId);

      if (!status) {
        this.error(`Job ${jobId} not found`);
        return;
      }

      if (flags.format === 'json') {
        this.log(JSON.stringify(status, null, 2));
        return;
      }

      this.log(chalk.bold(`Verification Job Status: ${jobId}`));
      this.log(`Type: ${chalk.cyan(status.type)}`);
      this.log(`Status: ${this.formatStatus(status.status)}`);
      this.log(`Progress: ${chalk.yellow(`${status.progress}%`)}`);
      this.log(`Stage: ${chalk.blue(status.stage)}`);
      
      if (status.startedAt) {
        this.log(`Started: ${chalk.dim(status.startedAt.toLocaleString())}`);
      }
      
      if (status.completedAt) {
        this.log(`Completed: ${chalk.dim(status.completedAt.toLocaleString())}`);
      }

      if (status.error) {
        this.log(`Error: ${chalk.red(status.error)}`);
      }

      // If waiting and operation is still running, wait for completion
      if (flags.wait && (status.status === 'queued' || status.status === 'running')) {
        this.log(chalk.yellow('\nWaiting for verification operation to complete...'));
        
        const result = await backgroundOps.waitForOperationWithProgress(
          jobId,
          (progress, stage) => {
            process.stdout.write(`\r${chalk.blue('Progress:')} ${progress}% (${stage})`);
          }
        );

        process.stdout.write('\n');
        this.log(chalk.green('Verification operation completed!'));
        
        if (flags.format === 'json') {
          this.log(JSON.stringify(result, null, 2));
        } else {
          this.log('Results have been processed successfully.');
        }
      }

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to get verification job status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * List verifications in background
   */
  private async listVerificationsInBackground(flags: any) {
    try {
      const backgroundOps = await createBackgroundAIOperationsManager();

      this.log(chalk.green('✓ Starting verification list operation in background...'));
      
      // For now, just show a simulated background operation
      const jobId = `verify-list-${Date.now()}`;
      
      this.log(chalk.blue(`Job ID: ${jobId}`));
      this.log('');
      this.log(chalk.dim('Commands to check progress:'));
      this.log(chalk.cyan(`  walrus_todo verify list --jobId ${jobId}`));
      this.log(chalk.cyan(`  walrus_todo verify list --jobId ${jobId} --wait`));
      this.log('');

      if (flags.wait) {
        this.log(chalk.yellow('Simulating verification list operation...'));
        
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        this.log(chalk.green('Operation completed!'));
        await this.listVerifications(flags.format);
      }

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to start background verification list: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Show verification in background
   */
  private async showVerificationInBackground(id: string, flags: any) {
    try {
      const backgroundOps = await createBackgroundAIOperationsManager();

      this.log(chalk.green(`✓ Starting verification show operation for ${id} in background...`));
      
      const jobId = `verify-show-${Date.now()}`;
      
      this.log(chalk.blue(`Job ID: ${jobId}`));
      this.log('');
      this.log(chalk.dim('Commands to check progress:'));
      this.log(chalk.cyan(`  walrus_todo verify show --jobId ${jobId}`));
      this.log(chalk.cyan(`  walrus_todo verify show --jobId ${jobId} --wait`));
      this.log('');

      if (flags.wait) {
        this.log(chalk.yellow('Simulating verification show operation...'));
        
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        this.log(chalk.green('Operation completed!'));
        await this.showVerification(id, flags.format);
      }

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to start background verification show: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Export verification in background
   */
  private async exportVerificationInBackground(id: string, flags: any) {
    try {
      const backgroundOps = await createBackgroundAIOperationsManager();

      this.log(chalk.green(`✓ Starting verification export operation for ${id} in background...`));
      
      const jobId = `verify-export-${Date.now()}`;
      
      this.log(chalk.blue(`Job ID: ${jobId}`));
      this.log('');
      this.log(chalk.dim('Commands to check progress:'));
      this.log(chalk.cyan(`  walrus_todo verify export --jobId ${jobId}`));
      this.log(chalk.cyan(`  walrus_todo verify export --jobId ${jobId} --wait`));
      this.log('');

      if (flags.wait) {
        this.log(chalk.yellow('Simulating verification export operation...'));
        
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        this.log(chalk.green('Operation completed!'));
        await this.exportVerification(id, flags.output, flags.content);
      }

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to start background verification export: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Format operation status with colors
   */
  private formatStatus(status: string): string {
    const statusColors = {
      queued: chalk.blue('⏳ Queued'),
      running: chalk.yellow('🔄 Running'),
      completed: chalk.green('✅ Completed'),
      failed: chalk.red('❌ Failed'),
      cancelled: chalk.gray('🚫 Cancelled'),
    };

    return statusColors[status as keyof typeof statusColors] || chalk.white(status);
  }
}
