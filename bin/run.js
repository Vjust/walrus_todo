#!/usr/bin/env node

const { run, flush, handle } = require('@oclif/core');

// Process any -h flags to convert them to --help
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-h') {
    args[i] = '--help';
  }
}
process.argv = [...process.argv.slice(0, 2), ...args];

run()
  .then(flush)
  .catch(handle);