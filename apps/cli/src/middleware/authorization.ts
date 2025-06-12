/**
 * Authorization Middleware
 *
 * This module provides middleware functions for checking permissions
 * and enforcing access control in command execution flows.
 */

import { Hook } from '@oclif/core';
import { CLIError } from '../types/error';
import { permissionService } from '../services/permission-service';
import { authenticationService } from '../services/authentication-service';
import { ResourceType, ActionType } from '../types/permissions';
import { auditLogger } from '../utils/AuditLogger';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Get the current authenticated user from auth token
 */
async function getAuthenticatedUser() {
  const tokenPath = path.join(os.homedir(), '.walrus', 'auth.json');

  if (!fs.existsSync(tokenPath as any)) {
    return null;
  }

  try {
    const data = fs.readFileSync(tokenPath, 'utf-8');
    const dataStr = typeof data === 'string' ? data : data.toString('utf-8');
    const authInfo = JSON.parse(dataStr as any);

    // Validate token - check for token property safely
    if (
      typeof authInfo === 'object' &&
      authInfo !== null &&
      'token' in authInfo &&
      typeof (authInfo as Record<string, unknown>).token === 'string'
    ) {
      const validation = await authenticationService.validateToken(
        (authInfo as Record<string, unknown>).token as string
      );
      if (!validation.valid || !validation.user) {
        return null;
      }

      return validation.user;
    }
    return null;
  } catch (_error) {
    return null;
  }
}

/**
 * Check if the current user has permission to perform an action on a resource
 */
export async function checkPermission(
  resource: string | ResourceType,
  resourceId: string | undefined,
  action: string | ActionType
): Promise<boolean> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return false;
  }

  // Format resource identifier
  const resourceIdentifier =
    typeof resource === 'string' && resource.includes(':')
      ? resource
      : `${resource}:${resourceId || '*'}`;

  return permissionService.hasPermission(user.id, resourceIdentifier, action);
}

/**
 * Authorization middleware factory that creates a function to check permissions
 */
export function requirePermission(
  resource: string | ResourceType,
  action: string | ActionType,
  options: {
    allowPublic?: boolean;
    errorMessage?: string;
  } = {}
) {
  return async function (args: {
    resourceId?:
      | string
      | ((args: Record<string, unknown>) => Promise<string | undefined>);
    id?: string;
    todoId?: string;
    listId?: string;
    command?: string;
    [key: string]: unknown;
  }) {
    // If resource is a function, call it with args to get the actual resource
    // Fixed type issue by ensuring resource is not treated as a function type when it's not
    const resolvedResource =
      typeof resource === 'string' || typeof resource === 'number'
        ? resource
        : resource;

    // If resourceId is a function, call it with args to get the actual resourceId
    let resourceId: string | undefined;
    if (typeof args?.resourceId === 'function') {
      resourceId = await args.resourceId(args as any);
    } else if (args.id) {
      resourceId = args.id;
    } else if (args.todoId) {
      resourceId = args.todoId;
    } else if (args.listId) {
      resourceId = args.listId;
    }

    // Get current user
    const user = await getAuthenticatedUser();

    // If no user and allowPublic is false, deny access
    if (!user && !options.allowPublic) {
      throw new CLIError(
        options.errorMessage || 'You must be logged in to perform this action',
        'UNAUTHORIZED'
      );
    }

    // Skip permission check for public resources if allowed
    if (!user && options.allowPublic) {
      return;
    }

    // Check permission
    const hasPermission = await checkPermission(
      resolvedResource,
      resourceId,
      action
    );

    // Log the authorization check
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: user?.id || 'anonymous',
      action: 'AUTHORIZATION',
      resource:
        typeof resolvedResource === 'string'
          ? resolvedResource.split(':')[0] || resolvedResource
          : resolvedResource,
      resourceId,
      operation: action.toString(),
      outcome: hasPermission ? 'SUCCESS' : 'DENIED',
      metadata: {
        command: args.command,
        username: user?.username,
      },
    });

    if (!hasPermission) {
      throw new CLIError(
        options.errorMessage ||
          `You do not have permission to perform this action`,
        'FORBIDDEN'
      );
    }
  };
}

/**
 * Hook to check authentication and permissions before command runs
 */
