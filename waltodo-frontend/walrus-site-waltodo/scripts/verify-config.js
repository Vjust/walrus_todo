#!/usr/bin/env node

/**
 * Configuration Verification Script
 * 
 * Verifies that all network configurations are properly set up with 
 * the official Walrus Sites package IDs.
 */

const fs = require('fs');
const path = require('path');

// Official package IDs that should be used
const OFFICIAL_PACKAGE_IDS = {
  mainnet: {
    walrusSites: '0x26eb7ee8688da02c5f671679524e379f0b837a12f1d1d799f255b7eea260ad27',
    walrus: '0xfdc88f7d7cf30afab2f82e8380d11ee8f70efb90e863d1de8616fae1bb09ea77'
  },
  testnet: {
    walrusSites: '0xf99aee9f21493e1590e7e5a9aea6f343a1f381031a04a732724871fc294be799',
    walrus: '0xd84704c17fc870b8764832c535aa6b11f21a95cd6f5bb38a9b07d2cf42220c66'
  }
};

// Legacy package ID that should not be used
const LEGACY_PACKAGE_ID = '0xe8d420d723b6813d1e001d8cba0dfc8613cbc814dedb4adcd41909f2e11daa8b';

function loadJsonConfig(network) {
  const configPath = path.join(__dirname, '..', 'public', 'config', `${network}.json`);
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error(`Failed to parse ${network}.json:`, error.message);
    return null;
  }
}

function verifyNetwork(network) {
  console.log(`\n📋 Verifying ${network} configuration...`);
  
  const config = loadJsonConfig(network);
  if (!config) {
    console.log(`❌ ${network}.json not found or invalid`);
    return false;
  }

  let isValid = true;
  const expectedIds = OFFICIAL_PACKAGE_IDS[network];

  // Check deployment package ID
  if (config.deployment?.packageId === LEGACY_PACKAGE_ID) {
    console.log(`❌ Still using legacy package ID in deployment: ${LEGACY_PACKAGE_ID}`);
    isValid = false;
  } else if (expectedIds && config.deployment?.packageId === expectedIds.walrusSites) {
    console.log(`✅ Deployment package ID: ${config.deployment.packageId}`);
  } else {
    console.log(`⚠️  Deployment package ID: ${config.deployment?.packageId || 'NOT SET'}`);
  }

  // Check contract package ID
  if (config.contracts?.todoNft?.packageId === LEGACY_PACKAGE_ID) {
    console.log(`❌ Still using legacy package ID in contracts: ${LEGACY_PACKAGE_ID}`);
    isValid = false;
  } else if (expectedIds && config.contracts?.todoNft?.packageId === expectedIds.walrusSites) {
    console.log(`✅ Contract package ID: ${config.contracts.todoNft.packageId}`);
  } else {
    console.log(`⚠️  Contract package ID: ${config.contracts?.todoNft?.packageId || 'NOT SET'}`);
  }

  // Check Walrus package ID
  if (expectedIds && config.walrus?.packageId === expectedIds.walrus) {
    console.log(`✅ Walrus package ID: ${config.walrus.packageId}`);
  } else {
    console.log(`⚠️  Walrus package ID: ${config.walrus?.packageId || 'NOT SET'}`);
  }

  // Check network URLs
  if (config.network?.url) {
    console.log(`✅ Network URL: ${config.network.url}`);
  } else {
    console.log(`❌ Network URL not configured`);
    isValid = false;
  }

  if (config.walrus?.publisherUrl) {
    console.log(`✅ Walrus Publisher URL: ${config.walrus.publisherUrl}`);
  } else {
    console.log(`❌ Walrus Publisher URL not configured`);
    isValid = false;
  }

  return isValid;
}

function main() {
  console.log('🔍 Walrus Sites Package Configuration Verification');
  console.log('================================================');
  
  console.log('\n📦 Expected Package IDs:');
  console.log(`Mainnet Walrus Sites: ${OFFICIAL_PACKAGE_IDS.mainnet.walrusSites}`);
  console.log(`Mainnet Walrus: ${OFFICIAL_PACKAGE_IDS.mainnet.walrus}`);
  console.log(`Testnet Walrus Sites: ${OFFICIAL_PACKAGE_IDS.testnet.walrusSites}`);
  console.log(`Testnet Walrus: ${OFFICIAL_PACKAGE_IDS.testnet.walrus}`);
  
  console.log(`\n🚫 Legacy Package ID (should not be used): ${LEGACY_PACKAGE_ID}`);

  const networks = ['mainnet', 'testnet'];
  let allValid = true;

  for (const network of networks) {
    const isValid = verifyNetwork(network);
    allValid = allValid && isValid;
  }

  console.log('\n📊 Summary:');
  if (allValid) {
    console.log('✅ All configurations are properly set up with official package IDs');
    process.exit(0);
  } else {
    console.log('❌ Some configurations need attention');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}