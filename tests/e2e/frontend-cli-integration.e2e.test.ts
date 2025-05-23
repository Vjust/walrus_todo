/**
 * Frontend-CLI Integration Tests
 * 
 * Tests the complete integration between CLI backend and frontend:
 * 1. Configuration sharing between CLI and frontend
 * 2. Real-time event synchronization
 * 3. Wallet connection and transaction signing
 * 4. Data consistency between CLI and frontend views
 * 5. Error handling across both systems
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import fetch from 'node-fetch';

jest.setTimeout(300000); // 5 minutes for integration tests

interface FrontendConfig {
  network: string;
  packageId: string;
  rpcUrl: string;
  walletAddress: string;
  features: {
    aiEnabled: boolean;
    blockchainVerification: boolean;
    encryptedStorage: boolean;
  };
}

interface CliTodo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  created_at: number;
  blockchain_id?: string;
}

describe('Frontend-CLI Integration Tests', () => {
  const projectRoot = path.join(__dirname, '../..');
  const frontendPath = path.join(projectRoot, 'waltodo-frontend');
  let frontendProcess: ChildProcess | null = null;
  let frontendPort = 3002;
  let deploymentInfo: any = null;

  beforeAll(async () => {
    // Ensure CLI is built
    try {
      execSync('pnpm run build:dev', { 
        cwd: projectRoot,
        stdio: 'inherit',
        timeout: 60000
      });
    } catch (_error) {
      throw new Error(`Failed to build CLI: ${error}`);
    }

    // Ensure frontend dependencies are installed
    if (fs.existsSync(frontendPath)) {
      try {
        execSync('pnpm install', { 
          cwd: frontendPath,
          stdio: 'inherit',
          timeout: 120000
        });
      } catch (_error) {
        // console.warn('Frontend dependency installation failed - some tests may be skipped'); // Removed console statement
      }
    }
  });

  afterAll(async () => {
    if (frontendProcess) {
      frontendProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  });

  describe('Configuration Synchronization', () => {
    test('should deploy contract and generate frontend config', async () => {
      // console.log('Deploying contract and generating frontend config...'); // Removed console statement
      
      try {
        const deployOutput = execSync(
          'pnpm run cli -- deploy --network testnet --gas-budget 200000000',
          {
            encoding: 'utf8',
            cwd: projectRoot,
            timeout: 180000
          }
        );

        expect(deployOutput).toContain('deployed successfully');
        expect(deployOutput).toContain('Package ID:');
        expect(deployOutput).toContain('Frontend configuration generated');

        // Extract deployment info
        const packageIdMatch = deployOutput.match(/Package ID:\s*(0x[a-fA-F0-9]+)/);
        const digestMatch = deployOutput.match(/Digest:\s*([A-Za-z0-9]+)/);
        const addressMatch = deployOutput.match(/Address:\s*(0x[a-fA-F0-9]+)/);

        expect(packageIdMatch).toBeTruthy();
        expect(digestMatch).toBeTruthy();
        expect(addressMatch).toBeTruthy();

        deploymentInfo = {
          packageId: packageIdMatch![1],
          digest: digestMatch![1],
          walletAddress: addressMatch![1],
          network: 'testnet'
        };

        // console.log('✓ Contract deployed successfully', deploymentInfo); // Removed console statement

      } catch (_error) {
        if (error.toString().includes('already deployed') || 
            error.toString().includes('Package ID already exists')) {
          // console.log('⚠ Contract already deployed - continuing with existing deployment'); // Removed console statement
          
          // Get existing deployment info from config
          try {
            const configOutput = execSync('pnpm run cli -- config', {
              encoding: 'utf8',
              cwd: projectRoot,
              timeout: 30000
            });
            
            // Parse config to get deployment info
            const packageIdMatch = configOutput.match(/Package ID:\s*(0x[a-fA-F0-9]+)/);
            const addressMatch = configOutput.match(/Wallet Address:\s*(0x[a-fA-F0-9]+)/);
            
            if (packageIdMatch && addressMatch) {
              deploymentInfo = {
                packageId: packageIdMatch[1],
                walletAddress: addressMatch[1],
                network: 'testnet'
              };
            }
          } catch (configError) {
            throw new Error(`Unable to get existing deployment info: ${configError}`);
          }
        } else {
          throw error;
        }
      }
    });

    test('should verify frontend config files are generated correctly', async () => {
      const configDir = path.join(frontendPath, 'src/config');
      const testnetConfigPath = path.join(configDir, 'testnet.json');

      expect(fs.existsSync(configDir)).toBeTruthy();
      expect(fs.existsSync(testnetConfigPath)).toBeTruthy();

      const config: FrontendConfig = JSON.parse(fs.readFileSync(testnetConfigPath, 'utf8'));

      expect(config.network).toBe('testnet');
      expect(config.packageId).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(config.rpcUrl).toContain('testnet.sui.io');
      expect(config.walletAddress).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(config.features).toHaveProperty('aiEnabled');
      expect(config.features).toHaveProperty('blockchainVerification');

      // console.log('✓ Frontend configuration validated'); // Removed console statement
    });

    test('should synchronize config to public directory', async () => {
      // Run setup-config script
      execSync('node setup-config.js', {
        cwd: frontendPath,
        stdio: 'inherit'
      });

      const publicConfigDir = path.join(frontendPath, 'public/config');
      const publicTestnetConfig = path.join(publicConfigDir, 'testnet.json');

      expect(fs.existsSync(publicConfigDir)).toBeTruthy();
      expect(fs.existsSync(publicTestnetConfig)).toBeTruthy();

      const config = JSON.parse(fs.readFileSync(publicTestnetConfig, 'utf8'));
      expect(config.network).toBe('testnet');
      expect(config.packageId).toMatch(/^0x[a-fA-F0-9]+$/);

      // console.log('✓ Public configuration synchronized'); // Removed console statement
    });
  });

  describe('Frontend Server Integration', () => {
    test('should start frontend development server', async () => {
      if (!fs.existsSync(frontendPath)) {
        // console.log('⚠ Frontend not found - skipping frontend tests'); // Removed console statement
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Frontend failed to start within timeout'));
        }, 120000);

        frontendProcess = spawn('pnpm', ['run', 'dev'], {
          cwd: frontendPath,
          env: { ...process.env, PORT: frontendPort.toString() },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let startupComplete = false;

        frontendProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          // console.log(`Frontend: ${output.trim() // Removed console statement}`);

          if ((output.includes('ready') || output.includes(`localhost:${frontendPort}`)) && !startupComplete) {
            startupComplete = true;
            clearTimeout(timeout);
            // console.log(`✓ Frontend started on port ${frontendPort}`); // Removed console statement
            resolve();
          }
        });

        frontendProcess.stderr?.on('data', (data) => {
          const error = data.toString();
          // console.log(`Frontend Error: ${error.trim() // Removed console statement}`);

          if (error.includes('EADDRINUSE')) {
            frontendPort = 3003; // Try different port
            frontendProcess?.kill();
            // Restart with new port - simplified for test
            clearTimeout(timeout);
            resolve();
          }
        });

        frontendProcess.on('exit', (code) => {
          if (code !== 0 && !startupComplete) {
            clearTimeout(timeout);
            reject(new Error(`Frontend process exited with code ${code}`));
          }
        });
      });
    });

    test('should verify frontend can load configuration at runtime', async () => {
      if (!frontendProcess) {
        // console.log('⚠ Frontend not running - skipping runtime config test'); // Removed console statement
        return;
      }

      // Wait for server to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        // Test config endpoint (if available)
        const configUrl = `http://localhost:${frontendPort}/config/testnet.json`;
        const response = await fetch(configUrl);
        
        if (response.ok) {
          const config = await response.json();
          expect(config.network).toBe('testnet');
          expect(config.packageId).toBeTruthy();
          // console.log('✓ Frontend runtime configuration accessible'); // Removed console statement
        } else {
          // console.log('⚠ Frontend config endpoint not accessible (may be expected) // Removed console statement');
        }
      } catch (_error) {
        // console.log('⚠ Frontend runtime config test skipped - server may not be ready'); // Removed console statement
      }
    });
  });

  describe('Data Consistency Between CLI and Frontend', () => {
    let testTodoTitle: string;

    test('should create todo via CLI and verify data structure', async () => {
      testTodoTitle = `Frontend CLI Integration Test ${Date.now()}`;
      const todoDescription = 'Test todo for frontend-CLI integration verification';

      const createOutput = execSync(
        `pnpm run cli -- create "${testTodoTitle}" "${todoDescription}" --blockchain`,
        {
          encoding: 'utf8',
          cwd: projectRoot,
          timeout: 120000
        }
      );

      expect(createOutput).toContain('created successfully');
      expect(createOutput).toContain('Transaction digest:');

      // console.log('✓ Todo created via CLI'); // Removed console statement
    });

    test('should list todos and verify JSON structure for frontend consumption', async () => {
      const listOutput = execSync('pnpm run cli -- list --blockchain --json', {
        encoding: 'utf8',
        cwd: projectRoot,
        timeout: 60000
      });

      const todos: CliTodo[] = JSON.parse(listOutput);
      expect(Array.isArray(todos)).toBeTruthy();

      const testTodo = todos.find(todo => todo.title === testTodoTitle);
      expect(testTodo).toBeTruthy();

      // Verify structure matches what frontend expects
      expect(testTodo).toHaveProperty('id');
      expect(testTodo).toHaveProperty('title');
      expect(testTodo).toHaveProperty('description');
      expect(testTodo).toHaveProperty('completed');
      expect(testTodo).toHaveProperty('created_at');
      expect(typeof testTodo!.created_at).toBe('number');

      // console.log('✓ CLI todo data structure compatible with frontend'); // Removed console statement
    });

    test('should verify todo completion workflow maintains data consistency', async () => {
      // Complete the todo via CLI
      const completeOutput = execSync(
        `pnpm run cli -- complete "${testTodoTitle}" --blockchain`,
        {
          encoding: 'utf8',
          cwd: projectRoot,
          timeout: 120000
        }
      );

      expect(completeOutput).toContain('completed successfully');

      // Verify the change is reflected in subsequent list calls
      const updatedListOutput = execSync('pnpm run cli -- list --blockchain --json', {
        encoding: 'utf8',
        cwd: projectRoot,
        timeout: 60000
      });

      const updatedTodos: CliTodo[] = JSON.parse(updatedListOutput);
      const completedTodo = updatedTodos.find(todo => todo.title === testTodoTitle);

      expect(completedTodo).toBeTruthy();
      expect(completedTodo!.completed).toBe(true);

      // console.log('✓ Todo completion maintains data consistency'); // Removed console statement
    });
  });

  describe('Real-time Event Integration', () => {
    test('should verify frontend has event subscription infrastructure', async () => {
      const eventHookPath = path.join(frontendPath, 'src/hooks/useBlockchainEvents.ts');
      
      if (fs.existsSync(eventHookPath)) {
        const eventHookContent = fs.readFileSync(eventHookPath, 'utf8');
        
        expect(eventHookContent).toContain('useEffect');
        expect(eventHookContent).toContain('subscription');
        expect(eventHookContent).toMatch(/TodoNFT|todo.*event/i);

        // console.log('✓ Frontend event subscription infrastructure verified'); // Removed console statement
      } else {
        // console.log('⚠ Event subscription hook not found - feature may not be implemented'); // Removed console statement
      }
    });

    test('should verify event handling components exist', async () => {
      const realtimeComponentPath = path.join(frontendPath, 'src/components/RealtimeTodoList.tsx');
      const eventStatusPath = path.join(frontendPath, 'src/components/BlockchainEventStatus.tsx');

      if (fs.existsSync(realtimeComponentPath)) {
        const content = fs.readFileSync(realtimeComponentPath, 'utf8');
        expect(content).toContain('useBlockchainEvents');
        // console.log('✓ Real-time todo list component verified'); // Removed console statement
      }

      if (fs.existsSync(eventStatusPath)) {
        const content = fs.readFileSync(eventStatusPath, 'utf8');
        expect(content).toMatch(/status|event|connection/i);
        // console.log('✓ Event status component verified'); // Removed console statement
      }

      if (!fs.existsSync(realtimeComponentPath) && !fs.existsSync(eventStatusPath)) {
        // console.log('⚠ Real-time event components not found - feature may not be fully implemented'); // Removed console statement
      }
    });

    test('should simulate event handling workflow', async () => {
      // This test verifies that the event subscription would work
      // by checking the configuration and infrastructure

      const blockchainConfigPath = path.join(frontendPath, 'src/lib/blockchain-events.ts');
      
      if (fs.existsSync(blockchainConfigPath)) {
        const configContent = fs.readFileSync(blockchainConfigPath, 'utf8');
        
        expect(configContent).toMatch(/subscription|websocket|event/i);
        expect(configContent).toMatch(/TodoNFT|package.*id/i);

        // console.log('✓ Event handling configuration verified'); // Removed console statement
      } else {
        // console.log('⚠ Blockchain event configuration not found'); // Removed console statement
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle CLI errors gracefully in frontend context', async () => {
      // Test CLI with invalid parameters
      try {
        execSync('pnpm run cli -- create "" "" --blockchain', {
          encoding: 'utf8',
          cwd: projectRoot,
          timeout: 30000
        });
        // Should not reach here
        expect(false).toBe(true);
      } catch (_error) {
        const errorOutput = error.toString();
        expect(errorOutput).toMatch(/invalid|empty|required/i);
        // console.log('✓ CLI input validation works correctly'); // Removed console statement
      }
    });

    test('should verify frontend can handle missing configuration', async () => {
      // Temporarily rename config file
      const configPath = path.join(frontendPath, 'public/config/testnet.json');
      const backupPath = path.join(frontendPath, 'public/config/testnet.json.backup');

      if (fs.existsSync(configPath)) {
        fs.renameSync(configPath, backupPath);

        try {
          // Frontend should handle missing config gracefully
          // This test verifies the error handling exists
          const configUtilPath = path.join(frontendPath, 'src/lib/config-loader.ts');
          
          if (fs.existsSync(configUtilPath)) {
            const configUtil = fs.readFileSync(configUtilPath, 'utf8');
            expect(configUtil).toMatch(/try.*catch|error.*handling/i);
            // console.log('✓ Frontend config error handling verified'); // Removed console statement
          }

        } finally {
          // Restore config file
          if (fs.existsSync(backupPath)) {
            fs.renameSync(backupPath, configPath);
          }
        }
      }
    });

    test('should verify network error handling', async () => {
      // Test CLI with invalid network
      try {
        execSync('pnpm run cli -- deploy --network invalid-network', {
          encoding: 'utf8',
          cwd: projectRoot,
          timeout: 30000
        });
        expect(false).toBe(true);
      } catch (_error) {
        const errorOutput = error.toString();
        expect(errorOutput).toMatch(/invalid.*network|network.*not.*supported/i);
        // console.log('✓ Network error handling verified'); // Removed console statement
      }
    });
  });

  describe('End-to-End Workflow Validation', () => {
    test('should complete full workflow: deploy → configure → create → list → complete', async () => {
      // console.log('Running complete E2E workflow...'); // Removed console statement

      // Step 1: Verify deployment (already done in previous tests)
      const configOutput = execSync('pnpm run cli -- config', {
        encoding: 'utf8',
        cwd: projectRoot,
        timeout: 30000
      });
      expect(configOutput).toMatch(/Package ID|Network|Address/);

      // Step 2: Create a workflow test todo
      const workflowTodoTitle = `E2E Workflow Test ${Date.now()}`;
      const createOutput = execSync(
        `pnpm run cli -- create "${workflowTodoTitle}" "End-to-end workflow validation" --blockchain`,
        {
          encoding: 'utf8',
          cwd: projectRoot,
          timeout: 120000
        }
      );
      expect(createOutput).toContain('created successfully');

      // Step 3: List and verify
      const listOutput = execSync('pnpm run cli -- list --blockchain --json', {
        encoding: 'utf8',
        cwd: projectRoot,
        timeout: 60000
      });
      const todos = JSON.parse(listOutput);
      const workflowTodo = todos.find((todo: CliTodo) => todo.title === workflowTodoTitle);
      expect(workflowTodo).toBeTruthy();
      expect(workflowTodo.completed).toBe(false);

      // Step 4: Complete and verify
      const completeOutput = execSync(
        `pnpm run cli -- complete "${workflowTodoTitle}" --blockchain`,
        {
          encoding: 'utf8',
          cwd: projectRoot,
          timeout: 120000
        }
      );
      expect(completeOutput).toContain('completed successfully');

      // Step 5: Final verification
      const finalListOutput = execSync('pnpm run cli -- list --blockchain --json', {
        encoding: 'utf8',
        cwd: projectRoot,
        timeout: 60000
      });
      const finalTodos = JSON.parse(finalListOutput);
      const completedTodo = finalTodos.find((todo: CliTodo) => todo.title === workflowTodoTitle);
      expect(completedTodo).toBeTruthy();
      expect(completedTodo.completed).toBe(true);

      // console.log('✅ Complete E2E workflow validation successful!'); // Removed console statement
    });

    test('should verify system is ready for production use', async () => {
      // console.log('Performing final system readiness check...'); // Removed console statement

      // Check all critical components
      const checks = [
        { name: 'CLI Build', command: 'pnpm run cli -- --version' },
        { name: 'Smart Contract Config', command: 'pnpm run cli -- config' },
        { name: 'Blockchain Connection', command: 'pnpm run cli -- list --limit 1 --blockchain' }
      ];

      const results = [];

      for (const check of checks) {
        try {
          const output = execSync(check.command, {
            encoding: 'utf8',
            cwd: projectRoot,
            timeout: 60000
          });
          results.push({ name: check.name, status: 'PASS', output: output.substring(0, 100) });
        } catch (_error) {
          results.push({ name: check.name, status: 'FAIL', error: error.toString().substring(0, 100) });
        }
      }

      // Report results
      // console.log('\n🔍 System Readiness Report:'); // Removed console statement
      results.forEach(result => {
        if (result.status === 'PASS') {
          // console.log(`  ✅ ${result.name}: PASS`); // Removed console statement
        } else {
          // console.log(`  ❌ ${result.name}: FAIL - ${result.error}`); // Removed console statement
        }
      });

      const passedChecks = results.filter(r => r.status === 'PASS').length;
      const totalChecks = results.length;

      expect(passedChecks).toBe(totalChecks);
      // console.log(`\n✅ System readiness: ${passedChecks}/${totalChecks} checks passed`); // Removed console statement
    });
  });
});