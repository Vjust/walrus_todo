// Type augmentations for @mysten/sui/client
// This file augments existing types without overriding exports

declare module '@mysten/sui/client' {
  interface SuiObjectResponse {
    data?: {
      content?: {
        dataType?: string;
        type?: string;
        fields?: {
          objectId?: string;
          title?: string;
          description?: string;
          completed?: boolean;
          walrusBlobId?: string;
          walrus_blob_id?: string;
        };
      };
    };
  }

  interface SuiSystemStateResponse {
    epoch: string;
    protocolVersion: string;
    systemParameters: Record<string, unknown>;
  }

  interface SuiSystemStateSummary {
    epoch: string;
    protocolVersion: string;
    referenceGasPrice: string;
    totalStake: string;
    storageFund: string;
    activeValidators: unknown[];
    atRiskValidators: unknown[];
    pendingActiveValidatorsSize: number;
    pendingRemovals: unknown[];
    stakingPoolMappingsSize: number;
    inactivePoolsSize: number;
    validatorReportRecords: unknown[];
    atRiskValidatorSize: number;
    validatorCandidatesSize: number;
    validatorLowStakeThreshold: string;
    validatorLowStakeGracePeriod: string;
    validatorVeryLowStakeThreshold: string;
    validatorVeryLowStakeGracePeriod: string;
    systemStateVersion: string;
    maxValidatorCount: number;
    minValidatorCount: number;
    validatorLowStakeThresholdMetadata: unknown;
    stakeSubsidyStartEpoch: string;
    stakeSubsidyBalance: string;
    stakeSubsidyDistributionCounter: string;
    stakeSubsidyCurrentDistributionAmount: string;
    stakeSubsidyPeriodLength: string;
    stakeSubsidyDecreaseRate: string;
    totalGasFeesCollected: string;
    totalStakeRewardsDistributed: string;
    totalStakeSubsidiesDistributed: string;
    validatorReportRecordsSize: number;
    systemParameters: unknown;
    systemStakeSubsidy: unknown;
    satInCirculation: string;
    epochDurationMs: number;
  }

  interface SuiTransactionBlockEffects {
    status: { status: string };
    created?: Array<{
      owner?: { AddressOwner?: string };
      reference: {
        objectId: string;
        digest: string;
        version: string;
      };
    }>;
    gasUsed?: { computationCost: string; storageCost: string };
  }

  interface SuiTransactionBlockResponse {
    digest: string;
    transaction?: {
      data?: {
        sender?: string;
      };
    };
    effects?: {
      status?: {
        status?: string;
      };
      created?: Array<{
        owner?: { AddressOwner?: string };
        reference: {
          objectId: string;
          digest: string;
          version: string;
        };
      }>;
    };
  }
}
