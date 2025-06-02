#!/usr/bin/env node

/**
 * Config Embedding Script for Static Export
 * 
 * This script embeds configuration files into the config-loader.ts at build time
 * to make Next.js static export work properly. The configs are embedded as literal
 * objects so they don't require runtime fetch() calls.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_LOADER_PATH = path.join(__dirname, '..', 'src', 'lib', 'config-loader.ts');
const CONFIG_DIR = path.join(__dirname, '..', 'public', 'config');

/**
 * Load all available config files
 */
function loadConfigFiles() {
  const configs = {};
  
  if (!fs.existsSync(CONFIG_DIR)) {
    console.warn('Config directory not found:', CONFIG_DIR);
    return configs;
  }
  
  const configFiles = fs.readdirSync(CONFIG_DIR).filter(file => file.endsWith('.json'));
  
  for (const file of configFiles) {
    const network = path.basename(file, '.json');
    const configPath = path.join(CONFIG_DIR, file);
    
    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      configs[network] = config;
      console.log(`✓ Loaded config for ${network}`);
    } catch (error) {
      console.warn(`✗ Failed to load config for ${network}:`, error.message);
    }
  }
  
  return configs;
}

/**
 * Embed configs into the config-loader.ts file
 */
function embedConfigs() {
  const configs = loadConfigFiles();
  
  if (!fs.existsSync(CONFIG_LOADER_PATH)) {
    console.error('Config loader file not found:', CONFIG_LOADER_PATH);
    process.exit(1);
  }
  
  let configLoaderContent = fs.readFileSync(CONFIG_LOADER_PATH, 'utf8');
  
  // Find the EMBEDDED_CONFIGS object and replace it
  const embedConfigsRegex = /const EMBEDDED_CONFIGS: Record<string, any> = \{[^}]*\};/s;
  
  const embeddedConfigsCode = `const EMBEDDED_CONFIGS: Record<string, any> = ${JSON.stringify(configs, null, 2)};`;\n  \n  if (embedConfigsRegex.test(configLoaderContent)) {\n    configLoaderContent = configLoaderContent.replace(embedConfigsRegex, embeddedConfigsCode);\n    console.log('✓ Replaced existing embedded configs');\n  } else {\n    console.error('✗ Could not find EMBEDDED_CONFIGS pattern in config-loader.ts');\n    process.exit(1);\n  }\n  \n  // Write the updated file\n  fs.writeFileSync(CONFIG_LOADER_PATH, configLoaderContent);\n  \n  console.log(`✓ Embedded ${Object.keys(configs).length} network configs`);\n  console.log('Networks:', Object.keys(configs).join(', '));\n}\n\n/**\n * Restore the original empty EMBEDDED_CONFIGS for development\n */\nfunction restoreConfigs() {\n  if (!fs.existsSync(CONFIG_LOADER_PATH)) {\n    console.error('Config loader file not found:', CONFIG_LOADER_PATH);\n    process.exit(1);\n  }\n  \n  let configLoaderContent = fs.readFileSync(CONFIG_LOADER_PATH, 'utf8');\n  \n  const embedConfigsRegex = /const EMBEDDED_CONFIGS: Record<string, any> = \{[^}]*\};/s;\n  const emptyEmbeddedConfigsCode = 'const EMBEDDED_CONFIGS: Record<string, any> = {};';\n  \n  if (embedConfigsRegex.test(configLoaderContent)) {\n    configLoaderContent = configLoaderContent.replace(embedConfigsRegex, emptyEmbeddedConfigsCode);\n    fs.writeFileSync(CONFIG_LOADER_PATH, configLoaderContent);\n    console.log('✓ Restored empty embedded configs for development');\n  } else {\n    console.warn('Could not find EMBEDDED_CONFIGS pattern - file may already be clean');\n  }\n}\n\n// Main execution\nif (require.main === module) {\n  const command = process.argv[2];\n  \n  if (command === 'restore') {\n    restoreConfigs();\n  } else {\n    embedConfigs();\n  }\n}\n\nmodule.exports = { embedConfigs, restoreConfigs };