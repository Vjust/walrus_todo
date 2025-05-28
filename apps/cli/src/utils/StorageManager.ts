import { execSync } from 'child_process';
// Using compatibility adapter for SuiClient
import {
  CLIError,
  StorageError,
  BlockchainError,
  ValidationError,
} from '../types/errors/consolidated/index';
import { handleError } from './error-handler';
import { WalrusClientAdapter } from './adapters/walrus-client-adapter';
import { Logger } from './Logger';
import { WalrusClient, WalrusClientExt } from '../types/client';
import { SuiClientType } from './adapters/sui-client-adapter';

interface MoveStruct {
  [key: string]: unknown;
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
  };
}

interface SuiBalanceResponse {
  totalBalance: string;
}

interface SuiSystemState {
  epoch: number;
}

interface SuiOwnedObjectsResponse {
  data: Array<{
    data?: {
      objectId: string;
      content?: SuiParsedData;
    };
  }>;
}

interface StorageObjectFields {
  storage_size: string;
  used_size?: string;
  end_epoch: number;
}

interface StorageUsageSummary {
  id: string;
  totalSize: number;
  usedSize: number;
  endEpoch: number;
}

export class StorageManager {
  private readonly logger = console;
  private readonly MIN_WAL_BALANCE = BigInt(100); // Minimum WAL tokens needed
  private readonly MIN_STORAGE_BUFFER = BigInt(10240); // 10KB minimum buffer
  private readonly DEFAULT_EPOCH_DURATION = 52; // ~6 months
  private readonly MIN_EPOCH_BUFFER = 10; // Minimum remaining epochs

