/**
 * Quick test to verify the complete WalrusClient mock has all required methods
 */

import { getMockWalrusClient } from './src/__tests__/helpers/complete-walrus-client-mock';

describe('Complete WalrusClient Mock', () => {
  it('should have all required methods including connect', () => {
    const mockClient = getMockWalrusClient();
    
    // Test that all commonly used methods exist
    expect(mockClient.connect).toBeDefined();
    expect(mockClient.getConfig).toBeDefined();
    expect(mockClient.getWalBalance).toBeDefined();
    expect(mockClient.getStorageUsage).toBeDefined();
    expect(mockClient.getBlobInfo).toBeDefined();
    expect(mockClient.getBlobObject).toBeDefined();
    expect(mockClient.verifyPoA).toBeDefined();
    expect(mockClient.readBlob).toBeDefined();
    expect(mockClient.getBlobMetadata).toBeDefined();
    expect(mockClient.writeBlob).toBeDefined();
    expect(mockClient.storageCost).toBeDefined();
    expect(mockClient.getBlobSize).toBeDefined();
    expect(mockClient.getStorageProviders).toBeDefined();
    expect(mockClient.reset).toBeDefined();
    
    // Test that they are all Jest mock functions
    expect(jest.isMockFunction(mockClient.connect)).toBe(true);
    expect(jest.isMockFunction(mockClient.getConfig)).toBe(true);
    expect(jest.isMockFunction(mockClient.getWalBalance)).toBe(true);
  });

  it('should have default implementations that return sensible values', async () => {
    const mockClient = getMockWalrusClient();
    
    // Test that connect resolves without error
    await expect(mockClient.connect()).resolves.toBeUndefined();
    
    // Test that getConfig returns the expected structure
    const config = await mockClient.getConfig();
    expect(config).toHaveProperty('network');
    expect(config).toHaveProperty('version');
    expect(config).toHaveProperty('maxSize');
    
    // Test that other methods work
    const balance = await mockClient.getWalBalance();
    expect(typeof balance).toBe('string');
    
    const usage = await mockClient.getStorageUsage();
    expect(usage).toHaveProperty('used');
    expect(usage).toHaveProperty('total');
  });
});