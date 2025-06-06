#!/usr/bin/env node

// Test runner for WalTodo commands
const { spawn } = require('child_process');
const path = require('path');

const commands = [
  { cmd: 'add', args: ['test-list', 'Test todo 1', '-p', 'high', '-t', 'test,demo'] },
  { cmd: 'add', args: ['test-list', 'Test todo 2', '-p', 'medium'] },
  { cmd: 'add', args: ['test-list', 'Test todo 3', '-p', 'low', '-d', '2025-06-10'] },
  { cmd: 'list', args: ['test-list'] },
  { cmd: 'list', args: [] },
  { cmd: 'complete', args: ['test-list', '1'] },
  { cmd: 'list', args: ['test-list'] },
  { cmd: 'configure', args: ['--show'] },
];

console.log('🧪 Testing WalTodo Commands...\n');

async function runCommand(cmdObj) {
  return new Promise((resolve) => {
    console.log(`\n📌 Running: waltodo ${cmdObj.cmd} ${cmdObj.args.join(' ')}`);
    console.log('─'.repeat(60));
    
    const proc = spawn('waltodo', [cmdObj.cmd, ...cmdObj.args], {
      stdio: 'inherit',
      shell: true
    });
    
    proc.on('close', (code) => {
      if (code !== 0) {
        console.log(`⚠️  Command exited with code ${code}`);
      }
      resolve();
    });
    
    proc.on('error', (err) => {
      console.error(`❌ Error: ${err.message}`);
      resolve();
    });
  });
}

async function runTests() {
  for (const cmd of commands) {
    await runCommand(cmd);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between commands
  }
  
  console.log('\n✅ Test sequence completed!\n');
}

runTests();