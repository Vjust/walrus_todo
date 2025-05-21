import { test } from '@oclif/test';
import * as fs from 'fs';
import * as path from 'path';
import { expect } from '@jest/globals';
import DeployCommand from '../../src/commands/deploy';

describe('DeployCommand', () => {
  describe('getMoveFilesPath', () => {
    const command = new DeployCommand();
    const getMoveFilesPath = (command as any).getMoveFilesPath.bind(command);

    beforeEach(() => {
      // Mock filesystem
      jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('finds files in development environment', () => {
      const devPath = path.join(process.cwd(), 'src/move');
      (fs.existsSync as jest.Mock).mockImplementation((p: string) => 
        p === path.join(devPath, 'Move.toml') || 
        p === path.join(devPath, 'sources')
      );

      const result = getMoveFilesPath();
      expect(result.moveToml).toBe(path.join(devPath, 'Move.toml'));
      expect(result.sourcesDir).toBe(path.join(devPath, 'sources'));
    });

    test('finds files in production environment', () => {
      const prodPath = path.join(__dirname, '../../src/move');
      (fs.existsSync as jest.Mock).mockImplementation((p: string) => 
        p === path.join(prodPath, 'Move.toml') || 
        p === path.join(prodPath, 'sources')
      );

      const result = getMoveFilesPath();
      expect(result.moveToml).toBe(path.join(prodPath, 'Move.toml'));
      expect(result.sourcesDir).toBe(path.join(prodPath, 'sources'));
    });

    test('throws error when files not found', () => {
      expect(() => getMoveFilesPath()).toThrow('Move files not found');
    });
  });

  describe('deployment', () => {
    test
      .stdout()
      .command(['deploy', '--network', 'testnet', '--gas-budget', '200000000'])
      .catch(error => {
        expect(error.message).toContain('Move files not found');
      })
      .it('handles missing move files gracefully');

    test
      .stdout()
      .stub(fs, 'existsSync', () => true)
      .stub(fs, 'mkdtempSync', () => '/temp/test-deploy')
      .stub(fs, 'mkdirSync', () => {})
      .stub(fs, 'readdirSync', () => ['todo.move'])
      .stub(fs, 'copyFileSync', () => {})
      .stub(fs, 'rmSync', () => {})
      .do(() => {
        // Mock successful deployment output
        const mockOutput = JSON.stringify({
          effects: {
            created: [
              { 
                owner: 'Immutable',
                reference: { objectId: 'test-package-id-123' }
              }
            ]
          },
          digest: 'test-digest-456'
        });
        
        // Mock config service
        const configService = require('../../src/services/config-service').configService;
        jest.spyOn(configService, 'getConfig').mockResolvedValue({});
        jest.spyOn(configService, 'saveConfig').mockResolvedValue();
        
        // Mock command executor
        const commandExecutor = require('../../src/utils/command-executor');
        jest.spyOn(commandExecutor, 'safeExecFileSync').mockReturnValue();
        jest.spyOn(commandExecutor, 'getActiveSuiAddress').mockReturnValue('0xtest-address');
        jest.spyOn(commandExecutor, 'publishSuiPackage').mockReturnValue(mockOutput);
      })
      .command(['deploy', '--network', 'testnet', '--address', '0xtest-address', '--gas-budget', '200000000'])
      .it('saves deployment config after successful deployment', () => {
        const configService = require('../../src/services/config-service').configService;
        
        // Verify saveConfig was called with deployment info
        expect(configService.saveConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            network: 'testnet',
            walletAddress: '0xtest-address',
            lastDeployment: expect.objectContaining({
              packageId: 'test-package-id-123',
              digest: 'test-digest-456',
              network: 'testnet',
              timestamp: expect.any(String)
            })
          })
        );
      });
  });
});

