// SuiClient Compatibility Adapter
// Provides a unified SuiClient interface across different SDK versions

let SuiClientImpl: any;
let getFullnodeUrlImpl: any;

try {
  // Try the correct import path that we verified works
  const suiClient = require('@mysten/sui/client');
  SuiClientImpl = suiClient.SuiClient;
  getFullnodeUrlImpl = suiClient.getFullnodeUrl;
} catch (error) {
  console.warn('Failed to import from @mysten/sui/client, using fallback');
  // Fallback to mock implementation
  SuiClientImpl = class MockSuiClient {
    constructor(_options: any) {
      console.warn('Using mock SuiClient');
    }
  };
  getFullnodeUrlImpl = (network: string) => `https://${network}.sui.io:443`;
}

// Re-export with compatibility wrapper
export const SuiClient = SuiClientImpl;
export const getFullnodeUrl = getFullnodeUrlImpl;

// Create factory function for compatibility
export function createSuiClient(options: any) {
  return new SuiClient(options);
}

// Export commonly needed types
export type SuiClientType = InstanceType<typeof SuiClient>;