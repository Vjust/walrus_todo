// Polyfills for Node.js modules in the browser environment
// This fixes factory call errors related to missing Node.js modules

// Buffer polyfill
if (typeof window !== 'undefined' && !window.Buffer) {
  const { Buffer } = require('buffer');
  window.Buffer = Buffer;
}

// Process polyfill
if (typeof window !== 'undefined' && !window.process) {
  window.process = require('process/browser');
}

// Global polyfills for crypto and other Node.js modules
if (typeof global === 'undefined') {
  (window as any).global = window;
}

// Export to ensure this is treated as a module
export {};