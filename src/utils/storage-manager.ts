import { SuiClient } from '@mysten/sui/client';
import { WalrusClient } from '@mysten/walrus';
import { CLIError } from '../types/error';
import { execSync } from 'child_process';
import { handleError } from './error-handler';

interface StorageCostEstimate {
  storageCost: bigint;
  writeCost: bigint;
  totalCost: bigint;
  requiredBalance: bigint;
  epochs: number;
}

interface WalrusMoveObject {
  dataType: 'moveObject';
  type: string;
  fields: {
    storage_size: string;
    used_size?: string;
    end_epoch: string;
  };
  hasPublicTransfer: boolean;
}

interface StorageVerification {
  isValid: boolean;
  remainingSize: number;
  remainingEpochs: number;
  details?: {
    id: string;
    totalSize: number;
    usedSize: number;
    endEpoch: number;
  }
}

export class StorageManager {
  private readonly MIN_WAL_BALANCE = BigInt(100); // Minimum WAL tokens needed
  private readonly MIN_STORAGE_BUFFER = BigInt(10240); // 10KB minimum buffer
  private readonly DEFAULT_EPOCH_DURATION = 52; // ~6 months
  private readonly MIN_EPOCH_BUFFER = 10; // Minimum remaining epochs

  constructor(
    private suiClient: SuiClient,
    private walrusClient: WalrusClient,
    private address: string
  ) {}

  /**
   * Verifies the network environment before storage operations
   * @throws {CLIError} if not connected to testnet
   */
  async verifyNetworkEnvironment(): Promise<void> {
    try {
      const envInfo = execSync('sui client active-env').toString().trim();
      if (!envInfo.includes('testnet')) {
        throw new CLIError(
          'Must be connected to testnet environment. Use "sui client switch --env testnet"',
          'WALRUS_WRONG_NETWORK'
        );
      }

      // Verify network connectivity
      const systemState = await this.suiClient.getLatestSuiSystemState();
      if (!systemState?.epoch) {
        throw new CLIError(
          'Failed to verify network state. Check your connection.',
          'WALRUS_NETWORK_ERROR'
        );
      }
    } catch (error) {
      if (error instanceof CLIError) throw error;
      throw new CLIError(
        `Network verification failed: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_NETWORK_ERROR'
      );
    }
  }

  /**
   * Checks both WAL balance and Storage Fund balance
   * @returns Current balances and status
   * @throws {CLIError} if balance check fails
   */
  async checkBalances(): Promise<{
    walBalance: bigint;
    storageFundBalance: bigint;
    isStorageFundSufficient: boolean;
  }> {
    try {
      // Check WAL token balance
      const walBalance = await this.suiClient.getBalance({
        owner: this.address,
        coinType: 'WAL'
      });

      // Get Storage Fund balance
      const storageFundBalance = await this.suiClient.getBalance({
        owner: this.address,
        coinType: '0x2::storage::Storage'
      });

      const isStorageFundSufficient = BigInt(storageFundBalance.totalBalance) >= this.MIN_WAL_BALANCE;

      if (BigInt(walBalance.totalBalance) < this.MIN_WAL_BALANCE) {
        throw new CLIError(
          `Insufficient WAL tokens. Minimum ${this.MIN_WAL_BALANCE} WAL required, but only ${walBalance.totalBalance} WAL available.`,
          'WALRUS_INSUFFICIENT_TOKENS'
        );
      }

      return {
        walBalance: BigInt(walBalance.totalBalance),
        storageFundBalance: BigInt(storageFundBalance.totalBalance),
        isStorageFundSufficient
      };
    } catch (error) {
      if (error instanceof CLIError) throw error;
      throw new CLIError(
        `Failed to check balances: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_BALANCE_CHECK_FAILED'
      );
    }
  }

