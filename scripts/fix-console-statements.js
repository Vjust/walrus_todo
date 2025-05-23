#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const replacements = [
  // console.log -> logger.info
  {
    pattern: /console\.log\s*\(/g,
    replacement: () => 'logger.info('
  },
  // console.error -> logger.error
  {
    pattern: /console\.error\s*\(/g,
    replacement: () => 'logger.error('
  },
  // console.warn -> logger.warn
  {
    pattern: /console\.warn\s*\(/g,
    replacement: () => 'logger.warn('
  },
  // console.info -> logger.info
  {
    pattern: /console\.info\s*\(/g,
    replacement: () => 'logger.info('
  },
  // console.debug -> logger.debug
  {
    pattern: /console\.debug\s*\(/g,
    replacement: () => 'logger.debug('
  }
];

// Files to skip
const skipPatterns = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.min.js',
  '**/coverage/**',
  '**/Logger.ts', // Skip the Logger file itself
  '**/fix-console-statements.js', // Skip this script
  '**/fix-console-statements.ts' // Skip the TypeScript version
];

// Check if file needs Logger import
function needsLoggerImport(content) {
  return content.includes('logger.') && !content.includes('import { Logger }') && !content.includes('import Logger');
}

// Add Logger import to file
function addLoggerImport(content, filePath) {
  const isTest = filePath.includes('.test.') || filePath.includes('.spec.');
  const isCommand = filePath.includes('/commands/') && !isTest;
  
  // For command files, we should use this.log() instead
  if (isCommand) {
    return content;
  }
  
  // Find the right place to add import
  const lines = content.split('\n');
  let importIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import') || lines[i].startsWith('const') || lines[i].startsWith('require')) {
      importIndex = i + 1;
    } else if (lines[i].trim() !== '' && !lines[i].startsWith('//') && !lines[i].startsWith('/*')) {
      if (importIndex === 0) importIndex = i;
      break;
    }
  }
  
  const importPath = calculateImportPath(filePath);
  const componentName = path.basename(filePath, path.extname(filePath));
  const importStatement = `import { Logger } from '${importPath}';\n\nconst logger = new Logger('${componentName}');`;
  
  lines.splice(importIndex, 0, importStatement);
  return lines.join('\n');
}

// Calculate relative import path for Logger
function calculateImportPath(filePath) {
  const loggerPath = path.join(process.cwd(), 'src/utils/Logger');
  const fileDir = path.dirname(filePath);
  let relativePath = path.relative(fileDir, loggerPath);
  
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  
  return relativePath.replace(/\\/g, '/');
}

// Process command files differently
function processCommandFile(content) {
  let modified = content;
  
  // In command files, replace console with this.log/this.error/this.warn
  modified = modified.replace(/console\.log\s*\(/g, 'this.log(');
  modified = modified.replace(/console\.error\s*\(/g, 'this.error(');
  modified = modified.replace(/console\.warn\s*\(/g, 'this.warn(');
  modified = modified.replace(/console\.info\s*\(/g, 'this.log(');
  modified = modified.replace(/console\.debug\s*\(/g, 'this.log(');
  
  return modified;
}

// Process test files differently
function processTestFile(content) {
  let modified = content;
  
  // In test files, we might want to remove console statements or use jest mocks
  // For now, let's comment them out
  modified = modified.replace(/console\.(log|error|warn|info|debug)\s*\([^)]*\);?/g, (match) => {
    return `// ${match} // Removed console statement`;
  });
  
  return modified;
}

// Process a single file
async function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = content;
    let hasChanges = false;
    
    // Skip if file already has eslint-disable-next-line no-console comments
    if (content.includes('eslint-disable-next-line no-console')) {
      return false;
    }
    
    const isTest = filePath.includes('.test.') || filePath.includes('.spec.');
    const isCommand = filePath.includes('/commands/') && !isTest;
    const isFrontend = filePath.includes('/waltodo-frontend/');
    const isScript = filePath.includes('/scripts/');
    const isBin = filePath.includes('/bin/');
    
    // Skip frontend files for now (they might use different logging)
    if (isFrontend) {
      return false;
    }
    
    // Check if file has console statements
    const hasConsole = /console\.(log|error|warn|info|debug)/.test(content);
    if (!hasConsole) {
      return false;
    }
    
    if (isCommand) {
      modified = processCommandFile(content);
    } else if (isTest) {
      modified = processTestFile(content);
    } else if (isScript || isBin) {
      // For scripts and bin files, keep console but add eslint-disable comment
      modified = content.replace(/console\.(log|error|warn|info|debug)\s*\(/g, (match) => {
        return `// eslint-disable-next-line no-console\n    ${match}`;
      });
    } else {
      // Regular files: replace console with logger
      for (const { pattern, replacement } of replacements) {
        if (pattern.test(modified)) {
          modified = modified.replace(pattern, replacement);
          hasChanges = true;
        }
      }
      
      // Add Logger import if needed
      if (hasChanges && needsLoggerImport(modified)) {
        modified = addLoggerImport(modified, filePath);
      }
    }
    
    if (modified !== content) {
      fs.writeFileSync(filePath, modified);
      console.log(`✓ Fixed: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

// Main function
async function main() {
  console.log('Fixing console statements in TypeScript and JavaScript files...\n');
  
  const files = await glob('**/*.{ts,js}', {
    ignore: skipPatterns,
    absolute: true
  });
  
  console.log(`Found ${files.length} files to check\n`);
  
  let fixedCount = 0;
  for (const file of files) {
    if (await processFile(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✨ Fixed ${fixedCount} files`);
}

// Run the script
main().catch(console.error);