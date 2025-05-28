#!/usr/bin/env node

/**
 * Bundle analyzer for WalTodo frontend performance optimization
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class BundleAnalyzer {
  constructor() {
    this.buildDir = path.join(__dirname, '../.next');
    this.reportDir = path.join(__dirname, '../performance-reports');
    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async analyzeBundles() {
    console.log('🔍 Analyzing bundle sizes...');
    
    const analysis = {
      timestamp: new Date().toISOString(),
      bundles: await this.getBundleSizes(),
      chunks: await this.getChunkAnalysis(),
      dependencies: await this.getDependencyAnalysis(),
      recommendations: [],
    };

    analysis.recommendations = this.generateRecommendations(analysis);
    
    // Save analysis report
    const reportPath = path.join(this.reportDir, `bundle-analysis-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2));
    
    console.log('📊 Bundle Analysis Complete');
    this.printSummary(analysis);
    
    return analysis;
  }

  async getBundleSizes() {
    const staticDir = path.join(this.buildDir, 'static');
    const bundles = {};

    if (!fs.existsSync(staticDir)) {
      console.warn('Build directory not found. Please run "npm run build" first.');
      return bundles;
    }

    const scanDirectory = (dir, prefix = '') => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          scanDirectory(filePath, `${prefix}${file}/`);
        } else if (file.endsWith('.js') || file.endsWith('.css')) {
          const relativePath = `${prefix}${file}`;
          bundles[relativePath] = {
            size: stat.size,
            sizeKB: Math.round(stat.size / 1024 * 100) / 100,
            type: file.endsWith('.js') ? 'javascript' : 'css',
          };
        }
      });
    };

    scanDirectory(staticDir);
    return bundles;
  }

  async getChunkAnalysis() {
    try {
      // Use Next.js bundle analyzer if available
      const manifestPath = path.join(this.buildDir, 'build-manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        return this.analyzeManifest(manifest);
      }
    } catch (error) {
      console.warn('Could not analyze chunks:', error.message);
    }
    
    return {};
  }

  analyzeManifest(manifest) {
    const analysis = {
      pages: {},
      sharedChunks: [],
      largestChunks: [],
    };

    // Analyze page bundles
    Object.entries(manifest.pages || {}).forEach(([page, files]) => {
      const totalSize = files.reduce((sum, file) => {
        const filePath = path.join(this.buildDir, 'static', file);
        try {
          const stat = fs.statSync(filePath);
          return sum + stat.size;
        } catch {
          return sum;
        }
      }, 0);

      analysis.pages[page] = {
        files: files.length,
        totalSize,
        totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
      };
    });

    return analysis;
  }

  async getDependencyAnalysis() {
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageLockPath = path.join(__dirname, '../package-lock.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      return {};
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const analysis = {
      totalDependencies: Object.keys(dependencies).length,
      largeDependencies: [],
      duplicateDependencies: [],
      unusedDependencies: [],
    };

    // Identify potentially large dependencies
    const knownLargeDeps = [
      '@mysten/sui',
      '@mysten/walrus', 
      '@suiet/wallet-kit',
      'socket.io-client',
      'react',
      'react-dom',
      'next',
    ];

    analysis.largeDependencies = Object.keys(dependencies).filter(dep =>
      knownLargeDeps.some(large => dep.includes(large))
    );

    return analysis;
  }

  generateRecommendations(analysis) {
    const recommendations = [];
    
    // Check bundle sizes
    Object.entries(analysis.bundles).forEach(([bundle, info]) => {
      if (info.sizeKB > 1000) { // 1MB+
        recommendations.push({
          type: 'bundle-size',
          severity: 'high',
          message: `Large bundle detected: ${bundle} (${info.sizeKB}KB). Consider code splitting.`,
          bundle,
          size: info.sizeKB,
        });
      } else if (info.sizeKB > 500) { // 500KB+
        recommendations.push({
          type: 'bundle-size',
          severity: 'medium',
          message: `Medium bundle size: ${bundle} (${info.sizeKB}KB). Monitor for growth.`,
          bundle,
          size: info.sizeKB,
        });
      }
    });

    // Check for too many dependencies
    if (analysis.dependencies.totalDependencies > 50) {
      recommendations.push({
        type: 'dependencies',
        severity: 'medium',
        message: `High dependency count: ${analysis.dependencies.totalDependencies}. Review unused dependencies.`,
      });
    }

    // Check for large pages
    Object.entries(analysis.chunks.pages || {}).forEach(([page, info]) => {
      if (info.totalSizeKB > 2000) { // 2MB+
        recommendations.push({
          type: 'page-size',
          severity: 'high',
          message: `Large page bundle: ${page} (${info.totalSizeKB}KB). Consider lazy loading.`,
          page,
          size: info.totalSizeKB,
        });
      }
    });

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        severity: 'info',
        message: 'Bundle sizes look good! Continue monitoring as the application grows.',
      });
    }

    return recommendations;
  }

  printSummary(analysis) {
    console.log('\n📦 Bundle Analysis Summary:');
    console.log('=' .repeat(50));
    
    // Bundle sizes
    const bundles = Object.values(analysis.bundles);
    const totalSize = bundles.reduce((sum, bundle) => sum + bundle.size, 0);
    const totalSizeKB = Math.round(totalSize / 1024 * 100) / 100;
    
    console.log(`📊 Total bundle size: ${totalSizeKB}KB`);
    console.log(`📁 Number of bundles: ${bundles.length}`);
    
    // Largest bundles
    const largest = Object.entries(analysis.bundles)
      .sort(([,a], [,b]) => b.size - a.size)
      .slice(0, 5);
    
    console.log('\n🔍 Largest bundles:');
    largest.forEach(([name, info]) => {
      console.log(`  ${name}: ${info.sizeKB}KB`);
    });
    
    // Dependencies
    console.log(`\n📦 Dependencies: ${analysis.dependencies.totalDependencies}`);
    if (analysis.dependencies.largeDependencies.length > 0) {
      console.log('⚠️  Large dependencies:', analysis.dependencies.largeDependencies.join(', '));
    }
    
    // Recommendations
    console.log(`\n💡 Recommendations: ${analysis.recommendations.length}`);
    analysis.recommendations.forEach(rec => {
      const emoji = rec.severity === 'high' ? '🚨' : rec.severity === 'medium' ? '⚠️' : 'ℹ️';
      console.log(`  ${emoji} ${rec.message}`);
    });
  }

  async generateReport() {
    const analysis = await this.analyzeBundles();
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport(analysis);
    const htmlPath = path.join(this.reportDir, `bundle-report-${Date.now()}.html`);
    fs.writeFileSync(htmlPath, htmlReport);
    
    console.log(`\n📄 Detailed report saved to: ${htmlPath}`);
    
    return analysis;
  }

  generateHTMLReport(analysis) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>WalTodo Bundle Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; }
        .section { margin: 30px 0; }
        .bundle-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .bundle-item { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .large { border-color: #ff6b6b; background: #fff5f5; }
        .medium { border-color: #feca57; background: #fffbf0; }
        .small { border-color: #48cab2; background: #f0fff4; }
        .recommendation { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .high { background: #ff6b6b; color: white; }
        .medium { background: #feca57; }
        .info { background: #48cab2; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h1>WalTodo Bundle Analysis Report</h1>
        <p>Generated: ${analysis.timestamp}</p>
    </div>
    
    <div class="section">
        <h2>Bundle Overview</h2>
        <p>Total bundles: ${Object.keys(analysis.bundles).length}</p>
        <p>Total size: ${Object.values(analysis.bundles).reduce((sum, b) => sum + b.sizeKB, 0).toFixed(2)}KB</p>
    </div>
    
    <div class="section">
        <h2>Bundle Details</h2>
        <div class="bundle-list">
            ${Object.entries(analysis.bundles).map(([name, info]) => `
                <div class="bundle-item ${info.sizeKB > 1000 ? 'large' : info.sizeKB > 500 ? 'medium' : 'small'}">
                    <h3>${name}</h3>
                    <p>Size: ${info.sizeKB}KB</p>
                    <p>Type: ${info.type}</p>
                </div>
            `).join('')}
        </div>
    </div>
    
    <div class="section">
        <h2>Recommendations</h2>
        ${analysis.recommendations.map(rec => `
            <div class="recommendation ${rec.severity}">
                <strong>${rec.type.toUpperCase()}:</strong> ${rec.message}
            </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h2>Dependencies</h2>
        <p>Total dependencies: ${analysis.dependencies.totalDependencies}</p>
        <p>Large dependencies: ${analysis.dependencies.largeDependencies.join(', ') || 'None'}</p>
    </div>
</body>
</html>
    `;
  }
}

// CLI interface
if (require.main === module) {
  const analyzer = new BundleAnalyzer();
  
  const command = process.argv[2] || 'analyze';
  
  switch (command) {
    case 'analyze':
      analyzer.analyzeBundles();
      break;
    case 'report':
      analyzer.generateReport();
      break;
    default:
      console.log('Usage: node bundle-analyzer.js [analyze|report]');
  }
}

module.exports = BundleAnalyzer;