/**
 * Stress Test Report Generator
 * 
 * This utility generates HTML and text reports from stress test metrics.
 * It can be used to visualize performance data and identify bottlenecks.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../src/utils/Logger';

const logger = new Logger('StressTestReportGenerator');

export interface StressTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  timeouts: number;
  rateLimitHits: number;
  networkErrors: number;
  otherErrors: number;
  totalDuration: number;
  requestsPerSecond: number;
  concurrentRequestsMax: number;
}

export interface ResourceUsagePoint {
  timestamp: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    user: number;
    system: number;
  };
}

export interface SystemInfo {
  [key: string]: string | number;
}

export interface HtmlReportOptions {
  title?: string;
  outputPath?: string;
  includeCharts?: boolean;
}

export interface TextReportOptions {
  title?: string;
  detailed?: boolean;
}

export interface ReportPackageOptions {
  title?: string;
  outputDir?: string;
  includeCharts?: boolean;
}

export class StressTestReportGenerator {
  /**
   * Generate an HTML report from stress test metrics
   */
  static generateHtmlReport(
    metrics: Record<string, StressTestMetrics>,
    resourceUsage: ResourceUsagePoint[] = [],
    systemInfo: SystemInfo = {},
    options: HtmlReportOptions = {}
  ): string {
    const title = options.title || 'AI Service Stress Test Report';
    const includeCharts = options.includeCharts !== false;

    // Format timestamp
    // const _timestamp = new Date().toISOString();
    const formattedDate = new Date().toLocaleString();

    // Calculate overall statistics
    const totalRequests = Object.values(metrics).reduce(
      (sum, m) => sum + m.totalRequests,
      0
    );
    const successfulRequests = Object.values(metrics).reduce(
      (sum, m) => sum + m.successfulRequests,
      0
    );
    const failedRequests = Object.values(metrics).reduce(
      (sum, m) => sum + m.failedRequests,
      0
    );
    const successRate =
      totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

    // Calculate average response times for each operation
    const avgResponseTimes = Object.keys(metrics)
      .map(op => ({
        operation: op,
        avgTime: metrics[op].avgResponseTime,
      }))
      .sort((a, b) => a.avgTime - b.avgTime);

    // Generate the HTML content
    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }
            h1, h2, h3 {
                color: #2c3e50;
            }
            .summary {
                background-color: #f8f9fa;
                border-radius: 5px;
                padding: 15px;
                margin-bottom: 20px;
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
            }
            .summary-item {
                flex: 1;
                min-width: 200px;
                margin: 10px;
            }
            .metrics-table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            .metrics-table th, .metrics-table td {
                border: 1px solid #ddd;
                padding: 12px;
                text-align: left;
            }
            .metrics-table th {
                background-color: #f2f2f2;
            }
            .metrics-table tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            .chart-container {
                display: flex;
                flex-wrap: wrap;
                margin: 20px 0;
            }
            .chart {
                flex: 1;
                min-width: 500px;
                height: 300px;
                margin: 15px;
            }
            .success-rate {
                font-size: 1.2em;
                font-weight: bold;
                color: ${successRate > 90 ? '#2ecc71' : successRate > 70 ? '#f39c12' : '#e74c3c'};
            }
            .resource-chart {
                width: 100%;
                height: 300px;
                margin: 20px 0;
            }
            .percentile-bar {
                display: flex;
                height: 20px;
                margin: 10px 0;
                background-color: #ecf0f1;
                border-radius: 4px;
                overflow: hidden;
            }
            .percentile-segment {
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 12px;
                text-shadow: 0 0 2px rgba(0,0,0,0.5);
            }
            .system-info {
                background-color: #f8f9fa;
                border-radius: 5px;
                padding: 15px;
                margin-bottom: 20px;
            }
            .system-info ul {
                list-style-type: none;
                padding: 0;
            }
            .system-info li {
                margin-bottom: 5px;
            }
        </style>
    </head>
    <body>
        <h1>${title}</h1>
        <p>Generated on ${formattedDate}</p>
        
        <div class="summary">
            <div class="summary-item">
                <h3>Overall Statistics</h3>
                <p>Total Requests: <strong>${totalRequests}</strong></p>
                <p>Successful Requests: <strong>${successfulRequests}</strong></p>
                <p>Failed Requests: <strong>${failedRequests}</strong></p>
                <p>Success Rate: <span class="success-rate">${successRate.toFixed(2)}%</span></p>
            </div>
            <div class="summary-item">
                <h3>Test Configuration</h3>
                <p>Operations Tested: <strong>${Object.keys(metrics).length}</strong></p>
                <p>Total Duration: <strong>${(Math.max(...Object.values(metrics).map(m => m.totalDuration)) / 1000).toFixed(2)}s</strong></p>
            </div>
            <div class="summary-item">
                <h3>Performance Ranking</h3>
                <ol>
                    ${avgResponseTimes
                      .map(
                        item =>
                          `<li><strong>${item.operation}</strong>: ${item.avgTime.toFixed(2)}ms</li>`
                      )
                      .join('')}
                </ol>
            </div>
        </div>
        
        ${
          Object.keys(systemInfo).length > 0
            ? `
        <h2>System Information</h2>
        <div class="system-info">
            <ul>
                ${Object.entries(systemInfo)
                  .map(
                    ([key, value]) =>
                      `<li><strong>${key}:</strong> ${value}</li>`
                  )
                  .join('')}
            </ul>
        </div>
        `
            : ''
        }
        
        <h2>Operation Metrics</h2>
        <table class="metrics-table">
            <thead>
                <tr>
                    <th>Operation</th>
                    <th>Requests</th>
                    <th>Success</th>
                    <th>Failed</th>
                    <th>Success Rate</th>
                    <th>Avg Time (ms)</th>
                    <th>Min Time (ms)</th>
                    <th>Max Time (ms)</th>
                    <th>Timeouts</th>
                    <th>Rate Limits</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(metrics)
                  .map(
                    ([operation, data]) => `
                <tr>
                    <td>${operation}</td>
                    <td>${data.totalRequests}</td>
                    <td>${data.successfulRequests}</td>
                    <td>${data.failedRequests}</td>
                    <td>${data.totalRequests > 0 ? ((data.successfulRequests / data.totalRequests) * 100).toFixed(2) : 0}%</td>
                    <td>${data.avgResponseTime.toFixed(2)}</td>
                    <td>${data.minResponseTime === Number.MAX_SAFE_INTEGER ? 'N/A' : data.minResponseTime}</td>
                    <td>${data.maxResponseTime}</td>
                    <td>${data.timeouts}</td>
                    <td>${data.rateLimitHits}</td>
                </tr>
                `
                  )
                  .join('')}
            </tbody>
        </table>
        
        <h2>Response Time Percentiles</h2>
        ${Object.entries(metrics)
          .map(
            ([operation, data]) => `
        <h3>${operation}</h3>
        <div class="percentile-bar">
            <div class="percentile-segment" style="width: 50%; background-color: #3498db;" title="P50: ${data.p50ResponseTime}ms">
                P50: ${data.p50ResponseTime}ms
            </div>
            <div class="percentile-segment" style="width: 40%; background-color: #f39c12;" title="P90: ${data.p90ResponseTime}ms">
                P90: ${data.p90ResponseTime}ms
            </div>
            <div class="percentile-segment" style="width: 5%; background-color: #e67e22;" title="P95: ${data.p95ResponseTime}ms">
                P95
            </div>
            <div class="percentile-segment" style="width: 5%; background-color: #e74c3c;" title="P99: ${data.p99ResponseTime}ms">
                P99
            </div>
        </div>
        `
          )
          .join('')}
    `;

    // Include charts if enabled
    if (includeCharts) {
      html += `
        <h2>Performance Charts</h2>
        <div class="chart-container">
            <div id="responseTimeChart" class="chart"></div>
            <div id="successRateChart" class="chart"></div>
        </div>
        
        ${
          resourceUsage.length > 0
            ? `
        <h2>Resource Usage</h2>
        <div id="memoryUsageChart" class="resource-chart"></div>
        <div id="cpuUsageChart" class="resource-chart"></div>
        `
            : ''
        }
        
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Response Time Chart
            const responseTimeCtx = document.getElementById('responseTimeChart').getContext('2d');
            new Chart(responseTimeCtx, {
                type: 'bar',
                data: {
                    labels: ${JSON.stringify(Object.keys(metrics))},
                    datasets: [
                        {
                            label: 'Average Response Time (ms)',
                            data: ${JSON.stringify(Object.values(metrics).map(m => m.avgResponseTime))},
                            backgroundColor: 'rgba(54, 162, 235, 0.5)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'P95 Response Time (ms)',
                            data: ${JSON.stringify(Object.values(metrics).map(m => m.p95ResponseTime))},
                            backgroundColor: 'rgba(255, 159, 64, 0.5)',
                            borderColor: 'rgba(255, 159, 64, 1)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Response Time (ms)'
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Response Times by Operation'
                        }
                    }
                }
            });
            
            // Success Rate Chart
            const successRateCtx = document.getElementById('successRateChart').getContext('2d');
            new Chart(successRateCtx, {
                type: 'pie',
                data: {
                    labels: ['Successful', 'Failed', 'Timeouts', 'Rate Limits'],
                    datasets: [{
                        data: [
                            ${successfulRequests},
                            ${
                              failedRequests -
                              Object.values(metrics).reduce(
                                (sum, m) => sum + m.timeouts,
                                0
                              ) -
                              Object.values(metrics).reduce(
                                (sum, m) => sum + m.rateLimitHits,
                                0
                              )
                            },
                            ${Object.values(metrics).reduce((sum, m) => sum + m.timeouts, 0)},
                            ${Object.values(metrics).reduce((sum, m) => sum + m.rateLimitHits, 0)}
                        ],
                        backgroundColor: [
                            'rgba(46, 204, 113, 0.7)',
                            'rgba(231, 76, 60, 0.7)',
                            'rgba(241, 196, 15, 0.7)',
                            'rgba(155, 89, 182, 0.7)'
                        ],
                        borderColor: [
                            'rgba(46, 204, 113, 1)',
                            'rgba(231, 76, 60, 1)',
                            'rgba(241, 196, 15, 1)',
                            'rgba(155, 89, 182, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Request Outcomes'
                        },
                        legend: {
                            position: 'right'
                        }
                    }
                }
            });
            
            ${
              resourceUsage.length > 0
                ? `
            // Memory Usage Chart
            const memoryData = ${JSON.stringify(
              resourceUsage.map(point => ({
                x: point.timestamp,
                rss: point.memory.rss / 1024 / 1024,
                heapTotal: point.memory.heapTotal / 1024 / 1024,
                heapUsed: point.memory.heapUsed / 1024 / 1024,
              }))
            )};
            
            const memoryCtx = document.getElementById('memoryUsageChart').getContext('2d');
            new Chart(memoryCtx, {
                type: 'line',
                data: {
                    datasets: [
                        {
                            label: 'RSS (MB)',
                            data: memoryData.map(point => ({x: point.x, y: point.rss})),
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.1)',
                            fill: true
                        },
                        {
                            label: 'Heap Used (MB)',
                            data: memoryData.map(point => ({x: point.x, y: point.heapUsed})),
                            borderColor: 'rgba(255, 99, 132, 1)',
                            backgroundColor: 'rgba(255, 99, 132, 0.1)',
                            fill: true
                        },
                        {
                            label: 'Heap Total (MB)',
                            data: memoryData.map(point => ({x: point.x, y: point.heapTotal})),
                            borderColor: 'rgba(75, 192, 192, 1)',
                            backgroundColor: 'rgba(75, 192, 192, 0.1)',
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        x: {
                            type: 'linear',
                            title: {
                                display: true,
                                text: 'Time'
                            },
                            ticks: {
                                callback: function(value) {
                                    return Math.round((value - ${resourceUsage[0]?.timestamp || 0}) / 1000) + 's';
                                }
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Memory (MB)'
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Memory Usage During Test'
                        }
                    }
                }
            });
            `
                : ''
            }
        });
        </script>
      `;
    }

    html += `
    </body>
    </html>
    `;

    // Save the report if an output path is provided
    if (options.outputPath) {
      fs.writeFileSync(options.outputPath, html);
    }

    return html;
  }

  /**
   * Generate a text-based report for command line output
   */
  static generateTextReport(
    metrics: Record<string, StressTestMetrics>,
    options: TextReportOptions = {}
  ): string {
    const title = options.title || 'AI Service Stress Test Report';
    const detailed = options.detailed !== false;

    // Format timestamp
    const formattedDate = new Date().toLocaleString();

    // Calculate overall statistics
    const totalRequests = Object.values(metrics).reduce(
      (sum, m) => sum + m.totalRequests,
      0
    );
    const successfulRequests = Object.values(metrics).reduce(
      (sum, m) => sum + m.successfulRequests,
      0
    );
    const failedRequests = Object.values(metrics).reduce(
      (sum, m) => sum + m.failedRequests,
      0
    );
    const successRate =
      totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

    // Build the text report
    let report = `
