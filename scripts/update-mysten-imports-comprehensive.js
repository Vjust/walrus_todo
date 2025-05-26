#!/usr/bin/env node

/**
 * Comprehensive @mysten SDK Import Updater
 * 
 * This script updates all @mysten SDK imports to use the correct paths
 * for the new TypeScript version. It handles:
 * 
 * 1. Updating SuiClient imports to use '@mysten/sui/client'
 * 2. Updating Transaction imports to use '@mysten/sui/transactions'
 * 3. Updating BCS imports to use '@mysten/bcs'
 * 4. Updating cryptography imports to use '@mysten/sui/cryptography'
 * 5. Updating keypair imports to use specific paths
 * 6. Fixing deprecated import patterns
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Import mapping for the new SDK structure
const IMPORT_MAPPINGS = [
  // SuiClient imports
  {
    pattern: /import\s+\{\s*([^}]*SuiClient[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/client'"
  },
  {
    pattern: /import\s+\{\s*([^}]*getFullnodeUrl[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/client'"
  },
  
  // Transaction imports
  {
    pattern: /import\s+\{\s*([^}]*Transaction[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/transactions'"
  },
  {
    pattern: /import\s+\{\s*([^}]*TransactionBlock[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/transactions'"
  },
  {
    pattern: /import\s+\{\s*([^}]*TransactionArgument[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/transactions'"
  },
  {
    pattern: /import\s+\{\s*([^}]*TransactionObjectArgument[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/transactions'"
  },
  
  // Cryptography imports
  {
    pattern: /import\s+\{\s*([^}]*Signer[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/cryptography'"
  },
  {
    pattern: /import\s+\{\s*([^}]*PublicKey[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/cryptography'"
  },
  {
    pattern: /import\s+\{\s*([^}]*SignatureScheme[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/cryptography'"
  },
  {
    pattern: /import\s+\{\s*([^}]*IntentScope[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/cryptography'"
  },
  {
    pattern: /import\s+\{\s*([^}]*messageWithIntent[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/cryptography'"
  },
  
  // Keypair imports
  {
    pattern: /import\s+\{\s*([^}]*Ed25519Keypair[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/keypairs/ed25519'"
  },
  {
    pattern: /import\s+\{\s*([^}]*Secp256k1Keypair[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/keypairs/secp256k1'"
  },
  
  // Utils imports
  {
    pattern: /import\s+\{\s*([^}]*toB64[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/utils'"
  },
  {
    pattern: /import\s+\{\s*([^}]*fromB64[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/utils'"
  },
  
  // BCS imports (separate package)
  {
    pattern: /import\s+\{\s*([^}]*BCS[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/bcs'"
  },
  
  // Fix deprecated sui.js imports
  {
    pattern: /@mysten\/sui\.js/g,
    replacement: "@mysten/sui"
  },
  
  // Fix any remaining generic @mysten/sui imports for specific common types
  {
    pattern: /import\s+\{\s*([^}]*SuiObjectRef[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/client'"
  },
  {
    pattern: /import\s+\{\s*([^}]*SuiObjectResponse[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    replacement: "import { $1 } from '@mysten/sui/client'"
  }
];

// More complex transformations that need manual handling
const COMPLEX_TRANSFORMATIONS = [
  {
    // Handle mixed imports that need to be split
    pattern: /import\s+\{\s*([^}]*(?:SuiClient|getFullnodeUrl)[^}]*,\s*[^}]*(?:Transaction|TransactionBlock)[^}]*)\s*\}\s+from\s+['"`]@mysten\/sui['"`]/g,
    handler: (match, imports) => {
      const importItems = imports.split(',').map(item => item.trim());
      const clientImports = [];
      const transactionImports = [];
      const cryptoImports = [];
      const utilImports = [];
      const bcsImports = [];
      const keypairImports = [];
      
      importItems.forEach(item => {
        if (item.includes('SuiClient') || item.includes('getFullnodeUrl') || item.includes('SuiObjectRef') || item.includes('SuiObjectResponse')) {
          clientImports.push(item);
        } else if (item.includes('Transaction') || item.includes('TransactionArgument') || item.includes('TransactionObjectArgument')) {
          transactionImports.push(item);
        } else if (item.includes('Signer') || item.includes('PublicKey') || item.includes('SignatureScheme') || item.includes('IntentScope') || item.includes('messageWithIntent')) {
          cryptoImports.push(item);
        } else if (item.includes('Ed25519Keypair')) {
          keypairImports.push(item);
        } else if (item.includes('toB64') || item.includes('fromB64')) {
          utilImports.push(item);
        } else if (item.includes('BCS')) {
          bcsImports.push(item);
        }
      });
      
      const imports = [];
      if (clientImports.length > 0) {
        imports.push(`import { ${clientImports.join(', ')} } from '@mysten/sui/client'`);
      }
      if (transactionImports.length > 0) {
        imports.push(`import { ${transactionImports.join(', ')} } from '@mysten/sui/transactions'`);
      }
      if (cryptoImports.length > 0) {
        imports.push(`import { ${cryptoImports.join(', ')} } from '@mysten/sui/cryptography'`);
      }
      if (keypairImports.length > 0) {
        imports.push(`import { ${keypairImports.join(', ')} } from '@mysten/sui/keypairs/ed25519'`);
      }
      if (utilImports.length > 0) {
        imports.push(`import { ${utilImports.join(', ')} } from '@mysten/sui/utils'`);
      }
      if (bcsImports.length > 0) {
        imports.push(`import { ${bcsImports.join(', ')} } from '@mysten/bcs'`);
      }
      
      return imports.join('\n');
    }
  }
];

function updateImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let updated = false;

    // Apply simple mappings first
    IMPORT_MAPPINGS.forEach(mapping => {
      const newContent = content.replace(mapping.pattern, mapping.replacement);
      if (newContent !== content) {
        content = newContent;
        updated = true;
      }
    });

    // Apply complex transformations
    COMPLEX_TRANSFORMATIONS.forEach(transformation => {
      const matches = [...content.matchAll(transformation.pattern)];
      matches.forEach(match => {
        const replacement = transformation.handler(match[0], match[1]);
        content = content.replace(match[0], replacement);
        updated = true;
      });
    });

    // Clean up duplicate imports (basic deduplication)
    const lines = content.split('\n');
    const seenImports = new Set();
    const cleanedLines = lines.filter(line => {
      if (line.trim().startsWith('import ') && line.includes('@mysten/')) {
        if (seenImports.has(line.trim())) {
          return false;
        }
        seenImports.add(line.trim());
      }
      return true;
    });
    
    if (cleanedLines.length !== lines.length) {
      content = cleanedLines.join('\n');
      updated = true;
    }

    if (updated) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated imports in: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

async function findAndUpdateFiles() {
  const patterns = [
    'src/**/*.{ts,tsx,js,jsx}',
    'tests/**/*.{ts,tsx,js,jsx}',
    'waltodo-frontend/**/*.{ts,tsx,js,jsx}',
    'scripts/**/*.{ts,tsx,js,jsx}',
    '*.{ts,tsx,js,jsx}'
  ];

  let totalFiles = 0;
  let updatedFiles = 0;

  for (const pattern of patterns) {
    try {
      const files = await glob(pattern, { nodir: true });
      
      for (const file of files) {
        // Skip node_modules and other excluded directories
        if (file.includes('node_modules') || file.includes('.git') || file.includes('dist') || file.includes('build')) {
          continue;
        }
        
        totalFiles++;
        if (updateImportsInFile(file)) {
          updatedFiles++;
        }
      }
    } catch (error) {
      console.error(`Error processing pattern ${pattern}:`, error.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Processed: ${totalFiles} files`);
  console.log(`   Updated: ${updatedFiles} files`);
  
  return { totalFiles, updatedFiles };
}

async function main() {
  console.log('🚀 Starting comprehensive @mysten SDK import update...\n');
  
  const { updatedFiles } = await findAndUpdateFiles();
  
  if (updatedFiles > 0) {
    console.log('\n✨ Import updates completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run `npm run build` to check for any remaining issues');
    console.log('   2. Run `npm test` to verify everything still works');
    console.log('   3. Review the changes and commit them');
  } else {
    console.log('\n✅ No import updates needed - all imports are already using correct paths!');
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { updateImportsInFile, findAndUpdateFiles };