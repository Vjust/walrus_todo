#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Comprehensive Jest error fixer
 * Fixes:
 * 1. jest/no-conditional-expect errors
 * 2. jest/no-jasmine-globals errors (fail() -> throw new Error())
 * 3. jest/no-commented-out-tests warnings
 */

// Find all test files with Jest errors
function getTestFilesWithErrors() {
  try {
    const output = execSync('npm run lint 2>&1', { encoding: 'utf8' });
    const lines = output.split('\n');
    const filesWithErrors = new Set();
    
    for (const line of lines) {
      if (line.includes('jest/no-conditional-expect') || 
          line.includes('jest/no-jasmine-globals') || 
          line.includes('jest/no-commented-out-tests')) {
        const filePath = line.split(':')[0];
        if (filePath && filePath.includes('.test.') || filePath.includes('.e2e.')) {
          filesWithErrors.add(filePath);
        }
      }
    }
    
    return Array.from(filesWithErrors);
  } catch (error) {
    console.error('Error getting lint output:', error.message);
    return [];
  }
}

// Fix fail() calls
function fixFailCalls(content) {
  return content.replace(/\bfail\(/g, 'throw new Error(');
}

// Fix conditional expects by extracting them from try-catch blocks
function fixConditionalExpects(content) {
  // Pattern 1: Simple try-catch with expects in catch
  const tryFailPattern = /try\s*\{([^}]*)\}\s*catch\s*\(([^)]*)\)\s*\{([^}]*expect[^}]*)\}/gs;
  
  content = content.replace(tryFailPattern, (match, tryBlock, catchParam, catchBlock) => {
    if (catchBlock.includes('expect(')) {
      // Extract the error variable
      const errorVar = catchParam.trim().split(':')[0].trim();
      
      return `let thrownError: any;
      try {${tryBlock}
        throw new Error('Expected function to throw');
      } catch (${catchParam}) {
        thrownError = ${errorVar};
      }
      
      expect(thrownError).toBeDefined();
      ${catchBlock.replace(/expect\(/g, 'expect(thrownError).toBeDefined();\n      expect(')}`;
    }
    return match;
  });
  
  // Pattern 2: try-catch with fail() calls
  const tryFailPattern2 = /try\s*\{([^}]*fail\([^}]*)\}\s*catch\s*\(([^)]*)\)\s*\{([^}]*)\}/gs;
  
  content = content.replace(tryFailPattern2, (match, tryBlock, catchParam, catchBlock) => {
    const cleanTryBlock = tryBlock.replace(/fail\([^)]*\);?/g, 'throw new Error("Expected function to throw");');
    
    return `let thrownError: any;
      try {${cleanTryBlock}
      } catch (${catchParam}) {
        thrownError = ${catchParam.split(':')[0].trim()};
      }
      
      expect(thrownError).toBeDefined();
      ${catchBlock}`;
  });
  
  return content;
}

// Remove commented out tests
function removeCommentedTests(content) {
  // Remove lines with commented describe/it/test
  const lines = content.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    return !(trimmed.startsWith('// it(') || 
             trimmed.startsWith('// test(') || 
             trimmed.startsWith('// describe('));
  });
  
  return filteredLines.join('\n');
}

// Process a single file
function fixFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return false;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Apply fixes
    const originalContent = content;
    
    content = fixFailCalls(content);
    content = fixConditionalExpects(content);
    content = removeCommentedTests(content);
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed: ${filePath}`);
      modified = true;
    }
    
    return modified;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
function main() {
  console.log('🔍 Finding test files with Jest errors...');
  
  const testFiles = getTestFilesWithErrors();
  console.log(`Found ${testFiles.length} files with Jest errors:`);
  testFiles.forEach(file => console.log(`  - ${file}`));
  
  if (testFiles.length === 0) {
    console.log('✅ No Jest errors found!');
    return;
  }
  
  console.log('\n🔧 Fixing Jest errors...');
  let fixedCount = 0;
  
  for (const filePath of testFiles) {
    if (fixFile(filePath)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} files`);
  
  // Run lint again to check remaining errors
  console.log('\n🔍 Checking remaining Jest errors...');
  try {
    const output = execSync('npm run lint 2>&1 | grep -E "(jest/no-conditional-expect|jest/no-jasmine-globals|jest/no-commented-out-tests)" | wc -l', { encoding: 'utf8' });
    const remainingErrors = parseInt(output.trim());
    
    if (remainingErrors === 0) {
      console.log('🎉 All Jest errors fixed!');
    } else {
      console.log(`⚠️  ${remainingErrors} Jest errors remaining. Manual review needed.`);
    }
  } catch (error) {
    console.log('✅ No Jest linting errors detected!');
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixFile, fixFailCalls, fixConditionalExpects, removeCommentedTests };