/**
 * Zod Schema Validation for Todo and TodoList
 *
 * This module provides comprehensive schema validation using Zod to ensure data integrity
 * and prevent serialization/deserialization errors by validating structure and throwing
 * meaningful errors when invalid data is encountered.
 */

import { z } from 'zod';

/**
 * Schema for Todo priority levels
 */
export const TodoPrioritySchema = z.enum(['low', 'medium', 'high'], {
  errorMap: () => ({ message: 'Priority must be one of: low, medium, high' }),
});

/**
 * Schema for Storage Location
 */
export const StorageLocationSchema = z.enum(['local', 'walrus', 'sui'], {
  errorMap: () => ({
    message: 'Storage location must be one of: local, walrus, sui',
  }),
});

/**
 * Core Todo schema with comprehensive validation
 */
export const TodoSchema = z.object(
  {
    id: z
      .string()
      .min(1, 'Todo ID cannot be empty')
      .max(100, 'Todo ID too long (max 100 characters)'),

    title: z
      .string()
      .min(1, 'Todo title cannot be empty')
      .max(256, 'Todo title too long (max 256 characters)')
      .refine(
        title => title.trim().length > 0,
        'Todo title cannot be only whitespace'
      ),

    description: z
      .string()
      .max(2048, 'Todo description too long (max 2048 characters)')
      .optional(),

    completed: z.boolean(),

    priority: TodoPrioritySchema.optional(),

    tags: z
      .array(
        z
          .string()
          .min(1, 'Tag cannot be empty')
          .max(50, 'Tag too long (max 50 characters)')
          .refine(
            tag => !/[<>"'&]/.test(tag),
            'Tag contains invalid characters'
          )
      )
      .max(20, 'Too many tags (max 20)')
      .optional(),

    dueDate: z
      .string()
      .datetime('Invalid due date format (must be ISO 8601)')
      .optional()
      .nullable(),

    createdAt: z
      .string()
      .datetime('Invalid created date format (must be ISO 8601)'),

    updatedAt: z
      .string()
      .datetime('Invalid updated date format (must be ISO 8601)'),

    storageLocation: StorageLocationSchema.optional(),

    walrusBlobId: z
      .string()
      .min(1, 'Walrus blob ID cannot be empty')
      .optional(),

    suiObjectId: z.string().min(1, 'Sui object ID cannot be empty').optional(),

    imageUrl: z.string().url('Invalid image URL format').optional(),
  },
  {
    errorMap: (issue, ctx) => {
      if (issue.code === z.ZodIssueCode.invalid_type) {
        return {
          message: `Expected ${issue.expected} but received ${issue.received} for field "${issue.path.join('.')}"`,
        };
      }
      return { message: ctx.defaultError };
    },
  }
);

/**
 * Schema for TodoList with validation
 */
export const TodoListSchema = z.object(
  {
    id: z
      .string()
      .min(1, 'TodoList ID cannot be empty')
      .max(100, 'TodoList ID too long (max 100 characters)'),

    name: z
      .string()
      .min(1, 'TodoList name cannot be empty')
      .max(100, 'TodoList name too long (max 100 characters)')
      .refine(
        name => name.trim().length > 0,
        'TodoList name cannot be only whitespace'
      )
      .refine(
        name => !/[<>"'&\\/:]/.test(name),
        'TodoList name contains invalid characters'
      ),

    description: z
      .string()
      .max(500, 'TodoList description too long (max 500 characters)')
      .optional(),

    owner: z
      .string()
      .min(1, 'TodoList owner cannot be empty')
      .max(100, 'TodoList owner too long (max 100 characters)'),

    todos: z.array(TodoSchema).max(1000, 'Too many todos in list (max 1000)'),

    version: z
      .number()
      .int('Version must be an integer')
      .min(0, 'Version cannot be negative'),

    collaborators: z
      .array(
        z
          .string()
          .min(1, 'Collaborator address cannot be empty')
          .max(100, 'Collaborator address too long (max 100 characters)')
      )
      .max(50, 'Too many collaborators (max 50)')
      .optional(),

    createdAt: z
      .string()
      .datetime('Invalid created date format (must be ISO 8601)'),

    updatedAt: z
      .string()
      .datetime('Invalid updated date format (must be ISO 8601)'),

    walrusBlobId: z
      .string()
      .min(1, 'Walrus blob ID cannot be empty')
      .optional(),

    suiObjectId: z
      .string()
      .min(1, 'Sui object ID cannot be empty')
      .optional(),

    tags: z
      .array(
        z
          .string()
          .min(1, 'List tag cannot be empty')
          .max(50, 'List tag too long (max 50 characters)')
      )
      .max(10, 'Too many list tags (max 10)')
      .optional(),

    syncedAt: z
      .string()
      .datetime('Invalid synced date format (must be ISO 8601)')
      .optional(),
  },
  {
    errorMap: (issue, ctx) => {
      if (issue.code === z.ZodIssueCode.invalid_type) {
        return {
          message: `Expected ${issue.expected} but received ${issue.received} for field "${issue.path.join('.')}"`,
        };
      }
      return { message: ctx.defaultError };
    },
  }
);

/**
 * Schema for bulk operations
 */
export const TodoListArraySchema = z
  .array(TodoListSchema)
  .max(100, 'Too many todo lists (max 100)');

/**
 * Type inference from schemas
 */
export type TodoSchemaType = z.infer<typeof TodoSchema>;
export type TodoListSchemaType = z.infer<typeof TodoListSchema>;
export type TodoPriorityType = z.infer<typeof TodoPrioritySchema>;
export type StorageLocationType = z.infer<typeof StorageLocationSchema>;

/**
 * Validation functions with detailed error messages
 */

/**
 * Validate a Todo object and throw detailed error on failure
 */
export function validateTodo(todo: unknown): TodoSchemaType {
  try {
    return TodoSchema.parse(todo);
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      const formattedErrors = _error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      throw new Error(`Todo validation failed: ${formattedErrors}`);
    }
    throw new Error(`Todo validation failed: Unknown error`);
  }
}

/**
 * Validate a TodoList object and throw detailed error on failure
 */
export function validateTodoList(todoList: unknown): TodoListSchemaType {
  try {
    return TodoListSchema.parse(todoList);
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      const formattedErrors = _error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      throw new Error(`TodoList validation failed: ${formattedErrors}`);
    }
    throw new Error(`TodoList validation failed: Unknown error`);
  }
}

