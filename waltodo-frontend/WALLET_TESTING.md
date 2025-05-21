# Wallet Integration Testing Guide

This document provides instructions for testing the multi-wallet integration in the WalTodo frontend application.

## Prerequisites

- Make sure you have the following wallet extensions installed:
  - [Sui/Slush Wallet](https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil)
  - [Phantom Wallet](https://phantom.app/download)
  - [Backpack Wallet](https://www.backpack.app/download)
- Run the development server: `pnpm run dev`

## Test Scenarios

### 1. WalletSelector Component Testing

#### Test 1: Verify Wallet Selection Modal
1. Navigate to the application home page
2. Check if the "Connect Wallet" button is visible
3. Click the button and verify that a dropdown appears with options for:
   - Sui Wallet
   - Slush
   - Phantom
   - Backpack
4. Verify that each option shows the wallet name and has the correct icon

#### Test 2: Test Error Handling When Wallet Not Installed
1. If you don't have one of the wallets installed, try selecting it
2. Verify that an error modal appears with:
   - A clear message indicating the wallet is not installed
   - An "Install" button that links to the correct download page
3. Click the "Install" button and verify it opens the correct webpage

### 2. Individual Wallet Testing

Repeat these steps for each supported wallet (Sui, Slush, Phantom, Backpack):

#### Test 1: Connect Flow
1. Click the "Connect Wallet" button
2. Select the wallet from the dropdown
3. Verify that the wallet's popup appears requesting connection approval
4. Approve the connection
5. Verify that:
   - The wallet status indicator shows the correct wallet type with the appropriate color
   - The address is displayed correctly in the UI
   - The "Connect Wallet" button is replaced with wallet information and a "Disconnect" button

#### Test 2: Disconnect Flow
1. Click the "Disconnect" button
2. Verify that:
   - The connection status is reset
   - The "Connect Wallet" button reappears
   - Any wallet-specific UI elements are hidden

#### Test 3: Network Switching
1. Connect to a wallet
2. Click the network name (e.g., "Testnet") or the "(change)" text
3. Select a different network (e.g., Mainnet, Devnet)
4. Verify that:
   - The wallet adapts to the new network
   - The UI updates to show the new network name

### 3. Error Handling Tests

#### Test 1: Connection Rejection
1. Click "Connect Wallet"
2. Select a wallet
3. When the wallet popup appears, click "Reject" or "Cancel"
4. Verify that:
   - An appropriate error modal appears
   - The error message indicates the connection was rejected
   - The application returns to the disconnected state

#### Test 2: Session Timeout/Expiration
1. Connect to a wallet
2. In another tab, disconnect the wallet or log out
3. Return to the application and perform an action
4. Verify that:
   - The application detects the session is no longer valid
   - An appropriate error message is shown
   - The UI returns to the disconnected state

### 4. Compatibility Testing

#### Test 1: Browser Compatibility
1. Test the wallet integration on multiple browsers:
   - Chrome
   - Firefox
   - Edge
   - Safari (if available)
2. Verify that wallet selection, connection, and disconnection work on each browser
3. Note any browser-specific issues

#### Test 2: Mobile Compatibility
1. Open the application on mobile devices
2. Test with wallet apps that support deep linking
3. Verify the connect/disconnect flows work appropriately

## Integration Testing Checklist

### Sui/Slush Wallet
- [ ] Selector displays Sui wallet option
- [ ] Connection request properly sent to extension
- [ ] Address displayed correctly after connection
- [ ] Wallet type badge shows "Sui" or "Slush" with blue/cyan color
- [ ] Disconnect works properly
- [ ] Network switching functions correctly

### Phantom Wallet
- [ ] Selector displays Phantom wallet option
- [ ] Connection request properly sent to extension
- [ ] Address displayed correctly after connection
- [ ] Wallet type badge shows "Phantom" with purple color
- [ ] Disconnect works properly
- [ ] Network switching functions correctly

### Backpack Wallet
- [ ] Selector displays Backpack wallet option
- [ ] Connection request properly sent to extension
- [ ] Address displayed correctly after connection
- [ ] Wallet type badge shows "Backpack" with orange color
- [ ] Disconnect works properly
- [ ] Network switching functions correctly

### Error Handling
- [ ] "Wallet not installed" error displayed correctly with install link
- [ ] "Connection rejected" error displayed correctly
- [ ] "Session expired" error handled appropriately
- [ ] Network errors handled gracefully

---

## Troubleshooting Common Issues

### Wallet Doesn't Connect
- Verify the wallet extension is installed and unlocked
- Check browser console for error messages
- Make sure you're using the latest version of the wallet extension

### Multiple Wallet Conflicts
- If multiple wallets (e.g., Phantom and Backpack) are detecting the same chain, try disabling one temporarily
- Ensure each wallet is connected to the correct network (testnet/mainnet)

### Network Switching Issues
- Close and reopen the wallet extension after switching networks
- Verify the wallet supports the selected network
- Check wallet settings to ensure the network endpoints are configured correctly