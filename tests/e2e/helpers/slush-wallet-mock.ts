/**
 * Slush wallet mock helpers for testing
 *
 * This provides standard mock implementations of the Slush wallet
 * that can be reused across various test files.
 */

import { Page } from '@playwright/test';

// E2E Slush wallet mock interfaces
interface SlushWalletWindow {
  slushProvider?: SlushProvider;
  stashedProvider?: SlushProvider;
  stashed?: SlushAdapter;
}

interface SlushProvider {
  hasPermissions(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  getAccounts(): Promise<MockSlushAccount[]>;
}

interface SlushAdapter {
  connect(): Promise<MockSlushAccount>;
  disconnect(): Promise<void>;
  signTransaction(): Promise<Record<string, unknown>>;
  signMessage(): Promise<Record<string, unknown>>;
}

interface SlushWalletOptions {
  connected?: boolean;
  rejectConnection?: boolean;
  failDisconnect?: boolean;
}

interface WalletContextChangeDetail {
  walletType: string;
  connected: boolean;
  slushAccount: MockSlushAccount;
}

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
  features: ['standard:connect', 'standard:events'],
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
  options: SlushWalletOptions = {}
) {
  await page.evaluate(
    ({ account, options }) => {
      const {
        connected = false,
        rejectConnection = false,
        failDisconnect = false,
      } = options;

      const walletWindow = window as unknown as SlushWalletWindow;
      
      // Mock Slush provider (previously Stashed)
      walletWindow.slushProvider = {
        hasPermissions: async () => connected,
        requestPermissions: async () => {
          if (rejectConnection) {
            throw new Error('User rejected the request');
          }
          return true;
        },
        getAccounts: async () => (connected ? [account] : []),
      };

      // Mock Slush adapter (standard interface)
      walletWindow.stashed = {
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
        signMessage: async () => ({}),
      };

      // For legacy support, also mock stashedProvider
      walletWindow.stashedProvider = walletWindow.slushProvider;
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
    const walletWindow = window as unknown as SlushWalletWindow;
    // Remove all Slush/Stashed wallet-related objects
    delete walletWindow.slushProvider;
    delete walletWindow.stashedProvider;
    delete walletWindow.stashed;
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
    address,
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
  await page.evaluate((acc: MockSlushAccount) => {
    // This simulates what happens in the wallet context after a successful connection
    const detail: WalletContextChangeDetail = {
      walletType: 'slush',
      connected: true,
      slushAccount: acc,
    };
    
    const walletContextEvent = new CustomEvent('walletContextChange', {
      detail,
    });

    document.dispatchEvent(walletContextEvent);
  }, account);
}
