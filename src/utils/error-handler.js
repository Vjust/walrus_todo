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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIError = void 0;
exports.handleError = handleError;
exports.withRetry = withRetry;
exports.assert = assert;
// Use require for chalk since it's an ESM module
var chalk_1 = require("chalk");
var error_1 = require("../types/error");
/**
 * Custom CLI error class for application-specific errors
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
/**
 * Centralized error handler for the application
 */
function handleError(messageOrError, error) {
    // Handle the case where only one parameter is passed
    if (error === undefined) {
        error = messageOrError;
        messageOrError = '';
    }
    var contextMessage = typeof messageOrError === 'string' ? messageOrError : '';
    if (error instanceof CLIError) {
        console.error("\n\u274C ".concat(contextMessage ? contextMessage + ': ' : '', "CLI Error: ").concat(error.message));
        return;
    }
    if (error instanceof Error) {
        console.error("\n\u274C ".concat(contextMessage ? contextMessage + ': ' : '', "Error: ").concat(error.message));
        return;
    }
    // Handle unknown error types with a message
    if ((0, error_1.isErrorWithMessage)(error)) {
        console.error("\n\u274C ".concat(contextMessage ? contextMessage + ': ' : '', "Error: ").concat(error.message));
        return;
    }
    // Handle completely unknown error types
    console.error("\n\u274C ".concat(contextMessage ? contextMessage + ': ' : '', "Unknown error occurred: ").concat((0, error_1.getErrorMessage)(error)));
}
/**
 * Wraps an async function with retry logic for transient errors
 */
function withRetry(fn_1) {
    return __awaiter(this, arguments, void 0, function (fn, maxRetries, baseDelay) {
        var lastError, _loop_1, attempt, state_1;
        if (maxRetries === void 0) { maxRetries = 3; }
        if (baseDelay === void 0) { baseDelay = 1000; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _loop_1 = function (attempt) {
                        var _b, error_2, delay_1;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 2, , 4]);
                                    _b = {};
                                    return [4 /*yield*/, fn()];
                                case 1: return [2 /*return*/, (_b.value = _c.sent(), _b)];
                                case 2:
                                    error_2 = _c.sent();
                                    lastError = error_2;
                                    // Only retry on network errors or specific transient errors
                                    if (!isTransientError(error_2) || attempt >= maxRetries) {
                                        throw error_2;
                                    }
                                    delay_1 = baseDelay * Math.pow(2, attempt - 1);
                                    console.log(chalk_1.default.yellow("Request failed, retrying (".concat(attempt, "/").concat(maxRetries, ") after ").concat(delay_1, "ms...")));
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay_1); })];
                                case 3:
                                    _c.sent();
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 1;
                    _a.label = 1;
                case 1:
                    if (!(attempt <= maxRetries)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 2:
                    state_1 = _a.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _a.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4: throw lastError;
            }
        });
    });
}
/**
 * Determines if an error is likely transient and can be retried
 */
function isTransientError(error) {
    var _a;
    var message = ((_a = error === null || error === void 0 ? void 0 : error.message) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
    return (message.includes('network') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('econnrefused') ||
        message.includes('econnreset') ||
        message.includes('429'));
}
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
