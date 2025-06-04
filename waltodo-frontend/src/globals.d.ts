// Global type declarations for Next.js 15 compatibility

declare global {
  // Node.js globals for browser environment
  interface Window {
    Buffer: typeof Buffer;
    process: NodeJS.Process;
  }

  // Module declarations for package compatibility
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      NEXT_PUBLIC_ENVIRONMENT?: string;
      NEXT_PUBLIC_APP_VERSION?: string;
      NEXT_EXPORT?: string;
      BUILD_MODE?: string;
    }
  }
}

// Fix for @mysten package compatibility
declare module '@mysten/dapp-kit' {
  export * from '@mysten/dapp-kit/dist';
}

declare module '@mysten/sui' {
  export * from '@mysten/sui/dist';
}

declare module '@mysten/walrus' {
  export * from '@mysten/walrus/dist';
}

// Fix for wallet standard packages
declare module '@wallet-standard/react' {
  export * from '@wallet-standard/react/dist';
}

declare module '@wallet-standard/features' {
  export * from '@wallet-standard/features/dist';
}

// Fix for React Query
declare module '@tanstack/react-query' {
  export * from '@tanstack/react-query/build/lib';
}

// Fix for utility libraries
declare module 'nanoid' {
  export function nanoid(size?: number): string;
  export const customAlphabet: (alphabet: string, size: number) => () => string;
}

declare module 'fuse.js' {
  export default class Fuse<T> {
    constructor(list: T[], options?: any);
    search(pattern: string): any[];
  }
}

// Export empty object to make this a module
export {};