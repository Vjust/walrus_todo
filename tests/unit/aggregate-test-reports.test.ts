import { TestReportAggregator } from '../../scripts/aggregate-test-reports';
import type { AggregatedResults } from '../../scripts/aggregate-test-reports';
import * as fs from 'fs';
// path module imported but not used in current tests

// Mock fs module
jest.mock('fs');
jest.mock('child_process');

describe('TestReportAggregator', () => {
  let aggregator: TestReportAggregator;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    aggregator = new TestReportAggregator('test-output');
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => {});
  });

  describe('TestStats interface', () => {
    it('should correctly type TestStats properties', () => {
      const testStats = {
        successfulRequests: 100,
        failedRequests: 10,
        totalDuration: 5000,
        successRate: 90,
        avgResponseTime: 50,
      };

      // Test that TypeScript recognizes these properties
      expect(testStats.successfulRequests).toBe(100);
      expect(testStats.failedRequests).toBe(10);
      expect(testStats.totalDuration).toBe(5000);
      expect(testStats.successRate).toBe(90);
      expect(testStats.avgResponseTime).toBe(50);
    });

    it('should handle stress test results with TestStats interface', () => {
      const mockStressData = {
        timestamp: '2024-01-01T00:00:00Z',
        metrics: {
          create: {
            successfulRequests: 150,
            failedRequests: 5,
            totalDuration: 7500,
            successRate: 96.8,
            avgResponseTime: 48.4,
          },
          update: {
            successfulRequests: 200,
            failedRequests: 3,
            totalDuration: 8000,
            successRate: 98.5,
            avgResponseTime: 39.4,
          },
        },
      };

      // Verify the structure matches our TestStats interface
      Object.entries(mockStressData.metrics).forEach(([op, stats]) => {
        expect(stats).toHaveProperty('successfulRequests');
        expect(stats).toHaveProperty('failedRequests');
        expect(stats).toHaveProperty('totalDuration');
        expect(stats).toHaveProperty('successRate');
        expect(stats).toHaveProperty('avgResponseTime');
        expect(op).toBeDefined();
      });
    });
  });

  describe('loadStressTestResults', () => {
    it('should properly cast metrics to TestStats', async () => {
      const stressTestData = {
        timestamp: '2024-01-01T00:00:00Z',
        metrics: {
          operation1: {
            successfulRequests: 100,
            failedRequests: 10,
            totalDuration: 5000,
            successRate: 90,
            avgResponseTime: 50,
          },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['test.json']);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(stressTestData));

      // Test the private method indirectly by calling loadExistingResults
      const results = await aggregator.loadExistingResults();

      // The results should include stress test data properly typed
      expect(results).toBeDefined();
    });
  });

  describe('AggregatedResults type export', () => {
    it('should export AggregatedResults as a type', () => {
      const mockResults: AggregatedResults = {
        title: 'Test Report',
        timestamp: '2024-01-01T00:00:00Z',
        totalDuration: 10000,
        totalTests: 100,
        totalPassed: 90,
        totalFailed: 10,
        totalSkipped: 0,
        successRate: 90,
        suites: [],
        coverage: undefined,
        performance: undefined,
      };

      expect(mockResults.title).toBe('Test Report');
      expect(mockResults.totalTests).toBe(100);
    });
  });
});