  /**
   * Estimates storage costs including buffer and epoch requirements
   */
  async estimateStorageCost(sizeBytes: number): Promise<StorageCostEstimate> {
    try {
      // Add buffer to requested size
      const sizeWithBuffer = BigInt(sizeBytes) + this.MIN_STORAGE_BUFFER;
      
      // Calculate costs with default epoch duration
      const { storageCost, writeCost, totalCost } = await this.walrusClient.storageCost(
        Number(sizeWithBuffer),
        this.DEFAULT_EPOCH_DURATION
      );

      // Add 10% buffer to total cost for gas fees and price fluctuations
      const requiredBalance = (BigInt(totalCost) * BigInt(110)) / BigInt(100);

      return {
        storageCost: BigInt(storageCost),
        writeCost: BigInt(writeCost),
        totalCost: BigInt(totalCost),
        requiredBalance,
        epochs: this.DEFAULT_EPOCH_DURATION
      };
    } catch (error) {
      throw new CLIError(
        `Failed to estimate storage cost: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_COST_ESTIMATION_FAILED'
      );
    }
  }

  /**
   * Verifies if existing storage can be reused
   */
  async verifyExistingStorage(
    requiredSize: number,
    currentEpoch: number
  ): Promise<StorageVerification> {
    try {
      const response = await this.suiClient.getOwnedObjects({
        owner: this.address,
        filter: { StructType: '0x2::storage::Storage' },
        options: { showContent: true }
      });

      // Find suitable storage with enough remaining size and epochs
      const suitableStorage = response.data
        .filter(item => {
          const content = item.data?.content as WalrusMoveObject | undefined;
          if (!content || content.dataType !== 'moveObject' || !content.fields) return false;
          const fields = content.fields;

          const remainingSize = Number(fields.storage_size) - Number(fields.used_size || 0);
          const remainingEpochs = Number(fields.end_epoch) - currentEpoch;

          return (
            remainingSize >= (requiredSize + Number(this.MIN_STORAGE_BUFFER)) &&
            remainingEpochs >= this.MIN_EPOCH_BUFFER
          );
        })
        .sort((a, b) => {
          // Sort by remaining size (descending)
          const aContent = a.data?.content as WalrusMoveObject | undefined;
          const bContent = b.data?.content as WalrusMoveObject | undefined;
          const aSize = Number(aContent?.fields?.storage_size || 0);
          const bSize = Number(bContent?.fields?.storage_size || 0);
          return bSize - aSize;
        })[0];

      if (!suitableStorage?.data?.content) {
        return { isValid: false, remainingSize: 0, remainingEpochs: 0 };
      }

      const content = suitableStorage.data.content as WalrusMoveObject;
      if (!content?.fields) {
        return { isValid: false, remainingSize: 0, remainingEpochs: 0 };
      }
      const fields = content.fields;
      const remainingSize = Number(fields.storage_size) - Number(fields.used_size || 0);
      const remainingEpochs = Number(fields.end_epoch) - currentEpoch;

      return {
        isValid: true,
        remainingSize,
        remainingEpochs,
        details: {
          id: suitableStorage.data.objectId,
          totalSize: Number(fields.storage_size),
          usedSize: Number(fields.used_size || 0),
          endEpoch: Number(fields.end_epoch)
        }
      };
    } catch (error) {
      handleError('Failed to verify existing storage', error);
      return { isValid: false, remainingSize: 0, remainingEpochs: 0 };
    }
  }

  /**
   * Comprehensive storage check including network, balance, and allocation
   */
  async validateStorageRequirements(
    sizeBytes: number
  ): Promise<{
    canProceed: boolean;
    existingStorage?: StorageVerification;
    requiredCost?: StorageCostEstimate;
    balances?: {
      walBalance: bigint;
      storageFundBalance: bigint;
    };
  }> {
    try {
      // 1. Verify network environment
      await this.verifyNetworkEnvironment();

      // 2. Check balances
      const balances = await this.checkBalances();

      // 3. Get current epoch
      const { epoch } = await this.suiClient.getLatestSuiSystemState();
      const currentEpoch = Number(epoch);

      // 4. Check existing storage
      const existingStorage = await this.verifyExistingStorage(sizeBytes, currentEpoch);
      if (existingStorage.isValid) {
        return {
          canProceed: true,
          existingStorage,
          balances
        };
      }

      // 5. Estimate new storage cost
      const requiredCost = await this.estimateStorageCost(sizeBytes);

      // 6. Verify sufficient balance for new storage
      const canProceed = balances.walBalance >= requiredCost.requiredBalance;

      return {
        canProceed,
        existingStorage,
        requiredCost,
        balances
      };
    } catch (error) {
      if (error instanceof CLIError) throw error;
      throw new CLIError(
        `Storage validation failed: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_STORAGE_VALIDATION_FAILED'
      );
    }
  }
}