"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const SuiTestService_1 = require("../services/SuiTestService");
(0, globals_1.describe)("SuiTestService (in‑memory)", () => {
    // deterministic address
    (0, globals_1.it)("returns the provided wallet address", async () => {
        const service = new SuiTestService_1.SuiTestService("0xabc");
        (0, globals_1.expect)(await service.getWalletAddress()).toBe("0xabc");
    });
    // add & fetch
    (0, globals_1.it)("creates a list and adds a todo", async () => {
        const service = new SuiTestService_1.SuiTestService();
        const listId = await service.createTodoList();
        const todoId = await service.addTodo(listId, "write tests");
        const todos = await service.getTodos(listId);
        (0, globals_1.expect)(todos).toHaveLength(1);
        (0, globals_1.expect)(todos[0]).toMatchObject({ id: todoId, text: "write tests" });
    });
    // update
    (0, globals_1.it)("updates a todo item correctly", async () => {
        const service = new SuiTestService_1.SuiTestService();
        const listId = await service.createTodoList();
        const todoId = await service.addTodo(listId, "initial");
        await service.updateTodo(listId, todoId, { completed: true });
        const [item] = await service.getTodos(listId);
        (0, globals_1.expect)(item.completed).toBe(true);
    });
});
