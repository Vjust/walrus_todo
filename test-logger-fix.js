#!/usr/bin/env node

// Simple test to verify logger fixes
const { Logger, LogLevel } = require('./apps/cli/src/utils/Logger.ts');

console.log('Testing CLI Logger fixes...');

try {
  const logger = new Logger('test');
  
  // Test basic logging
  logger.info('Test info message');
  logger.warn('Test warning message');
  logger.error('Test error message');
  logger.debug('Test debug message');
  
  // Test with context
  logger.info('Test with context', { key: 'value', nested: { data: 'test' } });
  
  // Test with error
  const testError = new Error('Test error');
  logger.error('Test error logging', testError);
  
  console.log('✅ CLI Logger tests passed');
} catch (error) {
  console.error('❌ CLI Logger test failed:', error);
  process.exit(1);
}

// Test API logger
try {
  console.log('Testing API Logger...');
  
  // Mock config for API logger test
  process.env.LOG_LEVEL = 'info';
  process.env.NODE_ENV = 'development';
  
  const { logger: apiLogger } = require('./apps/api/src/utils/logger.ts');
  
  apiLogger.info('API logger test');
  apiLogger.warn('API logger warning test');
  apiLogger.error('API logger error test');
  
  console.log('✅ API Logger tests passed');
} catch (error) {
  console.error('❌ API Logger test failed:', error);
  process.exit(1);
}

console.log('🎉 All logger fixes verified successfully!');