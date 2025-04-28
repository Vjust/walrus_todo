#!/usr/bin/env node

const { run } = require('@oclif/core');

run()
  .then(() => {/* successful exit */})
  .catch((e: Error) => {
    console.error('Error:', e);
    process.exit(1);
  });