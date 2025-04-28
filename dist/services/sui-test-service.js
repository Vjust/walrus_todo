"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suiTestService = exports.SuiTestService = void 0;
const tslib_1 = require("tslib");
// New Sui Test Service for interacting with Sui test networks and running Move tests
const client_1 = require("@mysten/sui/client");
const node_fetch_1 = tslib_1.__importDefault(require("node-fetch"));
const error_handler_1 = require("../utils/error-handler");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class SuiTestService {
    constructor(network = 'devnet') {
        const url = (0, client_1.getFullnodeUrl)(network);
        this.client = new client_1.SuiClient({ url });
    }
    /**
     * Retrieves the latest network state for diagnostics
     */
    async getNetworkStatus() {
        try {
            return await this.client.getLatestSuiSystemState();
        }
        catch (error) {
            throw new error_handler_1.CLIError(`Failed to get network status: ${error}`, 'NETWORK_ERROR');
        }
    }
    /**
     * Requests test SUI from the devnet faucet for a given address
     */
    async requestTestSui(address) {
        try {
            const faucetUrl = (0, client_1.getFullnodeUrl)('devnet').replace('fullnode', 'faucet');
            const res = await (0, node_fetch_1.default)(`${faucetUrl}/gas?recipient=${address}`);
            if (!res.ok) {
                throw new Error(`Faucet request failed: ${res.statusText}`);
            }
            return await res.json();
        }
        catch (error) {
            throw new error_handler_1.CLIError(`Failed to request test SUI: ${error}`, 'FAUCET_ERROR');
        }
    }
    /**
     * Executes Move unit tests in the specified directory
     */
    async runMoveTests(path = 'move') {
        try {
            const { stdout, stderr } = await execAsync('sui move test', { cwd: path });
            return { stdout, stderr };
        }
        catch (error) {
            throw new error_handler_1.CLIError(`Move tests failed: ${error}`, 'TEST_ERROR');
        }
    }
}
exports.SuiTestService = SuiTestService;
// Singleton for reuse
exports.suiTestService = new SuiTestService();
