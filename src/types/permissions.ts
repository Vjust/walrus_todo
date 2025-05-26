/**
 * Core permission types for the Walrus Todo application
 * This module defines the types, enums, and interfaces for the role-based permission system.
 * The permission system provides granular access control to various resources within the application,
 * enabling secure and controlled sharing of todos, lists, and other resources between users.
 *
 * @module permissions
 */

/**
 * User roles with different permission levels in the system.
 * Roles follow a hierarchical structure with increasing privileges.
 * Each role has predefined access to specific resources and actions.
 *
 * @enum {string}
 */
export enum UserRole {
  /** Minimal access - typically for unauthenticated or temporary users */
  GUEST = 'guest',

  /** Standard user access - regular authenticated users with basic privileges */
  USER = 'user',

  /** Enhanced access to specific lists - users who have been granted special access to shared resources */
  COLLABORATOR = 'collaborator',

  /** Advanced system management - users with elevated privileges for system administration */
  ADMIN = 'admin',

  /** Complete system access - users with unrestricted access to all system features */
  SUPER_ADMIN = 'super_admin',
}

/**
 * Permission definition structure for granular access control.
 * Permissions define what actions a user can perform on specific resources.
 * They can include optional conditions for more fine-grained control.
 *
 * @interface Permission
 */
export interface Permission {
  /**
   * Resource identifier in the format '{resourceType}:{resourceId}'.
   * Wildcards can be used, e.g., 'todo:*' to refer to all todos.
   */
  resource: string;

  /**
   * Action name the permission grants (read, write, delete, etc.).
   * Can be a specific action or '*' for all actions on the resource.
   */
  action: string;

  /**
   * Optional conditions that must be satisfied for the permission to apply.
   * Examples include time restrictions, IP limitations, or context-specific rules.
   */
  conditions?: Record<string, string | number | boolean | null>;
}

/**
 * Resource types that can have permissions applied to them.
 * Each resource type represents a distinct category of objects in the system
 * that can be secured with the permission system.
 *
 * @enum {string}
 */
export enum ResourceType {
  /** Individual todo items that users can create, view, and manage */
  TODO = 'todo',

  /** Todo lists that can group multiple related todos together */
  LIST = 'list',

  /** Storage resources for managing file uploads and blob storage */
  STORAGE = 'storage',

  /** User account information and related settings */
  ACCOUNT = 'account',

  /** AI-related features and capabilities */
  AI = 'ai',

  /** System-level configuration and administration */
  SYSTEM = 'system',
}

/**
 * Action types that can be performed on resources.
 * These define the specific operations that permissions can control.
 * Actions are grouped by resource type for clarity, but some actions
 * may apply to multiple resource types.
 *
 * @enum {string}
 */
export enum ActionType {
  /**
   * Common actions applicable to most resource types
   */
  /** View a resource without modifying it */
  READ = 'read',
  /** Create a new resource */
  CREATE = 'create',
  /** Modify an existing resource */
  UPDATE = 'update',
  /** Remove a resource from the system */
  DELETE = 'delete',
  /** Share a resource with other users */
  SHARE = 'share',

  /**
   * Todo-specific actions
   */
  /** Mark a todo as complete or incomplete */
  COMPLETE = 'complete',
  /** Transfer ownership of a todo to another user */
  TRANSFER_OWNERSHIP = 'transfer-ownership',

  /**
   * List-specific actions
   */
  /** Add a collaborator to a list */
  ADD_COLLABORATOR = 'add-collaborator',
  /** Remove a collaborator from a list */
  REMOVE_COLLABORATOR = 'remove-collaborator',
  /** Comprehensive management of list collaborators */
  MANAGE_COLLABORATORS = 'manage-collaborators',

  /**
   * Storage-specific actions
   */
  /** Upload files or blobs to storage */
  UPLOAD = 'upload',
  /** Download files or blobs from storage */
  DOWNLOAD = 'download',
  /** Manage storage allocation and quotas */
  MANAGE_ALLOCATION = 'manage-allocation',

  /**
   * Account-specific actions
   */
  /** Change account password */
  CHANGE_PASSWORD = 'change-password',
  /** Manage API keys and authentication credentials */
  MANAGE_CREDENTIALS = 'manage-credentials',

  /**
   * AI-specific actions
   */
  /** Generate summaries of todos or lists */
  SUMMARIZE = 'summarize',
  /** Perform analysis on todos or other data */
  ANALYZE = 'analyze',
  /** Automatically categorize todos */
  CATEGORIZE = 'categorize',
  /** Suggest priority levels for todos */
  PRIORITIZE = 'prioritize',
  /** Generate suggestions for new todos or actions */
  SUGGEST = 'suggest',
  /** Train AI models with user data */
  TRAIN = 'train',
  /** Manage AI service providers and settings */
  MANAGE_PROVIDERS = 'manage-providers',

  /**
   * System-specific actions
   */
  /** Access and review system audit logs */
  VIEW_AUDIT_LOGS = 'view-audit-logs',
  /** Manage user accounts and settings */
  MANAGE_USERS = 'manage-users',
  /** Manage user roles and permissions */
  MANAGE_ROLES = 'manage-roles',
  /** Configure system-wide settings */
  CONFIGURE_SYSTEM = 'configure-system',
}

/**
 * Role definition with associated permissions.
 * Roles represent a collection of permissions that can be assigned to users.
 * Roles can inherit permissions from other roles to create a hierarchical structure.
 *
 * @interface Role
 */
export interface Role {
  /** The role identifier from the UserRole enum */
  name: UserRole;

  /** Human-readable description of the role's purpose and scope */
  description: string;

  /** Optional parent role from which this role inherits permissions */
  inheritsFrom?: UserRole;

  /** List of specific permissions granted by this role */
  permissions: Permission[];
}

