/**
 * Represents a todo item
 */
export interface Todo {
    /** Unique identifier for the todo */
    id: string;
    /** Title of the todo item */
    title: string;
    /** Task description */
    task: string;
    /** Detailed description of the todo item */
    description?: string;
    /** Whether the todo is completed */
    completed: boolean;
    /** Priority level of the todo */
    priority: 'high' | 'medium' | 'low';
    /** Due date of the todo in YYYY-MM-DD format */
    dueDate?: string;
    /** Tags associated with the todo */
    tags: string[];
    /** Creation timestamp (ISO string) */
    createdAt: string;
    /** Last update timestamp (ISO string) */
    updatedAt: string;
    /** Completion timestamp (ISO string) */
    completedAt?: string;
    /** Whether the todo is private (stored only locally) */
    private: boolean;
}
/**
 * Represents a collection of todo items
 */
export interface TodoList {
    /** Unique identifier for the todo list */
    id: string;
    /** Name of the todo list */
    name: string;
    /** Owner's identifier */
    owner: string;
    /** Array of todo items in the list */
    todos: Todo[];
    /** Version number for the list */
    version: number;
    /** List of users who can access this list */
    collaborators?: string[];
    /** Creation timestamp (ISO string) */
    createdAt: string;
    /** Last update timestamp (ISO string) */
    updatedAt: string;
}
