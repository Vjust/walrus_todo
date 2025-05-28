import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { WebSocketService, WalletSocket } from '../websocketService';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { isValidWallet } from '../../middleware/auth';
import { Todo } from '../../types';

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../config');
jest.mock('../../middleware/auth');

const mockConfig = {
  cors: {
    origins: ['http://localhost:3000', 'http://localhost:3001'],
  },
  websocket: {
    pingTimeout: 60000,
    pingInterval: 25000,
  },
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

const mockIsValidWallet = isValidWallet as jest.MockedFunction<typeof isValidWallet>;

describe('WebSocketService', () => {
  let httpServer: HTTPServer;
  let webSocketService: WebSocketService;
  let clientSocket: ClientSocket;
  let serverSocket: WalletSocket;
  const testWallet = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  beforeAll((done) => {
    // Setup mocks
    (config as any) = mockConfig;
    (logger as any) = mockLogger;
    mockIsValidWallet.mockImplementation((wallet) => wallet === testWallet);

    // Create HTTP server
    httpServer = new HTTPServer();
    httpServer.listen(0, () => {
      const port = (httpServer.address() as any)?.port;
      
      // Initialize WebSocket service
      webSocketService = new WebSocketService(httpServer);
      
      // Create client socket
      clientSocket = ioc(`http://localhost:${port}`);
      
      clientSocket.on('connect', () => {
        done();
      });
    });
  });

  afterAll((done) => {
    clientSocket.close();
    httpServer.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with correct CORS configuration', () => {
      expect(mockLogger.info).toHaveBeenCalledWith('WebSocket service initialized');
    });

    it('should create SocketIO server with correct configuration', () => {
      const socketServer = webSocketService.getSocketServer();
      expect(socketServer).toBeInstanceOf(SocketIOServer);
    });

    it('should setup event handlers on connection', (done) => {
      clientSocket.on('connect', () => {
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Client connected',
          expect.objectContaining({ socketId: expect.any(String) })
        );
        done();
      });
    });
  });

  describe('Authentication', () => {
    it('should authenticate valid wallet', (done) => {
      clientSocket.emit('authenticate', { wallet: testWallet });
      
      clientSocket.on('auth-success', (data) => {
        expect(data.wallet).toBe(testWallet);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Socket authenticated',
          expect.objectContaining({
            socketId: expect.any(String),
            wallet: testWallet,
          })
        );
        done();
      });
    });

    it('should reject invalid wallet', (done) => {
      const invalidWallet = 'invalid-wallet';
      mockIsValidWallet.mockReturnValueOnce(false);
      
      clientSocket.emit('authenticate', { wallet: invalidWallet });
      
      clientSocket.on('auth-error', (data) => {
        expect(data.message).toBe('Invalid wallet address');
        done();
      });
    });
  });

  describe('Wallet Room Management', () => {
    beforeEach((done) => {
      // Authenticate first
      clientSocket.emit('authenticate', { wallet: testWallet });
      clientSocket.on('auth-success', () => done());
    });

    it('should join wallet room successfully', (done) => {
      clientSocket.emit('join-wallet', { wallet: testWallet });
      
      clientSocket.on('joined-wallet', (data) => {
        expect(data.wallet).toBe(testWallet);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Socket joined wallet room',
          expect.objectContaining({
            socketId: expect.any(String),
            wallet: testWallet,
            roomSize: 1,
          })
        );
        done();
      });
    });

    it('should reject joining with invalid wallet', (done) => {
      const invalidWallet = 'invalid';
      mockIsValidWallet.mockReturnValueOnce(false);
      
      clientSocket.emit('join-wallet', { wallet: invalidWallet });
      
      clientSocket.on('error', (data) => {
        expect(data.message).toBe('Invalid wallet address');
        done();
      });
    });

    it('should leave wallet room successfully', (done) => {
      // First join the room
      clientSocket.emit('join-wallet', { wallet: testWallet });
      
      clientSocket.on('joined-wallet', () => {
        clientSocket.emit('leave-wallet', { wallet: testWallet });
      });
      
      clientSocket.on('left-wallet', (data) => {
        expect(data.wallet).toBe(testWallet);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Socket left wallet room',
          expect.objectContaining({
            socketId: expect.any(String),
            wallet: testWallet,
          })
        );
        done();
      });
    });
  });

  describe('Sync Requests', () => {
    beforeEach((done) => {
      // Authenticate and join room
      clientSocket.emit('authenticate', { wallet: testWallet });
      clientSocket.on('auth-success', () => {
        clientSocket.emit('join-wallet', { wallet: testWallet });
        clientSocket.on('joined-wallet', () => done());
      });
    });

    it('should handle sync request for authenticated wallet', (done) => {
      clientSocket.emit('sync-request', { wallet: testWallet });
      
      setTimeout(() => {
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Sync requested',
          expect.objectContaining({
            socketId: expect.any(String),
            wallet: testWallet,
          })
        );
        done();
      }, 100);
    });

    it('should reject sync request for unauthorized wallet', (done) => {
      const unauthorizedWallet = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      clientSocket.emit('sync-request', { wallet: unauthorizedWallet });
      
      clientSocket.on('error', (data) => {
        expect(data.message).toBe('Unauthorized wallet access');
        done();
      });
    });
  });

  describe('Broadcasting Events', () => {
    const mockTodo: Todo = {
      id: 'test-todo-1',
      title: 'Test Todo',
      content: 'Test content',
      completed: false,
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      wallet: testWallet,
    };

    beforeEach((done) => {
      // Authenticate and join room
      clientSocket.emit('authenticate', { wallet: testWallet });
      clientSocket.on('auth-success', () => {
        clientSocket.emit('join-wallet', { wallet: testWallet });
        clientSocket.on('joined-wallet', () => done());
      });
    });

    it('should broadcast todo created event', (done) => {
      clientSocket.on('todo-created', (todo) => {
        expect(todo).toEqual(mockTodo);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Broadcasted todo created',
          expect.objectContaining({
            todoId: mockTodo.id,
            wallet: mockTodo.wallet,
          })
        );
        done();
      });

      webSocketService.broadcastTodoCreated(mockTodo);
    });

    it('should broadcast todo updated event', (done) => {
      const updatedTodo = { ...mockTodo, content: 'Updated content' };
      
      clientSocket.on('todo-updated', (todo) => {
        expect(todo).toEqual(updatedTodo);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Broadcasted todo updated',
          expect.objectContaining({
            todoId: updatedTodo.id,
            wallet: updatedTodo.wallet,
          })
        );
        done();
      });

      webSocketService.broadcastTodoUpdated(updatedTodo);
    });

    it('should broadcast todo deleted event', (done) => {
      clientSocket.on('todo-deleted', (data) => {
        expect(data).toEqual({ id: mockTodo.id, wallet: mockTodo.wallet });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Broadcasted todo deleted',
          expect.objectContaining({
            todoId: mockTodo.id,
            wallet: mockTodo.wallet,
          })
        );
        done();
      });

      webSocketService.broadcastTodoDeleted(mockTodo.id, mockTodo.wallet);
    });

    it('should broadcast todo completed event', (done) => {
      const completedTodo = { ...mockTodo, completed: true };
      
      clientSocket.on('todo-completed', (todo) => {
        expect(todo).toEqual(completedTodo);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Broadcasted todo completed',
          expect.objectContaining({
            todoId: completedTodo.id,
            wallet: completedTodo.wallet,
          })
        );
        done();
      });

      webSocketService.broadcastTodoCompleted(completedTodo);
    });

    it('should broadcast error event', (done) => {
      const errorMessage = { message: 'Test error', code: 'TEST_ERROR' };
      
      clientSocket.on('error', (error) => {
        expect(error).toEqual(errorMessage);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Broadcasted error',
          expect.objectContaining({
            wallet: testWallet,
            error: errorMessage,
          })
        );
        done();
      });

      webSocketService.broadcastError(testWallet, errorMessage);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should return correct stats when no clients connected', () => {
      const stats = webSocketService.getStats();
      expect(stats).toEqual({
        connectedClients: 0,
        walletsWithClients: 0,
        socketsByWallet: {},
      });
    });

    it('should return socket server instance', () => {
      const socketServer = webSocketService.getSocketServer();
      expect(socketServer).toBeInstanceOf(SocketIOServer);
    });
  });

  describe('Error Handling', () => {
    it('should handle socket errors gracefully', (done) => {
      clientSocket.on('connect', () => {
        // Simulate socket error
        const socketServer = webSocketService.getSocketServer();
        const serverSockets = socketServer.sockets.sockets;
        const firstSocket = Array.from(serverSockets.values())[0] as WalletSocket;
        
        if (firstSocket) {
          firstSocket.emit('error', new Error('Test error'));
          
          setTimeout(() => {
            expect(mockLogger.error).toHaveBeenCalledWith(
              'Socket error',
              expect.objectContaining({
                socketId: firstSocket.id,
                error: expect.any(Error),
              })
            );
            done();
          }, 100);
        } else {
          done();
        }
      });
    });

    it('should handle disconnection gracefully', (done) => {
      clientSocket.on('connect', () => {
        clientSocket.disconnect();
        
        setTimeout(() => {
          expect(mockLogger.info).toHaveBeenCalledWith(
            'Client disconnected',
            expect.objectContaining({
              socketId: expect.any(String),
              reason: expect.any(String),
            })
          );
          done();
        }, 100);
      });
    });
  });
});