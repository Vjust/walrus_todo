"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockNetworkLatency = exports.mockNetworkError = exports.waitForSync = exports.createMockTodo = exports.setupMockTodoList = exports.createTestContext = void 0;
const walrus_1 = require("../../__mocks__/@mysten/walrus");
const sui_1 = require("../../__mocks__/@mysten/sui");
const createTestContext = () => {
    return {
        walrusClient: new walrus_1.WalrusClient(),
        suiClient: sui_1.mockSuiClient
    };
};
exports.createTestContext = createTestContext;
const setupMockTodoList = (context, todos = []) => {
    const todoList = {
        id: 'mock-list-id',
        name: 'Mock Todo List',
        owner: 'mock-owner',
        todos,
        version: 1
    };
    // Setup in both Walrus and Sui
    const blobId = (0, walrus_1.setupMockTodos)(todos);
    (0, sui_1.setupMockObject)(todoList.id, todoList);
    context.todoList = todoList;
    context.mockTodoId = blobId;
    return todoList.id;
};
exports.setupMockTodoList = setupMockTodoList;
const createMockTodo = (overrides = {}) => {
    return {
        id: `mock-todo-${Math.random().toString(36).substr(2, 9)}`,
        task: 'Mock Todo Task',
        completed: false,
        priority: 'medium',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
    };
};
exports.createMockTodo = createMockTodo;
const waitForSync = async (ms = 100) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
exports.waitForSync = waitForSync;
const mockNetworkError = (client, method) => {
    const mockMethod = client[method];
    if (typeof mockMethod === 'function') {
        mockMethod.mockRejectedValueOnce(new Error('Network Error'));
    }
};
exports.mockNetworkError = mockNetworkError;
const mockNetworkLatency = (client, method, latencyMs) => {
    const mockMethod = client[method];
    if (typeof mockMethod === 'function') {
        const originalImpl = mockMethod.getMockImplementation();
        mockMethod.mockImplementationOnce(async (...args) => {
            await (0, exports.waitForSync)(latencyMs);
            return originalImpl === null || originalImpl === void 0 ? void 0 : originalImpl(...args);
        });
    }
};
exports.mockNetworkLatency = mockNetworkLatency;
