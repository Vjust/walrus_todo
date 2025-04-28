"use strict";
/**
 * Type definitions for the application
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuiError = exports.WalrusError = void 0;
const tslib_1 = require("tslib");
// Error types
class WalrusError extends Error {
    constructor(message, hint) {
        super(message);
        this.hint = hint;
        this.name = 'WalrusError';
    }
}
exports.WalrusError = WalrusError;
class SuiError extends Error {
    constructor(message, txHash) {
        super(message);
        this.txHash = txHash;
        this.name = 'SuiError';
    }
}
exports.SuiError = SuiError;
tslib_1.__exportStar(require("./todo"), exports);
