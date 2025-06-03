#!/usr/bin/env node

/**
 * Test Script for Config Embedding
 * 
 * This script tests the config embedding functionality to ensure
 * static export works properly with embedded configurations.
 */

const fs = require('fs');
const path = require('path');
const { embedConfigs, restoreConfigs } = require('./embed-configs');

const CONFIG_LOADER_PATH = path.join(__dirname, '..', 'src', 'lib', 'config-loader.ts');

/**
 * Test the config embedding process
 */
async function testConfigEmbedding() {
  console.log('🧪 Testing config embedding functionality...\n');
  
  // Step 1: Backup original file
  const originalContent = fs.readFileSync(CONFIG_LOADER_PATH, 'utf8');
  
  try {
    // Step 2: Test embedding
    console.log('📦 Testing config embedding...');
    embedConfigs();
    
    // Step 3: Verify embedding worked
    const embeddedContent = fs.readFileSync(CONFIG_LOADER_PATH, 'utf8');
    if (embeddedContent.includes('"testnet":') && embeddedContent.includes('"network":')) {
      console.log('✅ Config embedding successful');
    } else {
      throw new Error('Config embedding failed - no embedded content found');
    }
    
    // Step 4: Test restoration
    console.log('🔄 Testing config restoration...');
    restoreConfigs();
    
    // Step 5: Verify restoration
    const restoredContent = fs.readFileSync(CONFIG_LOADER_PATH, 'utf8');
    if (restoredContent.includes('const EMBEDDED_CONFIGS: Record<string, any> = {};')) {
      console.log('✅ Config restoration successful');
    } else {
      throw new Error('Config restoration failed');
    }
    
    console.log('\n🎉 All tests passed! Config embedding is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Restore original content on failure
    fs.writeFileSync(CONFIG_LOADER_PATH, originalContent);
    console.log('🔧 Restored original file content');
    
    process.exit(1);
  }
}

/**
 * Test static export compatibility
 */
function testStaticExportConfig() {
  console.log('\n🌐 Testing static export configuration...');
  
  const nextConfigPath = path.join(__dirname, '..', 'next.config.js');
  const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
  
  if (nextConfigContent.includes('output: \'export\'') && nextConfigContent.includes('NEXT_EXPORT')) {
    console.log('✅ Static export configuration found in next.config.js');
  } else {
    console.warn('⚠️  Static export configuration not found - may cause issues');
  }
  
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  if (packageJson.scripts['build:static'] && packageJson.scripts['embed-configs']) {
    console.log('✅ Build scripts configured correctly');
  } else {
    console.warn('⚠️  Build scripts missing - check package.json');
  }
}

// Run tests
if (require.main === module) {
  testConfigEmbedding();
  testStaticExportConfig();
}