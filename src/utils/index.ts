export * from './error-handler';
export * from './id-generator';
export * from './todo-serializer';
export * from './walrus-storage';

export function validateDate(dateStr: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

export function validatePriority(priority: string): priority is 'high' | 'medium' | 'low' {
  return ['high', 'medium', 'low'].includes(priority);
}

export function formatTodoOutput(todo: { completed: boolean; priority: 'high' | 'medium' | 'low'; task: string; dueDate?: string; tags: string[] }): string {
  const status = todo.completed ? '✓' : '⃞';
  const priority = {
    high: '⚠️',
    medium: '•',
    low: '○'
  }[todo.priority] || '•';

  return `${status} ${priority} ${todo.task}${todo.dueDate ? ` (due: ${todo.dueDate})` : ''}${
    todo.tags.length ? ` [${todo.tags.join(', ')}]` : ''
  }`;
}

export function formatDate(date: Date = new Date()): string {
  return date.toISOString().split('.')[0] + 'Z';
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}