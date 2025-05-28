import { test, expect } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';
import { CLIExecutor } from '../helpers/cli-executor';
import { FrontendHelpers } from '../helpers/frontend-helpers';

/**
 * Performance Testing with Lighthouse
 * Validates frontend performance, CLI response times, and WebSocket latency
 */

interface LighthouseResults {
  performance: number;
  accessibility: number;
  'best-practices': number;
  seo: number;
  'first-contentful-paint': number;
  'largest-contentful-paint': number;
  'cumulative-layout-shift': number;
}

test.describe('Performance Testing', () => {
  let cli: CLIExecutor;

  test.beforeAll(async () => {
    cli = new CLIExecutor();
  });

  test('Frontend Lighthouse audit meets performance thresholds', async ({ page, context }) => {
    // Configure for performance testing
    await context.addInitScript(() => {
      // Disable animations for consistent performance measurement
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0.01s !important;
          animation-delay: -0.01s !important;
          transition-duration: 0.01s !important;
          transition-delay: -0.01s !important;
        }
      `;
      document.head.appendChild(style);
    });

    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Run Lighthouse audit
    const results = await playAudit({
      page,
      port: 9222,
      thresholds: {
        performance: 75,        // Minimum 75% performance score
        accessibility: 85,      // Minimum 85% accessibility score
        'best-practices': 80,   // Minimum 80% best practices score
        'first-contentful-paint': 2000,  // Max 2 seconds FCP
        'largest-contentful-paint': 3000, // Max 3 seconds LCP
        'cumulative-layout-shift': 0.1,   // Max 0.1 CLS
      },
      opts: {
        chromeFlags: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    // Additional custom performance checks
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        totalLoadTime: navigation.loadEventEnd - navigation.fetchStart,
      };
    });

    // Validate custom metrics
    expect(performanceMetrics.domContentLoaded).toBeLessThan(1000); // DOM ready in <1s
    expect(performanceMetrics.totalLoadTime).toBeLessThan(3000);    // Total load <3s

    console.log('📊 Lighthouse Performance Results:', {
      performance: results.performance,
      fcp: results['first-contentful-paint'],
      lcp: results['largest-contentful-paint'],
      cls: results['cumulative-layout-shift']
    });

    console.log('📊 Custom Performance Metrics:', performanceMetrics);
  });

  test('CLI command response times are within acceptable limits', async () => {
    const commands = [
      { cmd: 'list', args: ['--format', 'json'], maxTime: 2000 },
      { cmd: 'add', args: ['Performance Test Todo', 'Testing CLI performance'], maxTime: 3000 },
      { cmd: 'config', args: ['--format', 'json'], maxTime: 1000 },
      { cmd: 'status', args: ['--format', 'json'], maxTime: 1500 },
    ];

    const results = [];

    for (const { cmd, args, maxTime } of commands) {
      const startTime = Date.now();
      
      try {
        await cli.expectSuccess(cmd, args);
        const responseTime = Date.now() - startTime;
        
        expect(responseTime).toBeLessThan(maxTime);
        
        results.push({
          command: `${cmd} ${args.join(' ')}`,
          responseTime,
          threshold: maxTime,
          passed: responseTime < maxTime
        });
        
      } catch (error) {
        console.warn(`⚠️ Command failed: ${cmd} ${args.join(' ')}`);
        results.push({
          command: `${cmd} ${args.join(' ')}`,
          responseTime: Date.now() - startTime,
          threshold: maxTime,
          passed: false,
          error: String(error)
        });
      }
    }

    // Report all results
    console.log('⚡ CLI Performance Results:');
    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.command}: ${result.responseTime}ms (max: ${result.threshold}ms)`);
    });

    // Ensure at least 80% of commands meet performance thresholds
    const passedCommands = results.filter(r => r.passed).length;
    const successRate = passedCommands / results.length;
    expect(successRate).toBeGreaterThanOrEqual(0.8);
  });

  test('WebSocket latency is within acceptable range', async ({ page }) => {
    const frontend = new FrontendHelpers(page);
    
    // Navigate and establish WebSocket connection
    await page.goto('/');
    await frontend.waitForAppReady();
    
    // Set up WebSocket latency measurement
    const latencyMeasurements: number[] = [];
    
    await page.evaluate(() => {
      // Hook into WebSocket to measure latency
      const originalSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function(data) {
        const timestamp = Date.now();
        
        // Store timestamp for correlation
        if (typeof data === 'string') {
          try {
            const message = JSON.parse(data);
            message._clientTimestamp = timestamp;
            data = JSON.stringify(message);
          } catch {
            // Not JSON, continue with original data
          }
        }
        
        return originalSend.call(this, data);
      };

      // Measure response latency
      (window as any).wsLatencyMeasurements = [];
    });

    // Trigger WebSocket events by creating todos via CLI
    const todoTitles = [
      `WS Latency Test 1 ${Date.now()}`,
      `WS Latency Test 2 ${Date.now()}`,
      `WS Latency Test 3 ${Date.now()}`
    ];

    for (const title of todoTitles) {
      const cliStartTime = Date.now();
      
      await cli.expectSuccess('add', [title, 'WebSocket latency test']);
      
      // Wait for todo to appear in frontend
      await frontend.waitForTodoByTitle(title, 5000);
      
      const frontendEndTime = Date.now();
      const endToEndLatency = frontendEndTime - cliStartTime;
      
      latencyMeasurements.push(endToEndLatency);
      
      // Wait between requests to avoid overwhelming the system
      await page.waitForTimeout(500);
    }

    // Analyze latency measurements
    if (latencyMeasurements.length > 0) {
      const avgLatency = latencyMeasurements.reduce((a, b) => a + b, 0) / latencyMeasurements.length;
      const maxLatency = Math.max(...latencyMeasurements);
      const minLatency = Math.min(...latencyMeasurements);

      // Performance thresholds
      expect(avgLatency).toBeLessThan(2000);  // Average <2 seconds
      expect(maxLatency).toBeLessThan(5000);  // Max <5 seconds
      expect(minLatency).toBeLessThan(3000);  // Min <3 seconds

      console.log('🔄 WebSocket Latency Results:', {
        average: `${avgLatency.toFixed(2)}ms`,
        min: `${minLatency}ms`,
        max: `${maxLatency}ms`,
        measurements: latencyMeasurements.length
      });
    } else {
      console.warn('⚠️ No WebSocket latency measurements captured');
    }
  });

  test('Frontend handles bulk operations without performance degradation', async ({ page }) => {
    const frontend = new FrontendHelpers(page);
    
    await page.goto('/');
    await frontend.waitForAppReady();
    
    // Start performance monitoring
    await frontend.startPerformanceMonitoring();
    
    // Create baseline performance measurement
    const baselineMetrics = await frontend.getPerformanceMetrics();
    
    // Create bulk todos via CLI
    const bulkSize = 20;
    const todoTitles = Array.from({ length: bulkSize }, (_, i) => 
      `Bulk Performance Test ${i + 1} ${Date.now()}`
    );
    
    const bulkStartTime = Date.now();
    
    // Create todos in batches to simulate real usage
    const batchSize = 5;
    for (let i = 0; i < todoTitles.length; i += batchSize) {
      const batch = todoTitles.slice(i, i + batchSize);
      
      const batchPromises = batch.map(title => 
        cli.expectSuccess('add', [title, 'Bulk performance test'])
      );
      
      await Promise.all(batchPromises);
      
      // Wait for batch to appear in frontend
      for (const title of batch) {
        await frontend.waitForTodoByTitle(title, 3000);
      }
      
      // Small delay between batches
      await page.waitForTimeout(200);
    }
    
    const bulkEndTime = Date.now();
    const totalBulkTime = bulkEndTime - bulkStartTime;
    
    // Get final performance metrics
    const finalMetrics = await frontend.getPerformanceMetrics();
    
    // Analyze performance impact
    const memoryIncrease = finalMetrics.memoryUsage - baselineMetrics.memoryUsage;
    const renderTimeIncrease = finalMetrics.avgRenderTime - baselineMetrics.avgRenderTime;
    
    // Performance thresholds
    expect(totalBulkTime).toBeLessThan(30000);           // Complete bulk in <30s
    expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Memory increase <20MB
    expect(renderTimeIncrease).toBeLessThan(50);         // Render time increase <50ms
    expect(finalMetrics.avgRenderTime).toBeLessThan(150); // Absolute render time <150ms
    
    // Verify all todos are present
    const finalTodoCount = await frontend.getTodoCount();
    expect(finalTodoCount).toBeGreaterThanOrEqual(bulkSize);
    
    console.log('📈 Bulk Operations Performance:', {
      totalTime: `${totalBulkTime}ms`,
      todosProcessed: bulkSize,
      avgTimePerTodo: `${(totalBulkTime / bulkSize).toFixed(2)}ms`,
      memoryIncrease: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
      renderTimeIncrease: `${renderTimeIncrease.toFixed(2)}ms`
    });
  });

  test('Page load performance with existing data', async ({ page }) => {
    // Pre-populate with data
    const dataSize = 50;
    for (let i = 0; i < dataSize; i++) {
      await cli.expectSuccess('add', [
        `Pre-existing Todo ${i + 1}`,
        `Data for load test ${Date.now()}`
      ]);
    }
    
    // Measure page load performance with data
    const startTime = Date.now();
    
    await page.goto('/');
    
    // Wait for todos to be fully loaded and rendered
    await page.waitForSelector('[data-testid="todo-item"]', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Verify todos are loaded
    const loadedTodoCount = await page.locator('[data-testid="todo-item"]').count();
    expect(loadedTodoCount).toBeGreaterThan(0);
    
    // Performance thresholds for loaded app
    expect(loadTime).toBeLessThan(5000); // Load with data <5 seconds
    
    // Check for layout shifts during load
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let cls = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
              cls += (entry as any).value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        
        setTimeout(() => {
          observer.disconnect();
          resolve(cls);
        }, 2000);
      });
    });
    
    expect(cls).toBeLessThan(0.1); // Cumulative Layout Shift <0.1
    
    console.log('🚀 Page Load Performance with Data:', {
      loadTime: `${loadTime}ms`,
      todosLoaded: loadedTodoCount,
      cumulativeLayoutShift: cls.toFixed(4)
    });
  });
});