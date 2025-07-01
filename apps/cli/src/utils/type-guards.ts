/**
 * Type guard utilities for safe error handling and unknown type checking
 */

/**
 * Type guard to check if a value is an Error object
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard to check if a value has a message property (Error-like)
 */
export function hasMessage(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value).message === 'string'
  );
}

/**
 * Type guard to check if a value has a code property
 */
export function hasCode(value: unknown): value is { code: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value).code === 'string'
  );
}

/**
 * Type guard to check if a value has both message and code properties
 */
export function hasMessageAndCode(
  value: unknown
): value is { message: string; code: string } {
  return hasMessage(value) && hasCode(value);
}

/**
 * Safely extracts an error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }

  if (hasMessage(error)) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error occurred';
}

/**
 * Safely extracts an error code from unknown error type
 */
export function getErrorCode(error: unknown): string | undefined {
  if (hasCode(error)) {
    return error.code;
  }

  return undefined;
}

/**
 * Type guard for Response objects
 */
export function isResponse(value: unknown): value is Response {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'statusText' in value &&
    typeof (value).status === 'number'
  );
}

/**
 * Type guard for objects with properties
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for arrays
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard for strings
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for numbers
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard for booleans
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Safely converts unknown to Error
 */
export function toError(value: unknown): Error {
  if (isError(value)) {
    return value;
  }

  const message = getErrorMessage(value);
  const error = new Error(message);

  // Preserve original error code if available
  const code = getErrorCode(value);
  if (code) {
    (error).code = code;
  }

  return error;
}

/**
 * Type assertion for Error objects (throws if not an error)
 */
export function assertError(value: unknown): asserts value is Error {
  if (!isError(value)) {
    throw new Error(`Expected Error, got ${typeof value}`);
  }
}

/**
 * Type assertion for objects (throws if not an object)
 */
export function assertObject(
  value: unknown
): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`Expected object, got ${typeof value}`);
  }
}

// Domain-specific type guards

/**
 * Type guard for Todo objects
 */
export function isTodo(value: unknown): value is import('../types/todo').Todo {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.id) &&
    isString(obj.title) &&
    isBoolean(obj.completed) &&
    ['high', 'medium', 'low'].includes(obj.priority as string) &&
    isArray(obj.tags) &&
    obj?.tags?.every(tag => isString(tag)) &&
    isString(obj.createdAt) &&
    isString(obj.updatedAt) &&
    isBoolean(obj.private) &&
    // Optional properties
    (obj?.description === undefined || isString(obj.description)) &&
    (obj?.dueDate === undefined || isString(obj.dueDate)) &&
    (obj?.completedAt === undefined || isString(obj.completedAt)) &&
    (obj?.storageLocation === undefined || ['local', 'blockchain', 'both'].includes(obj.storageLocation as string)) &&
    (obj?.walrusBlobId === undefined || isString(obj.walrusBlobId)) &&
    (obj?.nftObjectId === undefined || isString(obj.nftObjectId)) &&
    (obj?.imageUrl === undefined || isString(obj.imageUrl)) &&
    (obj?.category === undefined || isString(obj.category)) &&
    (obj?.listName === undefined || isString(obj.listName)) &&
    (obj?.syncedAt === undefined || isString(obj.syncedAt)) &&
    (obj?.user === undefined || isString(obj.user)) &&
    (obj?.reminders === undefined || (isArray(obj.reminders) && obj?.reminders?.every(isTodoReminder))) &&
    (obj?.metadata === undefined || isObject(obj.metadata))
  );
}

/**
 * Type guard for TodoReminder objects
 */
export function isTodoReminder(value: unknown): value is import('../types/todo').TodoReminder {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.id) &&
    isString(obj.date) &&
    isString(obj.message)
  );
}

/**
 * Type guard for TodoList objects
 */
