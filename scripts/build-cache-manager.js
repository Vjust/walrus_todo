/**
 * Build cache manager for optimizing build performance
 * Implements file hashing and incremental builds
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const buildConfig = require('./unified-build-config');

// Caching system
class BuildCacheManager {
  constructor(options = {}) {
    this.enabled = options.enabled ?? buildConfig.optimization.cacheEnabled;
    this.cacheDir = options.cacheDir ?? buildConfig.optimization.cacheDirectory;
    this.cacheFile = path.join(this.cacheDir, 'file-hashes.json');
    this.rootDir = process.cwd();
    this.fileHashes = {};
    
    // Create cache directory if it doesn't exist
    if (this.enabled && !fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    
    // Load existing cache
    this.loadCache();
  }
  
  /**
   * Load the cache from disk
   */
  loadCache() {
    if (!this.enabled) return;
    
    try {
      if (fs.existsSync(this.cacheFile)) {
        const cacheContent = fs.readFileSync(this.cacheFile, 'utf8');
        this.fileHashes = JSON.parse(cacheContent);
        console.log(`Loaded build cache with ${Object.keys(this.fileHashes).length} entries`);
      } else {
        this.fileHashes = {};
        console.log('No existing build cache found. Starting fresh.');
      }
    } catch (error) {
      console.warn(`Warning: Failed to load build cache: ${error.message}`);
      this.fileHashes = {};
    }
  }
  
  /**
   * Save the cache to disk
   */
  saveCache() {
    if (!this.enabled) return;
    
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.fileHashes, null, 2), 'utf8');
      console.log(`Saved build cache with ${Object.keys(this.fileHashes).length} entries`);
    } catch (error) {
      console.warn(`Warning: Failed to save build cache: ${error.message}`);
    }
  }
  
  /**
   * Calculate hash for a file
   * @param {string} filePath - Path to the file
   * @returns {string} - Hash of the file contents
   */
  calculateFileHash(filePath) {
    try {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      return crypto.createHash('md5').update(fileContents).digest('hex');
    } catch (error) {
      console.warn(`Warning: Failed to calculate hash for ${filePath}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Check if a file has changed since last build
   * @param {string} filePath - Path to the file
   * @returns {boolean} - True if the file has changed or is new
   */
  hasFileChanged(filePath) {
    if (!this.enabled) return true;
    
    const currentHash = this.calculateFileHash(filePath);
    if (!currentHash) return true;
    
    const previousHash = this.fileHashes[filePath];
    return !previousHash || previousHash !== currentHash;
  }
  
  /**
   * Update the hash for a file
   * @param {string} filePath - Path to the file
   */
  updateFileHash(filePath) {
    if (!this.enabled) return;
    
    const currentHash = this.calculateFileHash(filePath);
    if (currentHash) {
      this.fileHashes[filePath] = currentHash;
    }
  }
  
  /**
   * Get a list of files that have changed since the last build
   * @param {string[]} filePaths - List of file paths to check
   * @returns {string[]} - List of files that have changed
   */
  getChangedFiles(filePaths) {
    if (!this.enabled) return filePaths;
    
    return filePaths.filter(filePath => this.hasFileChanged(filePath));
  }
  
  /**
   * Clear the cache
   */
  clearCache() {
    if (!this.enabled) return;
    
    this.fileHashes = {};
    if (fs.existsSync(this.cacheFile)) {
      fs.unlinkSync(this.cacheFile);
    }
    console.log('Build cache cleared');
  }
}

module.exports = BuildCacheManager;