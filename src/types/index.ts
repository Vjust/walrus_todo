export type Priority = 'high' | 'medium' | 'low';
export type Network = 'devnet' | 'testnet' | 'mainnet';

export interface Todo {
  id: string;
  description: string;
  completed: boolean;
  priority?: Priority;
  dueDate?: string;
  tags?: string[];
  createdAt: string;
  walrusBlobId?: string;
  private?: boolean;
  encrypted?: boolean;
}

export interface TodoList {
  id: string;
  name: string;
  owner: string;
  todos: Todo[];
  collaborators?: string[];
  version: number;
}

export interface Config {
  network: Network;
  walletAddress?: string;
  privateKey?: string;
}