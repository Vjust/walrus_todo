// Mock BCS implementation
export const BCS = {
  // Basic types
  string: jest.fn().mockReturnValue({
    serialize: jest.fn().mockReturnValue(new Uint8Array())
  }),
  vector: jest.fn().mockReturnValue({
    serialize: jest.fn().mockReturnValue(new Uint8Array())
  }),
  u8: jest.fn(),
  bool: jest.fn().mockReturnValue({
    serialize: jest.fn().mockReturnValue(new Uint8Array())
  })
};