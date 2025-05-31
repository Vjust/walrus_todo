#!/usr/bin/env node

/**
 * Deployment script for WalTodo frontend
 * Handles build optimization, asset compression, and deployment
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Configuration
const config = {
  buildDir: '.next',
  publicDir: 'public',
  distDir: 'dist',
  cacheDir: '.cache',
  compressionLevel: 9,
};

// Deployment steps
async function deploy() {
  console.log('🚀 Starting WalTodo frontend deployment...\n');

  try {
    // Step 1: Clean previous builds
    await cleanBuild();

    // Step 2: Run production build
    await runProductionBuild();

    // Step 3: Optimize assets
    await optimizeAssets();

    // Step 4: Generate build metadata
    await generateBuildMetadata();

    // Step 5: Compress assets
    await compressAssets();

    // Step 6: Generate deployment manifest
    await generateManifest();

    // Step 7: Run post-build checks
    await runPostBuildChecks();

    console.log('\n✅ Deployment preparation completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Review the build output in the .next directory');
    console.log('2. Test the production build locally: pnpm start');
    console.log('3. Deploy to your hosting provider');
    console.log('4. Update CDN configuration if applicable');
    console.log('5. Verify all features work in production\n');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Clean previous builds
async function cleanBuild() {
  console.log('🧹 Cleaning previous builds...');
  
  const dirsToClean = [config.buildDir, config.distDir, config.cacheDir];
  
  for (const dir of dirsToClean) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  }
  
  console.log('✓ Clean completed');
}

// Run production build
async function runProductionBuild() {
  console.log('\n🔨 Running production build...');
  
  // Set production environment
  process.env.NODE_ENV = 'production';
  
  try {
    execSync('pnpm run build', { stdio: 'inherit' });
    console.log('✓ Build completed');
  } catch (error) {
    throw new Error('Build failed. Check the error output above.');
  }
}

// Optimize assets
async function optimizeAssets() {
  console.log('\n🎨 Optimizing assets...');
  
  // Optimize images
  console.log('  • Optimizing images...');
  try {
    // Check if sharp is available
    require.resolve('sharp');
    await optimizeImages();
  } catch (e) {
    console.log('  ⚠️  Sharp not available, skipping image optimization');
  }
  
  // Minify JSON files
  console.log('  • Minifying JSON files...');
  await minifyJsonFiles();
  
  console.log('✓ Asset optimization completed');
}

// Optimize images using sharp
async function optimizeImages() {
  const sharp = require('sharp');
  const imageDir = path.join(config.publicDir, 'images');
  
  try {
    const files = await fs.readdir(imageDir);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    
    for (const file of imageFiles) {
      const filePath = path.join(imageDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.size > 100000) { // Only optimize files > 100KB
        const optimized = await sharp(filePath)
          .resize(2048, 2048, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();
        
        if (optimized.length < stats.size) {
          await fs.writeFile(filePath, optimized);
          console.log(`    ✓ Optimized ${file} (${formatBytes(stats.size)} → ${formatBytes(optimized.length)})`);
        }
      }
    }
  } catch (error) {
    console.log('  ⚠️  Error optimizing images:', error.message);
  }
}

// Minify JSON files
async function minifyJsonFiles() {
  const configDir = path.join(config.publicDir, 'config');
  
  try {
    const files = await fs.readdir(configDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    for (const file of jsonFiles) {
      const filePath = path.join(configDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const minified = JSON.stringify(JSON.parse(content));
      
      if (minified.length < content.length) {
        await fs.writeFile(filePath, minified);
        console.log(`    ✓ Minified ${file}`);
      }
    }
  } catch (error) {
    console.log('  ⚠️  Error minifying JSON files:', error.message);
  }
}

// Generate build metadata
async function generateBuildMetadata() {
  console.log('\n📝 Generating build metadata...');
  
  const metadata = {
    version: process.env.npm_package_version || '0.1.0',
    buildTime: new Date().toISOString(),
    commitSha: await getGitCommitSha(),
    branch: await getGitBranch(),
    nodeVersion: process.version,
    environment: 'production',
  };
  
  await fs.writeFile(
    path.join(config.buildDir, 'build-metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  console.log('✓ Build metadata generated');
  console.log(`  • Version: ${metadata.version}`);
  console.log(`  • Commit: ${metadata.commitSha}`);
  console.log(`  • Branch: ${metadata.branch}`);
}

// Get git commit SHA
async function getGitCommitSha() {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch (e) {
    return 'unknown';
  }
}

// Get git branch
async function getGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (e) {
    return 'unknown';
  }
}

// Compress assets
async function compressAssets() {
  console.log('\n🗜️  Compressing assets...');
  
  // Check if compression tools are available
  try {
    execSync('which gzip', { stdio: 'ignore' });
    
    // Compress static assets
    const staticDir = path.join(config.buildDir, 'static');
    if (await fileExists(staticDir)) {
      execSync(`find ${staticDir} -type f \\( -name "*.js" -o -name "*.css" -o -name "*.html" \\) -exec gzip -9 -k {} \\;`);
      console.log('✓ Static assets compressed');
    }
  } catch (e) {
    console.log('⚠️  Gzip not available, skipping compression');
  }
}

// Generate deployment manifest
async function generateManifest() {
  console.log('\n📋 Generating deployment manifest...');
  
  const manifest = {
    name: 'WalTodo Frontend',
    version: process.env.npm_package_version || '0.1.0',
    buildTime: new Date().toISOString(),
    files: [],
  };
  
  // List all build files
  const buildFiles = await listAllFiles(config.buildDir);
  
  for (const file of buildFiles) {
    const stats = await fs.stat(file);
    const hash = await generateFileHash(file);
    
    manifest.files.push({
      path: path.relative(config.buildDir, file),
      size: stats.size,
      hash: hash,
      mtime: stats.mtime.toISOString(),
    });
  }
  
  await fs.writeFile(
    'deployment-manifest.json',
    JSON.stringify(manifest, null, 2)
  );
  
  console.log(`✓ Manifest generated with ${manifest.files.length} files`);
}

// List all files recursively
async function listAllFiles(dir) {
  const files = [];
  
  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  
  await walk(dir);
  return files;
}

// Generate file hash
async function generateFileHash(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 8);
}

// Run post-build checks
async function runPostBuildChecks() {
  console.log('\n🔍 Running post-build checks...');
  
  const checks = [
    checkBuildSize,
    checkRequiredFiles,
    checkEnvironmentVariables,
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    const result = await check();
    if (!result) {
      allPassed = false;
    }
  }
  
  if (!allPassed) {
    console.log('\n⚠️  Some checks failed. Review the warnings above.');
  } else {
    console.log('\n✓ All post-build checks passed');
  }
}

// Check build size
async function checkBuildSize() {
  const stats = await fs.stat(config.buildDir);
  const sizeInMB = await getDirSize(config.buildDir) / 1024 / 1024;
  
  console.log(`  • Build size: ${sizeInMB.toFixed(2)} MB`);
  
  if (sizeInMB > 100) {
    console.log('    ⚠️  Build size is large. Consider optimizing dependencies.');
    return false;
  }
  
  return true;
}

// Get directory size
async function getDirSize(dir) {
  let size = 0;
  const files = await listAllFiles(dir);
  
  for (const file of files) {
    const stats = await fs.stat(file);
    size += stats.size;
  }
  
  return size;
}

// Check required files
async function checkRequiredFiles() {
  const requiredFiles = [
    path.join(config.buildDir, 'build-manifest.json'),
    path.join(config.buildDir, 'routes-manifest.json'),
  ];
  
  let allExist = true;
  
  for (const file of requiredFiles) {
    if (!(await fileExists(file))) {
      console.log(`  ⚠️  Missing required file: ${path.basename(file)}`);
      allExist = false;
    }
  }
  
  return allExist;
}

// Check environment variables
async function checkEnvironmentVariables() {
  const requiredVars = [
    'NEXT_PUBLIC_SUI_NETWORK',
    'NEXT_PUBLIC_WALRUS_AGGREGATOR_URL',
    'NEXT_PUBLIC_WALRUS_PUBLISHER_URL',
  ];
  
  const envFile = await fs.readFile('.env.production', 'utf-8').catch(() => '');
  let allSet = true;
  
  for (const varName of requiredVars) {
    if (!envFile.includes(varName)) {
      console.log(`  ⚠️  Missing environment variable: ${varName}`);
      allSet = false;
    }
  }
  
  return allSet;
}

// Utility functions
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run deployment
deploy().catch(error => {
  console.error('Deployment error:', error);
  process.exit(1);
});