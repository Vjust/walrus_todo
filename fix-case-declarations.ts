#!/usr/bin/env ts-node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface CaseFixPattern {
  file: string;
  line: number;
  pattern: string;
  replacement: string;
}

const patterns: CaseFixPattern[] = [
  {
    file: 'tests/fuzz/serialization-fuzzer.test.ts',
    line: 84,
    pattern: 'case \'truncated\':\n              const validBuffer',
    replacement: 'case \'truncated\': {\n              const validBuffer'
  },
  {
    file: 'tests/fuzz/serialization-fuzzer.test.ts', 
    line: 193,
    pattern: 'case \'malformed\':\n              const malformedData',
    replacement: 'case \'malformed\': {\n              const malformedData'
  },
  {
    file: 'tests/fuzz/serialization-fuzzer.test.ts',
    line: 290,
    pattern: 'case \'injection\':\n              const injectionData',
    replacement: 'case \'injection\': {\n              const injectionData'
  },
  {
    file: 'tests/fuzz/serialization-fuzzer.test.ts',
    line: 303,
    pattern: 'case \'overflow\':\n              const overflowBuffer',
    replacement: 'case \'overflow\': {\n              const overflowBuffer'
  },
  {
    file: 'tests/fuzz/serialization-fuzzer.test.ts',
    line: 437,
    pattern: 'case \'large\':\n              const largeTodo',
    replacement: 'case \'large\': {\n              const largeTodo'
  },
  {
    file: 'tests/fuzz/serialization-fuzzer.test.ts',
    line: 452,
    pattern: 'case \'special\':\n              const specialTodo',
    replacement: 'case \'special\': {\n              const specialTodo'
  },
  {
    file: 'tests/fuzz/serialization-fuzzer.test.ts',
    line: 556,
    pattern: 'case \'malformed\':\n              const malformedInput',
    replacement: 'case \'malformed\': {\n              const malformedInput'
  },
  {
    file: 'tests/fuzz/serialization-fuzzer.test.ts',
    line: 568,
    pattern: 'case \'truncated\':\n              const validJson',
    replacement: 'case \'truncated\': {\n              const validJson'
  }
];

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
      let content = readFileSync(filePath, 'utf8');
      let modified = false;
      
      // Add block scopes for case declarations
      content = content.replace(
        /(case\s+[^:]+:\s*\n\s*)(const|let|function|class)\s/g,
        (match, caseStart, declaration) => {
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
        console.log(`Fixed case declarations in ${file}`);
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }
}

fixCaseDeclarations();