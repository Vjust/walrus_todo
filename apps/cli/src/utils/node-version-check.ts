// Node.js version compatibility checker
// Ensures the CLI runs on supported Node.js versions

export function checkNodeVersion(): void {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  const minVersion = 18;

  if (majorVersion < minVersion) {
    console.error(`❌ Node.js version ${nodeVersion} is not supported.`);
    console.error(`   Minimum required version: Node.js ${minVersion}.0.0`);
    console.error(`   Current version: ${nodeVersion}`);
    console.error('');
    console.error('Please upgrade Node.js:');
    console.error('  • Visit https://nodejs.org/ to download the latest version');
    console.error('  • Or use a version manager like nvm, fnm, or volta');
    console.error('');
    process.exit(1);
  }

  // Warn for very old versions within the supported range
  if (majorVersion === 18) {
    const minorVersion = parseInt(nodeVersion.split('.')[1], 10);
    if (minorVersion < 12) {
      console.warn(`⚠️  Node.js ${nodeVersion} is supported but older.`);
      console.warn('   Consider upgrading to Node.js 20+ for better performance.');
      console.warn('');
    }
  }
}

export function logCompatibilityInfo(): void {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  
  if (process.env.DEBUG || process.env.VERBOSE) {
    console.log(`🔧 Running on Node.js ${nodeVersion}`);
    
    const features = [];
    
    // Check for native support of features we polyfill
    if (typeof String.prototype.replaceAll !== 'undefined') {
      features.push('String.replaceAll (native)');
    } else {
      features.push('String.replaceAll (polyfilled)');
    }
    
    if (typeof Array.prototype.at !== 'undefined') {
      features.push('Array.at (native)');
    } else {
      features.push('Array.at (polyfilled)');
    }
    
    if (typeof Object.hasOwn !== 'undefined') {
      features.push('Object.hasOwn (native)');
    } else {
      features.push('Object.hasOwn (polyfilled)');
    }
    
    console.log(`   Features: ${features.join(', ')}`);
    console.log('');
  }
}