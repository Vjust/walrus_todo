/**
 * Permission Service
 *
 * This service provides role-based access control (RBAC) functionality for the Walrus Todo application.
 * It manages user roles, permissions, and authorization checks.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  UserRole,
  Permission,
  Role,
  PermissionUser,
  PermissionContext,
  ResourceType,
  ActionType,
  createResourceIdentifier,
  permissionMatches,
} from '../types/permissions';
import { CLIError } from '../types/errors/consolidated';
import { Logger } from '../utils/Logger';
import { auditLogger } from '../utils/AuditLogger';

// Define default roles and their permissions
const DEFAULT_ROLES: Role[] = [
  {
    name: UserRole.GUEST,
    description: 'Limited access to public resources only',
    permissions: [
      { resource: 'todo:*', action: ActionType.READ },
      { resource: 'list:*', action: ActionType.READ },
      { resource: 'ai:*', action: ActionType.SUMMARIZE },
      { resource: 'ai:*', action: ActionType.ANALYZE },
    ],
  },
  {
    name: UserRole.USER,
    description: 'Standard user with access to own resources',
    inheritsFrom: UserRole.GUEST,
    permissions: [
      { resource: 'todo:*', action: ActionType.CREATE },
      { resource: 'todo:*', action: ActionType.UPDATE },
      { resource: 'todo:*', action: ActionType.DELETE },
      { resource: 'todo:*', action: ActionType.COMPLETE },
      { resource: 'list:*', action: ActionType.CREATE },
      { resource: 'list:*', action: ActionType.UPDATE },
      { resource: 'list:*', action: ActionType.DELETE },
      { resource: 'list:*', action: ActionType.SHARE },
      { resource: 'storage:*', action: ActionType.UPLOAD },
      { resource: 'storage:*', action: ActionType.DOWNLOAD },
      { resource: 'account:*', action: ActionType.READ },
      { resource: 'account:*', action: ActionType.UPDATE },
      { resource: 'ai:*', action: ActionType.CATEGORIZE },
      { resource: 'ai:*', action: ActionType.PRIORITIZE },
      { resource: 'ai:*', action: ActionType.SUGGEST },
    ],
  },
  {
    name: UserRole.COLLABORATOR,
    description: 'Enhanced access to shared lists',
    inheritsFrom: UserRole.USER,
    permissions: [
      { resource: 'list:*', action: ActionType.ADD_COLLABORATOR },
      { resource: 'list:*', action: ActionType.REMOVE_COLLABORATOR },
    ],
  },
  {
    name: UserRole.ADMIN,
    description: 'Administrative access to the system',
    inheritsFrom: UserRole.COLLABORATOR,
    permissions: [
      { resource: 'storage:*', action: ActionType.MANAGE_ALLOCATION },
      { resource: 'account:*', action: ActionType.MANAGE_CREDENTIALS },
      { resource: 'ai:*', action: ActionType.TRAIN },
      { resource: 'ai:*', action: ActionType.MANAGE_PROVIDERS },
      { resource: 'system:*', action: ActionType.VIEW_AUDIT_LOGS },
      { resource: 'system:*', action: ActionType.MANAGE_USERS },
    ],
  },
  {
    name: UserRole.SUPER_ADMIN,
    description: 'Complete system access',
    inheritsFrom: UserRole.ADMIN,
    permissions: [
      { resource: 'system:*', action: ActionType.MANAGE_ROLES },
      { resource: 'system:*', action: ActionType.CONFIGURE_SYSTEM },
    ],
  },
];

export class PermissionService {
  private static instance: PermissionService;
  private roles: Map<UserRole, Role> = new Map();
  private users: Map<string, PermissionUser> = new Map();
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
    this.initializeRoles();
  }

  /**
   * Get singleton instance of PermissionService
   */
  public static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  /**
   * Initialize default roles
   */
  private initializeRoles(): void {
    DEFAULT_ROLES.forEach(role => {
      this.roles.set(role.name, role);
    });
    this.logger.debug('Permission roles initialized', {
      rolesCount: this.roles.size,
    });
  }

  /**
   * Create a new user
   */
  public async createUser(
    username: string,
    address?: string,
    roles: UserRole[] = [UserRole.USER]
  ): Promise<PermissionUser> {
    // Create user object
    const user: PermissionUser = {
      id: uuidv4(),
      username,
      address,
      roles,
      directPermissions: [],
      metadata: {},
      createdAt: Date.now(),
    };

    // Store user
    this.users.set(user.id, user);

    // Log user creation
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: 'system',
      action: 'USER_CREATED',
      resource: 'account',
      resourceId: user.id,
      operation: 'create',
      outcome: 'SUCCESS',
      metadata: {
        username: user.username,
        roles: user.roles,
      },
    });

    return user;
  }

  /**
   * Get user by ID
   */
  public async getUser(userId: string): Promise<PermissionUser | undefined> {
    return this.users.get(userId);
  }

  /**
   * Get user by username
   */
  public async getUserByUsername(
    username: string
  ): Promise<PermissionUser | undefined> {
    return Array.from(this.users.values()).find(
      user => user.username === username
    );
  }

  /**
   * Get user by blockchain address
   */
  public async getUserByAddress(
    address: string
  ): Promise<PermissionUser | undefined> {
    return Array.from(this.users.values()).find(
      user => user.address === address
    );
  }

  /**
   * Check if a user has a specific role
   */
  public async hasRole(userId: string, role: UserRole): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    return user.roles.includes(role) || this.hasInheritedRole(user.roles, role);
  }

  /**
   * Check if roles include an inherited role
   */
  private hasInheritedRole(
    userRoles: UserRole[],
    targetRole: UserRole
  ): boolean {
    // For each role the user has, check if it inherits from the target role
    for (const userRole of userRoles) {
      const role = this.roles.get(userRole);
      if (!role) continue;

      // Direct match
      if (role.name === targetRole) return true;

      // Check inheritance chain
      let currentRole = role;
      while (currentRole.inheritsFrom) {
        if (currentRole.inheritsFrom === targetRole) return true;
        currentRole =
          this.roles.get(currentRole.inheritsFrom) ||
          ({ name: currentRole.inheritsFrom } as Role);
      }
    }

    return false;
  }

  /**
   * Check if a user has permission for a specific action on a resource
   */
  public async hasPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    // Super Admin always has access
    if (user.roles.includes(UserRole.SUPER_ADMIN)) return true;

    // Create permission context
    const context: PermissionContext = {
      user,
      resource,
      resourceType: resource.split(':')[0] as ResourceType,
      resourceId: resource.includes(':') ? resource.split(':')[1] : undefined,
      action,
    };

    // Check direct permissions first
    const hasDirectPermission = user.directPermissions.some(permission =>
      permissionMatches(permission, context)
    );

    if (hasDirectPermission) return true;

    // Check role-based permissions
    for (const roleName of user.roles) {
      const role = this.roles.get(roleName);
      if (!role) continue;

      // Check if this role has the permission
      const hasRolePermission = role.permissions.some(permission =>
        permissionMatches(permission, context)
      );

      if (hasRolePermission) return true;

      // Check inherited roles
      if (role.inheritsFrom) {
        const hasInheritedPermission = await this.checkInheritedRolePermission(
          role.inheritsFrom,
          context
        );
        if (hasInheritedPermission) return true;
      }
    }

    // Ownership check - if the user owns the resource, they have access
    // but only if the resource ID matches their user ID
    if (context.resourceId && context.resourceId === user.id) {
      return true;
    }

    return false;
  }

  /**
   * Check if an inherited role has the required permission
   */
  private async checkInheritedRolePermission(
    roleName: UserRole,
    context: PermissionContext
  ): Promise<boolean> {
    const role = this.roles.get(roleName);
    if (!role) return false;

    // Check if this role has the permission
    const hasRolePermission = role.permissions.some(permission =>
      permissionMatches(permission, context)
    );

    if (hasRolePermission) return true;

    // Check deeper inheritance
    if (role.inheritsFrom) {
      return this.checkInheritedRolePermission(role.inheritsFrom, context);
    }

    return false;
  }

  /**
   * Get all permissions for a user (direct and role-based)
   */
  public async getUserPermissions(userId: string): Promise<Permission[]> {
    const user = await this.getUser(userId);
    if (!user) return [];

    // Start with direct permissions
    const permissions = [...user.directPermissions];

    // Add permissions from all roles, including inherited ones
    for (const roleName of user.roles) {
      const rolePermissions = await this.getRolePermissions(roleName);
      permissions.push(...rolePermissions);
    }

    // Remove duplicates
    return this.deduplicatePermissions(permissions);
  }

  /**
   * Get all permissions associated with a role, including inherited ones
   */
  private async getRolePermissions(roleName: UserRole): Promise<Permission[]> {
    const role = this.roles.get(roleName);
    if (!role) return [];

    // Start with this role's permissions
    const permissions = [...role.permissions];

    // Add inherited permissions if applicable
    if (role.inheritsFrom) {
      const inheritedPermissions = await this.getRolePermissions(
        role.inheritsFrom
      );
      permissions.push(...inheritedPermissions);
    }

    return permissions;
  }

  /**
   * Remove duplicate permissions
   */
  private deduplicatePermissions(permissions: Permission[]): Permission[] {
    const permissionMap = new Map<string, Permission>();

    permissions.forEach(permission => {
      const key = `${permission.resource}|${permission.action}`;
      permissionMap.set(key, permission);
    });

    return Array.from(permissionMap.values());
  }

  /**
   * Assign a role to a user
   */
  public async assignRoleToUser(userId: string, role: UserRole): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new CLIError(`User with ID ${userId} not found`, 'USER_NOT_FOUND');
    }

    if (!this.roles.has(role)) {
      throw new CLIError(`Role ${role} does not exist`, 'ROLE_NOT_FOUND');
    }

    // Check if user already has this role
    if (user.roles.includes(role)) {
      return;
    }

    // Add role
    user.roles.push(role);

    // Log role assignment
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: 'system',
      action: 'ROLE_ASSIGNED',
      resource: 'account',
      resourceId: user.id,
      operation: 'update',
      outcome: 'SUCCESS',
      metadata: {
        username: user.username,
        roleAssigned: role,
      },
    });
  }

  /**
   * Remove a role from a user
   */
  public async removeRoleFromUser(
    userId: string,
    role: UserRole
  ): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new CLIError(`User with ID ${userId} not found`, 'USER_NOT_FOUND');
    }

    // Check if user has this role
    if (!user.roles.includes(role)) {
      return;
    }

    // Remove role
    user.roles = user.roles.filter(r => r !== role);

    // Log role removal
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: 'system',
      action: 'ROLE_REMOVED',
      resource: 'account',
      resourceId: user.id,
      operation: 'update',
      outcome: 'SUCCESS',
      metadata: {
        username: user.username,
        roleRemoved: role,
      },
    });
  }

  /**
   * Grant a specific permission to a user
   */
  public async grantPermission(
    userId: string,
    permission: Permission
  ): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new CLIError(`User with ID ${userId} not found`, 'USER_NOT_FOUND');
    }

    // Check if user already has this permission
    const existingPermission = user.directPermissions.find(
      p => p.resource === permission.resource && p.action === permission.action
    );

    if (existingPermission) {
      return;
    }

    // Grant permission
    user.directPermissions.push(permission);

    // Log permission grant
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: 'system',
      action: 'PERMISSION_GRANTED',
      resource: 'account',
      resourceId: user.id,
      operation: 'update',
      outcome: 'SUCCESS',
      metadata: {
        username: user.username,
        permission,
      },
    });
  }

  /**
   * Revoke a specific permission from a user
   */
  public async revokePermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new CLIError(`User with ID ${userId} not found`, 'USER_NOT_FOUND');
    }

    // Remove matching permission
    user.directPermissions = user.directPermissions.filter(
      p => !(p.resource === resource && p.action === action)
    );

    // Log permission revocation
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: 'system',
      action: 'PERMISSION_REVOKED',
      resource: 'account',
      resourceId: user.id,
      operation: 'update',
      outcome: 'SUCCESS',
      metadata: {
        username: user.username,
        resource,
        action,
      },
    });
  }

  /**
   * Create owner permissions for a resource
   */
  public async createOwnerPermissions(
    userId: string,
    resourceType: ResourceType,
    resourceId: string
  ): Promise<void> {
    // Create direct permissions for all actions on this specific resource
    await this.grantPermission(userId, {
      resource: createResourceIdentifier(resourceType, resourceId),
      action: '*', // Wildcard for all actions
    });

    // Log owner permissions creation
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: 'system',
      action: 'OWNER_PERMISSIONS_CREATED',
      resource: resourceType,
      resourceId,
      operation: 'create',
      outcome: 'SUCCESS',
      metadata: {
        ownerId: userId,
      },
    });
  }

  /**
   * Check if a user is the owner of a resource
   */
  public async isResourceOwner(
    userId: string,
    resourceType: ResourceType,
    resourceId: string
  ): Promise<boolean> {
    // Get all permissions for the user
    const permissions = await this.getUserPermissions(userId);

    // Check for ownership permission pattern (resource ID, wildcard action)
    const resourceIdentifier = createResourceIdentifier(
      resourceType,
      resourceId
    );
    return permissions.some(
      p => p.resource === resourceIdentifier && p.action === '*'
    );
  }

  /**
   * Grant list collaboration permissions
   */
  public async grantCollaboratorPermissions(
    userId: string,
    listId: string,
    actions: ActionType[] = [ActionType.READ, ActionType.UPDATE]
  ): Promise<void> {
    // Grant each specified action permission
    for (const action of actions) {
      await this.grantPermission(userId, {
        resource: createResourceIdentifier(ResourceType.LIST, listId),
        action,
      });
    }

    // Log collaborator permissions
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: 'system',
      action: 'COLLABORATOR_PERMISSIONS_GRANTED',
      resource: ResourceType.LIST,
      resourceId: listId,
      operation: 'update',
      outcome: 'SUCCESS',
      metadata: {
        collaboratorId: userId,
        grantedActions: actions,
      },
    });
  }

  /**
   * Authorize and log an action
   */
  public async authorizeAction(
    userId: string,
    resource: string,
    action: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    const hasPermission = await this.hasPermission(userId, resource, action);

    // Log the authorization attempt
    const user =
      (await this.getUser(userId)) ||
      ({ username: 'unknown' } as PermissionUser);

    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId,
      action: 'AUTHORIZATION',
      resource: resource.split(':')[0],
      resourceId: resource.includes(':') ? resource.split(':')[1] : undefined,
      operation: action,
      outcome: hasPermission ? 'SUCCESS' : 'DENIED',
      metadata: {
        username: user.username,
        ...metadata,
      },
    });

    return hasPermission;
  }
}

// Export singleton instance
export const permissionService = PermissionService.getInstance();
