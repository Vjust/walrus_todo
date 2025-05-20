/**
 * Slush wallet mock helpers for testing
 * 
 * This provides standard mock implementations of the Slush wallet
 * that can be reused across various test files.
 */

import { Page } from '@playwright/test';

/**
 * Account object representing a Slush wallet account
 */
export interface MockSlushAccount {
  address: string;
  publicKey: Uint8Array;
  chains: string[];
  features: string[];
}

/**
 * Default mock account for testing
 */
export const DEFAULT_SLUSH_ACCOUNT: MockSlushAccount = {
  address: '0xslush123456789abcdef',
  publicKey: new Uint8Array([1, 2, 3, 4, 5]),
  chains: ['sui:testnet'],
  features: ['standard:connect', 'standard:events']
};

/**
 * Injects a mock Slush wallet provider into the browser context
 * @param page Playwright page object
 * @param account Optional custom account (defaults to DEFAULT_SLUSH_ACCOUNT)
 * @param options Additional configuration options
 */
export async function injectSlushWallet(
  page: Page, 
  account: MockSlushAccount = DEFAULT_SLUSH_ACCOUNT,
  options: {
    connected?: boolean;
    rejectConnection?: boolean;
    failDisconnect?: boolean;
  } = {}
) {
  await page.evaluate(
    ({ account, options }) => {
      const { connected = false, rejectConnection = false, failDisconnect = false } = options;
      
      // Mock Slush provider (previously Stashed)
      (window as any).slushProvider = {
        hasPermissions: async () => connected,
        requestPermissions: async () => {
          if (rejectConnection) {
            throw new Error('User rejected the request');
          }
          return true;
        },
        getAccounts: async () => connected ? [account] : []
      };
      
      // Mock Slush adapter (standard interface)
      (window as any).stashed = {
        connect: async () => {
          if (rejectConnection) {
            throw new Error('User rejected the request');
          }
          return account;
        },
        disconnect: async () => {
          if (failDisconnect) {
            throw new Error('Failed to disconnect');
          }
        },
        signTransaction: async () => ({}),
        signMessage: async () => ({})
      };
      
      // For legacy support, also mock stashedProvider
      (window as any).stashedProvider = (window as any).slushProvider;
    },
    { account, options }
  );
}

/**
 * Removes all mock Slush wallet providers from the browser context
 * @param page Playwright page object
 */
export async function removeSlushWallet(page: Page) {
  await page.evaluate(() => {
    // Remove all Slush/Stashed wallet-related objects
    delete (window as any).slushProvider;
    delete (window as any).stashedProvider;
    delete (window as any).stashed;
  });
}

/**
 * Creates a mock Slush account with custom address
 * @param address Custom wallet address to use
 * @returns MockSlushAccount object
 */
export function createSlushAccount(address: string): MockSlushAccount {
  return {
    ...DEFAULT_SLUSH_ACCOUNT,
    address
  };
}

/**
 * Simulates a wallet connection event
 * @param page Playwright page object
 * @param account Slush account to use
 */
export async function simulateSlushConnection(
  page: Page,
  account: MockSlushAccount = DEFAULT_SLUSH_ACCOUNT
) {
  await page.evaluate((acc) => {
    // This simulates what happens in the wallet context after a successful connection
    const walletContextEvent = new CustomEvent('walletContextChange', {
      detail: {
        walletType: 'slush',
        connected: true,
        slushAccount: acc
      }
    });
    
    document.dispatchEvent(walletContextEvent);
  }, account);
}