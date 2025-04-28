export interface Todo {
  id: string;
  task: string;
  description?: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  walrusBlobId?: string;
  isEncrypted?: boolean;
  isTest?: boolean;
  private?: boolean;
}

export interface TodoList {
  id: string;
  name: string;
  owner: string;
  todos: Todo[];
  version: number;
  collaborators?: string[];
  lastSynced?: string;
}
