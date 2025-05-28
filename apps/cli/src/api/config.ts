import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

export interface ApiConfigOptions {
  port?: number;
  env?: string;
  bodyLimit?: string;
  cors?: {
    origins: string[];
  };
  auth?: {
    required: boolean;
    apiKeys?: string[];
  };
  logging?: {
    enabled: boolean;
    level: string;
  };
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  version?: string;
}

export class ApiConfig {
  public readonly port: number;
  public readonly env: string;
  public readonly bodyLimit: string;
  public readonly cors: {
    origins: string[];
  };
  public readonly auth: {
    required: boolean;
    apiKeys: string[];
  };
  public readonly logging: {
    enabled: boolean;
    level: string;
  };
  public readonly rateLimit: {
    windowMs: number;
    max: number;
  };
  public readonly version: string;

  constructor(options: ApiConfigOptions = {}) {
    this.port = options.port || parseInt(process.env.API_PORT || '3000', 10);
    this.env = options.env || process.env.NODE_ENV || 'development';
    this.bodyLimit = options.bodyLimit || process.env.API_BODY_LIMIT || '10mb';

    this.cors = {
      origins: options.cors?.origins ||
        process.env.API_CORS_ORIGINS?.split(',') || [
          'http://localhost:3000',
          'http://localhost:3001',
        ],
    };

    this.auth = {
      required:
        options.auth?.required ?? process.env.API_AUTH_REQUIRED === 'true',
      apiKeys: options.auth?.apiKeys || process.env.API_KEYS?.split(',') || [],
    };

    this.logging = {
      enabled:
        options.logging?.enabled ?? process.env.API_LOGGING_ENABLED !== 'false',
      level: options.logging?.level || process.env.API_LOG_LEVEL || 'info',
    };

    this.rateLimit = {
      windowMs:
        options.rateLimit?.windowMs ||
        parseInt(process.env.API_RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
      max:
        options.rateLimit?.max ||
        parseInt(process.env.API_RATE_LIMIT_MAX || '100', 10),
    };

    this.version = options.version || process.env.API_VERSION || '1.0.0';
  }

  public isDevelopment(): boolean {
    return this.env === 'development';
  }

  public isProduction(): boolean {
    return this.env === 'production';
  }

  public isTest(): boolean {
    return this.env === 'test';
  }
}

// Singleton instance
let configInstance: ApiConfig | null = null;

export function getApiConfig(): ApiConfig {
  if (!configInstance) {
    configInstance = new ApiConfig();
  }
  return configInstance;
}

// Export default config
export default getApiConfig();
