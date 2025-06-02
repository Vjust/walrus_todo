/**
 * Shared types for Sui client package
 */
import { Transaction } from '@mysten/sui/transactions';
// Error types
export class SuiClientError extends Error {
    constructor(message, code, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = 'SuiClientError';
    }
}
export class WalletNotConnectedError extends SuiClientError {
    constructor() {
        super('Wallet not connected', 'WALLET_NOT_CONNECTED');
    }
}
export class TransactionError extends SuiClientError {
    constructor(message, transactionDigest) {
        super(message, 'TRANSACTION_ERROR');
        this.transactionDigest = transactionDigest;
    }
}
export class NetworkError extends SuiClientError {
    constructor(message, networkName) {
        super(message, 'NETWORK_ERROR');
        this.networkName = networkName;
    }
}
export { Transaction };
//# sourceMappingURL=types.js.map