'use client';

import { io, Socket } from 'socket.io-client';
import { queryClient, queryKeys, invalidateQueries } from './queryClient';
import { Todo } from '../types/todo';

export interface ServerToClientEvents {
  'todo-created': (todo: Todo) => void;
  'todo-updated': (todo: Todo) => void;
  'todo-deleted': (data: { id: string; wallet: string }) => void;
  'todo-completed': (todo: Todo) => void;
  'sync-requested': (data: { wallet: string }) => void;
  'auth-success': (data: { wallet: string }) => void;
  'auth-error': (data: { message: string }) => void;
  'joined-wallet': (data: { wallet: string }) => void;
  'left-wallet': (data: { wallet: string }) => void;
  error: (error: any) => void;
}

export interface ClientToServerEvents {
  authenticate: (data: { wallet: string }) => void;
  'join-wallet': (data: { wallet: string }) => void;
  'leave-wallet': (data: { wallet: string }) => void;
  'sync-request': (data: { wallet: string }) => void;
}

class WebSocketManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private currentRoom: string | null = null;

  connect() {
    if (this.socket?.connected) return;

    const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Rejoin wallet if we were in one
      if (this.currentRoom) {
        this.joinWallet(this.currentRoom);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('🔌 Max reconnection attempts reached');
      }
    });

    // Todo events with optimistic updates
    this.socket.on('todo-created', (todo: Todo) => {
      console.log('📝 Todo created:', todo.title);
      
      // Update the todos list cache
      queryClient.setQueryData(queryKeys.todos.list('default'), (oldData: Todo[] | undefined) => {
        if (!oldData) return [todo];
        return [...oldData, todo];
      });
      
      // Invalidate related queries
      invalidateQueries.todos('default');
    });

    this.socket.on('todo-updated', (todo: Todo) => {
      console.log('📝 Todo updated:', todo.title);
      
      // Update specific todo in cache
      queryClient.setQueryData(queryKeys.todos.detail(todo.id), todo);
      
      // Update todo in list cache
      queryClient.setQueryData(queryKeys.todos.list('default'), (oldData: Todo[] | undefined) => {
        if (!oldData) return [todo];
        return oldData.map(t => t.id === todo.id ? todo : t);
      });
      
      invalidateQueries.todoDetail(todo.id);
    });

    this.socket.on('todo-deleted', (data: { id: string; wallet: string }) => {
      console.log('🗑️ Todo deleted:', data.id);
      
      // Remove from list cache
      queryClient.setQueryData(queryKeys.todos.list('default'), (oldData: Todo[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter(t => t.id !== data.id);
      });
      
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: queryKeys.todos.detail(data.id) });
      
      invalidateQueries.todos('default');
    });

    this.socket.on('todo-completed', (todo: Todo) => {
      console.log('✅ Todo completed:', todo.title);
      
      // Update specific todo in cache
      queryClient.setQueryData(queryKeys.todos.detail(todo.id), todo);
      
      // Update todo in list cache
      queryClient.setQueryData(queryKeys.todos.list('default'), (oldData: Todo[] | undefined) => {
        if (!oldData) return [todo];
        return oldData.map(t => t.id === todo.id ? todo : t);
      });
      
      invalidateQueries.todoDetail(todo.id);
    });

    // Auth events
    this.socket.on('auth-success', (data: { wallet: string }) => {
      console.log('🔐 Authenticated with wallet:', data.wallet);
    });

    this.socket.on('auth-error', (data: { message: string }) => {
      console.error('🔐 Authentication failed:', data.message);
    });

    this.socket.on('joined-wallet', (data: { wallet: string }) => {
      console.log('🏠 Joined wallet room:', data.wallet);
    });

    this.socket.on('left-wallet', (data: { wallet: string }) => {
      console.log('🚪 Left wallet room:', data.wallet);
    });

    // Sync events
    this.socket.on('sync-requested', (data: { wallet: string }) => {
      console.log('🔄 Sync requested for wallet:', data.wallet);
      // Invalidate all queries to refetch data
      queryClient.invalidateQueries();
    });
  }

  joinWallet(wallet: string) {
    if (!this.socket?.connected) {
      console.warn('🔌 Cannot join wallet: WebSocket not connected');
      return;
    }

    this.currentRoom = wallet;
    this.socket.emit('authenticate', { wallet });
    this.socket.emit('join-wallet', { wallet });
    console.log('🏠 Joined wallet:', wallet);
  }

  leaveWallet(wallet: string) {
    if (!this.socket?.connected) return;

    if (this.currentRoom === wallet) {
      this.currentRoom = null;
    }
    
    this.socket.emit('leave-wallet', { wallet });
    console.log('🚪 Left wallet:', wallet);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentRoom = null;
      console.log('🔌 WebSocket disconnected manually');
    }
  }

  get connected() {
    return this.isConnected && this.socket?.connected;
  }

  get socketId() {
    return this.socket?.id;
  }
}

// Export singleton instance
export const websocketManager = new WebSocketManager();

// React hook for using WebSocket
export function useWebSocket() {
  const connect = () => websocketManager.connect();
  const disconnect = () => websocketManager.disconnect();
  const joinWallet = (wallet: string) => websocketManager.joinWallet(wallet);
  const leaveWallet = (wallet: string) => websocketManager.leaveWallet(wallet);
  
  return {
    connect,
    disconnect,
    joinWallet,
    leaveWallet,
    connected: websocketManager.connected,
    socketId: websocketManager.socketId,
  };
}