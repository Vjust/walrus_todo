import type {
  SuiObjectResponse,
  SuiTransactionBlockResponse,
  SuiSystemStateSummary,
} from '@mysten/sui/client';
import type { TransactionEffects } from '@mysten/sui/client';

export const createMockSuiObjectResponse = (
  fields: Record<string, unknown>
): SuiObjectResponse =>
  ({
    data: {
      content: {
        dataType: 'moveObject',
        type: 'test::todo_nft::TodoNFT',
        hasPublicTransfer: true,
        fields,
      },
    } as const,
  }) as SuiObjectResponse;

export const createMockTransactionResponse = (
  success: boolean,
  error?: string
): SuiTransactionBlockResponse => {
  const effects: TransactionEffects = {
    messageVersion: 'v1',
    status: { status: success ? 'success' : 'failure', error },
    executedEpoch: '0',
    gasUsed: {
      computationCost: '0',
      storageCost: '0',
      storageRebate: '0',
      nonRefundableStorageFee: '0',
    },
    transactionDigest: 'mock-digest',
    created: success
      ? [
          {
            owner: { AddressOwner: '0xowner' },
            reference: {
              objectId: 'test-nft-id',
              version: '1',
              digest: '0xnft-digest',
            },
          },
        ]
      : [],
    gasObject: {
      owner: { AddressOwner: '0xowner' },
      reference: {
        objectId: '0xgas',
        version: '1',
        digest: '0xgas-digest',
      },
    },
    mutated: [],
    deleted: [],
    unwrapped: [],
    wrapped: [],
    sharedObjects: [],
  };

  return {
    digest: 'test-digest',
    effects,
    events: [],
    checkpoint: null,
    balanceChanges: [],
    confirmedLocalExecution: false,
    timestampMs: null,
    transaction: {
      data: {
        messageVersion: 'v1',
        transaction: {
          kind: 'ProgrammableTransaction',
          inputs: [],
          transactions: [],
        },
        sender: '0xsender',
        gasData: {
          payment: [],
          owner: '0xowner',
          price: '1',
          budget: '1000',
        },
      },
      txSignatures: ['mock-signature'],
    },
  };
};

export const createMockSystemStateResponse = (
  options: { epoch?: string; protocolVersion?: string } = {}
): Partial<SuiSystemStateSummary> => ({
  epoch: options.epoch || '1',
  protocolVersion: options.protocolVersion || '1.0.0',
  systemStateVersion: '1',
  stakingPoolMappingsId: '0x123',
  inactivePoolsId: '0x123',
  inactivePoolsSize: '0',
  validatorCandidatesId: '0x123',
  validatorCandidatesSize: '0',
  validatorLowStakeThreshold: '0',
  validatorVeryLowStakeThreshold: '0',
  validatorLowStakeGracePeriod: '0',
  validatorVeryLowStakeGracePeriod: '0',
  minValidatorJoiningStake: '0',
  validatorReportRecords: [
    ['validator1', ['report1']],
    ['validator2', ['report2']],
  ] as [string, string[]][],
  stakeSubsidyStartEpoch: '0',
  stakeSubsidyDistributionCounter: '0',
  stakeSubsidyBalance: '0',
  stakeSubsidyCurrentDistributionAmount: '0',
  stakeSubsidyPeriodLength: '0',
  stakeSubsidyDecreaseRate: 0,
  totalStake: '1000000',
  activeValidators: [],
  pendingActiveValidatorsId: '0x123',
  pendingActiveValidatorsSize: '0',
  pendingRemovals: [],
  storageFundTotalObjectStorageRebates: '0',
  storageFundNonRefundableBalance: '1000000',
  referenceGasPrice: '1000',
  maxValidatorCount: '100',
  maxValidatorSetSize: '100',
  minValidatorCount: '4',
  atRiskValidators: [],
  safeModeStorageRewards: '0',
  safeModeComputationRewards: '0',
  safeModeStorageRebates: '0',
  safeModeNonRefundableStorageFee: '0',
  epochStartTimestampMs: '1625097600000',
  epochDurationMs: '86400000',
  safeMode: false,
  activeValidatorSetSize: '0',
  validatorSetSize: '0',
  validatorEpochInfoEvents: [],
});
