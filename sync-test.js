#!/usr/bin/env node

/**
 * Test script for the complete CLI ↔ API ↔ Frontend sync pipeline
 * This script validates the end-to-end synchronization functionality
 */

const { spawn } = require('child_process');
const { join } = require('path');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { setTimeout } = require('timers/promises');

const TEST_WALLET = '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef123456';
const API_PORT = 3001;
const FRONTEND_PORT = 3000;
const TODOS_DIR = join(__dirname, 'test-todos');

class SyncPipelineTest {
  constructor() {
    this.apiProcess = null;
    this.frontendProcess = null;
    this.daemonProcess = null;
    this.testResults = [];
    this.errors = [];
  }

  async run() {
    console.log('🚀 Starting WalTodo Sync Pipeline Test');
    console.log('=' .repeat(50));

    try {
      // Step 1: Start API server
      await this.startApiServer();
      await this.waitForService(`http://localhost:${API_PORT}/healthz`, 'API Server');

      // Step 2: Start frontend
      await this.startFrontend();
      await this.waitForService(`http://localhost:${FRONTEND_PORT}`, 'Frontend');

      // Step 3: Start sync daemon
      await this.startSyncDaemon();
      await setTimeout(3000); // Wait for daemon to initialize

      // Step 4: Run sync tests
      await this.runSyncTests();

      // Step 5: Validate results
      this.printResults();

    } catch (error) {
      console.error('❌ Test failed:', error);
      this.errors.push(error.message);
    } finally {
      await this.cleanup();
    }
  }

  async startApiServer() {
    console.log('📡 Starting API server...');
    
    const apiDir = join(__dirname, 'apps/api');
    this.apiProcess = spawn('pnpm', ['start'], {
      cwd: apiDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: API_PORT,
        NODE_ENV: 'development'
      }
    });

