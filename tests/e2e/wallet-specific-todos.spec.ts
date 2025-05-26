/**
 * Playwright E2E Tests for Wallet-Specific Todo Functionality
 *
 * These tests validate that users can only see their own todos when connecting
 * different wallets, ensuring proper data isolation and wallet switching.
 */

import { test, expect, Page } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:3000';

// Test helper functions
async function mockWalletConnection(
  page: Page,
  walletAddress: string,
  walletName: string = 'TestWallet'
) {
  // Mock wallet connection by setting up the wallet context
  await page.evaluate(
    ({ address, name }) => {
      // Mock the wallet connection in localStorage for persistence
      const mockWalletData = {
        address,
        name,
        connected: true,
        network: 'testnet',
      };

      // Store wallet data
      localStorage.setItem('lastConnectedWallet', name);
      localStorage.setItem(
        'walletConnectionData',
        JSON.stringify(mockWalletData)
      );

      // Mock wallet connection event
      window.dispatchEvent(
        new CustomEvent('wallet-connect', {
          detail: mockWalletData,
        })
      );
    },
    { address: walletAddress, name: walletName }
  );

  // Wait for wallet connection to be processed
  await page.waitForTimeout(500);
}

async function mockWalletDisconnection(page: Page) {
  await page.evaluate(() => {
    // Clear wallet data
    localStorage.removeItem('lastConnectedWallet');
    localStorage.removeItem('walletConnectionData');

    // Mock wallet disconnection event
    window.dispatchEvent(new CustomEvent('wallet-disconnect'));
  });

  await page.waitForTimeout(500);
}

async function createTodo(
  page: Page,
  title: string,
  description: string = '',
  priority: 'low' | 'medium' | 'high' = 'medium'
) {
  // Fill in the todo form
  await page.fill('input[placeholder="What needs to be done?"]', title);

  if (description) {
    await page.fill(
      'textarea[placeholder="Add a description (optional)"]',
      description
    );
  }

  if (priority !== 'medium') {
    await page.selectOption('select', priority);
  }

  // Submit the form
  await page.click('button[type="submit"]:has-text("Add Todo")');

  // Wait for the todo to be added
  await page.waitForTimeout(300);
}

async function getTodoTitles(page: Page): Promise<string[]> {
  // Wait for todos to load
  await page.waitForTimeout(500);

  // Get all todo titles from the todo list
  const todoElements = await page.locator('[data-testid="todo-item"]').all();
  const titles: string[] = [];

  for (const element of todoElements) {
    const titleElement = element.locator('[data-testid="todo-title"]');
    const titleCount = await titleElement.count();
    if (titleCount > 0) {
      const title = await titleElement.textContent();
      if (title) titles.push(title.trim());
    }
  }

  return titles;
}

