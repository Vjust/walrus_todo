/* eslint-disable no-console */
/**
 * Helper script to apply common fixes for implicit 'any' issues
 * Run with: npx ts-node scripts/fix-common-implicit-any.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { sync as globSync } from 'glob';

interface FileChange {
  file: string;
  original: string;
  updated: string;
  changeCount: number;
}

// Load files to process
const files = globSync(path.join(__dirname, '../src/**/*.ts'), {
  ignore: ['**/*.d.ts', '**/__mocks__/**/*.ts'],
});

// eslint-disable-next-line no-console
process.stdout.write(
  `Processing ${files.length} TypeScript files for common implicit 'any' patterns...\n`
);

const changes: FileChange[] = [];
let totalChanges = 0;

// Common patterns to fix (pattern and replacement)
const patterns = [
  // Function parameters without types in arrow functions
  {
    pattern: /(\([^)]*\))\s*=>/g,
    test: (match: string) => {
      // Check if the parameters already have type annotations
      return !match.includes(':') && match.length > 3;
    },
    fix: (match: string) => {
      // Add 'any' type to parameters
      return match.replace(/(\w+)(?=[,)])/g, '$1: any');
    },
  },
  // Callback parameters in methods like map, filter, reduce
  {
    pattern:
      /\.(map|filter|forEach|reduce|find|findIndex|some|every|sort)\(\s*(?:function\s*\(|\()([^)]*)\)/g,
    test: (match: string, methodName: string, params: string) => {
      // Only apply if parameters don't already have types
      return params.length > 0 && !params.includes(':');
    },
    fix: (match: string, methodName: string, params: string) => {
      // Add 'any' types to array method callbacks
      const typedParams = params
        .split(',')
        .map(p => p.trim())
        .map(p => (p && !p.includes(':') ? `${p}: any` : p))
        .join(', ');

      return match.replace(params, typedParams);
    },
  },
  // Function declarations without return types
  {
    pattern: /function\s+(\w+)\s*\(([^)]*)\)\s*{/g,
    test: (match: string, funcName: string, params: string) => {
      // Only apply if parameters don't already have types
      return params.length > 0 && !params.includes(':');
    },
    fix: (match: string, funcName: string, params: string) => {
      // Add 'any' types to parameters
      const typedParams = params
        .split(',')
        .map(p => p.trim())
        .map(p => (p && !p.includes(':') ? `${p}: any` : p))
        .join(', ');

      return `function ${funcName}(${typedParams}): any {`;
    },
  },
  // Object destructuring without types
  {
    pattern: /const\s+{([^}]*)}\s*=\s*([^;:{]+);/g,
    test: (match: string, props: string) => {
      // Only apply if no type annotation is present
      return !match.includes(':') && props.trim().length > 0;
    },
    fix: (match: string, props: string, source: string) => {
      // Add a type annotation to the destructuring
      return `const {${props}}: any = ${source};`;
    },
  },
  // Array destructuring without types
  {
    pattern: /const\s+\[([^\]]*)\]\s*=\s*([^;:[]+);/g,
    test: (match: string, elements: string) => {
      // Only apply if no type annotation is present
      return !match.includes(':') && elements.trim().length > 0;
    },
    fix: (match: string, elements: string, source: string) => {
      // Add 'any[]' type to array destructuring
      return `const [${elements}]: any[] = ${source};`;
    },
  },
];

// Process each file
files.forEach(filePath => {
  try {
    const relativePath = path.relative(path.resolve(__dirname, '..'), filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    let updated = content;
    let fileChangeCount = 0;

    // Apply each pattern
    patterns.forEach(({ pattern, test, fix }) => {
      updated = updated.replace(pattern, (match, ...args) => {
        // Check if the pattern should be applied
        if (test(match, args[0], args[1])) {
          fileChangeCount++;
          totalChanges++;
          return fix(match, args[0], args[1]);
        }
        return match;
      });
    });

    if (fileChangeCount > 0) {
      changes.push({
        file: relativePath,
        original: content,
        updated,
        changeCount: fileChangeCount,
      });

      // Create a backup of the original file
      const backupPath = `${filePath}.bak`;
      fs.writeFileSync(backupPath, content);

      // Write the updated content
      fs.writeFileSync(filePath, updated);

      process.stdout.write(
        `[${relativePath}] Applied ${fileChangeCount} changes (backup created)\n`
      );
    }
  } catch (error) {
    process.stderr.write(`Error processing ${filePath}: ${error}\n`);
  }
});

// Write change report
const reportPath = path.resolve(__dirname, '../implicit-any-fixes-report.md');
let report = `# Implicit 'any' Automatic Fixes Report\n\n`;
report += `Applied ${totalChanges} automatic fixes across ${changes.length} files.\n\n`;
report += `## Files Changed\n\n`;
report += `| File | Changes Applied |\n`;
report += `| ---- | -------------- |\n`;

changes.forEach(change => {
  report += `| ${change.file} | ${change.changeCount} |\n`;
});

report += `\n## Note\n\n`;
report += `These automatic fixes apply 'any' types as a starting point for fixing implicit 'any' issues.\n`;
report += `You should review these changes and replace 'any' with more specific types where appropriate.\n`;
report += `Backup files with extension '.bak' have been created for all modified files.\n\n`;
report += `To revert changes: \`npx ts-node scripts/revert-implicit-any-fixes.ts\`\n`;

fs.writeFileSync(reportPath, report);

// Create revert script
const revertScriptPath = path.resolve(
  __dirname,
  './revert-implicit-any-fixes.ts'
);
const revertScript = `/**
 * Script to revert changes made by fix-common-implicit-any.ts
 * Run with: npx ts-node scripts/revert-implicit-any-fixes.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { sync as globSync } from 'glob';

// Find all backup files
const backupFiles = globSync(path.join(__dirname, '../src/**/*.ts.bak'));
console.log(\`Found \${backupFiles.length} backup files to restore\`);

let restored = 0;

backupFiles.forEach(backupPath => {
  try {
    const originalPath = backupPath.replace(/\\.bak$/, '');
    const relativePath = path.relative(path.resolve(__dirname, '..'), originalPath);
    
    // Restore the original file
    fs.copyFileSync(backupPath, originalPath);
    
    // Remove the backup file
    fs.unlinkSync(backupPath);
    
    console.log(\`Restored \${relativePath}\`);
    restored++;
  } catch (error) {
    console.error(\`Error restoring \${backupPath}:\`, error);
  }
});

console.log(\`Successfully restored \${restored} files\`);
`;

fs.writeFileSync(revertScriptPath, revertScript);

process.stdout.write(
  `\nApplied ${totalChanges} automatic fixes to ${changes.length} files.\n`
);
process.stdout.write(`Report written to ${reportPath}\n`);
process.stdout.write(`Created revert script at ${revertScriptPath}\n`);
process.stdout.write(
  "\nThese changes add explicit 'any' types as a starting point.\n"
);
process.stdout.write(
  'You should review and replace with more specific types where appropriate.\n'
);
process.stdout.write(
  'To revert changes: npx ts-node scripts/revert-implicit-any-fixes.ts\n'
);
