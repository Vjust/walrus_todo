/**
 * @waltodo/shared-types
 * 
 * Shared type definitions for WalTodo CLI and frontend applications
 */

// Export all todo types
export * from './todo';

// API types removed - using blockchain-first architecture

// Export all blockchain types except the ones we need to handle separately
export {
  Network,
  SuiAddress,
  SuiTransaction,
  SuiObject,
  TodoNFT,
  AICredential,
  AIOperationVerifier,
  ContractAddresses,
  TransactionArgument,
  MoveCall,
  WalletAccount,
  WalletCapabilities,
  GasEstimate,
  TodoCompletedEvent,
  MoveModules,
  TransactionStatus
} from './blockchain';

// Export blockchain TodoCreatedEvent with a specific name
export { TodoCreatedEvent as TodoCreatedBlockchainEvent } from './blockchain';

// Export all storage types
export * from './storage';