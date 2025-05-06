import { Hook } from '@oclif/core';

// This hook is called when the CLI is initialized
const hook: Hook<'init'> = async function (_options) { // Renamed unused options to _options
  // You can do any initialization here
  // For example, you can check if the user is logged in
  // or if the configuration is valid
  // console.log('Initializing CLI...');
};

export default hook;
