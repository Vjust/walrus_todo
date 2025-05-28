"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
const consolidated_1 = require("../types/errors/consolidated");
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    // Constructor access set to public to fix TypeScript errors in existing code
    constructor(componentName = '') {
        this.logHandlers = [];
        this.componentName = '';
        // Add default console handler
        this.componentName = componentName;
        this.addHandler(entry => {
            // Skip debug messages unless NODE_ENV is development
            if (entry.level === LogLevel.DEBUG &&
                process.env.NODE_ENV !== 'development') {
                return;
            }
            const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
            const error = entry.error
                ? `\n${JSON.stringify(entry.error, null, 2)}`
                : '';
            const component = this.componentName ? `[${this.componentName}] ` : '';
            // eslint-disable-next-line no-console
            console[entry.level](`[${entry.timestamp}] ${component}${entry.message}${context}${error}`);
        });
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    /**
     * Add a log handler
     * @param handler Function to handle log entries
     */
    addHandler(handler) {
        this.logHandlers.push(handler);
    }
    /**
     * Remove all log handlers
     */
    clearHandlers() {
        this.logHandlers = [];
    }
    /**
     * Create a log entry
     * @param level Log level
     * @param message Log message
     * @param context Additional context
     * @param error Error object
     */
    log(level, message, context, error) {
        const entry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            context: this.sanitizeContext(context),
        };
        if (error) {
            entry.error = {
                name: error.name,
                code: error instanceof consolidated_1.WalrusError ? error.code : 'UNKNOWN_ERROR',
                message: error.message,
                stack: error.stack,
            };
        }
        this.logHandlers.forEach(handler => handler(entry));
    }
    /**
     * Remove sensitive information from context
     */
    sanitizeContext(context) {
        if (!context)
            return undefined;
        const sanitized = {};
        const sensitivePatterns = [
            /password/i,
            /secret/i,
            /key/i,
            /token/i,
            /auth/i,
            /signature/i,
            /seed/i,
        ];
        for (const [key, value] of Object.entries(context)) {
            if (sensitivePatterns.some(pattern => pattern.test(key))) {
                sanitized[key] = '[REDACTED]';
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeContext(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    error(message, error, context) {
        this.log(LogLevel.ERROR, message, context, error);
    }
}
exports.Logger = Logger;
