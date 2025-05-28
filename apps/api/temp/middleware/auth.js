"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidWallet = exports.generateToken = exports.extractWallet = exports.authenticateJWT = exports.validateApiKey = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
require("../types/express");
// API Key authentication middleware
const validateApiKey = (req, res, next) => {
    if (!config_1.config.auth.required) {
        return next();
    }
    const apiKey = req.header('X-API-Key') || req.query.apiKey;
    if (!apiKey) {
        res.status(401).json({
            success: false,
            error: 'API key required',
            timestamp: new Date().toISOString()
        });
        return;
    }
    if (!config_1.config.auth.apiKeys.includes(apiKey)) {
        logger_1.logger.warn('Invalid API key attempt', {
            key: apiKey.substring(0, 8) + '...',
            ip: req.ip
        });
        res.status(401).json({
            success: false,
            error: 'Invalid API key',
            timestamp: new Date().toISOString()
        });
        return;
    }
    next();
};
exports.validateApiKey = validateApiKey;
// JWT authentication middleware
const authenticateJWT = (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        res.status(401).json({
            success: false,
            error: 'Access token required',
            timestamp: new Date().toISOString()
        });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.auth.jwtSecret);
        req.wallet = decoded.wallet;
        req.user = {
            id: decoded.wallet,
            wallet: decoded.wallet
        };
        next();
    }
    catch (error) {
        logger_1.logger.warn('Invalid JWT token', { error: error instanceof Error ? error.message : 'Unknown error' });
        res.status(403).json({
            success: false,
            error: 'Invalid or expired token',
            timestamp: new Date().toISOString()
        });
    }
};
exports.authenticateJWT = authenticateJWT;
// Optional wallet extraction from query/header
const extractWallet = (req, res, next) => {
    // Try to get wallet from JWT first
    if (req.wallet) {
        return next();
    }
    // Fall back to wallet parameter/header for development
    const wallet = req.query.wallet || req.header('X-Wallet-Address');
    if (wallet) {
        req.wallet = wallet;
        req.user = {
            id: wallet,
            wallet: wallet
        };
    }
    next();
};
exports.extractWallet = extractWallet;
// Generate JWT token for wallet
const generateToken = (wallet) => {
    return jsonwebtoken_1.default.sign({ wallet }, config_1.config.auth.jwtSecret, { expiresIn: '24h' });
};
exports.generateToken = generateToken;
// Validate wallet format (Sui address)
const isValidWallet = (wallet) => {
    // Sui addresses are 32 bytes (64 hex chars) with 0x prefix
    const suiAddressRegex = /^0x[a-fA-F0-9]{64}$/;
    return suiAddressRegex.test(wallet);
};
exports.isValidWallet = isValidWallet;
