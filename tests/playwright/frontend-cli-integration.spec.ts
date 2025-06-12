import { test, expect } from '@playwright/test';

test.describe('Frontend and CLI Integration Analysis', () => {
  test('should analyze frontend structure and CLI integration', async ({ page }) => {
    // Navigate to the frontend
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot for analysis
    await page.screenshot({ path: 'frontend-homepage.png', fullPage: true });
    
    // Check page title and basic structure
    const title = await page.title();
    console.log('Page Title:', title);
    
    // Look for CLI-related elements or mentions
    const pageContent = await page.content();
    const hasCliMentions = pageContent.toLowerCase().includes('cli') || 
                          pageContent.toLowerCase().includes('command') ||
                          pageContent.toLowerCase().includes('terminal');
    
    console.log('Has CLI mentions:', hasCliMentions);
    
    // Check for navigation elements
    const navElements = await page.locator('nav, [role="navigation"]').count();
    console.log('Navigation elements found:', navElements);
    
    // Look for todo-related functionality
    const todoElements = await page.locator('*').filter({ hasText: /todo|task|list/i }).count();
    console.log('Todo-related elements found:', todoElements);
    
    // Check for wallet connection elements
    const walletElements = await page.locator('*').filter({ hasText: /wallet|connect|sui/i }).count();
    console.log('Wallet-related elements found:', walletElements);
    
    // Look for API endpoints or server communication
    const apiElements = await page.locator('*').filter({ hasText: /api|server|endpoint/i }).count();
    console.log('API-related elements found:', apiElements);
    
    // Check for any CLI command interfaces
    const cliInterfaces = await page.locator('input[type="text"], textarea').filter({ hasText: /command|cli/i }).count();
    console.log('CLI interface elements found:', cliInterfaces);
    
    // Look for buttons that might trigger CLI commands
    const actionButtons = await page.locator('button').count();
    console.log('Action buttons found:', actionButtons);
    
    // Check if there are any forms for todo management
    const forms = await page.locator('form').count();
    console.log('Forms found:', forms);
    
    // Look for any terminal or console-like interfaces
    const terminalElements = await page.locator('*').filter({ hasText: /terminal|console|shell/i }).count();
    console.log('Terminal-like elements found:', terminalElements);
    
    // Check for any embedded CLI functionality
    const cliEmbedded = await page.locator('*').filter({ hasText: /waltodo|cli/i }).count();
    console.log('WalTodo CLI references found:', cliEmbedded);
    
    // Analyze the page structure
    const mainContent = await page.locator('main, [role="main"], .main-content').count();
    console.log('Main content areas found:', mainContent);
    
    // Check for any dashboard or admin interfaces
    const dashboardElements = await page.locator('*').filter({ hasText: /dashboard|admin|control/i }).count();
    console.log('Dashboard-like elements found:', dashboardElements);
    
    // Look for any blockchain-related UI elements
    const blockchainElements = await page.locator('*').filter({ hasText: /blockchain|sui|walrus/i }).count();
    console.log('Blockchain-related elements found:', blockchainElements);
    
    // Check for any real-time features
    const realtimeElements = await page.locator('*').filter({ hasText: /real.?time|live|sync/i }).count();
    console.log('Real-time elements found:', realtimeElements);
    
    // Verify basic functionality
    expect(title as any).toBeTruthy();
    expect(pageContent as any).toBeTruthy();
  });
  
  test('should check for CLI command execution interface', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for any command input interfaces
    const commandInputs = await page.locator('input[placeholder*="command"], input[placeholder*="cli"], textarea[placeholder*="command"]');
    const commandInputCount = await commandInputs.count();
    console.log('Command input interfaces found:', commandInputCount);
    
    if (commandInputCount > 0) {
      for (let i = 0; i < commandInputCount; i++) {
        const input = commandInputs.nth(i as any);
        const placeholder = await input.getAttribute('placeholder');
        console.log(`Command input ${i + 1} placeholder:`, placeholder);
      }
    }
    
    // Look for any CLI-style output areas
    const outputAreas = await page.locator('pre, code, .terminal, .console, .output');
    const outputCount = await outputAreas.count();
    console.log('CLI-style output areas found:', outputCount);
    
    // Check for any execute/run buttons
    const executeButtons = await page.locator('button').filter({ hasText: /run|execute|submit|send/i });
    const executeButtonCount = await executeButtons.count();
    console.log('Execute-style buttons found:', executeButtonCount);
  });
  
  test('should analyze todo management interface', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for todo creation interfaces
    const todoInputs = await page.locator('input[placeholder*="todo"], input[placeholder*="task"], textarea[placeholder*="todo"]');
    const todoInputCount = await todoInputs.count();
    console.log('Todo input interfaces found:', todoInputCount);
    
    // Check for todo lists
    const todoLists = await page.locator('ul, ol, .todo-list, .task-list');
    const todoListCount = await todoLists.count();
    console.log('Todo list elements found:', todoListCount);
    
    // Look for add/create buttons
    const addButtons = await page.locator('button').filter({ hasText: /add|create|new/i });
    const addButtonCount = await addButtons.count();
    console.log('Add/Create buttons found:', addButtonCount);
    
    // Check for todo items
    const todoItems = await page.locator('li, .todo-item, .task-item');
    const todoItemCount = await todoItems.count();
    console.log('Todo item elements found:', todoItemCount);
  });
  
  test('should check for wallet integration', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for wallet connection buttons
    const walletButtons = await page.locator('button').filter({ hasText: /connect|wallet|sui/i });
    const walletButtonCount = await walletButtons.count();
    console.log('Wallet connection buttons found:', walletButtonCount);
    
    if (walletButtonCount > 0) {
      for (let i = 0; i < walletButtonCount; i++) {
        const button = walletButtons.nth(i as any);
        const text = await button.textContent();
        console.log(`Wallet button ${i + 1} text:`, text);
      }
    }
    
    // Check for wallet status indicators
    const walletStatus = await page.locator('*').filter({ hasText: /connected|disconnected|wallet.*status/i });
    const walletStatusCount = await walletStatus.count();
    console.log('Wallet status indicators found:', walletStatusCount);
  });
}); 