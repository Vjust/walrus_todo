"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiServer = void 0;
const server_1 = require("./server");
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
async function startServer() {
    try {
        const server = new server_1.ApiServer();
        const port = config_1.config.port || 3001;
        await server.start(port);
        logger_1.logger.info(`API server started on port ${port}`);
        // Graceful shutdown
        process.on('SIGTERM', async () => {
            logger_1.logger.info('SIGTERM received, shutting down gracefully');
            await server.stop();
            process.exit(0);
        });
        process.on('SIGINT', async () => {
            logger_1.logger.info('SIGINT received, shutting down gracefully');
            await server.stop();
            process.exit(0);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    startServer();
}
var server_2 = require("./server");
Object.defineProperty(exports, "ApiServer", { enumerable: true, get: function () { return server_2.ApiServer; } });