    this.apiProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('started') || output.includes('listening')) {
        console.log('✅ API server started');
      }
    });

    this.apiProcess.stderr.on('data', (data) => {
      console.log('API stderr:', data.toString());
    });
  }

  async startFrontend() {
    console.log('🌐 Starting frontend...');
    
    const frontendDir = join(__dirname, 'waltodo-frontend');
    this.frontendProcess = spawn('pnpm', ['dev'], {
      cwd: frontendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: FRONTEND_PORT,
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}/api`
      }
    });

    this.frontendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('ready') || output.includes('started')) {
        console.log('✅ Frontend started');
      }
    });

    this.frontendProcess.stderr.on('data', (data) => {
      console.log('Frontend stderr:', data.toString());
    });
  }

  async startSyncDaemon() {
    console.log('🔄 Starting sync daemon...');
    
    this.daemonProcess = spawn('node', [
      'dist/index.js',
      'daemon',
      '--wallet', TEST_WALLET,
      '--api-url', `http://localhost:${API_PORT}`,
      '--todos-dir', TODOS_DIR,
      '--sync-interval', '5' // 5 seconds for testing
    ], {
      cwd: join(__dirname, 'apps/cli'),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.daemonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Daemon:', output.trim());
      if (output.includes('started successfully')) {
        console.log('✅ Sync daemon started');
      }
    });

    this.daemonProcess.stderr.on('data', (data) => {
      console.log('Daemon stderr:', data.toString());
    });
  }

  async runSyncTests() {
    console.log('\n🧪 Running sync pipeline tests...');
    console.log('-'.repeat(30));

    // Test 1: CLI to API to Frontend sync
    await this.testCliToApiFrontend();

    // Test 2: Frontend to API to CLI sync
    await this.testFrontendToApiCli();

    // Test 3: Real-time WebSocket events
    await this.testWebSocketRealTime();

    // Test 4: Conflict resolution
    await this.testConflictResolution();
  }

  async testCliToApiFrontend() {
    console.log('📝 Test 1: CLI → API → Frontend sync');
    
    try {
      // Create a test todo via CLI file system
      const testTodo = {
        id: 'test-cli-to-frontend-' + Date.now(),
        title: 'Test CLI to Frontend Sync',
        description: 'This todo was created by the CLI and should appear in the frontend',
        completed: false,
        createdAt: new Date().toISOString(),
        wallet: TEST_WALLET
      };

      const todoListPath = join(TODOS_DIR, 'default.json');
      let todoList = { todos: [], metadata: { wallet: TEST_WALLET } };
      
      if (existsSync(todoListPath)) {
        todoList = JSON.parse(readFileSync(todoListPath, 'utf8'));
      }
      
      todoList.todos.push(testTodo);
      writeFileSync(todoListPath, JSON.stringify(todoList, null, 2));

      console.log('   ✓ Created todo via CLI file system');

      // Wait for sync to occur
      await setTimeout(8000);

      // Check if todo appears in API
      const apiResponse = await this.checkApiForTodo(testTodo.id);
      if (apiResponse) {
        console.log('   ✓ Todo synced to API');
        this.testResults.push('CLI → API sync: ✅');
      } else {
        console.log('   ❌ Todo not found in API');
        this.testResults.push('CLI → API sync: ❌');
      }

      // Note: Frontend check would require browser automation
      console.log('   ℹ️ Frontend check requires manual verification');

    } catch (error) {
      console.log('   ❌ Error:', error.message);
      this.testResults.push('CLI → API sync: ❌ ' + error.message);
    }
  }

  async testFrontendToApiCli() {
    console.log('🌐 Test 2: Frontend → API → CLI sync');
    
    try {
      // Simulate frontend creating a todo via API
      const testTodo = {
        title: 'Test Frontend to CLI Sync',
        description: 'This todo was created by the frontend and should appear in CLI',
        completed: false,
        wallet: TEST_WALLET
      };

      const response = await fetch(`http://localhost:${API_PORT}/api/v1/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': TEST_WALLET
        },
        body: JSON.stringify(testTodo)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('   ✓ Created todo via API');

        // Wait for sync to occur
        await setTimeout(8000);

        // Check if todo appears in CLI file system
        const todoListPath = join(TODOS_DIR, 'default.json');
        if (existsSync(todoListPath)) {
          const todoList = JSON.parse(readFileSync(todoListPath, 'utf8'));
          const foundTodo = todoList.todos.find(t => t.id === result.data.id);
          
          if (foundTodo) {
            console.log('   ✓ Todo synced to CLI file system');
            this.testResults.push('Frontend → CLI sync: ✅');
          } else {
            console.log('   ❌ Todo not found in CLI file system');
            this.testResults.push('Frontend → CLI sync: ❌');
          }
        } else {
          console.log('   ❌ Todo list file not found');
          this.testResults.push('Frontend → CLI sync: ❌');
        }

      } else {
        console.log('   ❌ Failed to create todo via API');
        this.testResults.push('Frontend → CLI sync: ❌ API error');
      }

    } catch (error) {
      console.log('   ❌ Error:', error.message);
      this.testResults.push('Frontend → CLI sync: ❌ ' + error.message);
    }
  }

  async testWebSocketRealTime() {
    console.log('⚡ Test 3: Real-time WebSocket events');
    
    try {
      // This test would require WebSocket client implementation
      console.log('   ℹ️ WebSocket test requires manual verification');
      console.log('   ℹ️ Check browser dev tools for WebSocket events');
      this.testResults.push('WebSocket real-time: ℹ️ Manual verification required');

    } catch (error) {
      console.log('   ❌ Error:', error.message);
      this.testResults.push('WebSocket real-time: ❌ ' + error.message);
    }
  }

  async testConflictResolution() {
    console.log('⚔️ Test 4: Conflict resolution');
    
    try {
      console.log('   ℹ️ Conflict resolution test requires complex setup');
      console.log('   ℹ️ Would need simultaneous modifications from multiple sources');
      this.testResults.push('Conflict resolution: ℹ️ Manual test required');

    } catch (error) {
      console.log('   ❌ Error:', error.message);
      this.testResults.push('Conflict resolution: ❌ ' + error.message);
    }
  }

  async checkApiForTodo(todoId) {
    try {
      const response = await fetch(`http://localhost:${API_PORT}/api/v1/todos`, {
        headers: {
          'X-Wallet-Address': TEST_WALLET
        }
      });

      if (response.ok) {
        const result = await response.json();
        return result.data.find(todo => todo.id === todoId);
      }
    } catch (error) {
      console.log('Error checking API:', error.message);
    }
    return null;
  }

  async waitForService(url, serviceName) {
    console.log(`⏳ Waiting for ${serviceName} to be ready...`);
    
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    
    while (attempts < maxAttempts) {
      try {
        const response = await fetch(url);
        if (response.ok || response.status < 500) {
          console.log(`✅ ${serviceName} is ready`);
          return;
        }
      } catch (error) {
        // Service not ready yet
      }
      
      await setTimeout(1000);
      attempts++;
    }
    
    throw new Error(`${serviceName} failed to start within ${maxAttempts} seconds`);
  }

  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log('=' .repeat(50));
    
    for (const result of this.testResults) {
      console.log(result);
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      for (const error of this.errors) {
        console.log(`  - ${error}`);
      }
    }
    
    const passed = this.testResults.filter(r => r.includes('✅')).length;
    const total = this.testResults.length;
    
    console.log(`\n📈 Summary: ${passed}/${total} tests passed`);
    
    if (passed === total && this.errors.length === 0) {
      console.log('🎉 All tests passed! Sync pipeline is working correctly.');
    } else {
      console.log('⚠️ Some tests failed or require manual verification.');
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    if (this.daemonProcess) {
      this.daemonProcess.kill();
      console.log('✅ Daemon stopped');
    }
    
    if (this.frontendProcess) {
      this.frontendProcess.kill();
      console.log('✅ Frontend stopped');
    }
    
    if (this.apiProcess) {
      this.apiProcess.kill();
      console.log('✅ API server stopped');
    }
    
    console.log('🏁 Test completed');
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  const test = new SyncPipelineTest();
  test.run().catch(console.error);
}

module.exports = SyncPipelineTest;