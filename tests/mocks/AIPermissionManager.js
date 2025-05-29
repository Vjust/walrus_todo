// Mock Permission Manager
const mockPermissionManager = {
  checkPermission: jest.fn().mockImplementation((action, context = {}) => {
    const { user = 'test-user', permissionLevel = 'STANDARD' } = context;
    
    // Simulate permission levels
    const permissions = {
      'ADMIN': ['summarize', 'categorize', 'analyze', 'delete', 'modify_permissions'],
      'STANDARD': ['summarize', 'categorize', 'analyze'],
      'READ_ONLY': ['summarize'],
    };
    
    const allowedActions = permissions[permissionLevel] || [];
    return allowedActions.includes(action);
  }),
  
  verifyOperationPermission: jest.fn().mockImplementation(async (operation, context = {}) => {
    const hasPermission = mockPermissionManager.checkPermission(operation.type, context);
    if (!hasPermission) {
      throw new Error(`Permission denied for operation: ${operation.type}`);
    }
    return true;
  }),
  
  // Role-based access control
  hasRole: jest.fn().mockImplementation((user, role) => {
    const userRoles = {
      'admin': ['ADMIN', 'STANDARD', 'READ_ONLY'],
      'test-user': ['STANDARD', 'READ_ONLY'],
      'read-only-user': ['READ_ONLY'],
      'unauthorized': [],
    };
    
    const roles = userRoles[user] || [];
    return roles.includes(role);
  }),
  
  // Permission enforcement
  enforcePermission: jest.fn().mockImplementation((action, context = {}) => {
    if (!mockPermissionManager.checkPermission(action, context)) {
      throw new Error(`Access denied: insufficient permissions for ${action}`);
    }
    return true;
  }),
  
  // Provider-specific permissions
  checkProviderPermission: jest.fn().mockImplementation((provider, action, context = {}) => {
    const { user = 'test-user' } = context;
    
    // Different providers may have different permission requirements
    const providerPermissions = {
      'openai': ['summarize', 'categorize', 'analyze'],
      'xai': ['summarize', 'categorize'],
      'restricted-provider': ['summarize'],
    };
    
    const allowedActions = providerPermissions[provider] || [];
    return allowedActions.includes(action);
  }),
  
  // Privilege escalation prevention
  preventPrivilegeEscalation: jest.fn().mockImplementation((currentRole, requestedRole) => {
    const roleHierarchy = {
      'READ_ONLY': 0,
      'STANDARD': 1,
      'ADMIN': 2,
    };
    
    const currentLevel = roleHierarchy[currentRole] || 0;
    const requestedLevel = roleHierarchy[requestedRole] || 0;
    
    if (requestedLevel > currentLevel) {
      throw new Error('Privilege escalation attempt detected');
    }
    
    return true;
  }),
  
  // Access logging
  logAccess: jest.fn().mockImplementation((user, action, resource, result) => {
    // Mock access logging
    return {
      timestamp: Date.now(),
      user,
      action,
      resource,
      result,
      logId: `access-log-${Date.now()}`,
    };
  }),
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
