import type { SuiObjectResponse, SuiTransactionBlockResponse } from '@mysten/sui/client';

import { Signer } from '@mysten/sui.js/cryptography';

declare module '@mysten/sui/client' {
  interface SuiClient {
    instanceId: string;
    address: string;
    connect(): Promise<void>;
  }
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
    systemParameters: Record<string, any>;
  }

  interface SuiSystemStateSummary {
    epoch: string;
    protocolVersion: string;
    referenceGasPrice: string;
    totalStake: string;
    storageFund: string;
    activeValidators: any[];
    atRiskValidators: any[];
    pendingActiveValidatorsSize: number;
    pendingRemovals: any[];
    stakingPoolMappingsSize: number;
    inactivePoolsSize: number;
    validatorReportRecords: any[];
    atRiskValidatorSize: number;
    validatorCandidatesSize: number;
    validatorLowStakeThreshold: string;
    validatorLowStakeGracePeriod: string;
    validatorVeryLowStakeThreshold: string;
    validatorVeryLowStakeGracePeriod: string;
    systemStateVersion: string;
    maxValidatorCount: number;
    minValidatorCount: number;
    validatorLowStakeThresholdMetadata: any;
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
    systemParameters: any;
    systemStakeSubsidy: any;
    satInCirculation: string;
    epochDurationMs: number;
  }

  interface SuiTransactionBlockEffects {
    status: { status: string };
    created?: Array<{ reference: { objectId: string } }>;
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
        reference?: {
          objectId?: string;
        };
      }>;
    };
  }
}