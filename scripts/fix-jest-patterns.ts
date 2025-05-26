#!/usr/bin/env ts-node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

interface JestError {
  file: string;
  line: number;
  type: 'conditional-expect' | 'jasmine-globals' | 'commented-tests';
  content: string;
}

/**
 * Advanced Jest pattern fixer that targets specific error patterns
 */
class JestPatternFixer {
  private fixedFiles = new Set<string>();
  private errorCount = 0;

  /**
   * Get Jest errors from lint output
   */
  private getJestErrors(): JestError[] {
    try {
      const output = execSync('npm run lint 2>&1', { encoding: 'utf8' });
      const lines = output.split('\n');
      const errors: JestError[] = [];
      
      let currentFile = '';
      
      for (const line of lines) {
        // Extract file path
        if (line.includes('.test.ts') || line.includes('.e2e.ts')) {
          const parts = line.split(':');
          if (parts.length >= 3) {
            currentFile = parts[0] || '';
            const lineNum = parseInt(parts[1] || '0', 10);
            const content = parts.slice(3).join(':');
            
            if (line.includes('jest/no-conditional-expect')) {
              errors.push({
                file: currentFile,
                line: lineNum,
                type: 'conditional-expect',
                content
              });
            } else if (line.includes('jest/no-jasmine-globals')) {
              errors.push({
                file: currentFile,
                line: lineNum,
                type: 'jasmine-globals',
                content
              });
            } else if (line.includes('jest/no-commented-out-tests')) {
              errors.push({
                file: currentFile,
                line: lineNum,
                type: 'commented-tests',
                content
              });
            }
          }
        }
      }
      
      return errors;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting Jest errors:', error);
      return [];
    }
  }