/**
 * Validate an array of TodoLists
 */
export function validateTodoListArray(
  todoLists: unknown
): TodoListSchemaType[] {
  try {
    return TodoListArraySchema.parse(todoLists);
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      const formattedErrors = _error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      throw new Error(`TodoList array validation failed: ${formattedErrors}`);
    }
    throw new Error(`TodoList array validation failed: Unknown error`);
  }
}

/**
 * Safe validation that returns a result object instead of throwing
 */
export function validateTodoSafe(
  todo: unknown
): { success: true; data: TodoSchemaType } | { success: false; error: string } {
  try {
    const validated = TodoSchema.parse(todo);
    return { success: true, data: validated };
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      const formattedErrors = _error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      return {
        success: false,
        error: `Todo validation failed: ${formattedErrors}`,
      };
    }
    return { success: false, error: 'Todo validation failed: Unknown error' };
  }
}

/**
 * Safe validation for TodoList
 */
export function validateTodoListSafe(
  todoList: unknown
):
  | { success: true; data: TodoListSchemaType }
  | { success: false; error: string } {
  try {
    const validated = TodoListSchema.parse(todoList);
    return { success: true, data: validated };
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      const formattedErrors = _error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      return {
        success: false,
        error: `TodoList validation failed: ${formattedErrors}`,
      };
    }
    return {
      success: false,
      error: 'TodoList validation failed: Unknown error',
    };
  }
}

/**
 * Validation for partial updates (allows partial Todo objects)
 */
export const PartialTodoSchema = TodoSchema.partial().extend({
  id: z.string().min(1, 'Todo ID cannot be empty'), // ID is still required
});

export type PartialTodoType = z.infer<typeof PartialTodoSchema>;

export function validatePartialTodo(todo: unknown): PartialTodoType {
  try {
    return PartialTodoSchema.parse(todo);
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      const formattedErrors = _error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      throw new Error(`Partial Todo validation failed: ${formattedErrors}`);
    }
    throw new Error(`Partial Todo validation failed: Unknown error`);
  }
}