export function isTodoList(value: unknown): value is import('../types/todo').TodoList {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.id) &&
    isString(obj.name) &&
    isString(obj.owner) &&
    isArray(obj.todos) &&
    obj?.todos?.every(todo => isTodo(todo)) &&
    isNumber(obj.version) &&
    isString(obj.createdAt) &&
    isString(obj.updatedAt) &&
    // Optional properties
    (obj?.collaborators === undefined || (isArray(obj.collaborators) && obj?.collaborators?.every(isString))) &&
    (obj?.permissions === undefined || isObject(obj.permissions)) &&
    (obj?.walrusBlobId === undefined || isString(obj.walrusBlobId)) &&
    (obj?.suiObjectId === undefined || isString(obj.suiObjectId))
  );
}

/**
 * Type guard for Config objects
 */
export function isConfig(value: unknown): value is import('../types/config').Config {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.network) &&
    isString(obj.walletAddress) &&
    isBoolean(obj.encryptedStorage) &&
    // Optional properties
    (obj?.lastDeployment === undefined || (
      isObject(obj.lastDeployment) &&
      isString((obj.lastDeployment as Record<string, unknown>).packageId) &&
      isString((obj.lastDeployment as Record<string, unknown>).timestamp)
    )) &&
    (obj?.packageId === undefined || isString(obj.packageId)) &&
    (obj?.registryId === undefined || isString(obj.registryId))
  );
}

/**
 * Type guard for NetworkConfig objects
 */
export function isNetworkConfig(value: unknown): value is import('../types/config').NetworkConfig {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.name) &&
    isString(obj.fullnode) &&
    // Optional properties
    (obj?.faucet === undefined || isString(obj.faucet)) &&
    (obj?.walrusUrl === undefined || isString(obj.walrusUrl)) &&
    (obj?.customRpcUrl === undefined || isString(obj.customRpcUrl))
  );
}

/**
 * Type guard for AccountConfig objects
 */
export function isAccountConfig(value: unknown): value is import('../types/config').AccountConfig {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.address) &&
    // Optional properties
    (obj?.privateKey === undefined || isString(obj.privateKey)) &&
    (obj?.keystore === undefined || (
      isObject(obj.keystore) &&
      isString((obj.keystore as Record<string, unknown>).path) &&
      ((obj.keystore as Record<string, unknown>).password === undefined || isString((obj.keystore as Record<string, unknown>).password))
    )) &&
    (obj?.publicKey === undefined || isString(obj.publicKey)) &&
    (obj?.nickname === undefined || isString(obj.nickname))
  );
}

/**
 * Type guard for BlobObject objects
 */
export function isBlobObject(value: unknown): value is import('../types/walrus').BlobObject {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.blob_id) &&
    // Optional properties
    (obj?.id === undefined || (
      isObject(obj.id) &&
      isString((obj.id as Record<string, unknown>).id)
    )) &&
    (obj?.registered_epoch === undefined || isNumber(obj.registered_epoch)) &&
    (obj?.storage_cost === undefined || (
      isObject(obj.storage_cost) &&
      isString((obj.storage_cost as Record<string, unknown>).value)
    )) &&
    (obj?.storage_rebate === undefined || (
      isObject(obj.storage_rebate) &&
      isString((obj.storage_rebate as Record<string, unknown>).value)
    )) &&
    (obj?.size === undefined || isString(obj.size)) &&
    (obj?.encoding_type === undefined || isNumber(obj.encoding_type)) &&
    (obj?.deletable === undefined || isBoolean(obj.deletable)) &&
    (obj?.cert_epoch === undefined || isNumber(obj.cert_epoch))
  );
}

/**
 * Type guard for BlobInfo objects
 */
