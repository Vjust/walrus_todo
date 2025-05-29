import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

export interface ApiConfig {
  port: number;
  env: string;
  cors: {
    origins: string[];
  };
  auth: {
    required: boolean;
    jwtSecret: string;
    apiKeys: string[];
  };
  logging: {
    level: string;
    enabled: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  websocket: {
    enabled: boolean;
    pingTimeout: number;
    pingInterval: number;
  };
  todo: {
    maxTodosPerWallet: number;
    dataPath: string;
  };
  server?: {
    host?: string;
    timeout?: number;
  };
}

export const config: ApiConfig = {
  port: parseInt(process.env.API_PORT || '3001', 10),
  env: process.env.NODE_ENV || 'development',

  cors: {
    origins: process.env.API_CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
    ],
  },

  auth: {
    required: process.env.API_AUTH_REQUIRED === 'true',
    jwtSecret:
      process.env.JWT_SECRET || 'waltodo-default-secret-change-in-production',
    apiKeys: process.env.API_KEYS?.split(',') || [],
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enabled: process.env.API_LOGGING_ENABLED !== 'false',
  },

  rateLimit: {
    windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    max: parseInt(process.env.API_RATE_LIMIT_MAX || '100', 10),
  },

  websocket: {
    enabled: process.env.WS_ENABLED !== 'false',
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000', 10),
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10),
  },

  todo: {
    maxTodosPerWallet: parseInt(process.env.MAX_TODOS_PER_WALLET || '1000', 10),
    dataPath: process.env.TODO_DATA_PATH || '../../data/todos',
  },
};

export default config;
