/**
 * @waltodo/shared-types
 * 
 * Shared type definitions for WalTodo CLI and frontend applications
 */

// Export all todo types
export * from './todo';

// Export all API types with renamed conflicting types
export {
  ApiResponse,
  ApiError,
  ApiMetadata,
  PaginatedResponse,
  GetTodosRequest,
  GetTodosResponse,
  GetTodoRequest,
  GetTodoResponse,
  CreateTodoRequest,
  CreateTodoResponse,
  UpdateTodoRequest,
  UpdateTodoResponse,
  DeleteTodoRequest,
  DeleteTodoResponse,
  SyncRequest,
  SyncResponse,
  SyncConflict,
  StoreToWalrusRequest,
  StoreToWalrusResponse,
  RetrieveFromWalrusRequest,
  RetrieveFromWalrusResponse,
  AIEnhanceRequest,
  AIEnhanceResponse,
  AISuggestRequest,
  AISuggestResponse,
  WebSocketEvent,
  TodoUpdatedEvent,
  TodoDeletedEvent,
  SyncRequiredEvent
} from './api';

// Export renamed WebSocket event to avoid conflict with blockchain event
export { TodoCreatedEvent as TodoCreatedWSEvent } from './api';

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