import { SuiClient } from '@mysten/sui.js/client';
import { WalrusClient } from '@mysten/walrus';
import { CLIError } from '../types/error';
import { execSync } from 'child_process';
import { handleError } from './error-handler';

interface MoveStruct {
  [key: string]: any;
}

interface SuiParsedData {
  dataType: 'moveObject' | 'package';
  fields?: MoveStruct;
  disassembled?: { [key: string]: unknown };
  type?: string;
  hasPublicTransfer?: boolean;
}

interface StorageCostEstimate {
  storageCost: bigint;
  writeCost: bigint;
  totalCost: bigint;
  requiredBalance: bigint;
  epochs: number;
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
  private readonly logger = console;
  // @ts-ignore - BigInt literals are not available when targeting lower than ES2020
  private readonly MIN_WAL_BALANCE = BigInt(100); // Minimum WAL tokens needed
  // @ts-ignore - BigInt literals are not available when targeting lower than ES2020
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
          const content = item.data?.content;
          if (!content || (content as SuiParsedData).dataType !== 'moveObject') return false;

          const moveContent = content as SuiParsedData & { fields: { storage_size: string; used_size?: string; end_epoch: number } };
          if (!moveContent.fields) return false;

          const fields = moveContent.fields;
          const remainingSize = Number(fields.storage_size) - Number(fields.used_size || 0);
          const remainingEpochs = Number(fields.end_epoch) - currentEpoch;

          return (
            remainingSize >= (requiredSize + Number(this.MIN_STORAGE_BUFFER)) &&
            remainingEpochs >= this.MIN_EPOCH_BUFFER
          );
        })
        .sort((a, b) => {
          // Sort by remaining size (descending)
          const aContent = (a.data?.content as SuiParsedData & { fields: { storage_size: string } }) || undefined;
          const bContent = (b.data?.content as SuiParsedData & { fields: { storage_size: string } }) || undefined;
          const aSize = Number(aContent?.fields?.storage_size || 0);
          const bSize = Number(bContent?.fields?.storage_size || 0);
          return bSize - aSize;
        })[0];

      if (!suitableStorage?.data?.content) {
        return { isValid: false, remainingSize: 0, remainingEpochs: 0 };
      }

      const fields = (suitableStorage.data.content as SuiParsedData & { fields: { storage_size: string; used_size?: string; end_epoch: number } }).fields;
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

  async getSuiBalance(address: string): Promise<string> {
    const balance = await this.suiClient.getBalance({
      owner: address,
      coinType: 'WAL'
    });
    return balance.totalBalance;
  }

  /**
   * Get current storage usage for an address
   */
  async getStorageUsage(address: string): Promise<{
    totalAllocated: number;
    totalUsed: number;
    storageObjects: Array<{
      id: string;
      totalSize: number;
      usedSize: number;
      endEpoch: number;
    }>;
  }> {
    try {
      const response = await this.suiClient.getOwnedObjects({
        owner: address,
        filter: { StructType: '0x2::storage::Storage' },
        options: { showContent: true }
      });

      const storageObjects = response.data
        .map(item => {
          const content = item.data?.content as SuiParsedData & {
            fields: { storage_size: string; used_size?: string; end_epoch: number }
          };
          if (!content?.fields) return null;

          return {
            id: item.data?.objectId || '',
            totalSize: Number(content.fields.storage_size),
            usedSize: Number(content.fields.used_size || 0),
            endEpoch: Number(content.fields.end_epoch)
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const totalAllocated = storageObjects.reduce((sum, obj) => sum + obj.totalSize, 0);
      const totalUsed = storageObjects.reduce((sum, obj) => sum + obj.usedSize, 0);

      return {
        totalAllocated,
        totalUsed,
        storageObjects
      };
    } catch (error) {
      throw new CLIError(
        `Failed to get storage usage: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_STORAGE_QUERY_FAILED'
      );
    }
  }

  /**
   * Get storage cost estimate for the given size and duration
   */
  async storageCost(sizeBytes: number, epochDuration: number = this.DEFAULT_EPOCH_DURATION): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint;
    breakdown: {
      baseStorageCost: bigint;
      epochMultiplier: number;
      writeOperationCost: bigint;
      networkFees: bigint;
    };
  }> {
    try {
      const { storageCost, writeCost, totalCost } = await this.walrusClient.storageCost(
        sizeBytes,
        epochDuration
      );

      // Calculate cost breakdown
      const baseStorageCost = BigInt(storageCost);
      const writeOperationCost = BigInt(writeCost);
      const networkFees = (BigInt(totalCost) * BigInt(10)) / BigInt(100); // 10% for network fees

      return {
        storageCost: BigInt(storageCost),
        writeCost: BigInt(writeCost),
        totalCost: BigInt(totalCost),
        breakdown: {
          baseStorageCost,
          epochMultiplier: epochDuration,
          writeOperationCost,
          networkFees
        }
      };
    } catch (error) {
      throw new CLIError(
        `Failed to calculate storage cost: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_COST_CALCULATION_FAILED'
      );
    }
  }

  async allocateStorage(size: string, signer: any): Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    };
  }> {
    const tx = await this.suiClient.getTransactionBlock({
      digest: '0x123', // TODO: Implement actual allocation
      options: { showEffects: true }
    });

    return {
      digest: tx.digest,
      storage: {
        id: { id: '0x123' },
        start_epoch: 1,
        end_epoch: 52,
        storage_size: size
      }
    };
  }
}