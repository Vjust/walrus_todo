/**
 * Basic Playwright E2E Tests for Wallet-Specific Todo Functionality
 *
 * These tests validate the user interface and basic functionality
 * without complex wallet mocking to ensure core features work.
 */

import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:3000';

test.describe('Basic Wallet Todo Functionality', () => {
  test('should load dashboard page successfully', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Check that the page loads with expected elements
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    await expect(
      page.locator('text=Manage your todos across different lists')
    ).toBeVisible();
  });

  test('should show wallet connection requirements', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Should show wallet connection warning when no wallet is connected
    await expect(
      page.locator(
        'text=Connect your wallet to create and manage your personal todos'
      )
    ).toBeVisible();

    // Add Todo button should show "Connect Wallet" when no wallet is connected
    const addButton = page.locator('button[type="submit"]').first();
    await expect(addButton).toContainText('Connect Wallet');
  });

  test('should have proper form elements for todo creation', async ({
    page,
  }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Check that form elements exist
    await expect(
      page.locator('input[placeholder="What needs to be done?"]')
    ).toBeVisible();
    await expect(
      page.locator('textarea[placeholder="Add a description (optional)"]')
    ).toBeVisible();
    await expect(page.locator('select')).toBeVisible(); // Priority selector
    await expect(
      page.locator('input[placeholder*="work, important"]')
    ).toBeVisible(); // Tags input
  });

  test('should show different todo lists in sidebar', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Check that list buttons exist
    await expect(page.locator('button:has-text("Default")')).toBeVisible();
    await expect(page.locator('button:has-text("Work")')).toBeVisible();
    await expect(page.locator('button:has-text("Personal")')).toBeVisible();
    await expect(page.locator('button:has-text("Shopping")')).toBeVisible();
  });

  test('should be able to switch between todo lists', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Click on Work list
    await page.click('button:has-text("Work")');

    // Should see "Work List" header
    await expect(page.locator('h2:has-text("Work List")')).toBeVisible();

    // Switch to Personal list
    await page.click('button:has-text("Personal")');

    // Should see "Personal List" header
    await expect(page.locator('h2:has-text("Personal List")')).toBeVisible();
  });

  test('should show empty state when no todos exist', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Should show empty state message
    await expect(page.locator('text=No todos in this list yet.')).toBeVisible();
    await expect(
      page.locator('text=Create your first todo using the form above!')
    ).toBeVisible();
  });

  test('should validate form inputs', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Try submitting empty form
    const addButton = page.locator('button[type="submit"]').first();
    await expect(addButton).toBeDisabled(); // Should be disabled when no title

    // Add title and check if button becomes enabled (though still disabled due to no wallet)
    await page.fill('input[placeholder="What needs to be done?"]', 'Test Todo');
    // Note: Button will still show "Connect Wallet" but this tests form validation
  });

  test('should handle priority selection', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Check priority options
    const prioritySelect = page.locator('select');
    await expect(prioritySelect).toBeVisible();

    // Should have priority options
    await expect(prioritySelect.locator('option[value="low"]')).toBeVisible();
    await expect(
      prioritySelect.locator('option[value="medium"]')
    ).toBeVisible();
    await expect(prioritySelect.locator('option[value="high"]')).toBeVisible();

    // Test selection
    await prioritySelect.selectOption('high');
    await expect(prioritySelect).toHaveValue('high');
  });

  test('should handle tags input', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Test tags input
    const tagsInput = page.locator('input[placeholder*="work, important"]');
    await tagsInput.fill('work, urgent, testing');
    await expect(tagsInput).toHaveValue('work, urgent, testing');
  });

  test('should handle due date input', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Test date input
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();

    const futureDate = '2025-12-31';
    await dateInput.fill(futureDate);
    await expect(dateInput).toHaveValue(futureDate);
  });

  test('should navigate to other pages', async ({ page }) => {
    // Test navigation to home page
    await page.goto(`${FRONTEND_URL}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('WalTodo');

    // Test navigation to blockchain page
    await page.goto(`${FRONTEND_URL}/blockchain`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Blockchain Todos');

    // Test navigation to examples page
    await page.goto(`${FRONTEND_URL}/examples`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Examples');
  });

  test('should demonstrate wallet isolation concept in UI', async ({
    page,
  }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Should show wallet connection requirement
    await expect(
      page.locator(
        'text=Connect your wallet to create and manage your personal todos'
      )
    ).toBeVisible();

    // The form should indicate wallet is required
    await expect(
      page.locator('button:has-text("Connect Wallet")')
    ).toBeVisible();

    // UI should indicate personal/wallet-specific todos
    await expect(page.locator('text=personal todos')).toBeVisible();
  });
});
