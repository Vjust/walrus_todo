/**
 * Simple Jest setup for basic tests
 */

// Global test timeout
jest.setTimeout(30000);

// Mock console to reduce noise
console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

// Basic globals for Node environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

console.log('✅ Simple Jest setup completed');
