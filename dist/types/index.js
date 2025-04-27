"use strict";
/**
 * Type definitions for the application
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuiError = exports.WalrusError = void 0;
// Error types
class WalrusError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'WalrusError';
    }
}
exports.WalrusError = WalrusError;
class SuiError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'SuiError';
    }
}
exports.SuiError = SuiError;
