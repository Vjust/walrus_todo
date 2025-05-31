# Wallet Testing Guide for WalTodo Frontend

This guide provides comprehensive instructions for testing wallet connectivity and functionality in the WalTodo frontend application.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Development Server Setup](#development-server-setup)
- [Testing Procedures](#testing-procedures)
- [Success Indicators](#success-indicators)
- [Common Issues and Solutions](#common-issues-and-solutions)
- [Advanced Testing](#advanced-testing)
- [Console Commands for Debugging](#console-commands-for-debugging)

## Prerequisites

### Required Wallet Extensions

Install at least one of the following Sui-compatible wallet extensions:

1. **Sui Wallet (Official)**
   - Chrome/Brave: [Chrome Web Store](https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil)
   - Firefox: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/sui-wallet/)
   - Create a new wallet or import existing one
   - Ensure you're connected to Sui Testnet

2. **Suiet Wallet**
   - Chrome/Brave: [Chrome Web Store](https://chrome.google.com/webstore/detail/suiet-sui-wallet/khpkpbbcccdmmclmpigdgddabeilkdpd)
   - Follow setup instructions
   - Switch to Testnet network

3. **Ethos Wallet**
   - Chrome: [Chrome Web Store](https://chrome.google.com/webstore/detail/ethos-sui-wallet/mcbigmjiafegjnnogedioegffbooigli)
   - Complete wallet setup
   - Ensure Testnet is selected

### Testnet SUI Tokens

1. Get free testnet SUI from the faucet:
   ```bash
   curl --location --request POST 'https://faucet.testnet.sui.io/gas' \
   --header 'Content-Type: application/json' \
   --data-raw '{
       "FixedAmountRequest": {
           "recipient": "YOUR_WALLET_ADDRESS"
       }
   }'
   ```

2. Or use the Sui Discord faucet:
   - Join [Sui Discord](https://discord.gg/sui)
   - Go to #testnet-faucet channel
   - Type `!faucet YOUR_WALLET_ADDRESS`

### Development Environment

- Node.js 18+ installed
- pnpm package manager installed
- Git repository cloned
- Dependencies installed (`pnpm install`)

## Development Server Setup

### 1. Start the Frontend Development Server

```bash
# Navigate to frontend directory
cd waltodo-frontend

# Install dependencies if not already done
pnpm install

# Start development server
pnpm dev
```

The server will start on `http://localhost:3000` (or next available port).

### 2. Verify Server is Running

Open your browser and navigate to:
- Main page: `http://localhost:3000`
- Blockchain demo: `http://localhost:3000/blockchain-demo`
- Test page: `http://localhost:3000/test`
- Dashboard: `http://localhost:3000/dashboard`

## Testing Procedures

### Step 1: Initial Page Load Testing

1. **Open Developer Console** (F12 or right-click → Inspect)
2. **Navigate to** `http://localhost:3000`
3. **Check for errors** in the console
4. **Verify** the page loads without hydration errors

### Step 2: Wallet Connection Testing

1. **Locate the Wallet Connect Button**
   - Should be in the navigation bar
   - May show "Connect Wallet" or wallet icon

2. **Click Connect Wallet**
   - A modal should appear listing available wallets
   - Only wallets you have installed should be clickable

3. **Select Your Wallet**
   - Click on your preferred wallet (e.g., "Sui Wallet")
   - Your wallet extension should open

4. **Approve Connection**
   - In the wallet popup, click "Connect" or "Approve"
   - May need to select which account to connect

5. **Verify Connection**
   - Button should now show wallet address (abbreviated)
   - May show balance or "Connected" status

### Step 3: Wallet Functionality Testing

1. **Test Disconnect**
   - Click on the connected wallet button
   - Select "Disconnect" option
   - Verify wallet is disconnected

2. **Test Reconnection**
   - Click "Connect Wallet" again
   - Wallet should reconnect faster (may auto-connect)

3. **Test Page Refresh**
   - With wallet connected, refresh the page (F5)
   - Wallet should remain connected after refresh

4. **Test Navigation**
   - Navigate to different pages
   - Wallet connection should persist

### Step 4: Transaction Testing

1. **Navigate to** `http://localhost:3000/blockchain`

2. **Create a Todo on Blockchain**
   - Ensure wallet is connected
   - Fill in todo details
   - Click "Create on Blockchain"
   - Approve transaction in wallet popup

3. **Monitor Transaction**
   - Watch for transaction status updates
   - Check transaction history component
   - Verify todo appears in list after confirmation

## Success Indicators

### ✅ Successful Wallet Connection
- No console errors
- Wallet address displayed in UI
- Connection persists across page refreshes
- Can view wallet balance/network

### ✅ Successful Transaction
- Transaction approved in wallet
- Transaction hash displayed
- Status updates from "pending" to "confirmed"
- Data appears in UI after confirmation
- Transaction visible in transaction history

### ✅ Successful Disconnect
- Wallet disconnected cleanly
- UI reverts to "Connect Wallet" state
- No lingering connection data
- Can reconnect without issues

## Common Issues and Solutions

### Issue 1: "Cannot read properties of undefined"
**Symptoms:** Console errors mentioning undefined wallet properties
**Solution:**
```javascript
// Check if wallet is properly initialized
console.log('Wallet context:', window.walletContext);
console.log('Available wallets:', await window.walletContext?.getWallets());
```

### Issue 2: Wallet Modal Doesn't Appear
**Symptoms:** Clicking "Connect Wallet" does nothing
**Solutions:**
1. Check browser extensions are enabled
2. Disable ad blockers temporarily
3. Clear browser cache and cookies
4. Try incognito/private mode

### Issue 3: Transaction Fails
**Symptoms:** Transaction rejected or fails
**Solutions:**
1. Ensure sufficient testnet SUI balance
2. Check network selection (must be testnet)
3. Verify gas settings in wallet
4. Check console for specific error messages

### Issue 4: Hydration Errors
**Symptoms:** "Hydration failed" errors in console
**Solutions:**
1. Clear Next.js cache: `rm -rf .next`
2. Restart development server
3. Check for SSR/CSR mismatches in components

### Issue 5: Wallet Not Detected
**Symptoms:** Installed wallet not showing in list
**Solutions:**
1. Refresh the page
2. Ensure wallet extension is enabled
3. Try restarting browser
4. Check wallet is properly installed

## Advanced Testing

### Testing Multiple Wallets

1. Install multiple wallet extensions
2. Test switching between wallets:
   ```javascript
   // In console, check available wallets
   const wallets = await window.walletContext?.getWallets();
   console.log('Available wallets:', wallets);
   ```

3. Verify only one wallet can be connected at a time

### Testing Error Scenarios

1. **Network Mismatch**
   - Switch wallet to mainnet
   - Try to connect
   - Should show network error

2. **Rejected Transactions**
   - Initiate a transaction
   - Reject in wallet
   - Verify proper error handling

3. **Insufficient Balance**
   - Try transaction with empty wallet
   - Should show balance error

### Testing Blockchain Events

Navigate to `http://localhost:3000/blockchain-demo` and test:
1. Real-time event subscriptions
2. Transaction status updates
3. Block height updates

## Console Commands for Debugging

### Basic Debugging Commands

```javascript
// Check wallet context
console.log('Wallet context exists:', !!window.walletContext);

// Get current wallet state
console.log('Connected wallet:', window.walletContext?.currentWallet);
console.log('Connected account:', window.walletContext?.currentAccount);

// List available wallets
window.walletContext?.getWallets().then(wallets => {
  console.log('Available wallets:', wallets);
});

// Check Sui client
console.log('Sui client:', window.suiClient);

// Get current network
console.log('Current network:', window.walletContext?.network);
```

### Advanced Debugging Commands

```javascript
// Check wallet capabilities
window.walletContext?.currentWallet?.features.then(features => {
  console.log('Wallet features:', features);
});

// Monitor wallet events
window.addEventListener('wallet-change', (e) => {
  console.log('Wallet changed:', e.detail);
});

// Check transaction history
const history = localStorage.getItem('walrus_todo_transactions');
console.log('Transaction history:', JSON.parse(history || '[]'));

// Force wallet disconnect
window.walletContext?.disconnect();

// Check error suppression
console.log('Error suppression active:', window.__errorSuppression);
```

### Performance Monitoring

```javascript
// Check React Query cache
console.log('Query cache:', window.queryClient?.getQueryCache());

// Monitor network requests
console.log('Active queries:', window.queryClient?.getQueryCache().getAll());

// Check component render count
console.log('Render count:', performance.getEntriesByType('measure'));
```

## Testing Checklist

Before considering wallet integration complete, ensure:

- [ ] Can connect with at least 2 different wallets
- [ ] Connection persists across page refreshes
- [ ] Can disconnect and reconnect without issues
- [ ] Transactions work on testnet
- [ ] No console errors during normal operation
- [ ] UI updates correctly on connection/disconnection
- [ ] Transaction history displays properly
- [ ] Error messages are user-friendly
- [ ] Works in both Chrome and Firefox
- [ ] Mobile responsive (if applicable)

## Troubleshooting Resources

- **Sui Documentation**: https://docs.sui.io/
- **Wallet SDKs**: Check respective wallet documentation
- **Discord Support**: Join Sui Discord for help
- **GitHub Issues**: Check project issues for known problems

## Notes for Developers

1. Always test in incognito/private mode at least once
2. Test with multiple accounts in same wallet
3. Verify error boundaries catch wallet errors
4. Check memory leaks with long-running connections
5. Test with slow network conditions
6. Verify proper cleanup on unmount

---

For additional help or to report issues, please check the project's GitHub repository or contact the development team.