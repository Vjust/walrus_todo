#!/bin/bash

# Increase Node memory limit
export NODE_OPTIONS="--max-old-space-size=8192"

# Run only Walrus upload related tests
npx jest \
  src/__tests__/walrus-image-storage.test.ts \
  src/__tests__/integration/commands.test.ts \
  --testNamePattern="should upload|should store|should create NFT" \
  --no-cache \
  --runInBand