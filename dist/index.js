#!/usr/bin/env node
"use strict";
const { run } = require('@oclif/core');
run()
    .then(() => { })
    .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
});
