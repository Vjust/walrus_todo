#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔧 Systematic ESLint unused variable fixer');

// Get all unused variable errors
console.log('📊 Getting unused variable errors...');
const lintOutput = execSync('pnpm run lint 2>&1 || true', { encoding: 'utf8' });
const unusedVarErrors = lintOutput
  .split('\n')
  .filter(line => line.includes('@typescript-eslint/no-unused-vars'))
  .map(line => {
    const match = line.match(/^(.+?):(\d+):(\d+)\s+error\s+(.+?)\s+@typescript-eslint\/no-unused-vars/);
    if (match) {
      return {
        file: match[1].trim(),
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        message: match[4].trim()
      };
    }
    return null;
  })
  .filter(Boolean);

console.log(`Found ${unusedVarErrors.length} unused variable errors`);

// Group by file
const errorsByFile = {};
unusedVarErrors.forEach(error => {
  if (!errorsByFile[error.file]) {
    errorsByFile[error.file] = [];
  }
  errorsByFile[error.file].push(error);
});

console.log(`Across ${Object.keys(errorsByFile).length} files`);

// Process files with simple import removals first
let fixedCount = 0;
for (const [filePath, errors] of Object.entries(errorsByFile)) {
  if (filePath.includes('demo-') || filePath.includes('test') || filePath.includes('__mocks__')) {
    console.log(`\n🔧 Processing ${filePath}...`);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Process unused imports (line-based fixes)
      for (const error of errors.sort((a, b) => b.line - a.line)) { // Process from bottom to top
        if (error.message.includes('is defined but never used') && error.line <= lines.length) {
          const line = lines[error.line - 1];
          
          // Simple import removal for obvious cases
          if (line.trim().startsWith('import ') && !line.includes('{')) {
            // Full import line removal
            console.log(`  Removing unused import: ${line.trim()}`);
            lines.splice(error.line - 1, 1);
            fixedCount++;
          } else if (line.includes('import') && line.includes('{')) {
            // Destructured import - try to remove the specific unused import
            const unusedVar = error.message.match(/'(.+?)'/)?.[1];
            if (unusedVar && line.includes(unusedVar)) {
              console.log(`  Removing unused destructured import: ${unusedVar}`);
              
              // Simple pattern: remove the unused variable from destructured imports
              let newLine = line.replace(new RegExp(`\\b${unusedVar}\\b,?\\s*`, 'g'), '');
              newLine = newLine.replace(/,\s*}/, ' }'); // Clean up trailing commas
              newLine = newLine.replace(/{\s*,/, '{ '); // Clean up leading commas
              newLine = newLine.replace(/{\s*}/, ''); // Remove empty destructures
              
              if (newLine.includes('{}') || newLine.match(/import\s*{\s*}\s*from/)) {
                // If destructure is now empty, remove the entire import
                lines.splice(error.line - 1, 1);
              } else {
                lines[error.line - 1] = newLine;
              }
              fixedCount++;
            }
          }
        }
      }
      
      // Write back if changes were made  
      if (fixedCount > 0) {
        fs.writeFileSync(filePath, lines.join('\n'));
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  }
}

console.log(`\n✅ Fixed ${fixedCount} unused variable errors`);
console.log('🏁 Done! Run "pnpm run lint" to see remaining errors.');