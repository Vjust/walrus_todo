import { Flags, Args } from '@oclif/core';
import BaseCommand from '../base-command';
import { AIVerifierAdapter, VerificationRecord } from '../types/adapters/AIVerifierAdapter';
import chalk from 'chalk';
import { TransactionBlock } from '@mysten/sui/transactions';
import * as fs from 'fs';
import * as path from 'path';
import { configService } from '../services/config-service';

export default class Verify extends BaseCommand {
  static description = 'Manage blockchain verifications for AI operations';
  
  static flags = {
    ...BaseCommand.flags,
    
    format: Flags.string({
      description: 'Output format (table, json)',
      default: 'table',
      options: ['table', 'json']
    }),
    
    output: Flags.string({
      description: 'Output file path for export action',
      char: 'o'
    }),
    
    content: Flags.boolean({
      description: 'Include content in export (if available)',
      default: false
    })
  };
  
  static args = {
    action: Args.string({
      name: 'action',
      description: 'Action to perform (list, show, export)',
      required: true,
      options: ['list', 'show', 'export']
    }),
    id: Args.string({
      name: 'id',
      description: 'Verification ID (required for show and export)',
      required: false
    })
  };
  
  private verifierAdapter!: AIVerifierAdapter;
  private configService = configService;

  async init() {
    await super.init();

    // Initialize the verifier adapter
    const config = await this.configService.getConfig();
    const packageId = config.packageId || '';
    const registryId = config.registryId || '';
    
    // This would be properly initialized in a real implementation
    this.verifierAdapter = {} as AIVerifierAdapter;
  }
  
  async run() {
    const { args, flags } = await this.parse(Verify);
    
    switch (args.action) {
      case 'list':
        await this.listVerifications(flags.format);
        break;
        
      case 'show':
        if (!args.id) {
          this.error('Verification ID is required for show action');
        }
        await this.showVerification(args.id, flags.format);
        break;
        
      case 'export':
        if (!args.id) {
          this.error('Verification ID is required for export action');
        }
        await this.exportVerification(args.id, flags.output, flags.content);
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
        provider: v.provider.slice(0, 8) + '...'
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
          timestamp: Date.now().toString()
        }
      };
      
      if (format === 'json') {
        this.log(JSON.stringify(verification, null, 2));
        return;
      }
      
      // Table format (default)
      this.log(chalk.bold('Verification Details:'));
      this.log(`ID:          ${verification.id}`);
      this.log(`Type:        ${this.formatVerificationType(verification.verificationType)}`);
      this.log(`User:        ${verification.user}`);
      this.log(`Provider:    ${verification.provider}`);
      this.log(`Timestamp:   ${new Date(verification.timestamp).toLocaleString()}`);
      this.log(`Request Hash: ${verification.requestHash}`);
      this.log(`Response Hash: ${verification.responseHash}`);
      
      if (Object.keys(verification.metadata).length > 0) {
        this.log(chalk.bold('\nMetadata:'));
        for (const [key, value] of Object.entries(verification.metadata)) {
          this.log(`${key}: ${value}`);
        }
      }
      
    } catch (error) {
      this.error(`Failed to show verification: ${error}`);
    }
  }
  
  private async exportVerification(id: string, outputPath?: string, includeContent = false) {
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
          timestamp: Date.now().toString()
        }
      };
      
      // Add mock content if requested
      const exportData: any = { ...verification };
      
      if (includeContent) {
        exportData.content = {
          request: 'Mock request content',
          response: 'Mock AI response content'
        };
      }
      
      // Format as attestation
      const attestation = {
        type: 'AIVerificationAttestation',
        version: '1.0.0',
        verification: exportData,
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: 'walrus_todo CLI'
        }
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
      this.error(`Failed to export verification: ${error}`);
    }
  }
  
  // Helper methods
  
  private formatVerificationType(type: number): string {
    const types = [
      'SUMMARIZE',
      'CATEGORIZE',
      'PRIORITIZE',
      'SUGGEST',
      'ANALYZE'
    ];
    
    return types[type] || `UNKNOWN(${type})`;
  }
  
  private formatTable(data: Record<string, any>[]): string {
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
      table += '\n' + columns.map(col => 
        String(row[col]).padEnd(widths[col])
      ).join(' | ');
    }
    
    return table;
  }
}