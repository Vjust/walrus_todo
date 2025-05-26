#!/usr/bin/env ts-node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';


function fixCaseDeclarations() {
  // Read the eslint output to get the exact files and lines
  const files = [
    'tests/fuzz/serialization-fuzzer.test.ts',
    'tests/fuzz/network-retry-fuzzer.test.ts', 
    'tests/fuzz/storage-fuzzer.test.ts',
    'tests/fuzz/transaction-fuzzer.test.ts',
    'tests/helpers/error-simulator.ts',
    'tests/security/InputValidationSecurity.test.ts'
  ];

  for (const file of files) {
    try {
      const filePath = join(process.cwd(), file);
      let content: string = readFileSync(filePath, 'utf8').toString();
      let modified = false;
      
      // Add block scopes for case declarations
      content = content.replace(
        /(case\s+[^:]+:\s*\n\s*)(const|let|function|class)\s/g,
        (match: string, caseStart: string, declaration: string) => {
          modified = true;
          return caseStart.slice(0, -1) + ' {\n' + caseStart.slice(-1) + declaration + ' ';
        }
      );

      // Add closing braces before next case or default or end of switch
      content = content.replace(
        /(\n\s*)((?:case\s+[^:]+:|default:|break;\s*\n\s*}))/g,
        (match, whitespace, nextElement) => {
          if (nextElement.startsWith('case') || nextElement.startsWith('default')) {
            return whitespace + '}\n' + whitespace + nextElement;
          }
          return match;
        }
      );

      if (modified) {
        writeFileSync(filePath, content);
        // Fixed case declarations in file
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }
}

fixCaseDeclarations();