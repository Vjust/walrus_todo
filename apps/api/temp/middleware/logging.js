"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityHeaders = exports.requestLogger = void 0;
const logger_1 = require("../utils/logger");
// Request logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    // Log request
    logger_1.logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        headers: {
            authorization: req.get('Authorization') ? '[PRESENT]' : '[MISSING]',
            'x-api-key': req.get('X-API-Key') ? '[PRESENT]' : '[MISSING]',
            'content-type': req.get('Content-Type')
        }
    });
    // Override res.json to log response
    const originalJson = res.json;
    res.json = function (body) {
        const duration = Date.now() - start;
        logger_1.logger.info('Response sent', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            contentLength: res.get('Content-Length'),
            success: body?.success !== false
        });
        return originalJson.call(this, body);
    };
    next();
};
exports.requestLogger = requestLogger;
// Security headers middleware
const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
};
exports.securityHeaders = securityHeaders;