export function isBlobInfo(value: unknown): value is import('../types/walrus').BlobInfo {
  if (!isBlobObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return isNumber(obj.certified_epoch);
}

/**
 * Type guard for CreateTodoInput objects
 */
export function isCreateTodoInput(value: unknown): value is import('../types/todo').CreateTodoInput {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.title) &&
    // Optional properties
    (obj?.description === undefined || isString(obj.description)) &&
    (obj?.priority === undefined || ['high', 'medium', 'low'].includes(obj.priority as string)) &&
    (obj?.dueDate === undefined || isString(obj.dueDate)) &&
    (obj?.tags === undefined || (isArray(obj.tags) && obj?.tags?.every(isString))) &&
    (obj?.category === undefined || isString(obj.category)) &&
    (obj?.listName === undefined || isString(obj.listName))
  );
}

/**
 * Type guard for UpdateTodoInput objects
 */
export function isUpdateTodoInput(value: unknown): value is import('../types/todo').UpdateTodoInput {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    // All properties are optional for updates
    (obj?.title === undefined || isString(obj.title)) &&
    (obj?.description === undefined || isString(obj.description)) &&
    (obj?.completed === undefined || isBoolean(obj.completed)) &&
    (obj?.priority === undefined || ['high', 'medium', 'low'].includes(obj.priority as string)) &&
    (obj?.dueDate === undefined || isString(obj.dueDate)) &&
    (obj?.tags === undefined || (isArray(obj.tags) && obj?.tags?.every(isString))) &&
    (obj?.category === undefined || isString(obj.category))
  );
}

/**
 * Type guard for Priority values
 */
export function isPriority(value: unknown): value is import('../types/todo').Priority {
  return ['high', 'medium', 'low'].includes(value as string);
}

/**
 * Type guard for StorageLocation values
 */
export function isStorageLocation(value: unknown): value is import('../types/todo').StorageLocation {
  return ['local', 'blockchain', 'both'].includes(value as string);
}

/**
 * Type guard for NetworkType values
 */
export function isNetworkType(value: unknown): value is import('../types/todo').NetworkType {
  return ['mainnet', 'testnet', 'devnet', 'localnet'].includes(value as string);
}

/**
 * Enhanced union type guards
 */

/**
 * Type guard for optional properties that safely handles undefined/null
 */
export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || value === null || isString(value);
}

/**
 * Type guard for optional boolean properties
 */
export function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || value === null || isBoolean(value);
}

/**
 * Type guard for optional number properties
 */
export function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || value === null || isNumber(value);
}

/**
 * Type guard for optional array properties
 */
export function isOptionalArray<T>(value: unknown, itemGuard?: (item: unknown) => item is T): value is T[] | undefined {
  if (value === undefined || value === null) return true;
  if (!isArray(value)) return false;
  if (itemGuard) {
    return value.every(itemGuard);
  }
  return true;
}

/**
 * Type guard for optional object properties
 */
export function isOptionalObject(value: unknown): value is Record<string, unknown> | undefined {
  return value === undefined || value === null || isObject(value);
}

/**
 * Generic union type guard creator
 */
export function createUnionGuard<T extends string>(
  allowedValues: readonly T[]
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return allowedValues.includes(value as T);
  };
}

/**
 * Type assertion for domain-specific types
 */
export function assertTodo(value: unknown): asserts value is import('../types/todo').Todo {
  if (!isTodo(value)) {
    throw new Error('Value is not a valid Todo object');
  }
}

export function assertTodoList(value: unknown): asserts value is import('../types/todo').TodoList {
  if (!isTodoList(value)) {
    throw new Error('Value is not a valid TodoList object');
  }
}

export function assertConfig(value: unknown): asserts value is import('../types/config').Config {
  if (!isConfig(value)) {
    throw new Error('Value is not a valid Config object');
  }
}

export function assertBlobObject(value: unknown): asserts value is import('../types/walrus').BlobObject {
  if (!isBlobObject(value)) {
    throw new Error('Value is not a valid BlobObject');
  }
}

export function assertBlobInfo(value: unknown): asserts value is import('../types/walrus').BlobInfo {
  if (!isBlobInfo(value)) {
    throw new Error('Value is not a valid BlobInfo object');
  }
}
