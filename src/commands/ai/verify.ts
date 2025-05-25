import { Args, Flags } from '@oclif/core';
import BaseCommand from '../../base-command';
import { AIVerificationService } from '../../services/ai/AIVerificationService';
import { TodoAIAdapter } from '../../types/adapters/TodoAIAdapter';
import { SuiClient } from '../../utils/adapters/sui-client-adapter';
import { AIProvider, TodoAIOperation } from '../../services/ai/types';
import chalk from 'chalk';
import { getAIVerifierAddress } from '../../services/ai/credentials/module-address';

export default class Verify extends BaseCommand {
  static description =
    'Check and verify AI operation results on blockchain for integrity and authenticity';

  static flags = {
    ...BaseCommand.flags,
    id: Flags.string({
      char: 'i',
      description: 'Verification ID to check',
      required: false,
    }),
    todo: Flags.string({
      char: 't',
      description: 'Todo ID to check verifications for',
      required: false,
    }),
    operation: Flags.string({
      char: 'o',
      description: 'AI operation to verify',
      required: false,
      options: [
        'summarize',
        'categorize',
        'prioritize',
        'suggest',
        'analyze',
        'group',
        'schedule',
        'detect_dependencies',
        'estimate_effort',
      ],
    }),
    provider: Flags.string({
      char: 'p',
      description: 'AI provider to use',
      required: false,
      options: ['xai', 'openai', 'anthropic', 'custom'],
    }),
  };

  static args = {
    action: Args.string({
      name: 'action',
      description: 'Action to perform (check, list, verify)',
      required: true,
      options: ['check', 'list', 'verify'],
    }),
  };

  static examples = [
    '<%= config.bin %> ai verify check --id VERIFICATION_ID                   # Check verification',
    '<%= config.bin %> ai verify list --todo TODO_ID                         # List verifications',
    '<%= config.bin %> ai verify verify --todo TODO_ID --operation summarize  # Verify operation',
    '<%= config.bin %> ai verify list --all                                  # List all verifications',
    '<%= config.bin %> ai verify check --id abc123 --detailed                # Detailed check',
    '<%= config.bin %> ai verify verify --todo task-789 --operation categorize --blockchain',
  ];

  private verificationService: AIVerificationService;
  private todoAIAdapter: TodoAIAdapter;

  async run() {
    const { args, flags } = await this.parse(Verify);

    // Initialize services
    this.verificationService = new AIVerificationService();

    // Initialize SUI client
    const client = new SuiClient({
      url: process.env.SUI_RPC_URL || 'https://fullnode.devnet.sui.io:443',
    });

    // Module addresses would typically come from configuration
    const aiVerifierAddress = getAIVerifierAddress();
    const todoAIModuleAddress = getAIVerifierAddress(); // Usually this would be different
    const todoAIRegistry =
      process.env.TODO_AI_REGISTRY ||
      '0x0000000000000000000000000000000000000000000000000000000000000123';
    const verificationRegistry =
      process.env.VERIFICATION_REGISTRY ||
      '0x0000000000000000000000000000000000000000000000000000000000000456';

    // Initialize the adapter
    this.todoAIAdapter = new TodoAIAdapter(
      client,
      todoAIModuleAddress,
      aiVerifierAddress,
      todoAIRegistry,
      verificationRegistry
    );

    const action = args.action as 'check' | 'list' | 'verify';

    switch (action) {
      case 'check':
        await this.checkVerification(flags.id);
        break;
      case 'list':
        await this.listVerifications(flags.todo);
        break;
      case 'verify':
        await this.verifyTodoOperation(
          flags.todo,
          flags.operation as TodoAIOperation,
          flags.provider as AIProvider
        );
        break;
      default:
        this.error(`Unknown action: ${action}`);
    }
  }

  private async checkVerification(verificationId?: string) {
    // Validate ID
    if (!verificationId) {
      this.error('Verification ID is required');
    }

    try {
      const isValid =
        await this.verificationService.verifyExistingOperation(verificationId);

      if (isValid) {
        this.log(
          `${chalk.green('\u2713')} Verification ${chalk.cyan(verificationId)} is valid`
        );
        this.log('This AI operation has been verified on the blockchain.');
      } else {
        this.log(
          `${chalk.red('\u2717')} Verification ${chalk.cyan(verificationId)} is invalid or not found`
        );
        this.log('This verification ID does not exist on the blockchain.');
      }
    } catch (error) {
      this.error(error.message);
    }
  }

  private async listVerifications(todoId?: string) {
    // Validate todo ID
    if (!todoId) {
      this.error('Todo ID is required');
    }

    try {
      const verifications =
        await this.todoAIAdapter.getVerificationsForTodo(todoId);

      if (verifications.length === 0) {
        this.log(
          `${chalk.yellow('\u26a0')} No verifications found for todo ${chalk.cyan(todoId)}`
        );
        return;
      }

      this.log(`Verifications for todo ${chalk.cyan(todoId)}:`);

      for (const verificationId of verifications) {
        const isValid =
          await this.verificationService.verifyExistingOperation(
            verificationId
          );
        const status = isValid
          ? chalk.green('\u2713 valid')
          : chalk.red('\u2717 invalid');

        this.log(`  ${chalk.cyan(verificationId)}: ${status}`);
      }
    } catch (error) {
      this.error(error.message);
    }
  }

  private async verifyTodoOperation(
    todoId?: string,
    operation?: TodoAIOperation,
    provider?: AIProvider
  ) {
    // Validate inputs
    if (!todoId) {
      this.error('Todo ID is required');
    }

    if (!operation) {
      this.error('Operation is required');
    }

    try {
      const isValid = await this.todoAIAdapter.verifyTodoOperation(
        todoId,
        operation
      );

      if (isValid) {
        this.log(
          `${chalk.green('\u2713')} Todo ${chalk.cyan(todoId)} has a verified ${chalk.cyan(operation)} operation`
        );
      } else {
        this.log(
          `${chalk.red('\u2717')} Todo ${chalk.cyan(todoId)} does not have a verified ${chalk.cyan(operation)} operation`
        );

        if (provider) {
          this.log(
            `You can create a verification with: ${chalk.cyan(`walrus_todo ai ${operation} ${todoId} --verify --provider ${provider}`)}`
          );
        } else {
          this.log(
            `You can create a verification with: ${chalk.cyan(`walrus_todo ai ${operation} ${todoId} --verify`)}`
          );
        }
      }
    } catch (error) {
      this.error(error.message);
    }
  }
}
