/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import * as ts from 'typescript';
import { Logger } from '../apps/cli/src/utils/Logger';

const logger = new Logger('unified-build');

/**
 * Unified build script with improved error handling and reporting.
 * This script consolidates the build process and provides better error feedback.
 */

// Color constants for output formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// Configuration options
interface BuildOptions {
  skipTypeCheck: boolean;
  verbose: boolean;
  clean: boolean;
  manifestOnly: boolean;
  binPermissionFix: boolean;
  transpileOnly: boolean;
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: BuildOptions = {
  skipTypeCheck:
    args.includes('--skip-typecheck') || args.includes('--no-type-check'),
  verbose: args.includes('--verbose'),
  clean: args.includes('--clean'),
  manifestOnly: args.includes('--manifest-only'),
  binPermissionFix:
    args.includes('--fix-permissions') ||
    !args.includes('--no-fix-permissions'), // Default to true
  transpileOnly:
    args.includes('--transpile-only') && !args.includes('--no-transpile-only'),
};

// Handle --clean-only flag
if (args.includes('--clean-only')) {
  options.clean = true;
  options.manifestOnly = true; // Just to skip the build
  logger.info(`${colors.blue}Running clean-only operation...${colors.reset}`);
}

// Root directory of the project
const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const binDir = path.join(rootDir, 'bin');
const manifestPath = path.join(rootDir, 'oclif.manifest.json');

/**
 * Clean the distribution directory
 */
function cleanDist(): void {
  if (options.verbose) {
    logger.info(`${colors.blue}Cleaning dist directory...${colors.reset}`);
  }

  if (fs.existsSync(distDir)) {
    try {
      fs.rmSync(distDir, { recursive: true, force: true });
      logger.info(
        `${colors.green}✓ Successfully cleaned dist directory${colors.reset}`
      );
    } catch (error) {
      logger.error(
        `${colors.red}✗ Failed to clean dist directory:${colors.reset}`,
        error instanceof Error ? error : new Error(String(error))
      );
      process.exit(1);
    }
  } else if (options.verbose) {
    logger.info(
      `${colors.gray}Dist directory does not exist, skipping clean.${colors.reset}`
    );
  }
}

/**
 * Fix permissions for binary files
 */
function fixBinPermissions(): void {
  if (!options.binPermissionFix) return;

  if (options.verbose) {
    logger.info(
      `${colors.blue}Fixing bin directory permissions...${colors.reset}`
    );
  }

  try {
    if (fs.existsSync(binDir)) {
      const binFiles = fs.readdirSync(binDir);

      binFiles.forEach(file => {
        const filePath = path.join(binDir, file);
        if (fs.statSync(filePath).isFile()) {
          try {
            const currentMode = fs.statSync(filePath).mode;
            // Add executable permissions (user, group, others)
            const newMode = currentMode | 0o111;
            fs.chmodSync(filePath, newMode);
            if (options.verbose) {
              logger.info(
                `${colors.green}✓ Fixed permissions for ${filePath}${colors.reset}`
              );
            }
          } catch (error) {
            logger.warn(
              `${colors.yellow}⚠ Could not change permissions for ${filePath}:${colors.reset}`,
              { error: error instanceof Error ? error.message : String(error) }
            );
          }
        }
      });

      logger.info(
        `${colors.green}✓ Successfully updated bin directory permissions${colors.reset}`
      );
    } else {
      logger.warn(
        `${colors.yellow}⚠ Bin directory not found, skipping permission fix${colors.reset}`
      );
    }
  } catch (error) {
    logger.error(
      `${colors.red}✗ Failed to fix bin directory permissions:${colors.reset}`,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Create or touch the OCLIF manifest file
 */
function touchManifest(): void {
  if (options.verbose) {
    logger.info(
      `${colors.blue}Creating/touching manifest file...${colors.reset}`
    );
  }

  try {
    // Create an empty manifest file if it doesn't exist
    if (!fs.existsSync(manifestPath)) {
      fs.writeFileSync(manifestPath, '{}', 'utf8');
    } else {
      // Touch the file (update timestamp) if it already exists
      const now = new Date();
      fs.utimesSync(manifestPath, now, now);
    }
    logger.info(
      `${colors.green}✓ Successfully touched manifest file${colors.reset}`
    );
  } catch (error) {
    logger.error(
      `${colors.red}✗ Failed to create/touch manifest file:${colors.reset}`,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Run the TypeScript compiler with full type checking
 */
function runTypeScriptCompiler(): void {
  if (options.verbose) {
    logger.info(
      `${colors.blue}Running TypeScript compiler with full type checking...${colors.reset}`
    );
  }

  try {
    const tscResult = childProcess.spawnSync('npx', ['tsc', '--skipLibCheck'], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
    });

    if (tscResult.status !== 0) {
      if (options.skipTypeCheck) {
        logger.warn(
          `${colors.yellow}⚠ TypeScript compilation had errors, but continuing due to --skip-typecheck flag${colors.reset}`
        );
      } else {
        logger.error(
          `${colors.red}✗ TypeScript compilation failed${colors.reset}`
        );
        process.exit(1);
      }
    } else {
      logger.info(
        `${colors.green}✓ TypeScript compilation successful${colors.reset}`
      );
    }
  } catch (error) {
    logger.error(
      `${colors.red}✗ Failed to run TypeScript compiler:${colors.reset}`,
      error instanceof Error ? error : new Error(String(error))
    );
    if (!options.skipTypeCheck) {
      process.exit(1);
    }
  }
}

/**
 * Run transpile-only build (faster but skips type checking)
 */
function runTranspileOnly(): void {
  if (options.verbose) {
    logger.info(`${colors.blue}Running transpile-only build...${colors.reset}`);
  }

  // Load tsconfig.json
  const configPath = path.join(rootDir, 'tsconfig.json');
  logger.info(`${colors.gray}Using tsconfig: ${configPath}${colors.reset}`);

  try {
    // Parse the tsconfig.json
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) {
      throw new Error(
        `Error reading tsconfig.json: ${configFile.error.messageText}`
      );
    }

    // Parse the parsed config
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      rootDir
    );

    // Output directory from the config
    const outDir = parsedConfig.options.outDir || path.join(rootDir, 'dist');

    // Make sure the output directory exists
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // Get all source files from the file system
    const getSourceFiles = (dir: string, fileList: string[] = []): string[] => {
      const files = fs.readdirSync(dir);

      files.forEach(file => {
        const filePath = path.join(dir, file);

        if (fs.statSync(filePath).isDirectory()) {
          // Skip node_modules
          if (file === 'node_modules' || file === 'dist' || file === '.git') {
            return;
          }
          fileList = getSourceFiles(filePath, fileList);
        } else if (
          (file.endsWith('.ts') || file.endsWith('.tsx')) &&
          !file.endsWith('.d.ts')
        ) {
          fileList.push(filePath);
        }
      });

      return fileList;
    };

    // Get all TypeScript files in src directory
    const sourceFiles = getSourceFiles(path.join(rootDir, 'apps/cli/src'));
    logger.info(
      `${colors.gray}Transpiling ${sourceFiles.length} files...${colors.reset}`
    );

    // Also include script files
    const scriptFiles = getSourceFiles(path.join(rootDir, 'scripts'));
    const allFiles = [...sourceFiles, ...scriptFiles];

    // Keep track of files processed and errors
    let filesProcessed = 0;
    let errors = 0;

    // Process each source file
    allFiles.forEach(fileName => {
      try {
        // Read the file
        const fileContent = fs.readFileSync(fileName, 'utf8');
        const sourceText = fileContent;

        // Transpile the file (no type checking)
        const { outputText } = ts.transpileModule(sourceText, {
          compilerOptions: {
            ...parsedConfig.options,
            noEmitOnError: false,
            declaration: false,
            skipLibCheck: true,
            target: ts.ScriptTarget.ES2019,
            module: ts.ModuleKind.CommonJS,
            esModuleInterop: true,
          },
          fileName,
          reportDiagnostics: false,
        });

        // Calculate output path
        let outputPath;
        if (fileName.startsWith(path.join(rootDir, 'apps/cli/src'))) {
          outputPath = fileName
            .replace(path.resolve(rootDir, 'apps/cli/src'), path.join(outDir, 'src'))
            .replace(/\.tsx?$/, '.js');
        } else if (fileName.startsWith(path.join(rootDir, 'scripts'))) {
          outputPath = fileName
            .replace(
              path.resolve(rootDir, 'scripts'),
              path.join(outDir, 'scripts')
            )
            .replace(/\.tsx?$/, '.js');
        }

        // Create output directory if it doesn't exist
        if (outputPath) {
          const outputDir = path.dirname(outputPath);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          // Write the transpiled file
          fs.writeFileSync(outputPath, outputText);
        }
        filesProcessed++;

        if (options.verbose && filesProcessed % 10 === 0) {
          logger.info(
            `${colors.gray}Processed ${filesProcessed}/${allFiles.length} files...${colors.reset}`
          );
        }
      } catch (error) {
        logger.error(
          `${colors.red}Error processing ${fileName}:${colors.reset}`,
          error instanceof Error ? error : new Error(String(error))
        );
        errors++;
      }
    });

    logger.info(
      `${colors.green}✓ Build completed with ${filesProcessed} files successfully transpiled and ${errors} errors.${colors.reset}`
    );

    if (errors > 0) {
      logger.warn(
        `${colors.yellow}⚠ There were ${errors} errors during transpilation.${colors.reset}`
      );
    }
  } catch (error) {
    logger.error(
      `${colors.red}✗ Failed to run transpile-only build:${colors.reset}`,
      error instanceof Error ? error : new Error(String(error))
    );
    process.exit(1);
  }
}

/**
 * Main build process
 */
function build(): void {
  logger.info(
    `${colors.magenta}Starting unified build process...${colors.reset}`
  );
  console.time('Build completed in');

  try {
    // Display build options
    if (options.verbose) {
      logger.info(`${colors.cyan}Build options:${colors.reset}`);
      logger.info(`  Skip Type Check: ${options.skipTypeCheck}`);
      logger.info(`  Verbose: ${options.verbose}`);
      logger.info(`  Clean: ${options.clean}`);
      logger.info(`  Manifest Only: ${options.manifestOnly}`);
      logger.info(`  Fix Permissions: ${options.binPermissionFix}`);
      logger.info(`  Transpile Only: ${options.transpileOnly}`);
    }

    // Step 1: Clean if requested
    if (options.clean) {
      cleanDist();
    }

    // Step 2: Generate manifest only if requested
    if (options.manifestOnly) {
      touchManifest();
      logger.info(
        `${colors.green}✓ Manifest-only operation completed successfully${colors.reset}`
      );
      return;
    }

    // Step 3: Build with appropriate method
    if (options.transpileOnly) {
      runTranspileOnly();
    } else {
      runTypeScriptCompiler();
    }

    // Step 4: Fix bin permissions
    fixBinPermissions();

    // Step 5: Create/touch manifest
    touchManifest();

    logger.info(`${colors.green}✓ Build completed successfully${colors.reset}`);
    console.timeEnd('Build completed in');
  } catch (error) {
    logger.error(`${colors.red}✗ Build failed:${colors.reset}`, error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Run the build process
build();