  /**
   * Fix conditional expect patterns
   */
  private fixConditionalExpects(content: string): string {
    // Pattern 1: expects inside try-catch blocks
    const tryPattern = /(try\s*\{[^}]*\}\s*catch\s*\([^)]*\)\s*\{[^}]*expect[^}]*\})/gs;
    
    content = content.replace(tryPattern, (match) => {
      // Extract the try and catch blocks
      const tryMatch = match.match(/try\s*\{([^}]*)\}/s);
      const catchMatch = match.match(/catch\s*\(([^)]*)\)\s*\{([^}]*)\}/s);
      
      if (tryMatch && catchMatch) {
        const tryBlock = tryMatch[1];
        const catchParam = catchMatch[1]?.split(':')[0]?.trim() || 'error';
        const catchBlock = catchMatch[2];
        
        // Move expects outside of catch block
        const expects = catchBlock?.match(/expect\([^;]*;/g) || [];
        const otherCode = catchBlock?.replace(/expect\([^;]*;/g, '').trim() || '';
        
        return `let thrownError: any;
        try {${tryBlock}
          throw new Error('Expected function to throw');
        } catch (${catchMatch[1]}) {
          thrownError = ${catchParam};
          ${otherCode}
        }
        
        expect(thrownError).toBeDefined();
        ${expects.map((exp: string) => exp.replace('expect(', `expect(thrownError).toBeDefined();\n        expect(`)).join('\n        ')}`;
      }
      
      return match;
    });
    
    // Pattern 2: expects inside if blocks
    const ifPattern = /if\s*\([^)]*\)\s*\{[^}]*expect[^}]*\}/gs;
    content = content.replace(ifPattern, (match) => {
      // For if blocks, we need to restructure the test logic
      return match.replace(/if\s*\(([^)]*)\)\s*\{([^}]*)\}/, (_, condition, block) => {
        if (block.includes('expect(')) {
          return `expect(${condition}).toBe(true);
          if (${condition}) {
            ${block}
          }`;
        }
        return match;
      });
    });
    
    return content;
  }

  /**
   * Fix jasmine globals (fail() calls)
   */
  private fixJasmineGlobals(content: string): string {
    // Replace fail() with throw new Error()
    content = content.replace(/fail\(\s*['"`]([^'"`]*)['"`]\s*\)/g, 'throw new Error("$1")');
    content = content.replace(/fail\(\)/g, 'throw new Error("Test failed")');
    
    return content;
  }

  /**
   * Remove commented out tests
   */
  private removeCommentedTests(content: string): string {
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      return !(
        trimmed.startsWith('// it(') ||
        trimmed.startsWith('// test(') ||
        trimmed.startsWith('// describe(') ||
        trimmed.startsWith('//it(') ||
        trimmed.startsWith('//test(') ||
        trimmed.startsWith('//describe(')
      );
    });
    
    return filteredLines.join('\n');
  }

  /**
   * Process a single file
   */
  private fixFile(filePath: string): boolean {
    if (!existsSync(filePath)) {
      // eslint-disable-next-line no-console
      console.log(`File not found: ${filePath}`);
      return false;
    }

    try {
      const fileContent = readFileSync(filePath, 'utf8');
      let content = typeof fileContent === 'string' ? fileContent : fileContent.toString();
      const originalContent = content;

      // Apply all fixes
      content = this.fixConditionalExpects(content);
      content = this.fixJasmineGlobals(content);
      content = this.removeCommentedTests(content);

      if (content !== originalContent) {
        writeFileSync(filePath, content);
        this.fixedFiles.add(filePath);
        // eslint-disable-next-line no-console
        console.log(`✅ Fixed: ${filePath}`);
        return true;
      }

      return false;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`❌ Error fixing ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Fix all Jest pattern errors
   */
  public async fixAllErrors(): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('🔍 Scanning for Jest errors...');
    
    const errors = this.getJestErrors();
    this.errorCount = errors.length;
    
    if (errors.length === 0) {
      // eslint-disable-next-line no-console
      console.log('✅ No Jest errors found!');
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`Found ${errors.length} Jest errors across ${new Set(errors.map(e => e.file)).size} files`);

    // Group by file
    const fileGroups = new Map<string, JestError[]>();
    for (const error of errors) {
      if (!fileGroups.has(error.file)) {
        fileGroups.set(error.file, []);
      }
      fileGroups.get(error.file)?.push(error);
    }

    // eslint-disable-next-line no-console
    console.log('\n🔧 Fixing files...');
    let fixedCount = 0;

    for (const [filePath, fileErrors] of fileGroups) {
      // eslint-disable-next-line no-console
      console.log(`\n📁 ${filePath} (${fileErrors.length} errors)`);
      
      if (this.fixFile(filePath)) {
        fixedCount++;
      }
    }

    // eslint-disable-next-line no-console
    console.log(`\n📊 Summary:`);
    // eslint-disable-next-line no-console
    console.log(`   Files processed: ${fileGroups.size}`);
    // eslint-disable-next-line no-console
    console.log(`   Files fixed: ${fixedCount}`);
    // eslint-disable-next-line no-console
    console.log(`   Total errors addressed: ${this.errorCount}`);

    // Check remaining errors
    // eslint-disable-next-line no-console
    console.log('\n🔍 Checking remaining errors...');
    const remainingErrors = this.getJestErrors();
    
    if (remainingErrors.length === 0) {
      // eslint-disable-next-line no-console
      console.log('🎉 All Jest errors have been fixed!');
    } else {
      // eslint-disable-next-line no-console
      console.log(`⚠️  ${remainingErrors.length} errors still remain and may need manual attention.`);
      
      // Show summary of remaining errors by type
      const errorTypes = remainingErrors.reduce((acc, err) => {
        acc[err.type] = (acc[err.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // eslint-disable-next-line no-console
      console.log('Remaining error types:');
      for (const [type, count] of Object.entries(errorTypes)) {
        // eslint-disable-next-line no-console
        console.log(`   ${type}: ${count}`);
      }
    }
  }
}

// Run the fixer
if (require.main === module) {
  const fixer = new JestPatternFixer();
  // eslint-disable-next-line no-console
  fixer.fixAllErrors().catch(console.error);
}

export default JestPatternFixer;