/**
 * User with roles and permissions.
 * Represents a user account with its associated roles and direct permissions.
 * Users can have multiple roles and additional direct permissions.
 *
 * @interface PermissionUser
 */
export interface PermissionUser {
  /** Unique identifier for the user */
  id: string;

  /** User's login name or display name */
  username: string;

  /** Optional blockchain address for blockchain-related operations */
  address?: string;

  /** List of roles assigned to the user */
  roles: UserRole[];

  /** Additional permissions granted directly to the user (outside of roles) */
  directPermissions: Permission[];

  /** Additional user-related data and settings */
  metadata: Record<string, string | number | boolean | null>;

  /** Unix timestamp when the user account was created */
  createdAt: number;

  /** Optional Unix timestamp of the user's last login */
  lastLogin?: number;
}

/**
 * Authentication result including tokens and user info.
 * Returned after successful authentication with the system.
 * Contains tokens for maintaining the authenticated session.
 *
 * @interface AuthResult
 */
export interface AuthResult {
  /** The authenticated user's information */
  user: PermissionUser;

  /** JWT or session token for API authentication */
  token: string;

  /** Token used to obtain a new authentication token when the current one expires */
  refreshToken: string;

  /** Unix timestamp when the current token expires */
  expiresAt: number;
}

/**
 * Token validation result.
 * Used to verify if an authentication token is valid and retrieve associated user information.
 *
 * @interface TokenValidationResult
 */
export interface TokenValidationResult {
  /** Whether the token is valid */
  valid: boolean;

  /** Whether the token has expired */
  expired: boolean;

  /** User associated with the token, if valid */
  user?: PermissionUser;
}

/**
 * Audit log entry for security events.
 * Used to track security-relevant actions in the system for compliance and troubleshooting.
 * Each entry represents a single event with detailed context information.
 *
 * @interface AuditLogEntry
 */
export interface AuditLogEntry {
  /** Unique identifier for the log entry */
  id: string;

  /** Unix timestamp when the event occurred */
  timestamp: number;

  /** ID of the user who performed the action */
  userId: string;

  /** Type of action performed (LOGIN, CREATE_TODO, etc.) */
  action: string;

  /** Type of resource affected by the action */
  resource: string;

  /** Specific ID of the affected resource */
  resourceId?: string;

  /** Specific operation performed on the resource */
  operation: string;

  /** Result of the operation - whether it succeeded, was denied, or failed */
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED';

  /** Additional contextual information about the event */
  metadata: Record<string, string | number | boolean | null>;

  /** Source IP address of the user performing the action */
  ipAddress?: string;

  /** Browser or application information of the user agent */
  userAgent?: string;
}

/**
 * Permission check context for evaluating permissions.
 * Contains all the necessary information to determine if a permission applies.
 * Used when checking if a user has permission to perform a specific action.
 *
 * @interface PermissionContext
 */
export interface PermissionContext {
  /** User attempting to perform the action */
  user: PermissionUser;

  /** Full resource identifier string */
  resource: string;

  /** Type of resource being accessed */
  resourceType: ResourceType;

  /** Specific ID of the resource being accessed */
  resourceId?: string;

  /** Action being attempted */
  action: ActionType | string;

  /** Additional contextual data for conditional permission evaluation */
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Permission configuration options.
 * Defines system-wide settings for how permissions are evaluated and applied.
 *
 * @interface PermissionConfig
 */
export interface PermissionConfig {
  /** Default role assigned to new users */
  defaultUserRole: UserRole;

  /** Whether role inheritance is enabled in the permission system */
  inheritanceEnabled: boolean;

  /** Whether to enforce strict permission checking (deny by default) */
  strictMode: boolean;

  /** Whether to automatically grant ownership permissions to resource creators */
  autoGrantOwnership: boolean;
}

/**
 * Helper functions for working with permissions
 */

/**
 * Creates a resource identifier string from a resource type and optional ID.
 * The format is '{resourceType}:{resourceId}' or '{resourceType}:*' for wildcards.
 *
 * @param {ResourceType} resourceType - The type of resource
 * @param {string} [resourceId] - Optional specific resource ID, omit for wildcard
 * @returns {string} Formatted resource identifier
 */
export function createResourceIdentifier(
  resourceType: ResourceType,
  resourceId?: string
): string {
  return resourceId ? `${resourceType}:${resourceId}` : `${resourceType}:*`;
}

/**
 * Parses a resource identifier string into its component parts.
 * Extracts the resource type and resource ID from a string in the format '{resourceType}:{resourceId}'.
 *
 * @param {string} resourceIdentifier - Resource identifier to parse
 * @returns {{ resourceType: ResourceType; resourceId?: string }} Parsed components
 */
export function parseResourceIdentifier(resourceIdentifier: string): {
  resourceType: ResourceType;
  resourceId?: string;
} {
  const [resourceTypeStr, resourceId] = resourceIdentifier.split(':');
  return {
    resourceType: resourceTypeStr as ResourceType,
    resourceId: resourceId === '*' ? undefined : resourceId,
  };
}

/**
 * Checks if a permission matches a given context.
 * Used to determine if a specific permission grants access in a particular scenario.
 * Considers resource wildcards, action wildcards, and conditional rules.
 *
 * @param {Permission} permission - The permission to check
 * @param {PermissionContext} context - The context in which to evaluate the permission
 * @returns {boolean} True if the permission grants access in this context
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
    permission.action === context.action || permission.action === '*';

  // If conditions exist, they should all be satisfied
  const conditionsMatch =
    !permission.conditions ||
    Object.entries(permission.conditions).every(([key, value]) => {
      return context.metadata?.[key] === value;
    });

  return resourceMatches && actionMatches && conditionsMatch;
}
