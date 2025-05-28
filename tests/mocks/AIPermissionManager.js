const { jest } = require('@jest/globals');

// Mock Permission Manager
const mockPermissionManager = {
  checkPermission: jest.fn().mockReturnValue(true),
  verifyOperationPermission: jest.fn().mockResolvedValue(true),
};

// Mock initializePermissionManager
const mockInitializePermissionManager = jest
  .fn()
  .mockReturnValue(mockPermissionManager);

module.exports = {
  initializePermissionManager: mockInitializePermissionManager,
  getPermissionManager: jest.fn().mockReturnValue(mockPermissionManager),
  AIPermissionManager: jest
    .fn()
    .mockImplementation(() => mockPermissionManager),
  default: mockInitializePermissionManager,
};