test.describe('Wallet-Specific Todo Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
  });

  test('should show wallet connection prompt when no wallet is connected', async ({
    page,
  }) => {
    // Ensure no wallet is connected
    await mockWalletDisconnection(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should show wallet connection warning
    await expect(
      page.locator(
        'text=Connect your wallet to create and manage your personal todos'
      )
    ).toBeVisible();

    // Add Todo button should be disabled and show "Connect Wallet"
    const addButton = page.locator('button[type="submit"]');
    await expect(addButton).toBeDisabled();
    await expect(addButton).toHaveText('Connect Wallet');
  });

  test('should allow creating todos when wallet is connected', async ({
    page,
  }) => {
    // Mock wallet connection
    await mockWalletConnection(
      page,
      '0x1234567890abcdef1234567890abcdef12345678'
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wallet connection warning should be hidden
    await expect(
      page.locator(
        'text=Connect your wallet to create and manage your personal todos'
      )
    ).not.toBeVisible();

    // Add Todo button should be enabled
    const addButton = page.locator('button[type="submit"]');
    await expect(addButton).not.toBeDisabled();
    await expect(addButton).toHaveText('Add Todo');

    // Create a test todo
    await createTodo(
      page,
      'Test Wallet Todo',
      'This todo should be associated with wallet 1'
    );

    // Todo should appear in the list
    await expect(page.locator('text=Test Wallet Todo')).toBeVisible();
  });

  test('should isolate todos between different wallets', async ({ page }) => {
    const wallet1Address = '0x1111111111111111111111111111111111111111';
    const wallet2Address = '0x2222222222222222222222222222222222222222';

    // Connect first wallet and create todos
    await mockWalletConnection(page, wallet1Address, 'Wallet1');
    await page.reload();
    await page.waitForLoadState('networkidle');

    await createTodo(page, 'Wallet 1 Todo 1', 'First todo for wallet 1');
    await createTodo(page, 'Wallet 1 Todo 2', 'Second todo for wallet 1');

    // Verify wallet 1 todos are visible
    let todoTitles = await getTodoTitles(page);
    expect(todoTitles).toContain('Wallet 1 Todo 1');
    expect(todoTitles).toContain('Wallet 1 Todo 2');

    // Switch to second wallet
    await mockWalletConnection(page, wallet2Address, 'Wallet2');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wallet 1 todos should not be visible
    todoTitles = await getTodoTitles(page);
    expect(todoTitles).not.toContain('Wallet 1 Todo 1');
    expect(todoTitles).not.toContain('Wallet 1 Todo 2');

    // Create todos for wallet 2
    await createTodo(page, 'Wallet 2 Todo 1', 'First todo for wallet 2');
    await createTodo(page, 'Wallet 2 Todo 2', 'Second todo for wallet 2');

    // Verify only wallet 2 todos are visible
    todoTitles = await getTodoTitles(page);
    expect(todoTitles).toContain('Wallet 2 Todo 1');
    expect(todoTitles).toContain('Wallet 2 Todo 2');
    expect(todoTitles).not.toContain('Wallet 1 Todo 1');
    expect(todoTitles).not.toContain('Wallet 1 Todo 2');

    // Switch back to first wallet
    await mockWalletConnection(page, wallet1Address, 'Wallet1');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wallet 1 todos should be visible again, wallet 2 todos should not
    todoTitles = await getTodoTitles(page);
    expect(todoTitles).toContain('Wallet 1 Todo 1');
    expect(todoTitles).toContain('Wallet 1 Todo 2');
    expect(todoTitles).not.toContain('Wallet 2 Todo 1');
    expect(todoTitles).not.toContain('Wallet 2 Todo 2');
  });

  test('should persist todos when reconnecting the same wallet', async ({
    page,
  }) => {
    const walletAddress = '0x3333333333333333333333333333333333333333';

    // Connect wallet and create todos
    await mockWalletConnection(page, walletAddress, 'PersistenceWallet');
    await page.reload();
    await page.waitForLoadState('networkidle');

    await createTodo(page, 'Persistent Todo 1', 'This should persist');
    await createTodo(page, 'Persistent Todo 2', 'This should also persist');

    // Verify todos are visible
    let todoTitles = await getTodoTitles(page);
    expect(todoTitles).toContain('Persistent Todo 1');
    expect(todoTitles).toContain('Persistent Todo 2');

    // Disconnect wallet
    await mockWalletDisconnection(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Todos should not be visible when disconnected
    todoTitles = await getTodoTitles(page);
    expect(todoTitles).not.toContain('Persistent Todo 1');
    expect(todoTitles).not.toContain('Persistent Todo 2');

    // Reconnect same wallet
    await mockWalletConnection(page, walletAddress, 'PersistenceWallet');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Todos should be visible again
    todoTitles = await getTodoTitles(page);
    expect(todoTitles).toContain('Persistent Todo 1');
    expect(todoTitles).toContain('Persistent Todo 2');
  });

  test('should allow completing todos for specific wallet', async ({
    page,
  }) => {
    const walletAddress = '0x4444444444444444444444444444444444444444';

    // Connect wallet and create a todo
    await mockWalletConnection(page, walletAddress, 'CompletionWallet');
    await page.reload();
    await page.waitForLoadState('networkidle');

    await createTodo(page, 'Todo to Complete', 'This todo will be completed');

    // Find and click the checkbox to complete the todo
    const todoCheckbox = page.locator('[data-testid="todo-checkbox"]').first();
    await expect(todoCheckbox).toBeVisible();
    await todoCheckbox.check();

    // Wait for the completion to be processed
    await page.waitForTimeout(300);

    // Verify the todo is marked as completed
    await expect(todoCheckbox).toBeChecked();

    // The todo title should have completed styling (strikethrough or similar)
    const todoTitle = page.locator('[data-testid="todo-title"]').first();
    await expect(todoTitle).toHaveClass(/completed|line-through/);
  });

  test('should handle multiple todo lists per wallet', async ({ page }) => {
    const walletAddress = '0x5555555555555555555555555555555555555555';

    // Connect wallet
    await mockWalletConnection(page, walletAddress, 'MultiListWallet');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Create todo in default list
    await createTodo(page, 'Default List Todo');

    // Switch to work list
    await page.click('button:has-text("Work")');
    await page.waitForTimeout(300);

    // Create todo in work list
    await createTodo(page, 'Work List Todo');

    // Verify work list todo is visible
    let todoTitles = await getTodoTitles(page);
    expect(todoTitles).toContain('Work List Todo');
    expect(todoTitles).not.toContain('Default List Todo');

    // Switch back to default list
    await page.click('button:has-text("Default")');
    await page.waitForTimeout(300);

    // Verify default list todo is visible
    todoTitles = await getTodoTitles(page);
    expect(todoTitles).toContain('Default List Todo');
    expect(todoTitles).not.toContain('Work List Todo');
  });

  test('should show appropriate error messages for wallet operations', async ({
    page,
  }) => {
    // Test without wallet connection
    await mockWalletDisconnection(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Try to submit a todo without connecting wallet
    await page.fill(
      'input[placeholder="What needs to be done?"]',
      'This should fail'
    );
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(
      page.locator('text=Please connect your wallet to add todos')
    ).toBeVisible();
  });

  test('should handle wallet switching gracefully', async ({ page }) => {
    const wallet1Address = '0x6666666666666666666666666666666666666666';
    const wallet2Address = '0x7777777777777777777777777777777777777777';

    // Start with wallet 1
    await mockWalletConnection(page, wallet1Address, 'SwitchWallet1');
    await page.reload();
    await page.waitForLoadState('networkidle');

    await createTodo(page, 'Before Switch Todo');

    // Verify todo is visible
    let todoTitles = await getTodoTitles(page);
    expect(todoTitles).toContain('Before Switch Todo');

    // Switch wallets rapidly
    await mockWalletConnection(page, wallet2Address, 'SwitchWallet2');
    await page.waitForTimeout(100);
    await mockWalletConnection(page, wallet1Address, 'SwitchWallet1');
    await page.waitForTimeout(100);
    await mockWalletConnection(page, wallet2Address, 'SwitchWallet2');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should show empty state for wallet 2
    todoTitles = await getTodoTitles(page);
    expect(todoTitles).not.toContain('Before Switch Todo');

    // Switch back to wallet 1
    await mockWalletConnection(page, wallet1Address, 'SwitchWallet1');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Original todo should still be there
    todoTitles = await getTodoTitles(page);
    expect(todoTitles).toContain('Before Switch Todo');
  });
});
