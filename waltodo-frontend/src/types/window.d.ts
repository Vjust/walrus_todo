interface Window {
  suiWallet?: any;
  ethereum?: {
    isSuiWallet?: boolean;
    [key: string]: any;
  };
  martian?: {
    sui?: any;
    [key: string]: any;
  };
  suiet?: any;
  phantom?: {
    solana?: any;
    [key: string]: any;
  };
  solana?: {
    isPhantom?: boolean;
    [key: string]: any;
  };
}