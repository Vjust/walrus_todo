interface Window {
  // Sui wallets
  suiWallet?: {
    connect: () => Promise<{ publicKey: string | Uint8Array }>;
    disconnect: () => Promise<void>;
    signAndExecuteTransaction: (transaction: any) => Promise<any>;
    executeMoveCall: (transaction: any) => Promise<any>;
    signTransaction: (transaction: any) => Promise<any>;
    signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
    getAccounts: () => Promise<string[]>;
    [key: string]: any;
  };
  ethereum?: {
    isSuiWallet?: boolean;
    [key: string]: any;
  };
  martian?: {
    sui?: {
      connect: () => Promise<{ publicKey: string | Uint8Array }>;
      disconnect: () => Promise<void>;
      signAndExecuteTransaction: (transaction: any) => Promise<any>;
      getAccounts: () => Promise<string[]>;
      [key: string]: any;
    };
    [key: string]: any;
  };
  suiet?: {
    connect: () => Promise<{ publicKey: string | Uint8Array }>;
    disconnect: () => Promise<void>;
    signAndExecuteTransaction: (transaction: any) => Promise<any>;
    getAccounts: () => Promise<string[]>;
    [key: string]: any;
  };

  // Solana wallets
  phantom?: {
    solana?: {
      isPhantom: boolean;
      connect: (options?: {
        onlyIfTrusted?: boolean;
      }) => Promise<{ publicKey: any }>;
      disconnect: () => Promise<void>;
      signTransaction: (transaction: any) => Promise<any>;
      signAllTransactions: (transactions: any[]) => Promise<any[]>;
      signMessage: (
        message: Uint8Array,
        encoding?: string
      ) => Promise<{ signature: Uint8Array }>;
      on: (event: string, callback: Function) => void;
      off: (event: string, callback: Function) => void;
      [key: string]: any;
    };
    [key: string]: any;
  };
  solana?: {
    isPhantom?: boolean;
    isSolflare?: boolean;
    isBackpack?: boolean;
    connect: (options?: {
      onlyIfTrusted?: boolean;
    }) => Promise<{ publicKey: any }>;
    disconnect: () => Promise<void>;
    signTransaction: (transaction: any) => Promise<any>;
    signAllTransactions: (transactions: any[]) => Promise<any[]>;
    signMessage: (
      message: Uint8Array,
      encoding?: string
    ) => Promise<{ signature: Uint8Array }>;
    on: (event: string, callback: Function) => void;
    off: (event: string, callback: Function) => void;
    request: (request: { method: string; params?: any }) => Promise<any>;
    [key: string]: any;
  };

  // Backpack wallet - multiple possible interfaces
  xnft?: {
    solana?: {
      publicKey: string;
      isBackpack: boolean;
      connect: (options?: {
        onlyIfTrusted?: boolean;
      }) => Promise<{ publicKey: any }>;
      disconnect: () => Promise<void>;
      signTransaction: (transaction: any) => Promise<any>;
      signAllTransactions: (transactions: any[]) => Promise<any[]>;
      signMessage: (
        message: Uint8Array,
        encoding?: string
      ) => Promise<{ signature: Uint8Array }>;
      on: (event: string, callback: Function) => void;
      off: (event: string, callback: Function) => void;
      [key: string]: any;
    };
    ethereum?: {
      publicKey: string;
      signTransaction: (transaction: any) => Promise<any>;
      [key: string]: any;
    };
    sui?: {
      publicKey: string;
      connect: () => Promise<{ publicKey: string | Uint8Array }>;
      disconnect: () => Promise<void>;
      getAccounts: () => Promise<string[]>;
      [key: string]: any;
    };
    request: (request: { method: string; params?: any }) => Promise<any>;
    [key: string]: any;
  };

  // Alternative Backpack interface
  backpack?: {
    connect: (options?: {
      onlyIfTrusted?: boolean;
    }) => Promise<{ publicKey: any }>;
    disconnect: () => Promise<void>;
    signTransaction: (transaction: any) => Promise<any>;
    signAllTransactions: (transactions: any[]) => Promise<any[]>;
    signMessage: (
      message: Uint8Array,
      encoding?: string
    ) => Promise<{ signature: Uint8Array }>;
    on: (event: string, callback: Function) => void;
    off: (event: string, callback: Function) => void;
    request: (request: { method: string; params?: any }) => Promise<any>;
    isBackpack: boolean;
    publicKey?: any;
    [key: string]: any;
  };
}
