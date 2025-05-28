#!/usr/bin/env node

/**
 * Lighthouse performance testing and optimization script
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

class LighthousePerformanceTester {
  constructor() {
    this.reportDir = path.join(__dirname, '../performance-reports');
    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async runLighthouseTest(url, options = {}) {
    const chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage']
    });

    const lighthouseOptions = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance'],
      port: chrome.port,
      ...options
    };

    const config = {
      extends: 'lighthouse:default',
      settings: {
        onlyAudits: [
          'first-contentful-paint',
          'largest-contentful-paint',
          'cumulative-layout-shift',
          'total-blocking-time',
          'speed-index',
          'interactive',
          'server-response-time',
          'render-blocking-resources',
          'unused-css-rules',
          'unused-javascript',
          'modern-image-formats',
          'uses-optimized-images',
          'uses-webp-images',
          'efficient-animated-content',
          'preload-lcp-image',
          'uses-rel-preconnect',
          'uses-rel-preload',
          'critical-request-chains',
          'font-display',
          'third-party-summary',
        ],
      },
    };

    try {
      console.log(`🔍 Running Lighthouse audit for: ${url}`);
      const runnerResult = await lighthouse(url, lighthouseOptions, config);
      
      await chrome.kill();
      
      return runnerResult;
    } catch (error) {
      await chrome.kill();
      throw error;
    }
  }

  async testMultiplePages(baseUrl, pages = ['/']) {
    const results = {};
    
    for (const page of pages) {
      const url = `${baseUrl}${page}`;
      console.log(`\n📊 Testing page: ${page}`);
      
      try {
        const result = await this.runLighthouseTest(url);
        results[page] = this.extractPerformanceMetrics(result);
        
        // Save individual report
        const reportPath = path.join(
          this.reportDir, 
          `lighthouse-${page.replace(/\//g, '_')}-${Date.now()}.json`
        );
        fs.writeFileSync(reportPath, JSON.stringify(result.lhr, null, 2));
        
        console.log(`✅ Test complete for ${page}`);
        this.printPageSummary(page, results[page]);
        
      } catch (error) {
        console.error(`❌ Error testing ${page}:`, error.message);
        results[page] = { error: error.message };
      }
    }
    
    return results;
  }

  extractPerformanceMetrics(result) {
    const lhr = result.lhr;
    const audits = lhr.audits;
    
    return {
      performance: {
        score: Math.round(lhr.categories.performance.score * 100),
        metrics: {
          firstContentfulPaint: audits['first-contentful-paint'].displayValue,
          largestContentfulPaint: audits['largest-contentful-paint'].displayValue,
          cumulativeLayoutShift: audits['cumulative-layout-shift'].displayValue,
          totalBlockingTime: audits['total-blocking-time'].displayValue,
          speedIndex: audits['speed-index'].displayValue,
          timeToInteractive: audits['interactive'].displayValue,
        },
        opportunities: this.extractOpportunities(audits),
        diagnostics: this.extractDiagnostics(audits),
      },
      timestamp: new Date().toISOString(),
    };
  }

  extractOpportunities(audits) {
    const opportunities = [];
    
    const opportunityAudits = [
      'render-blocking-resources',
      'unused-css-rules',
      'unused-javascript',
      'modern-image-formats',
      'uses-optimized-images',
      'uses-webp-images',
      'efficient-animated-content',
      'preload-lcp-image',
      'uses-rel-preconnect',
      'uses-rel-preload',
    ];
    
    opportunityAudits.forEach(auditId => {
      const audit = audits[auditId];
      if (audit && audit.score !== null && audit.score < 1) {
        opportunities.push({
          id: auditId,
          title: audit.title,
          description: audit.description,
          score: Math.round(audit.score * 100),
          savings: audit.details?.overallSavingsMs || 0,
          displayValue: audit.displayValue,
        });
      }
    });
    
    return opportunities.sort((a, b) => b.savings - a.savings);
  }

  extractDiagnostics(audits) {
    const diagnostics = [];
    
    const diagnosticAudits = [
      'server-response-time',
      'critical-request-chains',
      'font-display',
      'third-party-summary',
    ];
    
    diagnosticAudits.forEach(auditId => {
      const audit = audits[auditId];
      if (audit && audit.score !== null && audit.score < 1) {
        diagnostics.push({
          id: auditId,
          title: audit.title,
          description: audit.description,
          score: Math.round(audit.score * 100),
          displayValue: audit.displayValue,
        });
      }
    });
    
    return diagnostics;
  }

  printPageSummary(page, metrics) {
    if (metrics.error) {
      console.log(`❌ ${page}: Error - ${metrics.error}`);
      return;
    }
    
    const perf = metrics.performance;
    const scoreEmoji = perf.score >= 90 ? '🟢' : perf.score >= 50 ? '🟡' : '🔴';
    
    console.log(`${scoreEmoji} ${page}: Performance Score ${perf.score}/100`);
    console.log(`   📈 Metrics:`);
    console.log(`      FCP: ${perf.metrics.firstContentfulPaint}`);
    console.log(`      LCP: ${perf.metrics.largestContentfulPaint}`);
    console.log(`      CLS: ${perf.metrics.cumulativeLayoutShift}`);
    console.log(`      TBT: ${perf.metrics.totalBlockingTime}`);
    
    if (perf.opportunities.length > 0) {
      console.log(`   💡 Top opportunities:`);
      perf.opportunities.slice(0, 3).forEach(opp => {
        console.log(`      • ${opp.title} (${opp.savings}ms savings)`);
      });
    }
  }

  async generateComprehensiveReport(baseUrl) {
    const pages = ['/', '/dashboard', '/about'];
    const results = await this.testMultiplePages(baseUrl, pages);
    
    const report = {
      summary: this.generateSummary(results),
      pages: results,
      recommendations: this.generateRecommendations(results),
      timestamp: new Date().toISOString(),
    };
    
    // Save comprehensive report
    const reportPath = path.join(this.reportDir, `lighthouse-comprehensive-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport(report);
    const htmlPath = path.join(this.reportDir, `lighthouse-report-${Date.now()}.html`);
    fs.writeFileSync(htmlPath, htmlReport);
    
    console.log(`\n📄 Comprehensive report saved to: ${reportPath}`);
    console.log(`📄 HTML report saved to: ${htmlPath}`);
    
    this.printOverallSummary(report);
    
    return report;
  }

  generateSummary(results) {
    const validResults = Object.values(results).filter(r => !r.error);
    if (validResults.length === 0) return null;
    
    const scores = validResults.map(r => r.performance.score);
    const avgScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    
    return {
      averageScore: avgScore,
      totalPages: Object.keys(results).length,
      successfulTests: validResults.length,
      failedTests: Object.keys(results).length - validResults.length,
      scoreDistribution: {
        excellent: scores.filter(s => s >= 90).length,
        good: scores.filter(s => s >= 50 && s < 90).length,
        poor: scores.filter(s => s < 50).length,
      },
    };
  }

  generateRecommendations(results) {
    const recommendations = [];
    const allOpportunities = [];
    
    // Collect all opportunities
    Object.values(results).forEach(result => {
      if (!result.error && result.performance.opportunities) {
        allOpportunities.push(...result.performance.opportunities);
      }
    });
    
    // Group by opportunity type
    const grouped = allOpportunities.reduce((acc, opp) => {
      if (!acc[opp.id]) {
        acc[opp.id] = {
          id: opp.id,
          title: opp.title,
          description: opp.description,
          totalSavings: 0,
          occurrences: 0,
        };
      }
      acc[opp.id].totalSavings += opp.savings;
      acc[opp.id].occurrences++;
      return acc;
    }, {});
    
    // Sort by total potential savings
    const sorted = Object.values(grouped)
      .sort((a, b) => b.totalSavings - a.totalSavings)
      .slice(0, 10);
    
    sorted.forEach(opp => {
      recommendations.push({
        priority: opp.totalSavings > 1000 ? 'high' : opp.totalSavings > 500 ? 'medium' : 'low',
        title: opp.title,
        description: opp.description,
        impact: `${opp.totalSavings}ms potential savings across ${opp.occurrences} pages`,
        action: this.getActionForOpportunity(opp.id),
      });
    });
    
    return recommendations;
  }

  getActionForOpportunity(opportunityId) {
    const actions = {
      'render-blocking-resources': 'Defer non-critical CSS and JavaScript. Use async/defer attributes.',
      'unused-css-rules': 'Remove unused CSS rules or implement critical CSS extraction.',
      'unused-javascript': 'Remove dead code and implement code splitting.',
      'modern-image-formats': 'Use WebP or AVIF images instead of PNG/JPEG.',
      'uses-optimized-images': 'Compress and resize images appropriately.',
      'preload-lcp-image': 'Add rel="preload" for the Largest Contentful Paint image.',
      'uses-rel-preconnect': 'Add rel="preconnect" for third-party origins.',
      'efficient-animated-content': 'Use video formats instead of animated GIFs.',
    };
    
    return actions[opportunityId] || 'Review the specific audit details for optimization steps.';
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>WalTodo Lighthouse Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .score { font-size: 2em; font-weight: bold; }
        .excellent { color: #0f5132; }
        .good { color: #664d03; }
        .poor { color: #842029; }
        .page-results { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin: 30px 0; }
        .page-card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
        .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 15px 0; }
        .metric { background: #f8f9fa; padding: 10px; border-radius: 4px; }
        .recommendations { margin: 30px 0; }
        .recommendation { margin: 15px 0; padding: 15px; border-radius: 5px; }
        .high { background: #f8d7da; border-left: 4px solid #dc3545; }
        .medium { background: #fff3cd; border-left: 4px solid #ffc107; }
        .low { background: #d1ecf1; border-left: 4px solid #17a2b8; }
    </style>
</head>
<body>
    <div class="header">
        <h1>WalTodo Lighthouse Performance Report</h1>
        <p>Generated: ${report.timestamp}</p>
    </div>
    
    ${report.summary ? `
    <div class="summary">
        <h2>Performance Summary</h2>
        <div class="score ${report.summary.averageScore >= 90 ? 'excellent' : report.summary.averageScore >= 50 ? 'good' : 'poor'}">
            Average Score: ${report.summary.averageScore}/100
        </div>
        <p>Tested ${report.summary.totalPages} pages with ${report.summary.successfulTests} successful tests</p>
        <p>Score Distribution: ${report.summary.scoreDistribution.excellent} excellent, ${report.summary.scoreDistribution.good} good, ${report.summary.scoreDistribution.poor} poor</p>
    </div>
    ` : ''}
    
    <div class="page-results">
        ${Object.entries(report.pages).map(([page, result]) => `
            <div class="page-card">
                <h3>${page}</h3>
                ${result.error ? `
                    <p style="color: #dc3545;">Error: ${result.error}</p>
                ` : `
                    <div class="score ${result.performance.score >= 90 ? 'excellent' : result.performance.score >= 50 ? 'good' : 'poor'}">
                        ${result.performance.score}/100
                    </div>
                    <div class="metrics">
                        <div class="metric">
                            <strong>FCP:</strong> ${result.performance.metrics.firstContentfulPaint}
                        </div>
                        <div class="metric">
                            <strong>LCP:</strong> ${result.performance.metrics.largestContentfulPaint}
                        </div>
                        <div class="metric">
                            <strong>CLS:</strong> ${result.performance.metrics.cumulativeLayoutShift}
                        </div>
                        <div class="metric">
                            <strong>TBT:</strong> ${result.performance.metrics.totalBlockingTime}
                        </div>
                    </div>
                    ${result.performance.opportunities.length > 0 ? `
                        <h4>Top Opportunities:</h4>
                        <ul>
                            ${result.performance.opportunities.slice(0, 3).map(opp => `
                                <li>${opp.title} (${opp.savings}ms savings)</li>
                            `).join('')}
                        </ul>
                    ` : ''}
                `}
            </div>
        `).join('')}
    </div>
    
    <div class="recommendations">
        <h2>Performance Recommendations</h2>
        ${report.recommendations.map(rec => `
            <div class="recommendation ${rec.priority}">
                <h3>${rec.title}</h3>
                <p><strong>Impact:</strong> ${rec.impact}</p>
                <p><strong>Action:</strong> ${rec.action}</p>
            </div>
        `).join('')}
    </div>
</body>
</html>
    `;
  }

  printOverallSummary(report) {
    console.log('\n🎯 Overall Performance Summary:');
    console.log('=' .repeat(50));
    
    if (report.summary) {
      const { summary } = report;
      const scoreEmoji = summary.averageScore >= 90 ? '🟢' : summary.averageScore >= 50 ? '🟡' : '🔴';
      
      console.log(`${scoreEmoji} Average Performance Score: ${summary.averageScore}/100`);
      console.log(`📊 Pages tested: ${summary.totalPages} (${summary.successfulTests} successful)`);
      console.log(`📈 Score distribution:`);
      console.log(`   🟢 Excellent (90+): ${summary.scoreDistribution.excellent}`);
      console.log(`   🟡 Good (50-89): ${summary.scoreDistribution.good}`);
      console.log(`   🔴 Poor (<50): ${summary.scoreDistribution.poor}`);
    }
    
    console.log(`\n💡 Top Recommendations: ${report.recommendations.length}`);
    report.recommendations.slice(0, 5).forEach((rec, i) => {
      const priorityEmoji = rec.priority === 'high' ? '🚨' : rec.priority === 'medium' ? '⚠️' : 'ℹ️';
      console.log(`   ${i + 1}. ${priorityEmoji} ${rec.title}`);
    });
    
    if (report.summary && report.summary.averageScore >= 90) {
      console.log('\n🎉 Congratulations! Your application meets the Lighthouse ≥90 performance target!');
    } else {
      console.log('\n🔧 Focus on the recommendations above to improve your Lighthouse score.');
    }
  }
}

// CLI interface
async function main() {
  const tester = new LighthousePerformanceTester();
  
  const url = process.argv[2] || 'http://localhost:3000';
  const command = process.argv[3] || 'comprehensive';
  
  try {
    switch (command) {
      case 'single':
        const result = await tester.runLighthouseTest(url);
        const metrics = tester.extractPerformanceMetrics(result);
        tester.printPageSummary('/', metrics);
        break;
      case 'comprehensive':
      default:
        await tester.generateComprehensiveReport(url);
        break;
    }
  } catch (error) {
    console.error('❌ Lighthouse test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = LighthousePerformanceTester;