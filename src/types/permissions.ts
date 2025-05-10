/**
 * Core permission types for the Walrus Todo application
 * This module defines the types, enums, and interfaces for the role-based permission system
 */

/**
 * User roles with different permission levels
 */
export enum UserRole {
  GUEST = 'guest',           // Minimal access
  USER = 'user',             // Standard user access
  COLLABORATOR = 'collaborator', // Enhanced access to specific lists
  ADMIN = 'admin',           // Advanced system management
  SUPER_ADMIN = 'super_admin' // Complete system access
}

/**
 * Permission definition structure
 */
export interface Permission {
  resource: string;          // Resource identifier (todo:*, list:123, etc.)
  action: string;            // Action name (read, write, delete, etc.)
  conditions?: Record<string, any>; // Optional conditions (time restrictions, etc.)
}

/**
 * Resource types that can have permissions applied
 */
export enum ResourceType {
  TODO = 'todo',
  LIST = 'list',
  STORAGE = 'storage',
  ACCOUNT = 'account',
  AI = 'ai',
  SYSTEM = 'system'
}

/**
 * Action types that can be performed on resources
 */
export enum ActionType {
  // Common actions
  READ = 'read',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SHARE = 'share',
  
  // Todo-specific actions
  COMPLETE = 'complete',
  TRANSFER_OWNERSHIP = 'transfer-ownership',
  
  // List-specific actions
  ADD_COLLABORATOR = 'add-collaborator',
  REMOVE_COLLABORATOR = 'remove-collaborator',
  MANAGE_COLLABORATORS = 'manage-collaborators',
  
  // Storage-specific actions
  UPLOAD = 'upload',
  DOWNLOAD = 'download',
  MANAGE_ALLOCATION = 'manage-allocation',
  
  // Account-specific actions
  CHANGE_PASSWORD = 'change-password',
  MANAGE_CREDENTIALS = 'manage-credentials',
  
  // AI-specific actions
  SUMMARIZE = 'summarize',
  ANALYZE = 'analyze',
  CATEGORIZE = 'categorize',
  PRIORITIZE = 'prioritize',
  SUGGEST = 'suggest',
  TRAIN = 'train',
  MANAGE_PROVIDERS = 'manage-providers',
  
  // System-specific actions
  VIEW_AUDIT_LOGS = 'view-audit-logs',
  MANAGE_USERS = 'manage-users',
  MANAGE_ROLES = 'manage-roles',
  CONFIGURE_SYSTEM = 'configure-system'
}

/**
 * Role definition with permissions
 */
export interface Role {
  name: UserRole;
  description: string;
  inheritsFrom?: UserRole;
  permissions: Permission[];
}

/**
 * User with roles and permissions
 */
export interface PermissionUser {
  id: string;
  username: string;
  address?: string;        // Blockchain address
  roles: UserRole[];
  directPermissions: Permission[];
  metadata: Record<string, any>;
  createdAt: number;
  lastLogin?: number;
}

/**
 * Authentication result including tokens and user info
 */
export interface AuthResult {
  user: PermissionUser;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  expired: boolean;
  user?: PermissionUser;
}

/**
 * Audit log entry for security events
 */
export interface AuditLogEntry {
  id: string;                // Unique log ID
  timestamp: number;         // When the event occurred
  userId: string;            // User who performed the action
  action: string;            // Action type (LOGIN, CREATE_TODO, etc.)
  resource: string;          // Resource affected
  resourceId?: string;       // Specific resource ID
  operation: string;         // Operation performed
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED'; // Result
  metadata: Record<string, any>; // Additional context
  ipAddress?: string;        // Source IP address
  userAgent?: string;        // User agent information
}

/**
 * Permission check context for evaluating permissions
 */
export interface PermissionContext {
  user: PermissionUser;
  resource: string;
  resourceType: ResourceType;
  resourceId?: string;
  action: ActionType | string;
  metadata?: Record<string, any>;
}

/**
 * Permission configuration options
 */
export interface PermissionConfig {
  defaultUserRole: UserRole;
  inheritanceEnabled: boolean;
  strictMode: boolean;
  autoGrantOwnership: boolean;
}

/**
 * Helper functions for working with permissions
 */

/**
 * Create a resource identifier string
 */
export function createResourceIdentifier(
  resourceType: ResourceType,
  resourceId?: string
): string {
  return resourceId ? `${resourceType}:${resourceId}` : `${resourceType}:*`;
}

/**
 * Parse a resource identifier into its components
 */
export function parseResourceIdentifier(
  resourceIdentifier: string
): { resourceType: ResourceType; resourceId?: string } {
  const [resourceTypeStr, resourceId] = resourceIdentifier.split(':');
  return {
    resourceType: resourceTypeStr as ResourceType,
    resourceId: resourceId === '*' ? undefined : resourceId
  };
}

/**
 * Check if a permission matches a context
 */
export function permissionMatches(
  permission: Permission,
  context: PermissionContext
): boolean {
  // Resource matching - exact match or wildcard
  const resourceMatches = 
    permission.resource === context.resource ||
    permission.resource === `${context.resourceType}:*`;
    
  // Action matching - exact match or wildcard
  const actionMatches = 
    permission.action === context.action ||
    permission.action === '*';
    
  // If conditions exist, they should all be satisfied
  const conditionsMatch = !permission.conditions || 
    Object.entries(permission.conditions).every(([key, value]) => {
      return context.metadata?.[key] === value;
    });
    
  return resourceMatches && actionMatches && conditionsMatch;
}