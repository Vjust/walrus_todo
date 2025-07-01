export * from './error-handler';
export * from './id-generator';
export * from './todo-serializer';
export * from './walrus-storage';
export * from './performance-cache';
export * from './batch-processor';
export * from './lazy-loader';
export * from './progress-indicators';
export * from './interactive-mode';
export * from './error-messages';
export * from './union-type-utils';

// Network Health Checking System
export * from './NetworkHealthChecker';
export * from './NetworkRetryManager';
export * from './EndpointFallbackManager';
export * from './PreDeploymentValidator';
export * from './NetworkMonitor';
export * from './WalrusDeploymentHealthManager';

export function validateDate(dateStr: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

export function validatePriority(
  priority: string
): priority is 'high' | 'medium' | 'low' {
  return ['high', 'medium', 'low'].includes(priority);
}

export function formatTodoOutput(todo: {
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  title: string;
  dueDate?: string;
  tags: string[];
}): string {
  const status = todo.completed ? '✓' : '⃞';
  const priority =
    {
      high: '⚠️',
      medium: '•',
      low: '○',
    }[todo.priority] || '•';

  return `${status} ${priority} ${todo.title}${todo.dueDate ? ` (due: ${todo.dueDate})` : ''}${
    todo?.tags?.length ? ` [${todo?.tags?.join(', ')}]` : ''
  }`;
}

export function formatDate(date: Date = new Date()): string {
  return date.toISOString().split('.')[0] + 'Z';
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Type guards and null safety utilities
 */

/**
 * Safe array access with optional fallback
 * @param array Array to access
 * @param index Index to access
 * @param fallback Optional fallback value
 * @returns Element at index or fallback
 */
export function safeArrayAccess<T>(
  array: T[] | undefined | null,
  index: number,
  fallback?: T
): T | undefined {
  if (!array || index < 0 || index >= array.length) {
    return fallback;
  }
  return array[index];
}

/**
 * Safe property access with type checking
 * @param obj Object to access
 * @param key Property key
 * @returns Property value or undefined
 */
export function safePropertyAccess<T, K extends keyof T>(
  obj: T | undefined | null,
  key: K
): T[K] | undefined {
  return obj?.[key];
}

/**
 * Type guard to check if value is not null or undefined
 * @param value Value to check
 * @returns True if value is defined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard to check if value is a non-empty string
 * @param value Value to check
 * @returns True if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if value is a non-empty array
 * @param value Value to check
 * @returns True if value is a non-empty array
 */
export function isNonEmptyArray<T>(
  value: T[] | undefined | null
): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Safe object merge with null checks
 * @param target Target object
 * @param source Source object
 * @returns Merged object
 */
export function safeMerge<T extends Record<string, unknown>>(
  target: T | undefined | null,
  source: Partial<T> | undefined | null
): T {
  if (!target) {
    return (source as T) || ({} as T);
  }
  if (!source) {
    return target;
  }
  return { ...target, ...source };
}
