/**
 * Runtime Environment Detection
 */

import type { RuntimeEnvironment } from '../types';

export function detectEnvironment(): RuntimeEnvironment {
  const isNode = typeof process !== 'undefined' && 
                 process.versions && 
                 process.versions.node;
  
  const isBrowser = typeof window !== 'undefined' && 
                    typeof document !== 'undefined';
  
  const hasFileSystem = typeof require !== 'undefined' && 
                        (() => {
                          try {
                            require('fs');
                            return true;
                          } catch {
                            return false;
                          }
                        })();

  const hasProcess = typeof process !== 'undefined';

  return {
    isNode: Boolean(isNode),
    isBrowser,
    hasFileSystem,
    hasProcess,
  };
}

export const RUNTIME = detectEnvironment();

export function assertNode(feature: string): void {
  if (!RUNTIME.isNode) {
    throw new Error(`${feature} is only available in Node.js environment`);
  }
}

export function assertBrowser(feature: string): void {
  if (!RUNTIME.isBrowser) {
    throw new Error(`${feature} is only available in browser environment`);
  }
}

// Universal fetch polyfill
export async function universalFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (RUNTIME.isBrowser) {
    return fetch(input, init);
  }
  
  // Use cross-fetch for Node.js
  const { default: fetch } = await import('cross-fetch');
  return fetch(input, init);
}