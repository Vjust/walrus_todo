#!/usr/bin/env node
import { Logger } from '../src/utils/Logger';

const logger = new Logger('generate-coverage-badge');

const fs = require('fs');
const path = require('path');

/**
 * Generate coverage badge from jest coverage report
 */
function generateCoverageBadge() {
  try {
    // Read coverage summary
    const coverageSummaryPath = path.join(__dirname, '../coverage/coverage-summary.json');
    
    if (!fs.existsSync(coverageSummaryPath)) {
      logger.error('Coverage summary not found. Run "pnpm test:coverage" first.');
      process.exit(1);
    }
    
    const summary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf-8'));
    const total = summary.total;
    
    // Calculate overall percentage
    const percentage = Math.round(
      (total.lines.pct + total.statements.pct + total.functions.pct + total.branches.pct) / 4
    );
    
    // Determine badge color
    let color;
    if (percentage >= 90) color = 'brightgreen';
    else if (percentage >= 80) color = 'green';
    else if (percentage >= 70) color = 'yellow';
    else if (percentage >= 60) color = 'orange';
    else color = 'red';
    
    // Create badge markdown
    const badgeUrl = `https://img.shields.io/badge/coverage-${percentage}%25-${color}`;
    const badgeMarkdown = `![Coverage Status](${badgeUrl})`;
    
    // Update README
    const readmePath = path.join(__dirname, '../README.md');
    let readme = fs.readFileSync(readmePath, 'utf-8');
    
    // Replace existing coverage badge or add new one
    const badgeRegex = /!\[Coverage Status\]\(https:\/\/img\.shields\.io\/badge\/coverage-\d+%25-\w+\)/;
    
    if (badgeRegex.test(readme)) {
      readme = readme.replace(badgeRegex, badgeMarkdown);
    } else {
      // Add badge after the first line (title)
      const lines = readme.split('\n');
      lines.splice(1, 0, '', badgeMarkdown);
      readme = lines.join('\n');
    }
    
    fs.writeFileSync(readmePath, readme);
    
    logger.info(`Coverage badge updated: ${percentage}% (${color})`);
    
    // Also write badge data for GitHub Actions
    const badgeDataPath = path.join(__dirname, '../coverage/badge.json');
    fs.writeFileSync(
      badgeDataPath,
      JSON.stringify({
        schemaVersion: 1,
        label: 'coverage',
        message: `${percentage}%`,
        color: color
      }, null, 2)
    );
    
  } catch (error) {
    logger.error('Error generating coverage badge:', error);
    process.exit(1);
  }
}

generateCoverageBadge();