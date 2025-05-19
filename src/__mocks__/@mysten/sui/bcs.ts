// Mock BCS implementation
// In the actual code, the import is 'import { bcs } from '@mysten/sui/bcs'
// rather than capitalizing BCS

// Create a more complete serializer mock
const createSerializer = () => ({
  serialize: jest.fn().mockReturnValue(new Uint8Array()),
  deserialize: jest.fn().mockReturnValue(null)
});

// Create a mock for BCS class
export const BCS = {
  // Basic types
  string: jest.fn().mockReturnValue(createSerializer()),
  vector: jest.fn().mockReturnValue(createSerializer()),
  u8: jest.fn().mockReturnValue(createSerializer()),
  u16: jest.fn().mockReturnValue(createSerializer()),
  u32: jest.fn().mockReturnValue(createSerializer()),
  u64: jest.fn().mockReturnValue(createSerializer()),
  u128: jest.fn().mockReturnValue(createSerializer()),
  u256: jest.fn().mockReturnValue(createSerializer()),
  bool: jest.fn().mockReturnValue(createSerializer()),
  address: jest.fn().mockReturnValue(createSerializer()),
  
  // Compound types
  struct: jest.fn().mockReturnValue(createSerializer()),
  option: jest.fn().mockReturnValue(createSerializer()),
  
  // Additional methods from BCS
  registerStructType: jest.fn(),
  registerAddressType: jest.fn(),
  ser: jest.fn().mockReturnValue(new Uint8Array()),
  de: jest.fn().mockReturnValue({}),
};

// Export bcs object as it's imported in the codebase
export const bcs = {
  // Basic types
  string: jest.fn().mockReturnValue(createSerializer()),
  vector: jest.fn().mockReturnValue(createSerializer()),
  u8: jest.fn().mockReturnValue(createSerializer()),
  u16: jest.fn().mockReturnValue(createSerializer()),
  u32: jest.fn().mockReturnValue(createSerializer()),
  u64: jest.fn().mockReturnValue(createSerializer()),
  u128: jest.fn().mockReturnValue(createSerializer()),
  u256: jest.fn().mockReturnValue(createSerializer()),
  bool: jest.fn().mockReturnValue(createSerializer()),
  address: jest.fn().mockReturnValue(createSerializer()),
  
  // Compound types
  struct: jest.fn().mockReturnValue(createSerializer()),
  option: jest.fn().mockReturnValue(createSerializer()),
  
  // Additional methods from BCS
  registerStructType: jest.fn(),
  registerAddressType: jest.fn(),
  ser: jest.fn().mockReturnValue(new Uint8Array()),
  de: jest.fn().mockReturnValue({}),
};