#!/usr/bin/env node
/**
 * AI Operations Stress Test Runner
 * 
 * CLI utility to run stress tests for AI operations outside of the test framework.
 * This allows running targeted stress tests with custom parameters for development
 * and performance testing purposes.
 */

import { Command } from 'commander';
import { AIService } from '../../src/services/ai/aiService';
import { AIProvider } from '../../src/types/adapters/AIModelAdapter';
import { 
  AIStressTestFramework, 
  StressTestMode, 
  StressTestOptions 
} from './AIStressTestFramework';
import { StressTestReportGenerator } from './StressTestReportGenerator';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Generate sample todos for testing
const generateTestTodos = (count: number): any[] => {
  const todos = [];
  for (let i = 0; i < count; i++) {
    todos.push({
      id: `todo-${i}`,
      title: `Test Todo ${i}`,
      description: `This is a test todo ${i} for stress testing AI operations`,
      completed: false,
      priority: ['high', 'medium', 'low'][i % 3],
      tags: [`tag-${i % 5}`, 'stress-test'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: i % 2 === 0,
      storageLocation: 'local'
    });
  }
  return todos;
};

// Setup the command-line program
const program = new Command();

program
  .name('run-stress-tests')
  .description('Run stress tests for AI operations with customizable parameters')
  .version('1.0.0');

program
  .option('-m, --mode <mode>', 'Test mode (simulated, real, hybrid)', 'simulated')
  .option('-c, --concurrent <number>', 'Number of concurrent requests', '5')
  .option('-n, --requests <number>', 'Total number of requests', '50')
  .option('-o, --operations <operations>', 'Operations to test (comma-separated)', 'summarize,categorize,prioritize,suggest,analyze')
  .option('-t, --timeout <ms>', 'Request timeout in ms', '10000')
  .option('-r, --retries <count>', 'Number of retries for failed requests', '3')
  .option('-e, --error-rate <probability>', 'Simulated error probability (0-1)', '0.1')
  .option('-l, --latency <min-max>', 'Simulated latency range in ms', '100-2000')
  .option('-a, --api-key <key>', 'API key for real tests')
  .option('-p, --provider <provider>', 'AI provider (xai, openai)', 'xai')
  .option('-d, --duration <ms>', 'Maximum test duration in ms', '60000')
  .option('--ramp-up <ms>', 'Ramp-up period in ms', '1000')
  .option('--rate-limit <rpm>', 'Rate limit threshold in requests per minute', '60')
  .option('--report-dir <path>', 'Directory to save reports')
  .option('--report-title <title>', 'Title for the report')
  .option('--no-circuit-breaker', 'Disable circuit breaker')
  .option('--todo-count <count>', 'Number of todos to generate for testing', '10')
  .option('--abort-threshold <rate>', 'Abort test if failure rate exceeds threshold', '0.5')
  .option('--no-resource-monitoring', 'Disable resource usage monitoring')
  .parse();

const options = program.opts();

async function runStressTests() {
  console.log('Starting AI Operations Stress Tests');
  console.log('===================================');
  
  // Parse and validate options
  const mode = options.mode === 'real' ? StressTestMode.REAL :
               options.mode === 'hybrid' ? StressTestMode.HYBRID :
               StressTestMode.SIMULATED;
  
  const concurrentRequests = parseInt(options.concurrent, 10);
  const requestCount = parseInt(options.requests, 10);
  const operations = options.operations.split(',');
  const timeoutMs = parseInt(options.timeout, 10);
  const retryCount = parseInt(options.retries, 10);
  const errorProbability = parseFloat(options.errorRate);
  const [minLatency, maxLatency] = options.latency.split('-').map(n => parseInt(n, 10));
  const maxDurationMs = parseInt(options.duration, 10);
  const rampUpPeriodMs = parseInt(options.rampUp, 10);
  const rateLimitThreshold = parseInt(options.rateLimit, 10);
  const todoCount = parseInt(options.todoCount, 10);
  const abortThreshold = parseFloat(options.abortThreshold);
  
  // Validate options
  if (isNaN(concurrentRequests) || concurrentRequests <= 0) {
    console.error('Error: Concurrent requests must be a positive number');
    process.exit(1);
  }
  
  if (isNaN(requestCount) || requestCount <= 0) {
    console.error('Error: Request count must be a positive number');
    process.exit(1);
  }
  
  if (operations.length === 0) {
    console.error('Error: At least one operation must be specified');
    process.exit(1);
  }
  
  // Check for API key if using real mode
  if (mode === StressTestMode.REAL && !options.apiKey && !process.env.XAI_API_KEY && !process.env.OPENAI_API_KEY) {
    console.error('Error: API key is required for real mode. Use --api-key or set XAI_API_KEY environment variable.');
    process.exit(1);
  }
  
  // Initialize AIService based on mode
  let aiService: AIService;
  
  if (mode === StressTestMode.SIMULATED) {
    console.log('Using simulated mode with mock AI service');
    // Import the mock service dynamically to avoid issues in test environments
    const { createMockAIService } = await import('../helpers/ai-mock-helper');
    
    aiService = createMockAIService({
      provider: options.provider as AIProvider,
      mockOptions: {
        latency: {
          enabled: true,
          minLatencyMs: minLatency,
          maxLatencyMs: maxLatency,
          jitterEnabled: true,
          timeoutProbability: errorProbability / 2, // Half of errors are timeouts
          timeoutAfterMs: timeoutMs / 2
        },
        errors: {
          enabled: errorProbability > 0,
          errorType: 'rate_limit',
          probability: errorProbability / 2, // Half of errors are API errors
          errorMessage: 'Simulated API error'
        }
      }
    });
  } else {
    // Real service
    const apiKey = options.apiKey || process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
    const provider = options.provider.toLowerCase() === 'openai' ? AIProvider.OPENAI : AIProvider.XAI;
    
    console.log(`Using real mode with ${provider} service`);
    console.log('WARNING: This will make actual API calls and may incur charges!');
    
    aiService = new AIService(apiKey, provider);
  }
  
  // Generate test todos
  console.log(`Generating ${todoCount} test todos`);
  const todos = generateTestTodos(todoCount);
  
  // Configure stress test options
  const testOptions: StressTestOptions = {
    mode,
    concurrentRequests,
    requestCount,
    operationsToTest: operations,
    timeoutMs,
    retryCount,
    maxDurationMs,
    rampUpPeriodMs,
    rateLimitThreshold,
    errorProbability,
    simulatedLatencyRangeMs: [minLatency, maxLatency],
    useCircuitBreaker: options.circuitBreaker !== false,
    measureResourceUsage: options.resourceMonitoring !== false,
    abortOnFailureThreshold: abortThreshold
  };
  
  console.log('Test configuration:');
  console.log(JSON.stringify(testOptions, null, 2));
  
  // Create stress test framework
  const framework = new AIStressTestFramework(aiService, testOptions);
  
  // Setup event listeners
  framework.on('circuitBreakerOpen', (data) => {
    console.log(`Circuit breaker opened: failure rate = ${data.failureRate.toFixed(2)}`);
  });
  
  framework.on('circuitBreakerClosed', () => {
    console.log('Circuit breaker closed');
  });
  
  framework.on('error', ({ operation, error }) => {
    console.error(`Error in operation ${operation}:`, error.message);
  });
  
  framework.on('aborted', () => {
    console.log('Test aborted early');
  });
  
  // Run the test
  console.log('\nStarting stress test...');
  const startTime = Date.now();
  
  try {
    const metrics = await framework.runTest(todos);
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`\nTest completed in ${duration.toFixed(2)}s`);
    
    // Get resource usage
    const resourceUsage = framework.getResourceUsage();
    
    // Get system info
    const systemInfo = {
      platform: os.platform(),
      release: os.release(),
      cpus: os.cpus().length,
      totalMemory: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
      freeMemory: (os.freemem() / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
      nodeVersion: process.version
    };
    
    // Generate text report for console
    console.log('\n' + StressTestReportGenerator.generateTextReport(metrics, {
      title: options.reportTitle || 'AI Operations Stress Test Results'
    }));
    
    // Generate full report package if report directory is specified
    if (options.reportDir) {
      StressTestReportGenerator.generateReportPackage(
        metrics,
        resourceUsage,
        systemInfo,
        {
          title: options.reportTitle || 'AI Operations Stress Test Results',
          outputDir: options.reportDir,
          includeCharts: true
        }
      );
    }
  } catch (error) {
    console.error('Error running stress test:', error);
    process.exit(1);
  }
}

runStressTests().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});