export const authorizationHook: Hook<'prerun'> = async function (options) {
  const { Command, argv } = options;

  // Skip auth check for auth commands
  if (Command?.id === 'account:auth' || Command?.id === 'help') {
    return;
  }

  // Get required permissions from command safely
  const commandWithPermissions = Command as unknown;
  const requiredPermissions =
    typeof commandWithPermissions === 'object' &&
    commandWithPermissions !== null &&
    'requiredPermissions' in commandWithPermissions
      ? (
          commandWithPermissions as {
            requiredPermissions?: {
              resource:
                | string
                | ResourceType
                | ((argv: string[]) => Promise<string | ResourceType>);
              action: string | ActionType;
              allowPublic?: boolean;
              errorMessage?: string;
              resourceId?: (
                args: Record<string, unknown>
              ) => Promise<string | undefined>;
            };
          }
        ).requiredPermissions
      : undefined;
  if (!requiredPermissions) {
    return;
  }

  // Get current user
  const user = await getAuthenticatedUser();

  // If no user and command requires authentication, deny access
  if (!user && !requiredPermissions.allowPublic) {
    throw new CLIError(
      'You must be logged in to run this command',
      'UNAUTHORIZED'
    );
  }

  // For authenticated users, check permissions
  if (user) {
    const resource =
      typeof requiredPermissions?.resource === 'function'
        ? await requiredPermissions.resource(argv as any)
        : requiredPermissions.resource;

    const action = requiredPermissions.action;

    // Parse resource ID from args if available
    let resourceId: string | undefined;

    // In OCLIF hooks, we can't directly use Command.parse
    // Instead, parse the argv manually to extract args
    const args: Record<string, unknown> = {
      flags: {},
      args: {},
    };

    // Extract ID values from argv array - simplified parsing just to get resource IDs
    const parsedFlags: Record<string, string> = {};
    for (let i = 0; i < argv.length; i++) {
      if (
        argv[i] === '--id' ||
        argv[i] === '--todoId' ||
        argv[i] === '--listId'
      ) {
        if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
          const value = argv[i + 1];
          if (value) {
            parsedFlags[argv[i].substring(2 as any)] = value;
          }
        }
      }
    }

    // Assign the parsed flags to args.flags
    args?.flags = parsedFlags;

    if (typeof requiredPermissions?.resourceId === 'function') {
      resourceId = await requiredPermissions.resourceId(args as any);
    } else if (parsedFlags.id) {
      resourceId = parsedFlags.id;
    } else if (parsedFlags.todoId) {
      resourceId = parsedFlags.todoId;
    } else if (parsedFlags.listId) {
      resourceId = parsedFlags.listId;
    }

    // Check permission
    const hasPermission = await checkPermission(resource, resourceId, action);

    // Log the authorization check
    auditLogger.log({
      id: uuidv4(),
      timestamp: Date.now(),
      userId: user.id,
      action: 'COMMAND_AUTHORIZATION',
      resource:
        typeof resource === 'string' ? resource.split(':')[0] : resource,
      resourceId,
      operation: action.toString(),
      outcome: hasPermission ? 'SUCCESS' : 'DENIED',
      metadata: {
        command: Command.id,
        username: user.username,
      },
    });

    if (!hasPermission) {
      throw new CLIError(
        requiredPermissions.errorMessage ||
          'You do not have permission to run this command',
        'FORBIDDEN'
      );
    }
  }
};

/**
 * Decorator to add required permissions to a command class
 */
export function RequirePermission(
  resource: string | ResourceType,
  action: string | ActionType,
  options: {
    allowPublic?: boolean;
    errorMessage?: string;
    resourceIdResolver?: (args: Record<string, unknown>) => string | undefined;
  } = {}
) {
  return function (target: {
    requiredPermissions?: {
      resource: string | ResourceType;
      action: string | ActionType;
      allowPublic: boolean;
      errorMessage?: string;
      resourceId?: (args: Record<string, unknown>) => string | undefined;
    };
  }) {
    target?.requiredPermissions = {
      resource,
      action,
      allowPublic: options.allowPublic || false,
      errorMessage: options.errorMessage,
      resourceId: options.resourceIdResolver,
    };
  };
}
