interface Window {
  // Sui wallets
  suiWallet?: {
    connect: () => Promise<{ publicKey: string | Uint8Array }>;
    disconnect: () => Promise<void>;
    signAndExecuteTransaction: (transaction: unknown) => Promise<{ digest: string; effects?: unknown }>;
    executeMoveCall: (transaction: unknown) => Promise<{ digest: string; effects?: unknown }>;
    signTransaction: (transaction: unknown) => Promise<{ signature: Uint8Array; transactionBlockBytes: Uint8Array }>;
    signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
    getAccounts: () => Promise<string[]>;
    [key: string]: unknown;
  };
  ethereum?: {
    isSuiWallet?: boolean;
    [key: string]: unknown;
  };
  martian?: {
    sui?: {
      connect: () => Promise<{ publicKey: string | Uint8Array }>;
      disconnect: () => Promise<void>;
      signAndExecuteTransaction: (transaction: unknown) => Promise<{ digest: string; effects?: unknown }>;
      getAccounts: () => Promise<string[]>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  suiet?: {
    connect: () => Promise<{ publicKey: string | Uint8Array }>;
    disconnect: () => Promise<void>;
    signAndExecuteTransaction: (transaction: unknown) => Promise<{ digest: string; effects?: unknown }>;
    getAccounts: () => Promise<string[]>;
    [key: string]: unknown;
  };

  // Phantom wallet - supports both Solana and Sui
  phantom?: {
    sui?: {
      connect(options?: { onlyIfTrusted?: boolean }): Promise<{ address: string }>;
      disconnect(): Promise<void>;
      signAndExecuteTransaction(tx: unknown): Promise<{ digest: string }>;
      /* …rest identical to solana interface… */
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      off: (event: string, callback: (...args: unknown[]) => void) => void;
      [key: string]: unknown;
    };
    solana?: {
      isPhantom: boolean;
      connect: (options?: {
        onlyIfTrusted?: boolean;
      }) => Promise<{ publicKey: string | Uint8Array }>;
      disconnect: () => Promise<void>;
      signTransaction: (transaction: unknown) => Promise<{ signature: Uint8Array; transactionBytes: Uint8Array }>;
      signAllTransactions: (transactions: unknown[]) => Promise<{ signature: Uint8Array; transactionBytes: Uint8Array }[]>;
      signMessage: (
        message: Uint8Array,
        encoding?: string
      ) => Promise<{ signature: Uint8Array }>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      off: (event: string, callback: (...args: unknown[]) => void) => void;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  solana?: {
    isPhantom?: boolean;
    isSolflare?: boolean;
    isBackpack?: boolean;
    connect: (options?: {
      onlyIfTrusted?: boolean;
    }) => Promise<{ publicKey: string | Uint8Array }>;
    disconnect: () => Promise<void>;
    signTransaction: (transaction: unknown) => Promise<{ signature: Uint8Array; transactionBytes: Uint8Array }>;
    signAllTransactions: (transactions: unknown[]) => Promise<{ signature: Uint8Array; transactionBytes: Uint8Array }[]>;
    signMessage: (
      message: Uint8Array,
      encoding?: string
    ) => Promise<{ signature: Uint8Array }>;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    off: (event: string, callback: (...args: unknown[]) => void) => void;
    request: (request: { method: string; params?: unknown }) => Promise<unknown>;
    [key: string]: unknown;
  };

  // Backpack wallet - multiple possible interfaces
  xnft?: {
    solana?: {
      publicKey: string;
      isBackpack: boolean;
      connect: (options?: {
        onlyIfTrusted?: boolean;
      }) => Promise<{ publicKey: string | Uint8Array }>;
      disconnect: () => Promise<void>;
      signTransaction: (transaction: unknown) => Promise<{ signature: Uint8Array; transactionBytes: Uint8Array }>;
      signAllTransactions: (transactions: unknown[]) => Promise<{ signature: Uint8Array; transactionBytes: Uint8Array }[]>;
      signMessage: (
        message: Uint8Array,
        encoding?: string
      ) => Promise<{ signature: Uint8Array }>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      off: (event: string, callback: (...args: unknown[]) => void) => void;
      [key: string]: unknown;
    };
    ethereum?: {
      publicKey: string;
      signTransaction: (transaction: unknown) => Promise<{ signature: Uint8Array; transactionBytes: Uint8Array }>;
      [key: string]: unknown;
    };
    sui?: {
      publicKey: string;
      connect: () => Promise<{ publicKey: string | Uint8Array }>;
      disconnect: () => Promise<void>;
      getAccounts: () => Promise<string[]>;
      [key: string]: unknown;
    };
    request: (request: { method: string; params?: unknown }) => Promise<unknown>;
    [key: string]: unknown;
  };

  // Alternative Backpack interface
  backpack?: {
    connect: (options?: {
      onlyIfTrusted?: boolean;
    }) => Promise<{ publicKey: string | Uint8Array }>;
    disconnect: () => Promise<void>;
    signTransaction: (transaction: unknown) => Promise<{ signature: Uint8Array; transactionBytes: Uint8Array }>;
    signAllTransactions: (transactions: unknown[]) => Promise<{ signature: Uint8Array; transactionBytes: Uint8Array }[]>;
    signMessage: (
      message: Uint8Array,
      encoding?: string
    ) => Promise<{ signature: Uint8Array }>;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    off: (event: string, callback: (...args: unknown[]) => void) => void;
    request: (request: { method: string; params?: unknown }) => Promise<unknown>;
    isBackpack: boolean;
    publicKey?: string | Uint8Array;
    [key: string]: unknown;
  };
}
