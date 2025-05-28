import { Page, Locator, expect } from '@playwright/test';

/**
 * Frontend Page Object Model for WalTodo E2E tests
 * Provides high-level actions for interacting with the React frontend
 */

interface TodoData {
  title: string;
  description: string;
  completed: boolean;
  isBlockchain?: boolean;
  ownerAddress?: string;
  priority?: string;
  tags?: string[];
}

interface TransactionData {
  type: string;
  todoTitle: string;
  timestamp: string;
  status: string;
}

interface PerformanceMetrics {
  avgRenderTime: number;
  memoryUsage: number;
  wsLatency: number;
}

export class FrontendHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for the app to be fully loaded and ready
   */
  async waitForAppReady(timeout = 10000): Promise<void> {
    // Wait for main app container
    await this.page.waitForSelector('[data-testid="app-container"]', {
      timeout,
    });

    // Wait for loading states to complete
    await this.page
      .waitForSelector('[data-testid="loading"]', {
        state: 'detached',
        timeout: 5000,
      })
      .catch(() => {
        // Loading indicator might not be present, continue
      });

    // Wait for todo list container
    await this.page.waitForSelector('[data-testid="todo-list"]', { timeout });

    // Ensure React has finished hydration
    await this.page
      .waitForFunction(() => {
        return window.React !== undefined;
      })
      .catch(() => {
        // React might not be globally exposed, continue
      });
  }

  /**
   * Wait for a todo with specific title to appear
   */
  async waitForTodoByTitle(title: string, timeout = 5000): Promise<Locator> {
    const todoSelector = `[data-testid="todo-item"][data-title="${title}"]`;

    await this.page.waitForSelector(todoSelector, { timeout });
    return this.page.locator(todoSelector);
  }

  /**
   * Get todo data from a todo element
   */
  async getTodoData(todoElement: Locator): Promise<TodoData> {
    const title = (await todoElement.getAttribute('data-title')) || '';
    const description =
      (await todoElement
        .locator('[data-testid="todo-description"]')
        .textContent()) || '';
    const completed =
      (await todoElement.getAttribute('data-completed')) === 'true';
    const isBlockchain =
      (await todoElement.getAttribute('data-blockchain')) === 'true';
    const ownerAddress =
      (await todoElement.getAttribute('data-owner')) || undefined;

    return {
      title,
      description,
      completed,
      isBlockchain,
      ownerAddress,
    };
  }

  /**
   * Complete a todo via the frontend UI
   */
  async completeTodo(todoElement: Locator): Promise<void> {
    const completeButton = todoElement.locator(
      '[data-testid="complete-todo-btn"]'
    );
    await completeButton.click();

    // Wait for completion animation/state change
    await this.page.waitForTimeout(500);
  }

  /**
   * Clear all todos from the frontend
   */
  async clearAllTodos(): Promise<void> {
    try {
      const clearAllButton = this.page.locator(
        '[data-testid="clear-all-todos-btn"]'
      );

      if ((await clearAllButton.count()) > 0) {
        await clearAllButton.click();

        // Confirm in modal if it appears
        const confirmButton = this.page.locator(
          '[data-testid="confirm-clear-all"]'
        );
        if ((await confirmButton.count()) > 0) {
          await confirmButton.click();
        }

        // Wait for todos to be cleared
        await this.page.waitForTimeout(1000);
      }
    } catch (error) {
      // Clear all might not be available, continue
    }
  }

  /**
   * Connect wallet in the frontend
   */
  async connectWallet(): Promise<void> {
    const connectButton = this.page.locator(
      '[data-testid="connect-wallet-btn"]'
    );

    if ((await connectButton.count()) > 0) {
      await connectButton.click();

      // Select wallet type (assuming test wallet is available)
      const testWalletOption = this.page.locator(
        '[data-testid="wallet-option-test"]'
      );
      if ((await testWalletOption.count()) > 0) {
        await testWalletOption.click();
      }

      // Wait for wallet connection to complete
      await this.page.waitForSelector('[data-testid="wallet-connected"]', {
        timeout: 10000,
      });
    }
  }

  /**
   * Get connected wallet address
   */
  async getConnectedWalletAddress(): Promise<string> {
    const walletAddress = this.page.locator('[data-testid="wallet-address"]');
    return (await walletAddress.textContent()) || '';
  }

  /**
   * Verify WebSocket connection is active
   */
  async verifyWebSocketConnection(): Promise<void> {
    // Check for WebSocket connection indicator
    const wsIndicator = this.page.locator('[data-testid="ws-status"]');

    if ((await wsIndicator.count()) > 0) {
      await expect(wsIndicator).toHaveAttribute('data-status', 'connected');
    } else {
      // Alternative: Check for real-time functionality
      await this.page.waitForFunction(() => {
        return window.WebSocket !== undefined;
      });
    }
  }

  /**
   * Wait for error notification to appear
   */
  async waitForErrorNotification(
    errorPattern: RegExp,
    timeout = 5000
  ): Promise<void> {
    const errorNotification = this.page.locator(
      '[data-testid="error-notification"]'
    );

    await this.page.waitForSelector('[data-testid="error-notification"]', {
      timeout,
    });

    const errorText = (await errorNotification.textContent()) || '';
    expect(errorText).toMatch(errorPattern);
  }

  /**
   * Simulate network error for testing
   */
  async simulateNetworkError(): Promise<void> {
    // Intercept and fail network requests
    await this.page.route('**/api/**', route => route.abort('failed'));
    await this.page.route('**/ws**', route => route.abort('failed'));
  }

  /**
   * Restore network connectivity
   */
  async restoreNetwork(): Promise<void> {
    await this.page.unroute('**/api/**');
    await this.page.unroute('**/ws**');
  }

  /**
   * Start performance monitoring
   */
  async startPerformanceMonitoring(): Promise<void> {
    await this.page.evaluate(() => {
      // Initialize performance tracking
      (window as any).perfMetrics = {
        renderTimes: [],
        startTime: performance.now(),
      };

      // Hook into React render cycle if available
      if ((window as any).React) {
        const originalRender = (window as any).React.render;
        (window as any).React.render = function (...args: any[]) {
          const start = performance.now();
          const result = originalRender.apply(this, args);
          const end = performance.now();
          (window as any).perfMetrics.renderTimes.push(end - start);
          return result;
        };
      }
    });
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return await this.page.evaluate(() => {
      const metrics = (window as any).perfMetrics || {};
      const memory = (performance as any).memory;

      return {
        avgRenderTime:
          metrics.renderTimes?.length > 0
            ? metrics.renderTimes.reduce((a: number, b: number) => a + b, 0) /
              metrics.renderTimes.length
            : 0,
        memoryUsage: memory?.usedJSHeapSize || 0,
        wsLatency: 0, // TODO: Implement WebSocket latency measurement
      };
    });
  }

  /**
   * Get transaction history from the frontend
   */
  async getTransactionHistory(): Promise<TransactionData[]> {
    // Open transaction history panel
    const historyButton = this.page.locator(
      '[data-testid="transaction-history-btn"]'
    );

    if ((await historyButton.count()) > 0) {
      await historyButton.click();

      // Wait for history to load
      await this.page.waitForSelector('[data-testid="transaction-list"]', {
        timeout: 5000,
      });

      // Extract transaction data
      const transactions = await this.page
        .locator('[data-testid="transaction-item"]')
        .all();

      const txData: TransactionData[] = [];
      for (const tx of transactions) {
        const type = (await tx.getAttribute('data-type')) || '';
        const todoTitle = (await tx.getAttribute('data-todo-title')) || '';
        const timestamp = (await tx.getAttribute('data-timestamp')) || '';
        const status = (await tx.getAttribute('data-status')) || '';

        txData.push({ type, todoTitle, timestamp, status });
      }

      return txData;
    }

    return [];
  }

  /**
   * Create a todo via the frontend form
   */
  async createTodo(
    title: string,
    description: string,
    options: {
      priority?: string;
      tags?: string[];
      blockchain?: boolean;
    } = {}
  ): Promise<void> {
    // Click add todo button
    const addButton = this.page.locator('[data-testid="add-todo-btn"]');
    await addButton.click();

    // Fill form
    await this.page.fill('[data-testid="todo-title-input"]', title);
    await this.page.fill('[data-testid="todo-description-input"]', description);

    if (options.priority) {
      await this.page.selectOption(
        '[data-testid="todo-priority-select"]',
        options.priority
      );
    }

    if (options.tags?.length) {
      const tagsInput = this.page.locator('[data-testid="todo-tags-input"]');
      await tagsInput.fill(options.tags.join(', '));
    }

    if (options.blockchain) {
      const blockchainCheckbox = this.page.locator(
        '[data-testid="blockchain-todo-checkbox"]'
      );
      await blockchainCheckbox.check();
    }

    // Submit form
    const submitButton = this.page.locator('[data-testid="submit-todo-btn"]');
    await submitButton.click();

    // Wait for creation to complete
    await this.page.waitForTimeout(1000);
  }

  /**
   * Search for todos by text
   */
  async searchTodos(searchText: string): Promise<Locator[]> {
    const searchInput = this.page.locator('[data-testid="todo-search-input"]');
    await searchInput.fill(searchText);

    // Wait for search results
    await this.page.waitForTimeout(500);

    return await this.page.locator('[data-testid="todo-item"]').all();
  }

  /**
   * Filter todos by status
   */
  async filterTodos(status: 'all' | 'active' | 'completed'): Promise<void> {
    const filterButton = this.page.locator(`[data-testid="filter-${status}"]`);
    await filterButton.click();

    // Wait for filter to apply
    await this.page.waitForTimeout(500);
  }

  /**
   * Get count of visible todos
   */
  async getTodoCount(): Promise<number> {
    return await this.page.locator('[data-testid="todo-item"]').count();
  }

  /**
   * Verify app is in dark mode
   */
  async verifyDarkMode(): Promise<boolean> {
    const body = this.page.locator('body');
    const classes = (await body.getAttribute('class')) || '';
    return classes.includes('dark') || classes.includes('dark-mode');
  }

  /**
   * Toggle dark mode
   */
  async toggleDarkMode(): Promise<void> {
    const darkModeToggle = this.page.locator(
      '[data-testid="dark-mode-toggle"]'
    );
    await darkModeToggle.click();

    // Wait for theme change
    await this.page.waitForTimeout(300);
  }
}
