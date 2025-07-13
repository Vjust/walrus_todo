/**
 * Config module exports
 * 
 * This module provides configuration management functionality
 * for the waltodo application.
 */

// Configuration types and utilities
export {
  WaltodoConfig,
  defaultConfig,
  getConfigPath,
  getDataPath,
  ConfigManager,
  getConfig,
  updateConfig
} from './manager.js';