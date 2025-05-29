const axios = require('axios');

const API_BASE = 'http://localhost:3001/api/v1';

async function testSyncRoutes() {
  console.log('Testing sync routes...\n');

  try {
    // Test 1: Sync todo to Walrus
    console.log('1. Testing sync todo to Walrus...');
    const walrusSync = await axios.post(`${API_BASE}/sync/todos/test-123/walrus`, {}, {
      headers: { 'X-Wallet-Address': '0xtest123' }
    });
    console.log('✓ Walrus sync response:', walrusSync.data);

    // Test 2: Sync todo to blockchain
    console.log('\n2. Testing sync todo to blockchain...');
    const blockchainSync = await axios.post(`${API_BASE}/sync/todos/test-123/blockchain`, {}, {
      headers: { 'X-Wallet-Address': '0xtest123' }
    });
    console.log('✓ Blockchain sync response:', blockchainSync.data);

    // Test 3: Get sync status
    console.log('\n3. Testing get sync status...');
    const syncStatus = await axios.get(`${API_BASE}/sync/status/test-123`);
    console.log('✓ Sync status:', syncStatus.data);

    // Test 4: Sync list to Walrus
    console.log('\n4. Testing sync list to Walrus...');
    const listSync = await axios.post(`${API_BASE}/sync/lists/work/walrus`, {}, {
      headers: { 'X-Wallet-Address': '0xtest123' }
    });
    console.log('✓ List sync response:', listSync.data);

    // Test 5: Retrieve from Walrus
    console.log('\n5. Testing retrieve from Walrus...');
    const walrusData = await axios.get(`${API_BASE}/sync/walrus/blob_test_123`);
    console.log('✓ Walrus data:', walrusData.data);

    // Test 6: Batch sync
    console.log('\n6. Testing batch sync...');
    const batchSync = await axios.post(`${API_BASE}/sync/batch`, {
      operations: [
        { todoId: 'todo-1', targets: ['walrus', 'blockchain'], priority: 'high' },
        { todoId: 'todo-2', targets: ['walrus'], priority: 'normal' }
      ],
      waitForCompletion: false
    }, {
      headers: { 'X-Wallet-Address': '0xtest123' }
    });
    console.log('✓ Batch sync response:', batchSync.data);

    console.log('\n✅ All sync routes tested successfully!');
  } catch (error) {
    console.error('❌ Error testing sync routes:', error.response?.data || error.message);
  }
}

// Check if API server is running
axios.get(`${API_BASE}/../healthz`)
  .then(() => {
    console.log('API server is running at', API_BASE);
    testSyncRoutes();
  })
  .catch(() => {
    console.log('⚠️  API server is not running. Please start it with: npm run dev');
    console.log('   in the apps/api directory');
  });