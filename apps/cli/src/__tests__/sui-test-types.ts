import type {
  SuiObjectResponse,
  SuiTransactionBlockResponse,
  SuiSystemStateSummary,
} from '@mysten/sui/client';

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
    } as NonNullable<SuiObjectResponse['data']>,
  }) as SuiObjectResponse;

export const createMockTransactionResponse = (
  success: boolean,
  error?: string
): SuiTransactionBlockResponse => {
  const effects = {
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
    modifiedAtVersions: [],
    dependencies: [],
  };

  return {
    digest: 'test-digest',
    effects,
    checkpoint: null,
    transaction: {
      data: {
        sender: '0xsender',
      },
    },
  } as Partial<SuiTransactionBlockResponse> as SuiTransactionBlockResponse;
};

// Cast to SuiSystemStateSummary since we can't match the exact shape
export const createMockSystemStateResponse = (
  options: { epoch?: string | number; protocolVersion?: string } = {}
): SuiSystemStateSummary =>
  ({
    // Required fields
    epoch:
      typeof options.epoch === 'number'
        ? String(options.epoch)
        : options.epoch || '1',
    protocolVersion: options.protocolVersion || '1.0.0',
    systemStateVersion: '1',

    // Common properties
    stakingPoolMappingsId: '0x123',
    inactivePoolsId: '0x123',
    inactivePoolsSize: '0',
    validatorCandidatesId: '0x123',
    validatorCandidatesSize: '0',
    validatorLowStakeThreshold: '0',
    validatorVeryLowStakeThreshold: '0',
    validatorLowStakeGracePeriod: '0',
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
    stakeSubsidyDecreaseRate: '0',
    totalStake: '1000000',
    activeValidators: [
      {
        suiAddress: '0x1',
        protocolPubkeyBytes: '0x01',
        networkPubkeyBytes: '0x01',
        workerPubkeyBytes: '0x01',
        proofOfPossessionBytes: '0x01',
        name: 'validator1',
        description: 'Test validator 1',
        imageUrl: 'https://example.com/image.png',
        projectUrl: 'https://example.com',
        p2pAddress: '127.0.0.1:1234',
        netAddress: '127.0.0.1:1235',
        primaryAddress: '127.0.0.1:1236',
        workerAddress: '127.0.0.1:1237',
        nextEpochProtocolPubkeyBytes: null,
        nextEpochProofOfPossession: null,
        nextEpochNetworkPubkeyBytes: null,
        nextEpochWorkerPubkeyBytes: null,
        nextEpochNetAddress: null,
        nextEpochP2pAddress: null,
        nextEpochPrimaryAddress: null,
        nextEpochWorkerAddress: null,
        votingPower: '100',
        operationCapId: '0x123',
        gasPrice: '100',
        commissionRate: '100',
        nextEpochStake: '0',
        nextEpochGasPrice: '0',
        nextEpochCommissionRate: '0',
        pendingStake: '0',
        pendingTotalSuiWithdraw: '0',
        pendingPoolTokenWithdraw: '0',
        stakingPoolId: '0x123',
        stakingPoolActivationEpoch: '0',
        stakingPoolDeactivationEpoch: null,
        stakingPoolSuiBalance: '1000',
        rewardsPool: '0',
        poolTokenBalance: '0',
        exchangeRatesId: '0x123',
        exchangeRatesSize: '0',
      },
    ],
    pendingActiveValidatorsId: '0x123',
    pendingActiveValidatorsSize: '0',
    pendingRemovals: [],
    storageFundTotalObjectStorageRebates: '0',
    storageFundNonRefundableBalance: '1000000',
    referenceGasPrice: '1000',
    maxValidatorCount: '100',
    atRiskValidators: [],
    safeModeStorageRewards: '0',
    safeModeComputationRewards: '0',
    safeModeStorageRebates: '0',
    safeModeNonRefundableStorageFee: '0',
    epochStartTimestampMs: '1625097600000',
    epochDurationMs: '86400000',
    safeMode: false,

    // Additional required properties
    stakingPoolMappingsSize: '0',
    storageFund: {
      totalObjectStorageRebates: '0',
      nonRefundableBalance: '1000000',
    },
    atRiskValidatorSize: '0',
    validatorVeryLowStakeGracePeriod: '0',
    minValidatorCount: '4',
    maxValidatorSetSize: '100',
    validatorSetSize: '1',
    activeValidatorSetSize: '1',
    validatorEpochInfoEvents: [],

    // Force cast for compatibility
  }) as unknown as SuiSystemStateSummary;
