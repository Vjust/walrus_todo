/**
 * Command-specific type definitions for proper typing of CLI commands
 */

// OCLIF imports for future use
// import { Args as OclifArgs, Flags as OclifFlags } from '@oclif/core';
import { Todo, StorageLocation } from './todo';
import { AIProvider } from './adapters/AIModelAdapter';

/**
 * Base parsed arguments type for commands
 */
export interface ParsedArgs {
  [key: string]: string | undefined;
}

/**
 * Base parsed flags type for commands
 */
export interface ParsedFlags {
  [key: string]: string | string[] | boolean | number | undefined;
}

/**
 * Type-safe version of parsed output from OCLIF parse method
 */
export interface ParsedOutput<
  TArgs extends ParsedArgs = ParsedArgs,
  TFlags extends ParsedFlags = ParsedFlags,
> {
  args: TArgs;
  flags: TFlags;
}

/**
 * Add command specific types
 */
export interface AddCommandArgs extends ParsedArgs {
  listOrTitle?: string;
}

export interface AddCommandFlags extends ParsedFlags {
  task?: string | string[];
  priority?: string | string[];
  due?: string | string[];
  tags?: string | string[];
  private?: boolean;
  list?: string;
  storage?: StorageLocation;
  ai?: boolean;
  apiKey?: string;
  provider?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Complete command specific types
 */
export interface CompleteCommandArgs extends ParsedArgs {
  list?: string;
}

export interface CompleteCommandFlags extends ParsedFlags {
  id: string;
  network?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * List command specific types
 */
export interface ListCommandArgs extends ParsedArgs {
  listName?: string;
}

export interface ListCommandFlags extends ParsedFlags {
  completed?: boolean;
  pending?: boolean;
  sort?: 'priority' | 'dueDate';
  compact?: boolean;
  detailed?: boolean;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Storage command specific types
 */
export interface StorageCommandFlags extends ParsedFlags {
  action?: 'check' | 'allocate' | 'list' | 'analyze';
  size?: number;
  epochs?: number;
  verbose?: boolean;
  json?: boolean;
}

/**
 * Store command specific types
 */
export interface StoreCommandFlags extends ParsedFlags {
  mock?: boolean;
  todo?: string;
  all?: boolean;
  list?: string;
  epochs?: number;
  network?: string;
  'batch-size'?: number;
  retry?: boolean;
  reuse?: boolean;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Store file command specific types
 */
export interface StoreFileCommandArgs extends ParsedArgs {
  files?: string;
}

export interface StoreFileCommandFlags extends ParsedFlags {
  batch?: boolean;
  epochs?: number;
  force?: boolean;
  network?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Retrieve command specific types
 */
export interface RetrieveCommandArgs extends ParsedArgs {
  listName?: string;
}

export interface RetrieveCommandFlags extends ParsedFlags {
  id: string;
  output?: string;
  network?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * AI command specific types
 */
export interface AICommandFlags extends ParsedFlags {
  action?: 'setup' | 'verify' | 'credentials' | 'permissions';
  provider?: AIProvider | string;
  apiKey?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * System audit command specific types
 */
export interface AuditCommandFlags extends ParsedFlags {
  search?: boolean;
  operation?: string;
  startDate?: string;
  endDate?: string;
  outcome?: 'success' | 'failure' | 'all';
  configure?: boolean;
  level?: 'debug' | 'info' | 'warn' | 'error';
  retention?: number;
  json?: boolean;
  verbose?: boolean;
}

/**
 * AI permissions command specific types
 */
export interface AIPermissionsFlags extends ParsedFlags {
  list?: boolean;
  check?: boolean;
  grant?: boolean;
  revoke?: boolean;
  register?: boolean;
  operation?: string;
  permission?: string;
  user?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * AI credentials command specific types
 */
export interface AICredentialsFlags extends ParsedFlags {
  add?: boolean;
  remove?: boolean;
  list?: boolean;
  verify?: boolean;
  provider?: string;
  apiKey?: string;
  force?: boolean;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Validate config command specific types
 */
export interface ValidateConfigFlags extends ParsedFlags {
  fix?: boolean;
  detailed?: boolean;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Config write type - represents the structure of config files
 */
export interface ConfigData {
  network: string;
  walletAddress: string;
  encryptedStorage: boolean;
  lastDeployment?: {
    packageId: string;
    [key: string]: unknown;
  };
  packageId?: string;
  registryId?: string;
  completedTodos?: {
    count: number;
    lastCompleted: string | null;
    history: Array<{
      id: string;
      title: string;
      completedAt: string;
      listName?: string;
      category?: string;
    }>;
    byCategory: Record<string, number>;
  };
  [key: string]: unknown;
}

/**
 * File system write options type
 */
export interface FileWriteOptions {
  encoding?: BufferEncoding;
  mode?: number;
  flag?: string;
}

/**
 * Walrus storage interface
 */
export interface WalrusStorageInstance {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  storeTodo(todo: Todo): Promise<string>;
  retrieveTodo(blobId: string): Promise<Todo>;
  storeData(data: Buffer | string, options?: unknown): Promise<string>;
  initializeManagers?(): void;
  storageReuseAnalyzer?: unknown;
}

/**
 * Storage fields type for storage command
 */
export interface StorageFields {
  availableSpace: string;
  totalSpace: string;
  usedSpace: string;
  allocated: boolean;
  [key: string]: unknown;
}

/**
 * Spinner type for progress indicators
 */
export interface SpinnerInstance {
  stop(): void;
  succeed(text?: string): void;
  fail(text?: string): void;
  text: string;
}

/**
 * Audit log configuration
 */
export interface AuditLogConfig {
  level?: 'debug' | 'info' | 'warn' | 'error';
  retention?: number;
  destination?: string;
  [key: string]: unknown;
}

/**
 * JSON output types
 */
export interface JsonOutput {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
  [key: string]: unknown;
}

/**
 * Command validation types
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Type guards for runtime type checking
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value as any) && value.every(item => typeof item === 'string');
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

/**
 * Helper to ensure a flag value is an array
 */
export function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value as any) ? value : [value];
}

/**
 * Helper to ensure a flag value is a string
 */
export function ensureString(
  value: string | string[] | undefined,
  defaultValue = ''
): string {
  if (value === undefined) return defaultValue;
  return Array.isArray(value as any) ? value[0] : value;
}
