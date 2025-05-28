"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = require("dotenv");
// Load environment variables
(0, dotenv_1.config)();
exports.config = {
    port: parseInt(process.env.API_PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    cors: {
        origins: process.env.API_CORS_ORIGINS?.split(',') || [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002'
        ]
    },
    auth: {
        required: process.env.API_AUTH_REQUIRED === 'true',
        jwtSecret: process.env.JWT_SECRET || 'waltodo-default-secret-change-in-production',
        apiKeys: process.env.API_KEYS?.split(',') || []
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        enabled: process.env.API_LOGGING_ENABLED !== 'false'
    },
    rateLimit: {
        windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
        max: parseInt(process.env.API_RATE_LIMIT_MAX || '100', 10)
    },
    websocket: {
        enabled: process.env.WS_ENABLED !== 'false',
        pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000', 10),
        pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10)
    },
    todo: {
        dataPath: process.env.TODO_DATA_PATH || '../../Todos',
        maxTodosPerWallet: parseInt(process.env.MAX_TODOS_PER_WALLET || '1000', 10)
    }
};
exports.default = exports.config;
