import { test } from '@oclif/test';
import * as fs from 'fs';
import * as path from 'path';
import { expect } from '@jest/globals';
import DeployCommand from '../../apps/cli/src/commands/deploy';

// Mock fs module
jest.mock('fs');

interface DeployCommandWithPrivateMethods extends DeployCommand {
  getMoveFilesPath: () => { moveToml: string; sourcesDir: string };
}

describe('DeployCommand', () => {
  describe('getMoveFilesPath', () => {
    let command: DeployCommandWithPrivateMethods;

    beforeEach(() => {
      command = new DeployCommand() as DeployCommandWithPrivateMethods;
      // Mock filesystem
      jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('finds files in development environment', () => {
      const devPath = path.join(process.cwd(), 'apps/cli/src/move');
      (fs.existsSync as jest.Mock).mockImplementation(
        (p: string) =>
          p === path.join(devPath, 'Move.toml') ||
          p === path.join(devPath, 'sources')
      );

      const result = command.getMoveFilesPath();
      expect(result.moveToml).toBe(path.join(devPath, 'Move.toml'));
      expect(result.sourcesDir).toBe(path.join(devPath, 'sources'));
    });

    it('finds files in production environment', () => {
      const prodPath = path.join(__dirname, '../../apps/cli/src/move');
      (fs.existsSync as jest.Mock).mockImplementation(
        (p: string) =>
          p === path.join(prodPath, 'Move.toml') ||
          p === path.join(prodPath, 'sources')
      );

      const result = command.getMoveFilesPath();
      expect(result.moveToml).toBe(path.join(prodPath, 'Move.toml'));
      expect(result.sourcesDir).toBe(path.join(prodPath, 'sources'));
    });

    it('throws error when files not found', () => {
      expect(() => command.getMoveFilesPath()).toThrow('Move files not found');
    });
  });

  describe('deployment', () => {
    it('handles missing move files gracefully', async () => {
      const commandPromise = test
        .stdout()
        .command(['deploy', '--network', 'testnet', '--gas-budget', '200000000']);
      
      await expect(commandPromise).rejects.toThrow('Move files not found');
    });

    it('saves deployment config after successful deployment', async () => {
      // Mock successful deployment
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'mkdtempSync').mockReturnValue('/temp/test-deploy');
      jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
      jest.spyOn(fs, 'readdirSync').mockReturnValue(['todo.move'] as never[]);
      jest.spyOn(fs, 'copyFileSync').mockImplementation(() => undefined);
      jest.spyOn(fs, 'rmSync').mockImplementation(() => undefined);

      // Mock successful deployment output
      const mockOutput = JSON.stringify({
        effects: {
          created: [
            {
              owner: 'Immutable',
              reference: { objectId: 'test-package-id-123' },
            },
          ],
        },
        digest: 'test-digest-456',
      });

      // Mock config service
      const configService = await import('../../apps/cli/src/services/config-service');
      jest.spyOn(configService.configService, 'getConfig').mockResolvedValue({});
      jest.spyOn(configService.configService, 'saveConfig').mockResolvedValue();

      // Mock command executor
      const commandExecutor = await import('../../apps/cli/src/utils/command-executor');
      jest.spyOn(commandExecutor, 'safeExecFileSync').mockReturnValue();
      jest
        .spyOn(commandExecutor, 'getActiveSuiAddress')
        .mockReturnValue('0xtest-address');
      jest
        .spyOn(commandExecutor, 'publishSuiPackage')
        .mockReturnValue(mockOutput);

      await test
        .stdout()
        .command([
          'deploy',
          '--network',
          'testnet',
          '--address',
          '0xtest-address',
          '--gas-budget',
          '200000000',
        ])
        .it('saves deployment config', () => {
          // Verify saveConfig was called with deployment info
          expect(configService.configService.saveConfig).toHaveBeenCalledWith(
            expect.objectContaining({
              network: 'testnet',
              walletAddress: '0xtest-address',
              lastDeployment: expect.objectContaining({
                packageId: 'test-package-id-123',
                digest: 'test-digest-456',
                network: 'testnet',
                timestamp: expect.any(String),
              }),
            })
          );
          
          // Verify fs.writeFileSync was called (through writeFileSafe)
          expect(writeFileSyncSpy).toHaveBeenCalled();
        });
    });
  });
});