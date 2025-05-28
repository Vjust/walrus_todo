"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const socket_io_1 = require("socket.io");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const auth_1 = require("../middleware/auth");
class WebSocketService {
    constructor(httpServer) {
        this.walletSockets = new Map(); // wallet -> set of socket ids
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: config_1.config.cors.origins,
                methods: ['GET', 'POST'],
                credentials: true
            },
            pingTimeout: config_1.config.websocket.pingTimeout,
            pingInterval: config_1.config.websocket.pingInterval
        });
        this.setupEventHandlers();
        logger_1.logger.info('WebSocket service initialized');
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            logger_1.logger.info('Client connected', { socketId: socket.id });
            // Handle wallet authentication
            socket.on('authenticate', (data) => {
                this.authenticateSocket(socket, data.wallet);
            });
            // Handle joining wallet room
            socket.on('join-wallet', (data) => {
                this.joinWalletRoom(socket, data.wallet);
            });
            // Handle leaving wallet room
            socket.on('leave-wallet', (data) => {
                this.leaveWalletRoom(socket, data.wallet);
            });
            // Handle sync request
            socket.on('sync-request', (data) => {
                this.handleSyncRequest(socket, data.wallet);
            });
            // Handle disconnect
            socket.on('disconnect', (reason) => {
                logger_1.logger.info('Client disconnected', {
                    socketId: socket.id,
                    wallet: socket.wallet,
                    reason
                });
                this.handleDisconnect(socket);
            });
            // Handle errors
            socket.on('error', (error) => {
                logger_1.logger.error('Socket error', {
                    socketId: socket.id,
                    wallet: socket.wallet,
                    error
                });
            });
        });
    }
    authenticateSocket(socket, wallet) {
        if (!(0, auth_1.isValidWallet)(wallet)) {
            socket.emit('auth-error', { message: 'Invalid wallet address' });
            return;
        }
        socket.wallet = wallet;
        socket.emit('auth-success', { wallet });
        logger_1.logger.info('Socket authenticated', {
            socketId: socket.id,
            wallet
        });
    }
    joinWalletRoom(socket, wallet) {
        if (!(0, auth_1.isValidWallet)(wallet)) {
            socket.emit('error', { message: 'Invalid wallet address' });
            return;
        }
        const roomName = `wallet:${wallet}`;
        socket.join(roomName);
        // Track socket for this wallet
        if (!this.walletSockets.has(wallet)) {
            this.walletSockets.set(wallet, new Set());
        }
        this.walletSockets.get(wallet).add(socket.id);
        socket.emit('joined-wallet', { wallet });
        logger_1.logger.info('Socket joined wallet room', {
            socketId: socket.id,
            wallet,
            roomSize: this.walletSockets.get(wallet).size
        });
    }
    leaveWalletRoom(socket, wallet) {
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
        logger_1.logger.info('Socket left wallet room', {
            socketId: socket.id,
            wallet
        });
    }
    handleSyncRequest(socket, wallet) {
        if (!socket.wallet || socket.wallet !== wallet) {
            socket.emit('error', { message: 'Unauthorized wallet access' });
            return;
        }
        // Broadcast sync request to other clients for this wallet
        socket.to(`wallet:${wallet}`).emit('sync-requested', { wallet });
        logger_1.logger.info('Sync requested', {
            socketId: socket.id,
            wallet
        });
    }
    handleDisconnect(socket) {
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
    broadcastTodoCreated(todo) {
        const roomName = `wallet:${todo.wallet}`;
        this.io.to(roomName).emit('todo-created', todo);
        logger_1.logger.debug('Broadcasted todo created', {
            todoId: todo.id,
            wallet: todo.wallet
        });
    }
    broadcastTodoUpdated(todo) {
        const roomName = `wallet:${todo.wallet}`;
        this.io.to(roomName).emit('todo-updated', todo);
        logger_1.logger.debug('Broadcasted todo updated', {
            todoId: todo.id,
            wallet: todo.wallet
        });
    }
    broadcastTodoDeleted(todoId, wallet) {
        const roomName = `wallet:${wallet}`;
        this.io.to(roomName).emit('todo-deleted', { id: todoId, wallet });
        logger_1.logger.debug('Broadcasted todo deleted', {
            todoId,
            wallet
        });
    }
    broadcastTodoCompleted(todo) {
        const roomName = `wallet:${todo.wallet}`;
        this.io.to(roomName).emit('todo-completed', todo);
        logger_1.logger.debug('Broadcasted todo completed', {
            todoId: todo.id,
            wallet: todo.wallet
        });
    }
    broadcastError(wallet, error) {
        const roomName = `wallet:${wallet}`;
        this.io.to(roomName).emit('error', error);
        logger_1.logger.debug('Broadcasted error', {
            wallet,
            error
        });
    }
    // Stats and monitoring
    getStats() {
        const socketsByWallet = {};
        let totalClients = 0;
        this.walletSockets.forEach((sockets, wallet) => {
            socketsByWallet[wallet] = sockets.size;
            totalClients += sockets.size;
        });
        return {
            connectedClients: totalClients,
            walletsWithClients: this.walletSockets.size,
            socketsByWallet
        };
    }
    getSocketServer() {
        return this.io;
    }
}
exports.WebSocketService = WebSocketService;
