// New Sui Test Service for interacting with Sui test networks and running Move tests
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import fetch from 'node-fetch';
import { configService } from './config-service';
import { CLIError } from '../utils/error-handler';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SuiTestService {
  private client: SuiClient;

  constructor(network: string = 'devnet') {
    const url = getFullnodeUrl(network as any);
    this.client = new SuiClient({ url });
  }

  /**
   * Retrieves the latest network state for diagnostics
   */
  public async getNetworkStatus(): Promise<any> {
    try {
      return await this.client.getLatestSuiSystemState();
    } catch (error: unknown) {
      throw new CLIError(`Failed to get network status: ${error}`, 'NETWORK_ERROR');
    }
  }

  /**
   * Requests test SUI from the devnet faucet for a given address
   */
  public async requestTestSui(address: string): Promise<any> {
    try {
      const faucetUrl = getFullnodeUrl('devnet').replace('fullnode', 'faucet');
      const res = await fetch(`${faucetUrl}/gas?recipient=${address}`);
      if (!res.ok) {
        throw new Error(`Faucet request failed: ${res.statusText}`);
      }
      return await res.json();
    } catch (error: unknown) {
      throw new CLIError(`Failed to request test SUI: ${error}`, 'FAUCET_ERROR');
    }
  }

  /**
   * Executes Move unit tests in the specified directory
   */
  public async runMoveTests(path: string = 'move'): Promise<{ stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execAsync('sui move test', { cwd: path });
      return { stdout, stderr };
    } catch (error: unknown) {
      throw new CLIError(`Move tests failed: ${error}`, 'TEST_ERROR');
    }
  }
}

// Singleton for reuse
export const suiTestService = new SuiTestService();