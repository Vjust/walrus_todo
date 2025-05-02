import { WalrusClientInterface } from '../../types';
import { Todo, TodoList } from '../../types';
import { WalrusClient } from '../../__mocks__/@mysten/walrus';
import { mockSuiClient } from '../../__mocks__/@mysten/sui';
export interface TestContext {
    walrusClient: WalrusClient;
    suiClient: typeof mockSuiClient;
    todoList?: TodoList;
    mockTodoId?: string;
}
export declare const createTestContext: () => TestContext;
export declare const setupMockTodoList: (context: TestContext, todos?: Todo[]) => string;
export declare function createMockTodo(overrides?: Partial<Todo>): Todo;
export declare const waitForSync: (ms?: number) => Promise<void>;
export declare const mockNetworkError: (client: WalrusClientInterface | typeof mockSuiClient, method: string) => void;
export declare const mockNetworkLatency: (client: WalrusClientInterface | typeof mockSuiClient, method: string, latencyMs: number) => void;
