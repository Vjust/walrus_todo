#!/bin/bash

# A simple wrapper for the standalone AI todo command
echo -e "\n===== AI Todo Helper =====\n"

# Change to the project directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Run the standalone AI command
node ai-todo.js "$@"