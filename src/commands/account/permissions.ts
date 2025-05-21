import { Flags } from '@oclif/core';
import BaseCommand from '../../base-command';
import { permissionService } from '../../services/permission-service';
import { ActionType, UserRole } from '../../types/permissions';
import { CLIError } from '../../types/error';
import chalk from 'chalk';

/**
 * Manage user permissions and roles
 */
export default class PermissionsCommand extends BaseCommand {
  static description = 'Manage user permissions and roles';

  static examples = [
    '$ walrus account:permissions --list-roles',
    '$ walrus account:permissions --grant-role admin --user john',
    '$ walrus account:permissions --revoke-role collaborator --user mary',
    '$ walrus account:permissions --list-permissions --user john',
    '$ walrus account:permissions --grant-permission todo:* create --user john',
    '$ walrus account:permissions --revoke-permission list:shared-123 update --user mary',
  ];

  static flags = {
    ...BaseCommand.flags,
    'list-roles': Flags.boolean({
      description: 'List all available roles',
      exclusive: ['grant-role', 'revoke-role', 'list-permissions', 'grant-permission', 'revoke-permission'],
    }),
    'grant-role': Flags.string({
      description: 'Grant a role to a user',
      options: Object.values(UserRole),
      exclusive: ['list-roles', 'revoke-role', 'list-permissions', 'grant-permission', 'revoke-permission'],
      dependsOn: ['user'],
    }),
    'revoke-role': Flags.string({
      description: 'Revoke a role from a user',
      options: Object.values(UserRole),
      exclusive: ['list-roles', 'grant-role', 'list-permissions', 'grant-permission', 'revoke-permission'],
      dependsOn: ['user'],
    }),
    'list-permissions': Flags.boolean({
      description: 'List permissions for a user',
      exclusive: ['list-roles', 'grant-role', 'revoke-role', 'grant-permission', 'revoke-permission'],
      dependsOn: ['user'],
    }),
    'grant-permission': Flags.string({
      description: 'Grant a permission to a user (resource)',
      exclusive: ['list-roles', 'grant-role', 'revoke-role', 'list-permissions', 'revoke-permission'],
      dependsOn: ['user', 'action'],
    }),
    'revoke-permission': Flags.string({
      description: 'Revoke a permission from a user (resource)',
      exclusive: ['list-roles', 'grant-role', 'revoke-role', 'list-permissions', 'grant-permission'],
      dependsOn: ['user', 'action'],
    }),
    user: Flags.string({
      description: 'Username for the target user',
      dependsOn: ['grant-role', 'revoke-role', 'list-permissions', 'grant-permission', 'revoke-permission'],
    }),
    action: Flags.string({
      description: 'Action for permission grant/revoke',
      options: Object.values(ActionType),
      dependsOn: ['grant-permission', 'revoke-permission'],
    }),
    verify: Flags.boolean({
      description: 'Verify user has a specific permission',
      exclusive: ['list-roles', 'grant-role', 'revoke-role', 'list-permissions', 'grant-permission', 'revoke-permission'],
      dependsOn: ['user', 'resource', 'action'],
    }),
    resource: Flags.string({
      description: 'Resource for permission verification (e.g., todo:123)',
      dependsOn: ['verify'],
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PermissionsCommand);

    if (flags['list-roles']) {
      await this.listRoles();
    } else if (flags['grant-role'] && flags.user) {
      await this.grantRole(flags.user, flags['grant-role'] as UserRole);
    } else if (flags['revoke-role'] && flags.user) {
      await this.revokeRole(flags.user, flags['revoke-role'] as UserRole);
    } else if (flags['list-permissions'] && flags.user) {
      await this.listPermissions(flags.user);
    } else if (flags['grant-permission'] && flags.user && flags.action) {
      await this.grantPermission(flags.user, flags['grant-permission'], flags.action as ActionType);
    } else if (flags['revoke-permission'] && flags.user && flags.action) {
      await this.revokePermission(flags.user, flags['revoke-permission'], flags.action as ActionType);
    } else if (flags.verify && flags.user && flags.resource && flags.action) {
      await this.verifyPermission(flags.user, flags.resource, flags.action as ActionType);
    } else {
      this.log('Please specify an action to perform. See --help for details.');
    }
  }

  /**
   * List all available roles
   */
  private async listRoles(): Promise<void> {
    // Define roles with their descriptions for display
    const roles = [
      { name: UserRole.GUEST, description: 'Limited access to public resources only' },
      { name: UserRole.USER, description: 'Standard user with access to own resources' },
      { name: UserRole.COLLABORATOR, description: 'Enhanced access to shared lists' },
      { name: UserRole.ADMIN, description: 'Administrative access to the system' },
      { name: UserRole.SUPER_ADMIN, description: 'Complete system access' },
    ];

    this.log(chalk.bold('Available roles:'));
    
    for (const role of roles) {
      this.log(`${chalk.green(role.name)}: ${role.description}`);
    }
  }

  /**
   * Grant a role to a user
   */
  private async grantRole(username: string, role: UserRole): Promise<void> {
    try {
      // Find user by username
      const user = await permissionService.getUserByUsername(username);
      if (!user) {
        throw new CLIError(`User ${username} not found`, 'USER_NOT_FOUND');
      }

      // Grant role
      await permissionService.assignRoleToUser(user.id, role);
      this.log(chalk.green(`Role ${role} granted to user ${username}`));
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(error.message);
      } else {
        this.error(`Failed to grant role: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Revoke a role from a user
   */
  private async revokeRole(username: string, role: UserRole): Promise<void> {
    try {
      // Find user by username
      const user = await permissionService.getUserByUsername(username);
      if (!user) {
        throw new CLIError(`User ${username} not found`, 'USER_NOT_FOUND');
      }

      // Revoke role
      await permissionService.removeRoleFromUser(user.id, role);
      this.log(chalk.green(`Role ${role} revoked from user ${username}`));
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(error.message);
      } else {
        this.error(`Failed to revoke role: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * List permissions for a user
   */
  private async listPermissions(username: string): Promise<void> {
    try {
      // Find user by username
      const user = await permissionService.getUserByUsername(username);
      if (!user) {
        throw new CLIError(`User ${username} not found`, 'USER_NOT_FOUND');
      }

      // Get permissions
      const permissions = await permissionService.getUserPermissions(user.id);

      this.log(chalk.bold(`Permissions for user ${username}:`));
      
      if (permissions.length === 0) {
        this.log('No permissions found');
        return;
      }

      // Group permissions by resource
      const byResource: Record<string, string[]> = {};
      for (const permission of permissions) {
        if (!byResource[permission.resource]) {
          byResource[permission.resource] = [];
        }
        byResource[permission.resource].push(permission.action);
      }

      // Display permissions
      for (const [resource, actions] of Object.entries(byResource)) {
        this.log(`${chalk.green(resource)}: ${actions.join(', ')}`);
      }
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(error.message);
      } else {
        this.error(`Failed to list permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Grant a permission to a user
   */
  private async grantPermission(username: string, resource: string, action: ActionType): Promise<void> {
    try {
      // Find user by username
      const user = await permissionService.getUserByUsername(username);
      if (!user) {
        throw new CLIError(`User ${username} not found`, 'USER_NOT_FOUND');
      }

      // Grant permission
      await permissionService.grantPermission(user.id, {
        resource,
        action,
      });

      this.log(chalk.green(`Permission '${action}' on '${resource}' granted to user ${username}`));
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(error.message);
      } else {
        this.error(`Failed to grant permission: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Revoke a permission from a user
   */
  private async revokePermission(username: string, resource: string, action: ActionType): Promise<void> {
    try {
      // Find user by username
      const user = await permissionService.getUserByUsername(username);
      if (!user) {
        throw new CLIError(`User ${username} not found`, 'USER_NOT_FOUND');
      }

      // Revoke permission
      await permissionService.revokePermission(user.id, resource, action);

      this.log(chalk.green(`Permission '${action}' on '${resource}' revoked from user ${username}`));
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(error.message);
      } else {
        this.error(`Failed to revoke permission: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Verify if a user has a specific permission
   */
  private async verifyPermission(username: string, resource: string, action: ActionType): Promise<void> {
    try {
      // Find user by username
      const user = await permissionService.getUserByUsername(username);
      if (!user) {
        throw new CLIError(`User ${username} not found`, 'USER_NOT_FOUND');
      }

      // Check permission
      const hasPermission = await permissionService.hasPermission(user.id, resource, action);

      if (hasPermission) {
        this.log(chalk.green(`User ${username} has permission to ${action} on ${resource}`));
      } else {
        this.log(chalk.red(`User ${username} does NOT have permission to ${action} on ${resource}`));
      }
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(error.message);
      } else {
        this.error(`Failed to verify permission: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
}