${title}
${'='.repeat(title.length)}
Generated on ${formattedDate}

SUMMARY
-------
Total Requests: ${totalRequests}
Successful: ${successfulRequests} (${successRate.toFixed(2)}%)
Failed: ${failedRequests}
Duration: ${(Math.max(...Object.values(metrics).map(m => m.totalDuration)) / 1000).toFixed(2)}s
Operations: ${Object.keys(metrics).join(', ')}

OPERATIONS PERFORMANCE
---------------------`;

    // Sort operations by average response time
    const sortedOps = Object.keys(metrics).sort(
      (a, b) => metrics[a].avgResponseTime - metrics[b].avgResponseTime
    );

    for (const op of sortedOps) {
      const m = metrics[op];
      const opSuccessRate =
        m.totalRequests > 0
          ? (m.successfulRequests / m.totalRequests) * 100
          : 0;

      report += `\n${op}:
  Requests: ${m.totalRequests}
  Success Rate: ${opSuccessRate.toFixed(2)}%
  Avg Response: ${m.avgResponseTime.toFixed(2)}ms
  Min/Max: ${m.minResponseTime === Number.MAX_SAFE_INTEGER ? 'N/A' : m.minResponseTime}ms / ${m.maxResponseTime}ms
  P95 Response: ${m.p95ResponseTime}ms`;

      if (detailed) {
        report += `
  Timeouts: ${m.timeouts}
  Rate Limits: ${m.rateLimitHits}
  Network Errors: ${m.networkErrors}
  Other Errors: ${m.otherErrors}
  Concurrent Max: ${m.concurrentRequestsMax}
  Requests/sec: ${m.requestsPerSecond.toFixed(2)}`;
      }
    }

    return report;
  }

  /**
   * Generate a CSV export of the metrics
   */
  static generateCsvReport(metrics: Record<string, StressTestMetrics>): string {
    // Define CSV header
    const headers = [
      'Operation',
      'TotalRequests',
      'SuccessfulRequests',
      'FailedRequests',
      'SuccessRate',
      'AvgResponseTime',
      'MinResponseTime',
      'MaxResponseTime',
      'P50ResponseTime',
      'P90ResponseTime',
      'P95ResponseTime',
      'P99ResponseTime',
      'Timeouts',
      'RateLimitHits',
      'NetworkErrors',
      'OtherErrors',
      'TotalDuration',
      'RequestsPerSecond',
      'ConcurrentRequestsMax',
    ];

    // Convert the metrics to CSV rows
    let csv = headers.join(',') + '\n';

    for (const [operation, data] of Object.entries(metrics)) {
      const successRate =
        data.totalRequests > 0
          ? (data.successfulRequests / data.totalRequests) * 100
          : 0;

      const row = [
        operation,
        data.totalRequests,
        data.successfulRequests,
        data.failedRequests,
        successRate.toFixed(2),
        data.avgResponseTime.toFixed(2),
        data.minResponseTime === Number.MAX_SAFE_INTEGER
          ? 'N/A'
          : data.minResponseTime,
        data.maxResponseTime,
        data.p50ResponseTime,
        data.p90ResponseTime,
        data.p95ResponseTime,
        data.p99ResponseTime,
        data.timeouts,
        data.rateLimitHits,
        data.networkErrors,
        data.otherErrors,
        data.totalDuration,
        data.requestsPerSecond.toFixed(2),
        data.concurrentRequestsMax,
      ];

      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * Generate a comprehensive report package with HTML, text, and CSV formats
   */
  static generateReportPackage(
    metrics: Record<string, StressTestMetrics>,
    resourceUsage: ResourceUsagePoint[] = [],
    systemInfo: SystemInfo = {},
    options: ReportPackageOptions = {}
  ): void {
    const title = options.title || 'AI Service Stress Test Report';
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '');
    const baseFilename = `stress_test_report_${timestamp}`;

    // Create output directory if it doesn't exist
    const outputDir =
      options.outputDir || path.join(process.cwd(), 'stress-test-reports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate HTML report
    const htmlPath = path.join(outputDir, `${baseFilename}.html`);
    this.generateHtmlReport(metrics, resourceUsage, systemInfo, {
      title,
      outputPath: htmlPath,
      includeCharts: options.includeCharts,
    });

    // Generate text report
    const textPath = path.join(outputDir, `${baseFilename}.txt`);
    fs.writeFileSync(
      textPath,
      this.generateTextReport(metrics, { title, detailed: true })
    );

    // Generate CSV report
    const csvPath = path.join(outputDir, `${baseFilename}.csv`);
    fs.writeFileSync(csvPath, this.generateCsvReport(metrics));

    // Generate JSON raw data
    const jsonPath = path.join(outputDir, `${baseFilename}.json`);
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          title,
          timestamp: new Date().toISOString(),
          metrics,
          resourceUsage,
          systemInfo,
        },
        null,
        2
      )
    );

    logger.info(`Reports generated in: ${outputDir}`);
    logger.info(`HTML Report: ${htmlPath}`);
    logger.info(`Text Report: ${textPath}`);
    logger.info(`CSV Report: ${csvPath}`);
    logger.info(`JSON Data: ${jsonPath}`);
  }
}
