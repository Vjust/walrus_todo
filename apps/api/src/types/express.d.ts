// Type declarations to fix Express compilation issues
declare global {
  namespace Express {
    interface Request {
      wallet?: string;
    }
  }
}

// Extend Express types for compatibility
declare module 'express' {
  interface Request {
    wallet?: string;
  }
}

export {};