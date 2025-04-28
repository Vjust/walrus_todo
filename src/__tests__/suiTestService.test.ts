import { describe, it, expect } from "@jest/globals";
import { SuiTestService } from "../services/SuiTestService";

describe("SuiTestService (in‑memory)", () => {
	// deterministic address
	it("returns the provided wallet address", async () => {
		const service = new SuiTestService("0xabc");
		expect(await service.getWalletAddress()).toBe("0xabc");
	});

	// add & fetch
	it("creates a list and adds a todo", async () => {
		const service = new SuiTestService();
		const listId = await service.createTodoList();
		const todoId = await service.addTodo(listId, "write tests");
		const todos = await service.getTodos(listId);

		expect(todos).toHaveLength(1);
		expect(todos[0]).toMatchObject({ id: todoId, text: "write tests" });
	});

	// update
	it("updates a todo item correctly", async () => {
		const service = new SuiTestService();
		const listId = await service.createTodoList();
		const todoId = await service.addTodo(listId, "initial");
		await service.updateTodo(listId, todoId, { completed: true });

		const [item] = await service.getTodos(listId);
		expect(item.completed).toBe(true);
	});
});
