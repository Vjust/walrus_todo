"use strict";
/**
 * @file Transaction error class for blockchain transaction failures
 * Handles errors related to blockchain transactions, smart contract interactions, and gas issues.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionError = void 0;
const BaseError_1 = require("./BaseError");
/**
 * Error thrown for blockchain transaction failures
 */
class TransactionError extends BaseError_1.BaseError {
    /**
     * Create a new TransactionError
     * @param message Error message
     * @param options Options for the error
     */
    constructor(message, options = {}) {
        const { transactionHash, gasLimit, gasPrice, blockNumber, contractAddress, methodName, code = 'TRANSACTION_ERROR', ...restOptions } = options;
        // Build context with transaction details
        const context = {
            ...(options.context || {}),
            ...(transactionHash ? { transactionHash } : {}),
            ...(gasLimit ? { gasLimit } : {}),
            ...(gasPrice ? { gasPrice } : {}),
            ...(blockNumber ? { blockNumber } : {}),
            ...(contractAddress ? { contractAddress } : {}),
            ...(methodName ? { methodName } : {}),
        };
        // Call BaseError constructor
        super({
            message,
            code,
            context,
            recoverable: false, // Transaction failures are generally not recoverable
            shouldRetry: false, // Retrying the same transaction usually won't help
            ...restOptions,
        });
        // Store properties
        this.transactionHash = transactionHash;
        this.gasLimit = gasLimit;
        this.gasPrice = gasPrice;
        this.blockNumber = blockNumber;
        this.contractAddress = contractAddress;
        this.methodName = methodName;
    }
    /**
     * Create a TransactionError for gas limit exceeded
     * @param gasLimit Gas limit that was exceeded
     * @param options Additional options
     * @returns New TransactionError instance
     */
    static gasLimitExceeded(gasLimit, options = {}) {
        return new TransactionError(`Transaction failed: gas limit exceeded (${gasLimit})`, {
            ...options,
            gasLimit,
            code: 'TRANSACTION_GAS_LIMIT_EXCEEDED',
        });
    }
    /**
     * Create a TransactionError for insufficient funds
     * @param options Additional options
     * @returns New TransactionError instance
     */
    static insufficientFunds(options = {}) {
        return new TransactionError('Transaction failed: insufficient funds', {
            ...options,
            code: 'TRANSACTION_INSUFFICIENT_FUNDS',
        });
    }
    /**
     * Create a TransactionError for reverted transaction
     * @param reason Revert reason if available
     * @param options Additional options
     * @returns New TransactionError instance
     */
    static reverted(reason, options = {}) {
        return new TransactionError(reason ? `Transaction reverted: ${reason}` : 'Transaction reverted', {
            ...options,
            code: 'TRANSACTION_REVERTED',
        });
    }
    /**
     * Override sanitizeContext to handle transaction-specific sensitive data
     * @param context Context object to sanitize
     * @returns Sanitized context or undefined
     */
    sanitizeContext(context) {
        if (!context)
            return undefined;
        // First apply base sanitization
        const sanitized = super.sanitizeContext(context) || {};
        // Additional transaction-specific sanitization
        const txSpecificKeys = [
            'transactionHash',
            'contractAddress',
            'fromAddress',
            'toAddress',
            'senderAddress',
            'receiverAddress',
            'walletAddress',
        ];
        for (const key of txSpecificKeys) {
            if (key in sanitized && typeof sanitized[key] === 'string') {
                sanitized[key] = this.redactIdentifier(sanitized[key]);
            }
        }
        // Check for any string that looks like an address or transaction hash
        for (const [key, value] of Object.entries(sanitized)) {
            if (typeof value === 'string') {
                // Look for Sui, Ethereum, or blockchain address patterns
                const addressRegex = /^(0x[a-fA-F0-9]{40,64})$/;
                const txHashRegex = /^(0x[a-fA-F0-9]{64,66})$/;
                if (addressRegex.test(value) ||
                    txHashRegex.test(value)) {
                    sanitized[key] = this.redactIdentifier(value);
                }
            }
        }
        return sanitized;
    }
}
exports.TransactionError = TransactionError;
