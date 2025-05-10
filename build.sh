#!/bin/bash

# Modern build.sh that forwards to the enhanced Node.js based build system
# This script is just for backward compatibility with any existing workflows

# Make the enhanced build script executable
chmod +x ./scripts/enhanced-run-build.js

# Forward all arguments to the enhanced Node.js build script
node ./scripts/enhanced-run-build.js "$@"