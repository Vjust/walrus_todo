// Global polyfill for browser environment
// This provides a global object for libraries that expect it

if (typeof global === 'undefined') {
  if (typeof window !== 'undefined') {
    window.global = window;
  } else if (typeof self !== 'undefined') {
    self.global = self;
  }
}

module.exports = global || window || self || {};