  constructor(
    private suiClient: SuiClientType,
    private walrusClient: WalrusClient | WalrusClientAdapter | WalrusClientExt,
    private address: string,
    private config?: {
      minAllocation?: bigint;
      checkThreshold?: number;
    }
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
      let systemState: unknown;
      if (
        'getLatestSuiSystemState' in this.suiClient &&
        typeof this.suiClient.getLatestSuiSystemState === 'function'
      ) {
        systemState = await this.suiClient.getLatestSuiSystemState();
      }
      if (!systemState || !(systemState as { epoch?: unknown }).epoch) {
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
      const walBalance: SuiBalanceResponse = await this.suiClient.getBalance({
        owner: this.address,
        coinType: 'WAL',
      });

      // Get Storage Fund balance
      const storageFundBalance: SuiBalanceResponse =
        await this.suiClient.getBalance({
          owner: this.address,
          coinType: '0x2::storage::Storage',
        });

      const isStorageFundSufficient =
        BigInt(storageFundBalance.totalBalance) >= this.MIN_WAL_BALANCE;

      if (BigInt(walBalance.totalBalance) < this.MIN_WAL_BALANCE) {
        throw new CLIError(
          `Insufficient WAL tokens. Minimum ${this.MIN_WAL_BALANCE} WAL required, but only ${walBalance.totalBalance} WAL available.`,
          'WALRUS_INSUFFICIENT_TOKENS'
        );
      }

      return {
        walBalance: BigInt(walBalance.totalBalance),
        storageFundBalance: BigInt(storageFundBalance.totalBalance),
        isStorageFundSufficient,
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
      const { storageCost, writeCost, totalCost } =
        await this.walrusClient.storageCost(
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
        epochs: this.DEFAULT_EPOCH_DURATION,
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
      const response: SuiOwnedObjectsResponse =
        await this.suiClient.getOwnedObjects({
          owner: this.address,
          filter: { StructType: '0x2::storage::Storage' },
          options: { showContent: true },
        });

      // Find suitable storage with enough remaining size and epochs
      const suitableStorage = response.data
        .filter(item => {
          const content = item.data?.content;
          if (!content || (content as SuiParsedData).dataType !== 'moveObject')
            return false;

          const moveContent = content as SuiParsedData & {
            fields: StorageObjectFields;
          };
          if (!moveContent.fields) return false;

          const fields = moveContent.fields;
          const remainingSize =
            Number(fields.storage_size) - Number(fields.used_size || 0);
          const remainingEpochs = Number(fields.end_epoch) - currentEpoch;

          return (
            remainingSize >= requiredSize + Number(this.MIN_STORAGE_BUFFER) &&
            remainingEpochs >= this.MIN_EPOCH_BUFFER
          );
        })
        .sort((a, b) => {
          // Sort by remaining size (descending)
          const aContent =
            (a.data?.content as SuiParsedData & {
              fields: Pick<StorageObjectFields, 'storage_size'>;
            }) || undefined;
          const bContent =
            (b.data?.content as SuiParsedData & {
              fields: Pick<StorageObjectFields, 'storage_size'>;
            }) || undefined;
          const aSize = Number(aContent?.fields?.storage_size || 0);
          const bSize = Number(bContent?.fields?.storage_size || 0);
          return bSize - aSize;
        })[0];

      if (!suitableStorage?.data?.content) {
        return { isValid: false, remainingSize: 0, remainingEpochs: 0 };
      }

      const fields = (
        suitableStorage.data.content as SuiParsedData & {
          fields: StorageObjectFields;
        }
      ).fields;
      const remainingSize =
        Number(fields.storage_size) - Number(fields.used_size || 0);
      const remainingEpochs = Number(fields.end_epoch) - currentEpoch;

      return {
        isValid: true,
        remainingSize,
        remainingEpochs,
        details: {
          id: suitableStorage.data.objectId,
          totalSize: Number(fields.storage_size),
          usedSize: Number(fields.used_size || 0),
          endEpoch: Number(fields.end_epoch),
        },
      };
    } catch (error) {
      handleError('Failed to verify existing storage', error);
      return { isValid: false, remainingSize: 0, remainingEpochs: 0 };
    }
  }

  /**
   * Comprehensive storage check including network, balance, and allocation
   */
  async validateStorageRequirements(sizeBytes: number): Promise<{
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
      const systemState: SuiSystemState =
        await this.suiClient.getLatestSuiSystemState();
      const epoch = systemState?.epoch;
      const currentEpoch = Number(epoch);

      // 4. Check existing storage
      const existingStorage = await this.verifyExistingStorage(
        sizeBytes,
        currentEpoch
      );
      if (existingStorage.isValid) {
        return {
          canProceed: true,
          existingStorage,
          balances,
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
        balances,
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
    const balance: SuiBalanceResponse = await this.suiClient.getBalance({
      owner: address,
      coinType: 'WAL',
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
      const response: SuiOwnedObjectsResponse =
        await this.suiClient.getOwnedObjects({
          owner: address,
          filter: { StructType: '0x2::storage::Storage' },
          options: { showContent: true },
        });

      const storageObjects = response.data
        .map(item => {
          const content = item.data?.content as SuiParsedData & {
            fields: StorageObjectFields;
          };
          if (!content?.fields) return null;

          return {
            id: item.data?.objectId || '',
            totalSize: Number(content.fields.storage_size),
            usedSize: Number(content.fields.used_size || 0),
            endEpoch: Number(content.fields.end_epoch),
          };
        })
        .filter((item): item is StorageUsageSummary => item !== null);

      const totalAllocated = storageObjects.reduce(
        (sum: number, obj: StorageUsageSummary) => sum + obj.totalSize,
        0
      );
      const totalUsed = storageObjects.reduce(
        (sum: number, obj: StorageUsageSummary) => sum + obj.usedSize,
        0
      );

      return {
        totalAllocated,
        totalUsed,
        storageObjects,
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
  async storageCost(
    sizeBytes: number,
    epochDuration: number = this.DEFAULT_EPOCH_DURATION
  ): Promise<{
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
      const { storageCost, writeCost, totalCost } =
        await this.walrusClient.storageCost(sizeBytes, epochDuration);

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
          networkFees,
        },
      };
    } catch (error) {
      throw new CLIError(
        `Failed to calculate storage cost: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_COST_CALCULATION_FAILED'
      );
    }
  }

  /**
   * Allocates new storage on Walrus
   * NOTE: This method is currently not used in production code.
   * The actual storage allocation happens through the Walrus CLI integration.
   * This method exists for future direct SDK integration and testing purposes.
   *
   * @param size - Size of storage to allocate
   * @param signer - Transaction signer (unused in current implementation)
   * @returns Mock storage allocation result
   */
  async allocateStorage(
    size: string,
    _signer: unknown
  ): Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    };
  }> {
    // NOTE: This is a mock implementation for testing
    // Real storage allocation happens through Walrus CLI integration
    // See walrus-storage.ts and walrus-storage-cli.ts for actual implementation
    const mockDigest = '0x' + Date.now().toString(16);

    return {
      digest: mockDigest,
      storage: {
        id: { id: mockDigest },
        start_epoch: 1,
        end_epoch: 52,
        storage_size: size,
      },
    };
  }

  /**
   * Ensures sufficient storage is allocated for the given size
   * @param requiredStorage Size of storage needed in bytes (as BigInt)
   * @throws {StorageError} if insufficient storage is available
   * @throws {ValidationError} if balance data is missing or invalid
   * @throws {BlockchainError} if client errors occur
   */
  async ensureStorageAllocated(requiredStorage: bigint): Promise<void> {
    try {
      const walBalance = await this.walrusClient.getWalBalance();
      if (!walBalance) {
        throw new ValidationError('Unable to fetch WAL balance');
      }

      const minAllocation = this.config?.minAllocation || BigInt(1000);
      if (BigInt(walBalance) < minAllocation) {
        throw new StorageError(
          `Insufficient WAL tokens. Minimum ${minAllocation} WAL required, but only ${walBalance} WAL available.`
        );
      }

      const storageUsage = await this.walrusClient.getStorageUsage();
      if (!storageUsage) {
        throw new ValidationError('Unable to fetch storage usage');
      }

      const usedStorage = BigInt(storageUsage.used);
      const totalStorage = BigInt(storageUsage.total);
      const availableStorage = totalStorage - usedStorage;

      if (availableStorage < requiredStorage) {
        throw new StorageError(
          `Insufficient storage. Required: ${requiredStorage}, Available: ${availableStorage}`
        );
      }

      // Check if storage is below threshold
      const checkThreshold = this.config?.checkThreshold || 20;
      const usagePercentage = Number(
        (usedStorage * BigInt(100)) / totalStorage
      );

      if (usagePercentage > 100 - checkThreshold) {
        const logger = Logger.getInstance();
        logger.warn('Storage allocation running low', {
          used: usedStorage.toString(),
          total: totalStorage.toString(),
          usagePercentage,
        });
      }
    } catch (error) {
      if (error instanceof StorageError || error instanceof ValidationError) {
        throw error;
      }

      if ((error as Error).message.includes('balance')) {
        throw new ValidationError(`${(error as Error).message}`);
      }

      throw new BlockchainError(`${(error as Error).message}`);
    }
  }

  /**
   * Calculates the amount of storage required for a file
   * @param sizeBytes File size in bytes
   * @param days Number of days to store
   * @returns Required storage tokens as BigInt
   * @throws {ValidationError} for invalid inputs
   */
  calculateRequiredStorage(sizeBytes: number, days: number): bigint {
    if (sizeBytes <= 0) {
      throw new ValidationError('File size must be greater than zero');
    }

    if (days <= 0) {
      throw new ValidationError('Storage duration must be greater than zero');
    }

    // Basic calculation: 1 WAL per MB per day + safety margin
    const mbSize = sizeBytes / (1024 * 1024);
    const requiredWal = Math.ceil(mbSize * days);

    // Add 1 WAL as safety margin
    return BigInt(requiredWal + 1);
  }

  /**
   * Get current storage allocation status
   * @returns Storage allocation information
   */
  async getStorageAllocation(): Promise<{
    allocated: bigint;
    used: bigint;
    available: bigint;
    minRequired: bigint;
  }> {
    try {
      const storageUsage = await this.walrusClient.getStorageUsage();

      if (!storageUsage) {
        throw new ValidationError('Unable to fetch storage usage');
      }

      const allocated = BigInt(storageUsage.total);
      const used = BigInt(storageUsage.used);
      const available = allocated - used;
      const minRequired = this.config?.minAllocation || BigInt(1000);

      return {
        allocated,
        used,
        available,
        minRequired,
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to get storage allocation: ${(error as Error).message}`
      );
    }
  }
}
