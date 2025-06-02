#!/usr/bin/env node

/**
 * Service Status Checker
 * Checks if all WalTodo services are running properly
 */

const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const services = [
  {
    name: 'API Server',
    url: 'http://localhost:3001/health',
    port: 3001
  },
  {
    name: 'Frontend',
    url: 'http://localhost:3000',
    port: 3000
  }
];

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bright: '\x1b[1m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

// Check if a port is in use
const checkPort = async (port) => {
  try {
    const { stdout } = await execAsync(`lsof -i:${port} | grep LISTEN`);
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
};

// Check service health
const checkService = async (service) => {
  const portInUse = await checkPort(service.port);
  
  if (!portInUse) {
    return {
      ...service,
      status: 'stopped',
      message: `Port ${service.port} is not in use`
    };
  }
  
  try {
    const response = await axios.get(service.url, { timeout: 5000 });
    return {
      ...service,
      status: 'running',
      message: 'Service is healthy'
    };
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return {
        ...service,
        status: 'starting',
        message: 'Port is in use but service not responding yet'
      };
    }
    return {
      ...service,
      status: 'error',
      message: error.message
    };
  }
};

// Check CLI
const checkCli = async () => {
  try {
    const { stdout } = await execAsync('./bin/waltodo --version');
    return {
      name: 'CLI',
      status: 'ready',
      message: stdout.trim()
    };
  } catch (error) {
    return {
      name: 'CLI',
      status: 'error',
      message: 'CLI not built or not accessible'
    };
  }
};

// Main function
const checkAllServices = async () => {
  log('\n🔍 WalTodo Service Status Check', 'bright');
  log('=' .repeat(50), 'blue');
  
  // Check CLI
  const cliStatus = await checkCli();
  const cliIcon = cliStatus.status === 'ready' ? '✓' : '✗';
  const cliColor = cliStatus.status === 'ready' ? 'green' : 'red';
  log(`\n${cliIcon} ${cliStatus.name}: ${cliStatus.message}`, cliColor);
  
  // Check services
  for (const service of services) {
    const status = await checkService(service);
    
    let icon, color;
    switch (status.status) {
      case 'running':
        icon = '✓';
        color = 'green';
        break;
      case 'starting':
        icon = '⟳';
        color = 'yellow';
        break;
      case 'stopped':
        icon = '✗';
        color = 'red';
        break;
      default:
        icon = '⚠';
        color = 'yellow';
    }
    
    log(`${icon} ${status.name} (port ${status.port}): ${status.message}`, color);
  }
  
  // Quick commands
  log('\n📋 Quick Commands:', 'bright');
  log('  Start all services:  pnpm dev:all', 'blue');
  log('  Start API only:      ./bin/waltodo serve --port 3001 --dev', 'blue');
  log('  Start frontend only: cd waltodo-frontend && pnpm dev', 'blue');
  log('  Run tests:           pnpm test:integration:full', 'blue');
  
  log('');
};

// Run check
checkAllServices().catch(error => {
  log(`Error: ${error.message}`, 'red');
  process.exit(1);
});