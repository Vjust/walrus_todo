/* eslint-disable no-console */
/**
 * Script to incrementally enable noImplicitAny for specific directories
 * Run with: npx ts-node scripts/incremental-noImplicitAny.ts [directory]
 *
 * Example: npx ts-node scripts/incremental-noImplicitAny.ts src/types
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { Logger } from '../src/utils/Logger';

const logger = new Logger('incremental-noImplicitAny');

// Get target directory from command line
const targetDir = process.argv[2];

if (!targetDir) {
  logger.error('Please specify a directory to analyze');
  logger.error(
    'Usage: npx ts-node scripts/incremental-noImplicitAny.ts [directory]'
  );
  logger.error(
    'Example: npx ts-node scripts/incremental-noImplicitAny.ts src/types'
  );
  process.exit(1);
}

// Resolve target directory path
const targetDirPath = path.resolve(process.cwd(), targetDir);

// Check if directory exists
if (
  !fs.existsSync(targetDirPath) ||
  !fs.statSync(targetDirPath).isDirectory()
) {
  logger.error(`Directory not found: ${targetDirPath}`);
  process.exit(1);
}

logger.info(`Analyzing directory: ${targetDir}`);

// Load and parse tsconfig.json
const configPath = path.resolve(process.cwd(), 'tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

if (configFile.error) {
  logger.error(`Error reading tsconfig.json: ${configFile.error.messageText}`);
  process.exit(1);
}

// Create a configuration with noImplicitAny enabled for analysis
const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.dirname(configPath)
);

// Override with noImplicitAny enabled
const strictConfig = {
  ...parsedConfig.options,
  noImplicitAny: true,
};

// Get TypeScript files in target directory
const files = glob.sync(path.join(targetDirPath, '**/*.ts'), {
  ignore: ['**/*.d.ts', '**/__mocks__/**/*.ts'],
});

if (files.length === 0) {
  logger.info(`No TypeScript files found in ${targetDir}`);
  process.exit(0);
}

logger.info(`Found ${files.length} TypeScript files to analyze`);

// Create program with files
const program = ts.createProgram(files, strictConfig);

// Get semantic diagnostics
const diagnostics = ts.getPreEmitDiagnostics(program);

// Filter only implicit any diagnostics (error code 7006)
const implicitAnyDiagnostics = diagnostics.filter(
  d =>
    d.code === 7006 || // Parameter has implicit 'any' type
    d.code === 7005 || // Variable has implicit 'any' type
    d.code === 7008 || // Member has implicit 'any' type
    d.code === 7034 // Variable has implicit 'any' type
);

logger.info(
  `Found ${implicitAnyDiagnostics.length} implicit 'any' issues in ${targetDir}`
);

if (implicitAnyDiagnostics.length === 0) {
  logger.info(`Directory ${targetDir} is ready for noImplicitAny!`);

  // Generate a path-specific tsconfig for this directory
  const dirName = path.basename(targetDirPath);
  const tsconfigPath = path.join(targetDirPath, `tsconfig.${dirName}.json`);

  const tsconfigContent = {
    extends: '../../../tsconfig.json',
    compilerOptions: {
      noImplicitAny: true,
    },
    include: ['./**/*.ts'],
  };

  fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfigContent, null, 2));
  logger.info(`Created directory-specific tsconfig at ${tsconfigPath}`);
  process.exit(0);
}

// Group diagnostics by file
const fileIssues = new Map<string, ts.Diagnostic[]>();

implicitAnyDiagnostics.forEach(diagnostic => {
  if (diagnostic.file) {
    const filePath = diagnostic.file.fileName;

    if (!fileIssues.has(filePath)) {
      fileIssues.set(filePath, []);
    }

    const issues = fileIssues.get(filePath);
    if (issues) {
      issues.push(diagnostic);
    }
  }
});

// Print issues by file
logger.info('\nIssues by file:');
fileIssues.forEach((diagnostics, filePath) => {
  const relativePath = path.relative(process.cwd(), filePath);
  logger.info(`\n${relativePath} (${diagnostics.length} issues):`);

  diagnostics.forEach(diagnostic => {
    if (diagnostic.file && diagnostic.start !== undefined) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      );
      logger.info(`  Line ${line + 1}, Col ${character + 1}: ${message}`);
    }
  });
});

// Create incremental progress tracking
interface ProgressData {
  [directory: string]: {
    lastChecked: string;
    fileCount: number;
    issueCount: number;
    fileWithIssues: string[];
  };
}

const progressFile = path.resolve(process.cwd(), 'noImplicitAny-progress.json');
let progressData: ProgressData = {};

if (fs.existsSync(progressFile)) {
  try {
    const fileContent = fs.readFileSync(progressFile, 'utf-8');
    progressData = JSON.parse(typeof fileContent === 'string' ? fileContent : fileContent.toString());
  } catch (error) {
    logger.error(`Error reading progress file: ${error}`);
    progressData = {};
  }
}

// Update progress data
progressData[targetDir] = {
  lastChecked: new Date().toISOString(),
  fileCount: files.length,
  issueCount: implicitAnyDiagnostics.length,
  fileWithIssues: Array.from(fileIssues.keys()).map(filePath =>
    path.relative(process.cwd(), filePath)
  ),
};

// Write progress data
fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2));
logger.info(`\nProgress data updated in ${progressFile}`);

// Generate a report
const reportDir = path.resolve(process.cwd(), 'noImplicitAny-reports');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

const reportPath = path.join(
  reportDir,
  `${path.basename(targetDir)}-report.md`
);
let report = `# noImplicitAny Analysis for ${targetDir}\n\n`;
report += `**Date:** ${new Date().toISOString()}\n\n`;
report += `**Files Analyzed:** ${files.length}\n\n`;
report += `**Total Issues:** ${implicitAnyDiagnostics.length}\n\n`;

report += `## Issues by File\n\n`;
fileIssues.forEach((diagnostics, filePath) => {
  const relativePath = path.relative(process.cwd(), filePath);
  report += `### ${relativePath} (${diagnostics.length} issues)\n\n`;

  diagnostics.forEach(diagnostic => {
    if (diagnostic.file && diagnostic.start !== undefined) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      );
      report += `- Line ${line + 1}, Col ${character + 1}: ${message}\n`;
    }
  });

  report += '\n';
});

report += `## Recommendations\n\n`;
report += `1. Address parameter types first, as they are typically the easiest to fix\n`;
report += `2. Focus on files with fewer issues as quick wins\n`;
report += `3. Create interfaces for common object patterns\n`;
report += `4. Use specific types instead of 'any' where possible\n`;

fs.writeFileSync(reportPath, report);
logger.info(`Report written to ${reportPath}`);
