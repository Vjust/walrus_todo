/**
 * Todo model and type definitions
 */

export type Priority = 'low' | 'medium' | 'high';
export type TodoStatus = 'pending' | 'done';

export interface Todo {
  id: string;
  description: string;
  priority: Priority;
  status: TodoStatus;
  tags: string[];
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  walrusId?: string; // ID in Walrus storage
}