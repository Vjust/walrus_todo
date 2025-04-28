"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WalrusTestService_1 = require("../services/WalrusTestService");
describe("WalrusTestService (in-memory)", () => {
    let service;
    beforeEach(() => {
        service = new WalrusTestService_1.WalrusTestService();
    });
    it("stores and retrieves a todo", async () => {
        const todo = {
            id: "todo1",
            task: "Test todo", // required field
            priority: "medium", // required field
            tags: [], // required field
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const listId = "list1";
        const blobId = await service.storeTodo(listId, todo);
        const retrieved = await service.getTodo(blobId);
        expect(retrieved).not.toBeNull();
        expect(retrieved).toMatchObject({
            id: todo.id,
            task: todo.task,
            completed: todo.completed
        });
    });
    it("builds and retrieves a todo list", async () => {
        const todos = [
            {
                id: "todo1",
                task: "First task",
                priority: "low",
                tags: ["work"],
                completed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: "todo2",
                task: "Second task",
                priority: "high",
                tags: ["home", "urgent"],
                completed: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
        const listId = "test-list";
        for (const t of todos)
            await service.storeTodo(listId, t);
        const list = await service.getTodoList(listId);
        expect(list).not.toBeNull();
        expect(list.todos.map(t => t.id)).toEqual(["todo1", "todo2"]);
        expect(list.todos[1].completed).toBe(true);
    });
    it("updates a todo correctly", async () => {
        const todo = {
            id: "todo-update",
            task: "Original task",
            priority: "medium",
            tags: ["init"],
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const listId = "update-list";
        await service.storeTodo(listId, todo);
        const updatedTodo = {
            ...todo,
            task: "Updated task",
            priority: "low",
            tags: ["updated"],
            completed: true
        };
        await service.updateTodo(listId, updatedTodo);
        const list = (await service.getTodoList(listId));
        expect(list.todos).toHaveLength(1);
        expect(list.todos[0]).toMatchObject({
            id: updatedTodo.id,
            task: updatedTodo.task,
            completed: true
        });
    });
});
