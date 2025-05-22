/**
 * Unit tests for Permission Service
 * 
 * Tests role-based access control (RBAC), permission checks, and authorization logic.
 */

import { PermissionService } from '../../../src/services/permission-service';
import { 
  UserRole,
  ActionType,
  ResourceType,
  createResourceIdentifier,
  Permission
} from '../../../src/types/permissions';

import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('../../../src/utils/Logger');
jest.mock('../../../src/utils/AuditLogger');
jest.mock('uuid');

describe('PermissionService', () => {
  let permissionService: PermissionService;
  const mockUserId = 'test-user-id';
  const mockUsername = 'testuser';
  const mockAddress = '0x12345';
  
  beforeEach(() => {
    jest.clearAllMocks();
    (uuidv4 as jest.Mock).mockReturnValue(mockUserId);
    
    // Clear the singleton instance
    (PermissionService as any).instance = undefined;
    permissionService = PermissionService.getInstance();
  });
  
  describe('User Management', () => {
    it('should create a new user with default role', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress);
      
      expect(user.id).toBe(mockUserId);
      expect(user.username).toBe(mockUsername);
      expect(user.address).toBe(mockAddress);
      expect(user.roles).toEqual([UserRole.USER]);
      expect(user.directPermissions).toEqual([]);
    });
    
    it('should create a user with custom roles', async () => {
      const customRoles = [UserRole.ADMIN, UserRole.COLLABORATOR];
      const user = await permissionService.createUser(mockUsername, mockAddress, customRoles);
      
      expect(user.roles).toEqual(customRoles);
    });
    
    it('should retrieve a user by ID', async () => {
      const createdUser = await permissionService.createUser(mockUsername, mockAddress);
      const retrievedUser = await permissionService.getUser(createdUser.id);
      
      expect(retrievedUser).toEqual(createdUser);
    });
    
    it('should retrieve a user by username', async () => {
      const createdUser = await permissionService.createUser(mockUsername, mockAddress);
      const retrievedUser = await permissionService.getUserByUsername(mockUsername);
      
      expect(retrievedUser).toEqual(createdUser);
    });
    
    it('should retrieve a user by address', async () => {
      const createdUser = await permissionService.createUser(mockUsername, mockAddress);
      const retrievedUser = await permissionService.getUserByAddress(mockAddress);
      
      expect(retrievedUser).toEqual(createdUser);
    });
  });
  
  describe('Role Management', () => {
    it('should check if a user has a specific role', async () => {
      // Create a user with only COLLABORATOR role
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.COLLABORATOR]);
      
      const hasCollaborator = await permissionService.hasRole(user.id, UserRole.COLLABORATOR);
      const hasAdmin = await permissionService.hasRole(user.id, UserRole.ADMIN);
      const hasSuperAdmin = await permissionService.hasRole(user.id, UserRole.SUPER_ADMIN);
      
      expect(hasCollaborator).toBe(true);
      expect(hasAdmin).toBe(false);
      expect(hasSuperAdmin).toBe(false);
    });
    
    it('should check inherited roles correctly', async () => {
      // ADMIN inherits from COLLABORATOR, which inherits from USER
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.ADMIN]);
      
      const hasAdmin = await permissionService.hasRole(user.id, UserRole.ADMIN);
      const hasCollaborator = await permissionService.hasRole(user.id, UserRole.COLLABORATOR);
      const hasUser = await permissionService.hasRole(user.id, UserRole.USER);
      const hasGuest = await permissionService.hasRole(user.id, UserRole.GUEST);
      
      expect(hasAdmin).toBe(true);
      expect(hasCollaborator).toBe(true);
      expect(hasUser).toBe(true);
      expect(hasGuest).toBe(true);
    });
    
    it('should assign a role to a user', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      
      await permissionService.assignRoleToUser(user.id, UserRole.COLLABORATOR);
      const hasCollaborator = await permissionService.hasRole(user.id, UserRole.COLLABORATOR);
      
      expect(hasCollaborator).toBe(true);
    });
    
    it('should remove a role from a user', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER, UserRole.COLLABORATOR]);
      
      await permissionService.removeRoleFromUser(user.id, UserRole.COLLABORATOR);
      const hasCollaborator = await permissionService.hasRole(user.id, UserRole.COLLABORATOR);
      
      expect(hasCollaborator).toBe(false);
    });
  });
  
  describe('Permission Checks', () => {
    it('should check user permissions for allowed actions', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      
      // Users can create todos
      const canCreateTodo = await permissionService.hasPermission(
        user.id,
        createResourceIdentifier(ResourceType.TODO, '*'),
        ActionType.CREATE
      );
      
      expect(canCreateTodo).toBe(true);
    });
    
    it('should deny permissions for non-allowed actions', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      
      // Regular users cannot manage system users
      const canManageUsers = await permissionService.hasPermission(
        user.id,
        createResourceIdentifier(ResourceType.SYSTEM, '*'),
        ActionType.MANAGE_USERS
      );
      
      expect(canManageUsers).toBe(false);
    });
    
    it('should allow Super Admin to perform any action', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.SUPER_ADMIN]);
      
      // Super Admin can do anything
      const canDoAnything = await permissionService.hasPermission(
        user.id,
        createResourceIdentifier(ResourceType.SYSTEM, 'any-resource'),
        'any-action'
      );
      
      expect(canDoAnything).toBe(true);
    });
    
    it('should check inherited permissions correctly', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.COLLABORATOR]);
      
      // Collaborator inherits from User and should be able to create todos
      const canCreateTodo = await permissionService.hasPermission(
        user.id,
        createResourceIdentifier(ResourceType.TODO, '*'),
        ActionType.CREATE
      );
      
      // Collaborator has additional permissions like adding collaborators
      const canAddCollaborator = await permissionService.hasPermission(
        user.id,
        createResourceIdentifier(ResourceType.LIST, '*'),
        ActionType.ADD_COLLABORATOR
      );
      
      expect(canCreateTodo).toBe(true);
      expect(canAddCollaborator).toBe(true);
    });
    
    it('should check direct permissions', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      const customPermission: Permission = {
        resource: createResourceIdentifier(ResourceType.SYSTEM, 'custom-resource'),
        action: 'custom-action'
      };
      
      // Grant a direct permission
      await permissionService.grantPermission(user.id, customPermission);
      
      // Check the permission
      const hasPermission = await permissionService.hasPermission(
        user.id,
        customPermission.resource,
        customPermission.action
      );
      
      expect(hasPermission).toBe(true);
    });
    
    it('should allow owner access to their resources', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      
      // User should have access to a resource with their user ID
      const hasOwnerAccess = await permissionService.hasPermission(
        user.id,
        createResourceIdentifier(ResourceType.TODO, user.id),
        ActionType.DELETE
      );
      
      expect(hasOwnerAccess).toBe(true);
    });
  });
  
  describe('Direct Permission Management', () => {
    it('should grant a specific permission to a user', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      const permission: Permission = {
        resource: createResourceIdentifier(ResourceType.AI, 'gpt-model'),
        action: ActionType.TRAIN
      };
      
      await permissionService.grantPermission(user.id, permission);
      
      const hasPermission = await permissionService.hasPermission(
        user.id,
        permission.resource,
        permission.action
      );
      
      expect(hasPermission).toBe(true);
    });
    
    it('should revoke a specific permission from a user', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      const permission: Permission = {
        resource: createResourceIdentifier(ResourceType.AI, 'gpt-model'),
        action: ActionType.TRAIN
      };
      
      // Grant and then revoke
      await permissionService.grantPermission(user.id, permission);
      await permissionService.revokePermission(user.id, permission.resource, permission.action);
      
      const hasPermission = await permissionService.hasPermission(
        user.id,
        permission.resource,
        permission.action
      );
      
      expect(hasPermission).toBe(false);
    });
  });
  
  describe('Owner Permissions', () => {
    it('should create owner permissions for a resource', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      const resourceId = 'todo-123';
      
      await permissionService.createOwnerPermissions(user.id, ResourceType.TODO, resourceId);
      
      // Owner should have all permissions on the resource
      const resource = createResourceIdentifier(ResourceType.TODO, resourceId);
      const canRead = await permissionService.hasPermission(user.id, resource, ActionType.READ);
      const canUpdate = await permissionService.hasPermission(user.id, resource, ActionType.UPDATE);
      const canDelete = await permissionService.hasPermission(user.id, resource, ActionType.DELETE);
      
      expect(canRead).toBe(true);
      expect(canUpdate).toBe(true);
      expect(canDelete).toBe(true);
    });
    
    it('should check if a user is a resource owner', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      const resourceId = 'todo-123';
      
      await permissionService.createOwnerPermissions(user.id, ResourceType.TODO, resourceId);
      
      const isOwner = await permissionService.isResourceOwner(user.id, ResourceType.TODO, resourceId);
      const isNotOwner = await permissionService.isResourceOwner(user.id, ResourceType.TODO, 'other-todo');
      
      expect(isOwner).toBe(true);
      expect(isNotOwner).toBe(false);
    });
  });
  
  describe('Collaborator Permissions', () => {
    it('should grant collaborator permissions for a list', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      const listId = 'list-123';
      
      await permissionService.grantCollaboratorPermissions(user.id, listId);
      
      const resource = createResourceIdentifier(ResourceType.LIST, listId);
      const canRead = await permissionService.hasPermission(user.id, resource, ActionType.READ);
      const canUpdate = await permissionService.hasPermission(user.id, resource, ActionType.UPDATE);
      const canDelete = await permissionService.hasPermission(user.id, resource, ActionType.DELETE);
      
      expect(canRead).toBe(true);
      expect(canUpdate).toBe(true);
      expect(canDelete).toBe(false); // Collaborators can't delete by default
    });
    
    it('should grant custom actions to collaborators', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      const listId = 'list-123';
      const customActions = [ActionType.READ, ActionType.UPDATE, ActionType.SHARE];
      
      await permissionService.grantCollaboratorPermissions(user.id, listId, customActions);
      
      const resource = createResourceIdentifier(ResourceType.LIST, listId);
      const canShare = await permissionService.hasPermission(user.id, resource, ActionType.SHARE);
      
      expect(canShare).toBe(true);
    });
  });
  
  describe('Authorization', () => {
    it('should authorize and log an action', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      const resource = createResourceIdentifier(ResourceType.TODO, 'todo-123');
      const action = ActionType.CREATE;
      
      const isAuthorized = await permissionService.authorizeAction(
        user.id,
        resource,
        action,
        { metadata: 'test' }
      );
      
      expect(isAuthorized).toBe(true);
    });
    
    it('should deny and log unauthorized actions', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      const resource = createResourceIdentifier(ResourceType.SYSTEM, 'system');
      const action = ActionType.CONFIGURE_SYSTEM;
      
      const isAuthorized = await permissionService.authorizeAction(
        user.id,
        resource,
        action
      );
      
      expect(isAuthorized).toBe(false);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle non-existent users gracefully', async () => {
      const hasPermission = await permissionService.hasPermission(
        'non-existent-user',
        createResourceIdentifier(ResourceType.TODO, '*'),
        ActionType.READ
      );
      
      expect(hasPermission).toBe(false);
    });
    
    it('should throw error when trying to modify non-existent users', async () => {
      await expect(
        permissionService.assignRoleToUser('non-existent-user', UserRole.ADMIN)
      ).rejects.toThrow(CLIError);
    });
    
    it('should handle empty permission arrays', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, []);
      user.directPermissions = [];
      
      const permissions = await permissionService.getUserPermissions(user.id);
      expect(permissions).toEqual([]);
    });
    
    it('should handle permission deduplication', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.ADMIN]);
      
      // Grant a permission that the admin role already has
      await permissionService.grantPermission(user.id, {
        resource: createResourceIdentifier(ResourceType.ACCOUNT, '*'),
        action: ActionType.MANAGE_CREDENTIALS
      });
      
      const permissions = await permissionService.getUserPermissions(user.id);
      
      // Check that duplicates are removed
      const credentialPermissions = permissions.filter(p => 
        p.resource === createResourceIdentifier(ResourceType.ACCOUNT, '*') &&
        p.action === ActionType.MANAGE_CREDENTIALS
      );
      
      expect(credentialPermissions.length).toBe(1);
    });
  });
  
  describe('Wildcard Permissions', () => {
    it('should match wildcard resources', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      
      // Users have todo:* permissions
      const canAccessSpecificTodo = await permissionService.hasPermission(
        user.id,
        createResourceIdentifier(ResourceType.TODO, 'specific-todo-id'),
        ActionType.READ
      );
      
      expect(canAccessSpecificTodo).toBe(true);
    });
    
    it('should match wildcard actions for owners', async () => {
      const user = await permissionService.createUser(mockUsername, mockAddress, [UserRole.USER]);
      const resourceId = 'todo-123';
      
      await permissionService.createOwnerPermissions(user.id, ResourceType.TODO, resourceId);
      
      // Owners have * action permissions
      const resource = createResourceIdentifier(ResourceType.TODO, resourceId);
      const canPerformAnyAction = await permissionService.hasPermission(
        user.id,
        resource,
        'any-custom-action'
      );
      
      expect(canPerformAnyAction).toBe(true);
    });
  });
});