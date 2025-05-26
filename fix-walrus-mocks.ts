#!/usr/bin/env npx ts-node

/**
 * Script to fix WalrusClient mock issues in test files
 * 
 * This script:
 * 1. Finds all test files with inline WalrusClient mocks
 * 2. Replaces them with imports and usage of the complete mock
 * 3. Adds the connect method where it's missing
 */

import * as fs from 'fs';

// Files that need to be updated to use the complete mock
const filesToUpdate = [
  'tests/error-handling/storage-errors.test.ts',
  'tests/error-handling/blockchain-errors.test.ts', 
  'tests/unit/ExpiryMonitor.test.ts',
  'tests/unit/ConsolidatedAIService.test.ts',
  'tests/unit/walrus-image-storage.test.ts',
  'tests/integration/blockchain-verification/VerificationFlow.test.ts',
  'tests/integration/blockchain-verification/TodoAIExtension.test.ts',
  'tests/integration/blockchain-verification/CredentialVerificationService.test.ts',
  'tests/utils/ExpiryMonitor.test.ts',
  'tests/commands/complete.test.ts'
];

function addCompleteWalrusClientImport(content: string): string {
  // Check if the import already exists
  if (content.includes('getMockWalrusClient') || content.includes('CompleteWalrusClientMock')) {
    return content;
  }

  // Find existing imports from the types/client module
  const clientImportRegex = /import\s+(?:type\s+)?{[^}]*}\s+from\s+['"][^'"]*\/types\/client['"];?/;
  const clientImportMatch = content.match(clientImportRegex);

  if (clientImportMatch) {
    // Add to existing client import
    const existingImport = clientImportMatch[0];
    const updatedImport = existingImport.replace(
      /}\s+from/, 
      '}\nimport { getMockWalrusClient, type CompleteWalrusClientMock } from \'../../helpers/complete-walrus-client-mock\';\nimport type { WalrusClientExt } from'
    );
    return content.replace(existingImport, updatedImport);
  } else {
    // Add new import after other imports
    const lastImportRegex = /import[^;]+;(?:\s*\/\/[^\n]*)?$/gm;
    const matches = Array.from(content.matchAll(lastImportRegex));
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const insertPos = (lastMatch.index ?? 0) + lastMatch[0].length;
      return content.slice(0, insertPos) + 
        '\nimport { getMockWalrusClient, type CompleteWalrusClientMock } from \'../../helpers/complete-walrus-client-mock\';' +
        content.slice(insertPos);
    }
  }

  return content;
}

function replaceInlineMockWithCompleteMock(content: string): string {
  // Pattern to match inline WalrusClient mock definitions
  const inlineMockPattern = /mockWalrusClient\s*=\s*{[\s\S]*?}\s*as\s+jest\.Mocked<WalrusClientExt>;/g;
  
  return content.replace(inlineMockPattern, (_match) => {
    return `mockWalrusClient = getMockWalrusClient();
    
    // Override specific methods for this test as needed
    // Example: mockWalrusClient.getConfig.mockResolvedValue({ ... });`;
  });
}

function updateMockVariableType(content: string): string {
  // Replace jest.Mocked<WalrusClientExt> with CompleteWalrusClientMock
  return content.replace(
    /let\s+mockWalrusClient:\s*jest\.Mocked<WalrusClientExt>;/g,
    'let mockWalrusClient: CompleteWalrusClientMock;'
  );
}

function updateFile(filePath: string): void {
  // Updating file
  
  if (!fs.existsSync(filePath)) {
    // File does not exist
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Apply transformations
    content = addCompleteWalrusClientImport(content.toString());
    content = updateMockVariableType(content);
    content = replaceInlineMockWithCompleteMock(content);

    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      // Updated successfully
    } else {
      // No changes needed
    }

  } catch (error) {
    // Error updating file
  }
}

function main(): void {
  // Fixing WalrusClient mock issues in test files

  for (const file of filesToUpdate) {
    updateFile(file);
  }

  // Finished updating test files!
  // Next steps:
  // 1. Review the changes in each file
  // 2. Add any test-specific mock overrides as needed
  // 3. Run tests to verify everything works
}

if (require.main === module) {
  main();
}