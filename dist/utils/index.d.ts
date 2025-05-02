export * from './error-handler';
export * from './id-generator';
export declare function validateDate(dateStr: string): boolean;
export declare function validatePriority(priority: string): priority is 'high' | 'medium' | 'low';
export declare function formatTodoOutput(todo: {
    completed: boolean;
    priority: 'high' | 'medium' | 'low';
    task: string;
    dueDate?: string;
    tags: string[];
}): string;
export declare function formatDate(date?: Date): string;
export declare function sleep(ms: number): Promise<void>;
