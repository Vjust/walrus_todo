"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIError = void 0;
exports.isErrorWithMessage = isErrorWithMessage;
exports.toErrorWithMessage = toErrorWithMessage;
exports.getErrorMessage = getErrorMessage;
/**
 * Type guard for ErrorWithMessage interface
 */
function isErrorWithMessage(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string');
}
/**
 * Convert any error-like object into ErrorWithMessage
 */
function toErrorWithMessage(maybeError) {
    if (isErrorWithMessage(maybeError))
        return maybeError;
    try {
        return new Error(JSON.stringify(maybeError));
    }
    catch (_a) {
        // Fallback in case there's an error stringifying the maybeError
        // Like with circular references for example.
        return new Error(String(maybeError));
    }
}
/**
 * Extract error message from any error-like object
 */
function getErrorMessage(error) {
    return toErrorWithMessage(error).message;
}
/**
 * Base class for all CLI errors
 */
var CLIError = /** @class */ (function (_super) {
    __extends(CLIError, _super);
    function CLIError(message, code) {
        if (code === void 0) { code = 'GENERAL_ERROR'; }
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.name = 'CLIError';
        return _this;
    }
    return CLIError;
}(Error));
exports.CLIError = CLIError;
