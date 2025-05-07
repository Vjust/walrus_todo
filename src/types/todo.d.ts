export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  private: boolean;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  list?: string;
  walrusBlobId?: string;
  imageUrl?: string;
  nftObjectId?: string;
  storageLocation?: 'local' | 'blockchain' | 'both' | 'walrus';
  completedAt?: string;
}

export interface TodoList {
  id: string;
  name: string;
  owner: string;
  todos: Todo[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodoServiceConfig {
  network: string;
  lastDeployment?: {
    packageId: string;
    todoNftCollectionId?: string;
  } | null;
}

export interface TodoServiceOptions {
  config?: TodoServiceConfig;
  dataDir?: string;
}