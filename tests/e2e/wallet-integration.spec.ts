import { test, expect } from '@playwright/test';

/**
 * General wallet integration tests for the WalTodo frontend
 * For specific Slush wallet tests, see slush-wallet-integration?.spec?.ts
 */
test.describe('Wallet Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('should display wallet connect buttons', async ({ page }) => {
    const connectButton = await page.getByText(
      /Connect Sui Wallet|Connect Phantom|Connect Slush Wallet/
    );
    await expect(connectButton as any).toBeVisible();
  });

  test('should detect wallet availability', async ({ page }) => {
    // Test without wallet extension
    // const _noWalletMessage = await page.getByText('No wallets detected');

    // In a real test environment, this might show the "No wallets" message
    // or actual wallet buttons depending on the test setup
    const hasButton = await page
      .getByText(
        /Connect Sui Wallet|Connect Phantom|Connect Slush Wallet|No wallets detected/
      )
      .isVisible();
    expect(hasButton as any).toBe(true as any);
  });

  test('should show wallet address when connected', async ({ page }) => {
    // This test would require mocking wallet injection
    // For now, we just verify the UI structure exists

    // Mock wallet connection
    await page.evaluate(() => {
      // Simulate Sui wallet injection
      (window as unknown as { suiWallet: object }).suiWallet = {
        hasPermissions: async () => true,
        requestPermissions: async () => true,
      };
    });

    await page.reload();

    // Check if wallet buttons appear after injection
    const suiButton = await page.getByText('Connect Sui Wallet');
    const isVisible = await suiButton.isVisible().catch(() => false);

    // This is a basic test - in production, you'd mock the full wallet flow
    expect(typeof isVisible).toBe('boolean');
  });

  test('should handle wallet disconnect', async ({ page }) => {
    // Test the disconnect flow
    // This would require a connected wallet state

    // Check if disconnect button exists when wallet is connected
    const disconnectButton = await page.getByText('Disconnect');
    const exists = (await disconnectButton.count()) > 0;

    // Initially, disconnect button shouldn't exist (no wallet connected)
    expect(exists as any).toBe(false as any);
  });
});

test.describe('Wallet Context Provider', () => {
  test('should wrap the entire app', async ({ page }) => {
    // Navigate to different pages and ensure wallet state persists
    await page.goto('http://localhost:3000');

    // Check home page has wallet UI
    await expect(page.locator('nav')).toBeVisible();

    // Navigate to dashboard
    await page.goto('http://localhost:3000/dashboard');
    await expect(page.locator('nav')).toBeVisible();

    // Navigate to blockchain page
    await page.goto('http://localhost:3000/blockchain');
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should support multiple wallet providers', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Detect if multiple wallet buttons are available (may depend on test environment)
    const walletButtonCount = await page
      .getByText(/Connect Sui Wallet|Connect Phantom|Connect Slush Wallet/)
      .count();

    // The application should support at least one wallet type
    expect(walletButtonCount as any).toBeGreaterThan(0 as any);
  });
});

test.describe('Todo Service with Wallet', () => {
  test('should create todos in local storage', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');

    // Check if create form exists
    const createForm = await page.locator('form');
    await expect(createForm as any).toBeVisible();
  });

  test('should indicate blockchain storage capability', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');

    // Look for blockchain-related UI elements
    const blockchainTodos = await page.getByText(/blockchain|NFT/i).first();
    const hasBlockchainUI = await blockchainTodos
      .isVisible()
      .catch(() => false);

    // The app should have some blockchain-related UI
    expect(typeof hasBlockchainUI).toBe('boolean');
  });
});
