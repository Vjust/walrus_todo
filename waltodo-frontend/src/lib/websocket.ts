'use client';

import { io, Socket } from 'socket.io-client';
import { queryClient, queryKeys, invalidateQueries } from './queryClient';
import { Todo } from '../types/todo';

export interface ServerToClientEvents {
  TODO_CREATED: (data: { todo: Todo; listName: string }) => void;
  TODO_UPDATED: (data: { todo: Todo; listName: string }) => void;
  TODO_DELETED: (data: { todoId: string; listName: string }) => void;
  TODO_COMPLETED: (data: { todo: Todo; listName: string }) => void;
  LIST_CREATED: (data: { listName: string }) => void;
  LIST_DELETED: (data: { listName: string }) => void;
  SYNC_STARTED: (data: { todoId: string; type: 'walrus' | 'blockchain' }) => void;
  SYNC_COMPLETED: (data: { todoId: string; type: 'walrus' | 'blockchain'; result: any }) => void;
  SYNC_FAILED: (data: { todoId: string; type: 'walrus' | 'blockchain'; error: string }) => void;
}

export interface ClientToServerEvents {
  JOIN_ROOM: (room: string) => void;
  LEAVE_ROOM: (room: string) => void;
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
      
      // Rejoin room if we were in one
      if (this.currentRoom) {
        this.joinRoom(this.currentRoom);
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
    this.socket.on('TODO_CREATED', ({ todo, listName }) => {
      console.log('📝 Todo created:', todo.title);
      
      // Update the todos list cache
      queryClient.setQueryData(queryKeys.todos.list(listName), (oldData: Todo[] | undefined) => {
        if (!oldData) return [todo];
        return [...oldData, todo];
      });
      
      // Invalidate related queries
      invalidateQueries.todos(listName);
    });

    this.socket.on('TODO_UPDATED', ({ todo, listName }) => {
      console.log('📝 Todo updated:', todo.title);
      
      // Update specific todo in cache
      queryClient.setQueryData(queryKeys.todos.detail(todo.id), todo);
      
      // Update todo in list cache
      queryClient.setQueryData(queryKeys.todos.list(listName), (oldData: Todo[] | undefined) => {
        if (!oldData) return [todo];
        return oldData.map(t => t.id === todo.id ? todo : t);
      });
      
      invalidateQueries.todoDetail(todo.id);
    });

    this.socket.on('TODO_DELETED', ({ todoId, listName }) => {
      console.log('🗑️ Todo deleted:', todoId);
      
      // Remove from list cache
      queryClient.setQueryData(queryKeys.todos.list(listName), (oldData: Todo[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter(t => t.id !== todoId);
      });
      
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: queryKeys.todos.detail(todoId) });
      
      invalidateQueries.todos(listName);
    });

    this.socket.on('TODO_COMPLETED', ({ todo, listName }) => {
      console.log('✅ Todo completed:', todo.title);
      
      // Update specific todo in cache
      queryClient.setQueryData(queryKeys.todos.detail(todo.id), todo);
      
      // Update todo in list cache
      queryClient.setQueryData(queryKeys.todos.list(listName), (oldData: Todo[] | undefined) => {
        if (!oldData) return [todo];
        return oldData.map(t => t.id === todo.id ? todo : t);
      });
      
      invalidateQueries.todoDetail(todo.id);
    });

    // List events
    this.socket.on('LIST_CREATED', ({ listName }) => {
      console.log('📋 List created:', listName);
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.lists() });
    });

    this.socket.on('LIST_DELETED', ({ listName }) => {
      console.log('🗑️ List deleted:', listName);
      queryClient.removeQueries({ queryKey: queryKeys.todos.list(listName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.lists() });
    });

    // Sync events
    this.socket.on('SYNC_STARTED', ({ todoId, type }) => {
      console.log(`🔄 Sync started for ${todoId} (${type})`);
      // Could update UI to show sync in progress
    });

    this.socket.on('SYNC_COMPLETED', ({ todoId, type, result }) => {
      console.log(`✅ Sync completed for ${todoId} (${type}):`, result);
      // Invalidate sync status queries
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.sync(todoId) });
      invalidateQueries.todoDetail(todoId);
    });

    this.socket.on('SYNC_FAILED', ({ todoId, type, error }) => {
      console.error(`❌ Sync failed for ${todoId} (${type}):`, error);
      // Could show error notification
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.sync(todoId) });
    });
  }

  joinRoom(room: string) {
    if (!this.socket?.connected) {
      console.warn('🔌 Cannot join room: WebSocket not connected');
      return;
    }

    this.currentRoom = room;
    this.socket.emit('JOIN_ROOM', room);
    console.log('🏠 Joined room:', room);
  }

  leaveRoom(room: string) {
    if (!this.socket?.connected) return;

    if (this.currentRoom === room) {
      this.currentRoom = null;
    }
    
    this.socket.emit('LEAVE_ROOM', room);
    console.log('🚪 Left room:', room);
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
  const joinRoom = (room: string) => websocketManager.joinRoom(room);
  const leaveRoom = (room: string) => websocketManager.leaveRoom(room);
  
  return {
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    connected: websocketManager.connected,
    socketId: websocketManager.socketId,
  };
}