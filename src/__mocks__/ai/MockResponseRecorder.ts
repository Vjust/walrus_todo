/**
 * MockResponseRecorder - Records and replays AI interactions for testing
 */

import * as fs from 'fs';
import * as path from 'path';
import { RecordedInteraction } from './types';

export class MockResponseRecorder {
  private recordings: RecordedInteraction[] = [];
  private currentReplayIndex: number = 0;
  
  /**
   * Record an API request
   */
  public recordRequest(method: string, promptOrTemplate: any, params: any): string {
    const id = `recording-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    this.recordings.push({
      id,
      timestamp: Date.now(),
      operation: params.operation || 'unknown',
      method,
      request: {
        prompt: promptOrTemplate,
        params
      },
      response: null, // Will be filled later
      provider: params.provider || 'unknown',
      modelName: params.modelName || 'unknown'
    });
    
    return id;
  }
  
  /**
   * Record an API response
   */
  public recordResponse(method: string, response: any): void {
    // Update the most recent recording for this method
    const index = this.recordings.findIndex(r => 
      r.method === method && r.response === null
    );
    
    if (index !== -1) {
      this.recordings[index].response = response;
    }
  }
  
  /**
   * Get all recorded interactions
   */
  public getRecordings(): RecordedInteraction[] {
    return [...this.recordings];
  }
  
  /**
   * Get the next recorded response for replay
   */
  public getNextReplay(method: string, operation: string): any {
    // Find the next recording that matches the method and operation
    const matchingRecordings = this.recordings.filter(
      r => r.method === method && r.operation === operation
    );
    
    if (matchingRecordings.length === 0) {
      return null;
    }
    
    // If we've gone through all recordings, wrap around
    if (this.currentReplayIndex >= matchingRecordings.length) {
      this.currentReplayIndex = 0;
    }
    
    return matchingRecordings[this.currentReplayIndex++].response;
  }
  
  /**
   * Reset the replay counter
   */
  public resetReplay(): void {
    this.currentReplayIndex = 0;
  }
  
  /**
   * Save recordings to a file
   */
  public saveRecordings(filePath?: string): boolean {
    try {
      const defaultDir = path.join(process.cwd(), 'test-recordings');
      const defaultFilename = `ai-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      
      const targetPath = filePath || path.join(defaultDir, defaultFilename);
      
      // Create directory if it doesn't exist
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write the recordings to file
      fs.writeFileSync(
        targetPath,
        JSON.stringify(this.recordings, null, 2),
        'utf8'
      );
      
      return true;
    } catch (_error) {
      console.error('Failed to save recordings:', error);
      return false;
    }
  }
  
  /**
   * Load recordings from a file
   */
  public loadRecordings(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`Recording file not found: ${filePath}`);
        return false;
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      this.recordings = JSON.parse(fileContent);
      this.currentReplayIndex = 0;
      
      return true;
    } catch (_error) {
      console.error('Failed to load recordings:', error);
      return false;
    }
  }
  
  /**
   * Clear all recordings
   */
  public clear(): void {
    this.recordings = [];
    this.currentReplayIndex = 0;
  }
}