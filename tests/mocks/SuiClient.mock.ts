const { jest } = require('@jest/globals');
import type { SuiClient } from '@mysten/sui/client';

/**
 * Mock SuiClient with commonly used methods
 */
export interface MockSuiClient extends jest.Mocked<SuiClient> {
  getLatestSuiSystemState: jest.MockedFunction<() => Promise<any>>;
  getObject: jest.MockedFunction<(input: any) => Promise<any>>;
  executeTransactionBlock: jest.MockedFunction<(input: any) => Promise<any>>;
  signAndExecuteTransactionBlock: jest.MockedFunction<
    (input: any) => Promise<any>
  >;
  dryRunTransactionBlock: jest.MockedFunction<(input: any) => Promise<any>>;
  multiGetObjects: jest.MockedFunction<(input: any) => Promise<any>>;
  getTransactionBlock: jest.MockedFunction<(input: any) => Promise<any>>;
  queryTransactionBlocks: jest.MockedFunction<(input: any) => Promise<any>>;
  getAllBalances: jest.MockedFunction<(input: any) => Promise<any>>;
  getBalance: jest.MockedFunction<(input: any) => Promise<any>>;
  getCoins: jest.MockedFunction<(input: any) => Promise<any>>;
  getReferenceGasPrice: jest.MockedFunction<() => Promise<any>>;
  getValidatorsApy: jest.MockedFunction<() => Promise<any>>;
  getOwnedObjects: jest.MockedFunction<(input: any) => Promise<any>>;
  getRpcApiVersion: jest.MockedFunction<() => Promise<any>>;
  requestSuiFromFaucet: jest.MockedFunction<(input: any) => Promise<any>>;
}

/**
 * Creates a mock SuiClient instance with all common methods mocked
 */
export function createMockSuiClient(): MockSuiClient {
  return {
    getLatestSuiSystemState: jest.fn().mockResolvedValue({
      activeValidators: [],
      safeMode: false,
      epoch: '0',
      referenceGasPrice: '1000',
      protocolVersion: '1',
      systemStateVersion: '1',
      maxValidatorCount: '100',
      minValidatorCount: '4',
      validatorCandidatesSize: '0',
      atRiskValidators: [],
      storageFundTotalObjectStorageRebates: '0',
      storageFundNonRefundableBalance: '1000000',
      stakeSubsidyCurrentDistributionAmount: '0',
      totalStake: '1000000',
    }),
    getObject: jest.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
    executeTransactionBlock: jest.fn().mockResolvedValue({
      digest: 'mock-digest',
      confirmedLocalExecution: true,
      effects: {
        status: { status: 'success' },
        gasUsed: {
          computationCost: '1000',
          storageCost: '2000',
          storageRebate: '500',
        },
      },
    }),
    signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({
      digest: 'mock-digest',
      confirmedLocalExecution: true,
      effects: {
        status: { status: 'success' },
        gasUsed: {
          computationCost: '1000',
          storageCost: '2000',
          storageRebate: '500',
        },
      },
    }),
    dryRunTransactionBlock: jest.fn().mockResolvedValue({
      effects: {
        status: { status: 'success' },
        gasUsed: {
          computationCost: '1000',
          storageCost: '2000',
          storageRebate: '500',
        },
      },
    }),
    multiGetObjects: jest.fn().mockResolvedValue([]),
    getTransactionBlock: jest.fn().mockResolvedValue({
      digest: 'mock-digest',
      transaction: {},
      effects: {
        status: { status: 'success' },
      },
    }),
    queryTransactionBlocks: jest.fn().mockResolvedValue({
      data: [],
      hasNextPage: false,
    }),
    getAllBalances: jest.fn().mockResolvedValue([]),
    getBalance: jest.fn().mockResolvedValue({
      coinType: '0x2::sui::SUI',
      coinObjectCount: 1,
      totalBalance: '1000000',
    }),
    getCoins: jest.fn().mockResolvedValue({
      data: [],
      hasNextPage: false,
    }),
    getReferenceGasPrice: jest.fn().mockResolvedValue('1000'),
    getValidatorsApy: jest.fn().mockResolvedValue({
      apys: [],
      epoch: '0',
    }),
    getOwnedObjects: jest.fn().mockResolvedValue({
      data: [],
      hasNextPage: false,
    }),
    getRpcApiVersion: jest.fn().mockResolvedValue('1.0.0'),
    requestSuiFromFaucet: jest.fn().mockResolvedValue({}),
  } as MockSuiClient;
}

/**
 * Creates a SuiClient class mock for jest.MockedClass usage
 */
export function createSuiClientClassMock() {
  const MockSuiClientClass = jest
    .fn()
    .mockImplementation(() => createMockSuiClient()) as jest.MockedClass<
    typeof SuiClient
  >;

  // Add prototype methods for cases where tests access methods via prototype
  const mockInstance = createMockSuiClient();
  MockSuiClientClass.prototype = mockInstance;

  return MockSuiClientClass;
}

/**
 * Global SuiClient mock that can be imported
 */
export const mockSuiClient = createMockSuiClient();
export const MockSuiClientClass = createSuiClientClassMock();
