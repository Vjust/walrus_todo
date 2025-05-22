/**
 * MockConfigManager - Manages configuration for AI mocking framework
 */

import * as fs from 'fs';
import * as path from 'path';
import { getScenario } from './scenarios';

interface MockConfig {
  // Provider configuration
  provider: string;
  modelName: string;
  
  // Response templates
  useDefaultTemplates: boolean;
  customTemplates?: Record<string, any>;
  
  // Error simulation
  errorSimulation: {
    enabled: boolean;
    errorType?: MockErrorType;
    probability?: number;
    errorMessage?: string;
    operationTargets?: string[];
  };
  
  // Latency simulation
  latencySimulation: LatencyOptions;
  
  // Recording configuration
  recording: {
    mode: RecordingMode;
    savePath?: string;
    loadPath?: string;
  };
  
  // Active scenarios
  activeScenarios: string[];
}

// Default configuration
const DEFAULT_CONFIG: MockConfig = {
  provider: 'xai',
  modelName: 'grok-beta',
  
  useDefaultTemplates: true,
  
  errorSimulation: {
    enabled: false
  },
  
  latencySimulation: {
    enabled: false,
    minLatencyMs: 100,
    maxLatencyMs: 500,
    jitterEnabled: true,
    timeoutProbability: 0,
    timeoutAfterMs: 30000
  },
  
  recording: {
    mode: RecordingMode.DISABLED
  },
  
  activeScenarios: []
};

export class MockConfigManager {
  private config: MockConfig;
  private configPath?: string;
  
  constructor(configPath?: string) {
    this.config = { ...DEFAULT_CONFIG };
    this.configPath = configPath;
    
    if (configPath) {
      this.loadConfig(configPath);
    }
  }
  
  /**
   * Get current mock configuration
   */
  public getConfig(): MockConfig {
    return { ...this.config };
  }
  
  /**
   * Update the mock configuration
   */
  public updateConfig(updates: Partial<MockConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      // Merge nested objects properly
      errorSimulation: {
        ...this.config.errorSimulation,
        ...(updates.errorSimulation || {})
      },
      latencySimulation: {
        ...this.config.latencySimulation,
        ...(updates.latencySimulation || {})
      },
      recording: {
        ...this.config.recording,
        ...(updates.recording || {})
      }
    };
    
    if (this.configPath) {
      this.saveConfig();
    }
  }
  
  /**
   * Reset configuration to defaults
   */
  public resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
    
    if (this.configPath) {
      this.saveConfig();
    }
  }
  
  /**
   * Load configuration from file
   */
  public loadConfig(configPath: string): boolean {
    try {
      if (!fs.existsSync(configPath)) {
        return false;
      }
      
      const configData = fs.readFileSync(configPath, 'utf8');
      this.config = JSON.parse(configData);
      this.configPath = configPath;
      return true;
    } catch (_error) {
      console.error('Failed to load mock configuration:', error);
      return false;
    }
  }
  
  /**
   * Save configuration to file
   */
  public saveConfig(configPath?: string): boolean {
    const savePath = configPath || this.configPath;
    if (!savePath) {
      return false;
    }
    
    try {
      const dir = path.dirname(savePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(
        savePath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );
      
      this.configPath = savePath;
      return true;
    } catch (_error) {
      console.error('Failed to save mock configuration:', error);
      return false;
    }
  }
  
  /**
   * Generate a MockResponseOptions object from the current config
   */
  public generateMockOptions(): MockResponseOptions {
    // Start with basic provider info
    const options: MockResponseOptions = {
      provider: this.config.provider as any,
      modelName: this.config.modelName
    };
    
    // Add templates if using custom ones
    if (!this.config.useDefaultTemplates && this.config.customTemplates) {
      options.templates = this.config.customTemplates;
    }
    
    // Add error simulation if enabled
    if (this.config.errorSimulation.enabled) {
      options.errors = { ...this.config.errorSimulation };
    }
    
    // Add latency simulation if enabled
    if (this.config.latencySimulation.enabled) {
      options.latency = { ...this.config.latencySimulation };
    }
    
    // Add recording mode
    if (this.config.recording.mode !== RecordingMode.DISABLED) {
      options.recordingMode = this.config.recording.mode;
    }
    
    return options;
  }
  
  /**
   * Apply active scenarios from the configuration
   */
  public applyActiveScenarios(options: MockResponseOptions): MockResponseOptions {
    const result = { ...options };
    
    // Apply each active scenario in order
    for (const scenarioName of this.config.activeScenarios) {
      const scenario = getScenario(scenarioName);
      if (scenario) {
        // Merge the scenario settings with current options
        if (scenario.templates) {
          result.templates = {
            ...(result.templates || {}),
            ...scenario.templates
          };
        }
        
        if (scenario.errors) {
          result.errors = {
            ...(result.errors || { enabled: false }),
            ...scenario.errors
          };
        }
        
        if (scenario.latency) {
          result.latency = {
            ...(result.latency || { enabled: false, minLatencyMs: 0, maxLatencyMs: 0, jitterEnabled: false, timeoutProbability: 0, timeoutAfterMs: 30000 }),
            ...scenario.latency
          };
        }
      }
    }
    
    return result;
  }
  
  /**
   * Add a scenario to active scenarios
   */
  public activateScenario(scenarioName: string): boolean {
    const scenario = getScenario(scenarioName);
    if (!scenario) {
      return false;
    }
    
    if (!this.config.activeScenarios.includes(scenarioName)) {
      this.config.activeScenarios.push(scenarioName);
      
      if (this.configPath) {
        this.saveConfig();
      }
    }
    
    return true;
  }
  
  /**
   * Remove a scenario from active scenarios
   */
  public deactivateScenario(scenarioName: string): boolean {
    const index = this.config.activeScenarios.indexOf(scenarioName);
    if (index === -1) {
      return false;
    }
    
    this.config.activeScenarios.splice(index, 1);
    
    if (this.configPath) {
      this.saveConfig();
    }
    
    return true;
  }
  
  /**
   * Create a default configuration file if it doesn't exist
   */
  public static createDefaultConfig(configPath: string): boolean {
    try {
      if (fs.existsSync(configPath)) {
        return false; // Don't overwrite existing config
      }
      
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(
        configPath,
        JSON.stringify(DEFAULT_CONFIG, null, 2),
        'utf8'
      );
      
      return true;
    } catch (_error) {
      console.error('Failed to create default configuration:', error);
      return false;
    }
  }
}