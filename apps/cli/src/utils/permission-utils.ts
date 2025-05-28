/**
 * Permission Utilities
 *
 * Helper functions for working with permissions, roles, and access control.
 */

import {
  ResourceType,
  ActionType,
  createResourceIdentifier,
} from '../types/permissions';
import { Todo, TodoList } from '../types/todo';
import { permissionService } from '../services/permission-service';

/**
 * Check if a user is the owner of a todo
 */
export async function isOwnerOfTodo(
  userId: string,
  todo: Todo
): Promise<boolean> {
  // If todo has a specific owner field, check that
  if (todo.private) {
    return true; // Private todos are only accessible by owner
  }

  // Check resource ownership through permission service
  return permissionService.isResourceOwner(userId, ResourceType.TODO, todo.id);
}

/**
 * Check if a user is the owner of a todo list
 */
export async function isOwnerOfList(
  userId: string,
  list: TodoList
): Promise<boolean> {
  // Check owner field
  if (list.owner === userId) {
    return true;
  }

  // Check resource ownership through permission service
  return permissionService.isResourceOwner(userId, ResourceType.LIST, list.id);
}

/**
 * Check if a user is a collaborator on a todo list
 */
export async function isCollaboratorOnList(
  userId: string,
  list: TodoList
): Promise<boolean> {
  // Check collaborators array
  if (list.collaborators && list.collaborators.includes(userId)) {
    return true;
  }

  // Check collaborator permissions
  return permissionService.hasPermission(
    userId,
    createResourceIdentifier(ResourceType.LIST, list.id),
    ActionType.UPDATE
  );
}

/**
 * Check if a user can access a todo
 */
export async function canAccessTodo(
  userId: string,
  todo: Todo
): Promise<boolean> {
  // Private todos are only accessible by owner
  if (todo.private) {
    return isOwnerOfTodo(userId, todo);
  }

  // Check read permission
  return permissionService.hasPermission(
    userId,
    createResourceIdentifier(ResourceType.TODO, todo.id),
    ActionType.READ
  );
}

/**
 * Check if a user can modify a todo
 */
export async function canModifyTodo(
  userId: string,
  todo: Todo
): Promise<boolean> {
  // First check if user is owner
  if (await isOwnerOfTodo(userId, todo)) {
    return true;
  }

  // Then check update permission
  return permissionService.hasPermission(
    userId,
    createResourceIdentifier(ResourceType.TODO, todo.id),
    ActionType.UPDATE
  );
}

/**
 * Check if a user can access a todo list
 */
export async function canAccessList(
  userId: string,
  list: TodoList
): Promise<boolean> {
  // Check if user is owner or collaborator
  if (
    (await isOwnerOfList(userId, list)) ||
    (await isCollaboratorOnList(userId, list))
  ) {
    return true;
  }

  // Check read permission
  return permissionService.hasPermission(
    userId,
    createResourceIdentifier(ResourceType.LIST, list.id),
    ActionType.READ
  );
}

/**
 * Check if a user can modify a todo list
 */
export async function canModifyList(
  userId: string,
  list: TodoList
): Promise<boolean> {
  // Check if user is owner
  if (await isOwnerOfList(userId, list)) {
    return true;
  }

  // Check if user is collaborator
  if (await isCollaboratorOnList(userId, list)) {
    return permissionService.hasPermission(
      userId,
      createResourceIdentifier(ResourceType.LIST, list.id),
      ActionType.UPDATE
    );
  }

  return false;
}

/**
 * Setup owner permissions for a new todo
 */
export async function setupTodoOwnerPermissions(
  userId: string,
  todoId: string
): Promise<void> {
  await permissionService.createOwnerPermissions(
    userId,
    ResourceType.TODO,
    todoId
  );
}

/**
 * Setup owner permissions for a new todo list
 */
export async function setupListOwnerPermissions(
  userId: string,
  listId: string
): Promise<void> {
  await permissionService.createOwnerPermissions(
    userId,
    ResourceType.LIST,
    listId
  );
}

/**
 * Setup collaborator permissions for a todo list
 */
export async function setupCollaboratorPermissions(
  userId: string,
  listId: string,
  permissions: ActionType[] = [ActionType.READ, ActionType.UPDATE]
): Promise<void> {
  await permissionService.grantCollaboratorPermissions(
    userId,
    listId,
    permissions
  );
}

/**
 * Check if current operation requires blockchain verification
 */
export function requiresBlockchainVerification(
  resourceType: ResourceType,
  action: ActionType
): boolean {
  // List of operations that require blockchain verification
  const verifiedOperations: [ResourceType, ActionType][] = [
    [ResourceType.TODO, ActionType.TRANSFER_OWNERSHIP],
    [ResourceType.LIST, ActionType.SHARE],
    [ResourceType.STORAGE, ActionType.MANAGE_ALLOCATION],
    [ResourceType.AI, ActionType.TRAIN],
    [ResourceType.SYSTEM, ActionType.MANAGE_USERS],
    [ResourceType.SYSTEM, ActionType.MANAGE_ROLES],
  ];

  return verifiedOperations.some(
    ([r, a]) => r === resourceType && a === action
  );
}
