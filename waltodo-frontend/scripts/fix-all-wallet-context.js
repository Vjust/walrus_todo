#!/usr/bin/env node
/**
 * Script to fix all useWalletContext destructuring issues
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const sourceDir = path.join(__dirname, '..', 'src');

// Find all TypeScript/React files
const files = glob.sync('**/*.{ts,tsx}', { cwd: sourceDir });

const destructuringPattern = /const\s*\{\s*([^}]+)\s*\}\s*=\s*useWalletContext\(\)/g;

files.forEach(file => {
  const filePath = path.join(sourceDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('useWalletContext()')) {
    // Replace destructuring patterns with safe access
    content = content.replace(destructuringPattern, (match, destructuredVars) => {
      const vars = destructuredVars.split(',').map(v => v.trim().split(':')[0].trim());
      const walletContextLine = 'const walletContext = useWalletContext();';
      const safeAccessLines = vars.map(varName => {
        if (varName.includes(' as ')) {
          const [original, alias] = varName.split(' as ').map(s => s.trim());
          return `  const ${alias} = walletContext?.${original} || null;`;
        }
        return `  const ${varName} = walletContext?.${varName} || ${getDefaultValue(varName)};`;
      });
      
      return walletContextLine + '\n' + safeAccessLines.join('\n');
    });
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${file}`);
  }
});

function getDefaultValue(varName) {
  switch (varName) {
    case 'connected':
    case 'connecting':
      return 'false';
    case 'connect':
    case 'disconnect':
    case 'clearError':
    case 'resetSession':
    case 'resetActivityTimer':
    case 'openModal':
    case 'closeModal':
      return '(() => {})';
    case 'transactionHistory':
      return '[]';
    case 'lastActivity':
      return '0';
    case 'sessionExpired':
    case 'isModalOpen':
      return 'false';
    default:
      return 'null';
  }
}

console.log('All wallet context issues fixed!');