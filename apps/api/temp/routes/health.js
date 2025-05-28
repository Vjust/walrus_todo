"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHealthRoutes = createHealthRoutes;
const express_1 = require("express");
require("../types/express");
const error_1 = require("../middleware/error");
const config_1 = require("../config");
function createHealthRoutes(websocketService) {
    const router = (0, express_1.Router)();
    // Basic health check
    router.get('/healthz', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            service: 'waltodo-api'
        });
    });
    // Detailed health check
    router.get('/health', (0, error_1.asyncHandler)(async (req, res) => {
        const healthData = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            service: 'waltodo-api',
            environment: config_1.config.env,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            websocket: {
                enabled: config_1.config.websocket.enabled,
                ...(websocketService && {
                    stats: websocketService.getStats()
                })
            },
            features: {
                authentication: config_1.config.auth.required,
                rateLimit: config_1.config.rateLimit.max > 0,
                logging: config_1.config.logging.enabled
            }
        };
        res.json(healthData);
    }));
    // Readiness probe
    router.get('/ready', (req, res) => {
        // Add any readiness checks here (database connections, etc.)
        res.json({
            status: 'ready',
            timestamp: new Date().toISOString()
        });
    });
    // Liveness probe
    router.get('/live', (req, res) => {
        res.json({
            status: 'alive',
            timestamp: new Date().toISOString()
        });
    });
    return router;
}
