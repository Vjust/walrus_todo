/**
 * Build helper script
 * 
 * This script runs TypeScript compiler programmatically in transpileOnly mode,
 * which completely skips type checking to generate JavaScript files.
 */
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const root = path.resolve(__dirname, '..');
const tsconfig = path.join(root, 'tsconfig.json');

console.log('Running TypeScript build in transpile-only mode...');
console.log('Using tsconfig:', tsconfig);

// Build command using ttsc (TypeScript with transpileOnly option)
const command = `npx ttypescript --project ${tsconfig} --skipLibCheck`;

console.log('Executing command:', command);

// Execute build command
const child = exec(command);

// Stream output
child.stdout?.pipe(process.stdout);
child.stderr?.pipe(process.stderr);

// Handle completion
child.on('exit', (code) => {
  if (code === 0) {
    console.log('Build completed successfully in transpile-only mode');
    console.log('TypeScript compatibility checking was skipped');
  } else {
    console.error(`Build failed with exit code ${code}`);
    process.exit(code || 1);
  }
});