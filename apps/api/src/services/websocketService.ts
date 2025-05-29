import { Server as SocketIOServer, Socket, ServerOptions } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Todo } from '../types';
import { isValidWallet } from '../middleware/auth';

export interface WalletSocket extends Socket {
  wallet?: string;
}

export class WebSocketService {
  private io: SocketIOServer;
  private walletSockets: Map<string, Set<string>> = new Map(); // wallet -> set of socket ids

  constructor(httpServer: HTTPServer) {
    const serverOptions: Partial<ServerOptions> = {
      cors: {
        origin: config.cors.origins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: config.websocket.pingTimeout,
      pingInterval: config.websocket.pingInterval,
    };
    
    this.io = new SocketIOServer(httpServer, serverOptions);

    this.setupEventHandlers();
    logger.info('WebSocket service initialized');
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: WalletSocket) => {
      logger.info('Client connected', { socketId: socket.id });

      // Handle wallet authentication
      socket.on('authenticate', (data: { wallet: string }) => {
        this.authenticateSocket(socket, data.wallet);
      });

      // Handle joining wallet room
      socket.on('join-wallet', (data: { wallet: string }) => {
        this.joinWalletRoom(socket, data.wallet);
      });

      // Handle leaving wallet room
      socket.on('leave-wallet', (data: { wallet: string }) => {
        this.leaveWalletRoom(socket, data.wallet);
      });

      // Handle sync request
      socket.on('sync-request', (data: { wallet: string }) => {
        this.handleSyncRequest(socket, data.wallet);
      });

      // Handle disconnect
      socket.on('disconnect', reason => {
        logger.info('Client disconnected', {
          socketId: socket.id,
          wallet: socket.wallet,
          reason,
        });
        this.handleDisconnect(socket);
      });

      // Handle errors
      socket.on('error', error => {
        logger.error('Socket error', {
          socketId: socket.id,
          wallet: socket.wallet,
          error,
        });
      });
    });
  }

  private authenticateSocket(socket: WalletSocket, wallet: string): void {
    if (!isValidWallet(wallet)) {
      socket.emit('auth-error', { message: 'Invalid wallet address' });
      return;
    }

    socket.wallet = wallet;
    socket.emit('auth-success', { wallet });

    logger.info('Socket authenticated', {
      socketId: socket.id,
      wallet,
    });
  }

  private joinWalletRoom(socket: WalletSocket, wallet: string): void {
    if (!isValidWallet(wallet)) {
      socket.emit('error', { message: 'Invalid wallet address' });
      return;
    }

    const roomName = `wallet:${wallet}`;
    socket.join(roomName);

    // Track socket for this wallet
    if (!this.walletSockets.has(wallet)) {
      this.walletSockets.set(wallet, new Set());
    }
    const walletSockets = this.walletSockets.get(wallet);
    if (walletSockets) {
      walletSockets.add(socket.id);
    }

    socket.emit('joined-wallet', { wallet });

    logger.info('Socket joined wallet room', {
      socketId: socket.id,
      wallet,
      roomSize: walletSockets?.size || 0,
    });
  }

  private leaveWalletRoom(socket: WalletSocket, wallet: string): void {
    const roomName = `wallet:${wallet}`;
    socket.leave(roomName);

    // Remove socket tracking
    const socketSet = this.walletSockets.get(wallet);
    if (socketSet) {
      socketSet.delete(socket.id);
      if (socketSet.size === 0) {
        this.walletSockets.delete(wallet);
      }
    }

    socket.emit('left-wallet', { wallet });

    logger.info('Socket left wallet room', {
      socketId: socket.id,
      wallet,
    });
  }

  private handleSyncRequest(socket: WalletSocket, wallet: string): void {
    if (!socket.wallet || socket.wallet !== wallet) {
      socket.emit('error', { message: 'Unauthorized wallet access' });
      return;
    }

    // Broadcast sync request to other clients for this wallet
    socket.to(`wallet:${wallet}`).emit('sync-requested', { wallet });

    logger.info('Sync requested', {
      socketId: socket.id,
      wallet,
    });
  }

  private handleDisconnect(socket: WalletSocket): void {
    if (socket.wallet) {
      const socketSet = this.walletSockets.get(socket.wallet);
      if (socketSet) {
        socketSet.delete(socket.id);
        if (socketSet.size === 0) {
          this.walletSockets.delete(socket.wallet);
        }
      }
    }
  }

  // Public methods for broadcasting events

  public broadcastTodoCreated(todo: Todo): void {
    const roomName = `wallet:${todo.wallet}`;
    this.io.to(roomName).emit('todo-created', todo);

    logger.debug('Broadcasted todo created', {
      todoId: todo.id,
      wallet: todo.wallet,
    });
  }

  public broadcastTodoUpdated(todo: Todo): void {
    const roomName = `wallet:${todo.wallet}`;
    this.io.to(roomName).emit('todo-updated', todo);

    logger.debug('Broadcasted todo updated', {
      todoId: todo.id,
      wallet: todo.wallet,
    });
  }

  public broadcastTodoDeleted(todoId: string, wallet: string): void {
    const roomName = `wallet:${wallet}`;
    this.io.to(roomName).emit('todo-deleted', { id: todoId, wallet });

    logger.debug('Broadcasted todo deleted', {
      todoId,
      wallet,
    });
  }

  public broadcastTodoCompleted(todo: Todo): void {
    const roomName = `wallet:${todo.wallet}`;
    this.io.to(roomName).emit('todo-completed', todo);

    logger.debug('Broadcasted todo completed', {
      todoId: todo.id,
      wallet: todo.wallet,
    });
  }

  public broadcastError(
    wallet: string,
    error: { message: string; code?: string }
  ): void {
    const roomName = `wallet:${wallet}`;
    this.io.to(roomName).emit('error', error);

    logger.debug('Broadcasted error', {
      wallet,
      error,
    });
  }

  // Generic broadcast method for any event type
  public broadcast(event: { type: string; data: any; wallet: string }): void {
    const roomName = `wallet:${event.wallet}`;
    this.io.to(roomName).emit(event.type.toLowerCase().replace(/_/g, '-'), event.data);

    logger.debug('Broadcasted event', {
      type: event.type,
      wallet: event.wallet,
    });
  }

  // Stats and monitoring

  public getStats(): {
    connectedClients: number;
    walletsWithClients: number;
    socketsByWallet: Record<string, number>;
  } {
    const socketsByWallet: Record<string, number> = {};
    let totalClients = 0;

    this.walletSockets.forEach((sockets, wallet) => {
      socketsByWallet[wallet] = sockets.size;
      totalClients += sockets.size;
    });

    return {
      connectedClients: totalClients,
      walletsWithClients: this.walletSockets.size,
      socketsByWallet,
    };
  }

  public getSocketServer(): SocketIOServer {
    return this.io;
  }
}
