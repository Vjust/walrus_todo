#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get all command files
const commandsDir = path.join(__dirname, 'dist', 'src', 'commands');
const commandFiles = fs.readdirSync(commandsDir)
  .filter(file =>
    file.endsWith('.js') &&
    !file.includes(' 2.js') &&
    !file.includes('.d.ts') &&
    !file.includes('.d.js') &&
    file !== 'index.js'
  );

// Create manifest structure
const manifest = {
  version: '1.0.0',
  commands: {},
  topics: {
    simple: {
      description: 'Simple todo management commands'
    }
  }
};

// Add each command to the manifest
commandFiles.forEach(file => {
  const commandName = path.basename(file, '.js');

  // Skip index.js
  if (commandName === 'index') return;

  // Add command to manifest with proper ID and path
  manifest.commands[commandName] = {
    id: commandName,
    description: `${commandName} command`,
    pluginName: 'waltodo',
    pluginType: 'core',
    aliases: [],
    flags: {},
    args: [],
    // Add the path to the command file
    path: `./dist/src/commands/${commandName}`
  };
});

// Write manifest to file
fs.writeFileSync('oclif.manifest.json', JSON.stringify(manifest, null, 2));
console.log('Generated oclif.manifest.json with', Object.keys(manifest.commands).length, 'commands');
