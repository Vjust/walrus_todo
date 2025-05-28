const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server: SocketIOServer } = require('socket.io');

// Simple working API server without TypeScript strictness
class SimpleApiServer {
  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Basic todo endpoints
    this.app.get('/api/todos', (req, res) => {
      res.json({
        success: true,
        todos: [],
        message: 'Todo API working'
      });
    });

    this.app.post('/api/todos', (req, res) => {
      const { title, content } = req.body;
      const todo = {
        id: Date.now().toString(),
        title,
        content,
        completed: false,
        createdAt: new Date().toISOString()
      };
      
      // Broadcast new todo via WebSocket
      this.io.emit('todo:created', todo);
      
      res.json({
        success: true,
        todo,
        message: 'Todo created successfully'
      });
    });

    // Sync endpoint
    this.app.post('/api/sync', (req, res) => {
      const { event, data } = req.body;
      
      // Broadcast sync event
      this.io.emit('sync:update', { event, data, timestamp: new Date().toISOString() });
      
      res.json({
        success: true,
        message: 'Sync event broadcasted'
      });
    });
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`Client ${socket.id} joined room: ${room}`);
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  start(port = 3001) {
    return new Promise((resolve) => {
      this.httpServer.listen(port, () => {
        console.log(`API server running on port ${port}`);
        console.log(`WebSocket server ready for real-time sync`);
        resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        console.log('API server stopped');
        resolve();
      });
    });
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new SimpleApiServer();
  server.start().catch(console.error);
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });
}

module.exports = { SimpleApiServer };