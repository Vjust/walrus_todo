import { describe, it, expect } from "@jest/globals";
import { SuiTestService } from "../services/SuiTestService";
import { Config } from "../types";

describe("SuiTestService (in‑memory)", () => {
  const mockConfig: Config = {
    network: 'testnet',
    walletAddress: '0xabc',
    encryptedStorage: false
  };
  
  const service = new SuiTestService(mockConfig);
  
  it("returns the provided wallet address", async () => {
    const testService = new SuiTestService(mockConfig);
    expect(await testService.getWalletAddress()).toBe("0xabc");
  });

  it("creates a list and adds a todo", async () => {
    const listId = await service.createTodoList();
    const todoId = await service.addTodo(listId, "write tests");
    const todos = await service.getTodos(listId);

    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ id: todoId, text: "write tests" });
  });

  it("updates a todo item correctly", async () => {
    const listId = await service.createTodoList();
    const todoId = await service.addTodo(listId, "initial");
    await service.updateTodo(listId, todoId, { completed: true });

    const [item] = await service.getTodos(listId);
    expect(item.completed).toBe(true);
  });

  it("deletes a todo list", async () => {
    const listId = await service.createTodoList();
    await service.deleteTodoList(listId);
    
    await expect(service.getTodos(listId)).rejects.toThrow();
  });
});