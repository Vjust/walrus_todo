export const getFullnodeUrl = (network) => {
  return `https://${network}.sui.io:443`;
};

export const SuiClient = jest.fn().mockImplementation(() => ({
  getObject: jest.fn(),
  multiGetObjects: jest.fn(),
  executeTransactionBlock: jest.fn(),
  dryRunTransactionBlock: jest.fn(),
}));

export const Transaction = jest.fn().mockImplementation(() => ({
  moveCall: jest.fn(),
  transferObjects: jest.fn(),
  setGasBudget: jest.fn(),
}));