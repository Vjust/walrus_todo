export declare class SuiTestService {
    private client;
    constructor(network?: string);
    /**
     * Retrieves the latest network state for diagnostics
     */
    getNetworkStatus(): Promise<any>;
    /**
     * Requests test SUI from the devnet faucet for a given address
     */
    requestTestSui(address: string): Promise<any>;
    /**
     * Executes Move unit tests in the specified directory
     */
    runMoveTests(path?: string): Promise<{
        stdout: string;
        stderr: string;
    }>;
}
export declare const suiTestService: SuiTestService;
