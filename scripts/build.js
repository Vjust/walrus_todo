#!/usr/bin/env node

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function build() {
  console.log('🔨 Building waltodo...\n');
  
  const startTime = performance.now();
  
  try {
    // Ensure dist directory exists
    await fs.mkdir(join(rootDir, 'dist'), { recursive: true });
    
    // Build configuration
    const buildOptions = {
      entryPoints: [join(rootDir, 'src/index.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: join(rootDir, 'dist/index.js'),
      sourcemap: true,
      external: [
        // Don't bundle node_modules - mark all dependencies as external
        'chalk',
        'commander',
        'inquirer',
        'ora',
        'uuid',
        'cli-table3',
        'axios',
        '@mysten/sui.js',
        '@mysten/wallet-standard',
        'node:*',
        'fs',
        'path',
        'url',
        'util',
        'crypto',
        'stream',
        'events',
        'os',
        'child_process',
        'http',
        'https',
        'net',
        'tls',
        'zlib',
        'querystring',
        'string_decoder',
        'buffer',
        'assert',
        'process',
        'console',
        'timers',
        'perf_hooks'
      ],
      minify: process.env.NODE_ENV === 'production',
      keepNames: true,
      metafile: true,
      treeShaking: true,
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
      loader: {
        '.ts': 'ts',
        '.js': 'js',
        '.json': 'json'
      },
      define: {
        'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
        'global': 'globalThis'
      }
    };
    
    // Run build
    const result = await esbuild.build(buildOptions);
    
    // Make the output executable
    const outputPath = join(rootDir, 'dist/index.js');
    await fs.chmod(outputPath, '755');
    
    // Add shebang to the output file
    const content = await fs.readFile(outputPath, 'utf8');
    if (!content.startsWith('#!/usr/bin/env node')) {
      await fs.writeFile(outputPath, '#!/usr/bin/env node\n' + content);
    }
    
    // Calculate build time
    const buildTime = ((performance.now() - startTime) / 1000).toFixed(2);
    
    // Get output size
    const stats = await fs.stat(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    
    // Analyze metafile for more details
    const analysis = await esbuild.analyzeMetafile(result.metafile, {
      verbose: false,
    });
    
    console.log('✅ Build completed successfully!\n');
    console.log(`📦 Output: ${outputPath}`);
    console.log(`📏 Size: ${sizeKB} KB`);
    console.log(`⏱️  Time: ${buildTime}s`);
    console.log(`🗺️  Source maps: enabled`);
    
    if (process.env.VERBOSE) {
      console.log('\n📊 Build analysis:\n');
      console.log(analysis);
    }
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run build
build().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});