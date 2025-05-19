/**
 * Script to find and update old storage utility imports
 * This script scans the codebase for old import statements and suggests replacements
 * using the new consolidated storage API.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const importPatterns = [
  {
    old: /import \{.*\} from ['"]\.\.\/utils\/walrus-storage['"]/,
    new: "import { createStorage, TodoStorage } from '../utils/storage'",
    usage: {
      'createWalrusStorage\\((.*)\\)': 'createStorage(\'todo\', undefined, { useMockMode: $1 }) as TodoStorage',
      'new WalrusStorage\\((.*)\\)': 'createStorage(\'todo\', $1) as TodoStorage'
    }
  },
  {
    old: /import \{.*\} from ['"]\.\.\/utils\/walrus-image-storage['"]/,
    new: "import { createStorage, ImageStorage } from '../utils/storage'",
    usage: {
      'createWalrusImageStorage\\((.*)\\)': 'createStorage(\'image\', undefined, { suiClient: $1 }) as ImageStorage',
      'new WalrusImageStorage\\((.*)\\)': 'createStorage(\'image\', undefined, { suiClient: $1 }) as ImageStorage'
    }
  },
  {
    old: /import \{.*\} from ['"]\.\.\/utils\/sui-nft-storage['"]/,
    new: "import { createStorage, NFTStorage } from '../utils/storage'",
    usage: {
      'new SuiNftStorage\\(([^,]*),([^,]*),(.*)\\)': 'createStorage(\'nft\', undefined, { suiClient: $1, signer: $2, packageConfig: $3 }) as NFTStorage'
    }
  },
];

// Find TypeScript/JavaScript files
function findFiles(dir) {
  let results = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      results = results.concat(findFiles(itemPath));
    } else if (stat.isFile() && /\.(ts|js)$/.test(item)) {
      results.push(itemPath);
    }
  }
  
  return results;
}

// Find files that import old storage utilities
function findFilesWithOldImports() {
  console.log('Searching for files with old storage imports...');
  
  const allFiles = findFiles(srcDir);
  const filesWithOldImports = [];
  
  for (const file of allFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      
      for (const pattern of importPatterns) {
        if (pattern.old.test(content)) {
          filesWithOldImports.push({
            file,
            patterns: [pattern]
          });
          break;
        }
      }
    } catch (error) {
      console.error(`Error reading file ${file}:`, error.message);
    }
  }
  
  return filesWithOldImports;
}

// Generate migration suggestions
function generateMigrationSuggestions(files) {
  console.log(`\nFound ${files.length} files with old storage imports.\n`);
  
  if (files.length === 0) {
    return;
  }
  
  console.log('Migration suggestions:');
  console.log('======================\n');
  
  for (const { file, patterns } of files) {
    const content = fs.readFileSync(file, 'utf-8');
    let updatedContent = content;
    
    console.log(`File: ${path.relative(rootDir, file)}`);
    console.log('  Import changes:');
    
    for (const pattern of patterns) {
      const match = content.match(pattern.old);
      if (match) {
        console.log(`    - Replace: ${match[0]}`);
        console.log(`      With:    ${pattern.new}`);
        
        updatedContent = updatedContent.replace(pattern.old, pattern.new);
      }
    }
    
    console.log('  Usage changes:');
    
    for (const pattern of patterns) {
      for (const [oldUsage, newUsage] of Object.entries(pattern.usage)) {
        const regex = new RegExp(oldUsage, 'g');
        let match;
        
        while ((match = regex.exec(content)) !== null) {
          const originalCode = match[0];
          const updatedCode = originalCode.replace(new RegExp(oldUsage), newUsage);
          
          console.log(`    - Replace: ${originalCode}`);
          console.log(`      With:    ${updatedCode}`);
        }
      }
    }
    
    console.log('\n');
  }
  
  console.log('For each file, update the imports and usage patterns as shown above.');
  console.log('Remember to adjust the configuration parameters based on the specific needs of each file.');
}

// Main
function main() {
  console.log('Storage Import Migration Tool');
  console.log('============================\n');
  
  const files = findFilesWithOldImports();
  generateMigrationSuggestions(files);
  
  console.log('\nTo convert all files, add the --convert flag.');
}

main();