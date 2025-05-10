/**
 * Script to analyze TypeScript files for potential implicit 'any' type issues
 * Run with: npx ts-node scripts/analyze-implicit-any.ts
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

interface ImplicitAnyIssue {
  file: string;
  line: number;
  column: number;
  message: string;
  category: string;
}

interface AnalysisResults {
  totalFiles: number;
  totalIssues: number;
  issuesByFile: Record<string, ImplicitAnyIssue[]>;
  issuesByCategory: Record<string, ImplicitAnyIssue[]>;
  topFiles: {file: string, count: number}[];
}

// Load and parse tsconfig.json
const configPath = path.resolve(__dirname, '../tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

if (configFile.error) {
  console.error(`Error reading tsconfig.json: ${configFile.error.messageText}`);
  process.exit(1);
}

// Create a configuration with noImplicitAny enabled for analysis
const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.dirname(configPath)
);

// Override with noImplicitAny enabled
const strictConfig = {
  ...parsedConfig.options,
  noImplicitAny: true
};

// Create a new program with the strict configuration
const host = ts.createCompilerHost(strictConfig);
const files = glob.sync(path.join(__dirname, '../src/**/*.ts'), {
  ignore: ['**/*.d.ts', '**/__mocks__/**/*.ts']
});

console.log(`Analyzing ${files.length} TypeScript files for implicit 'any' issues...`);

// Create program with files
const program = ts.createProgram(files, strictConfig, host);

// Get semantic diagnostics
const diagnostics = ts.getPreEmitDiagnostics(program);

// Filter only implicit any diagnostics (error code 7006)
const implicitAnyDiagnostics = diagnostics.filter(d => 
  d.code === 7006 || // Parameter has implicit 'any' type
  d.code === 7005 || // Variable has implicit 'any' type
  d.code === 7008 || // Member has implicit 'any' type
  d.code === 7034    // Variable has implicit 'any' type
);

// Categorize issues
const issues: ImplicitAnyIssue[] = [];

implicitAnyDiagnostics.forEach(diagnostic => {
  if (diagnostic.file) {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
    const relativePath = path.relative(path.resolve(__dirname, '..'), diagnostic.file.fileName);
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    
    // Categorize the issue
    let category = 'unknown';
    
    if (message.includes('parameter')) {
      category = 'function-parameter';
    } else if (message.includes('variable')) {
      category = 'variable-declaration';
    } else if (message.includes('member')) {
      category = 'class-member';
    } else if (message.includes('property')) {
      category = 'object-property';
    } else if (message.includes('callback')) {
      category = 'callback';
    } else if (message.includes('array')) {
      category = 'array-method';
    }
    
    issues.push({
      file: relativePath,
      line: line + 1,
      column: character + 1,
      message,
      category
    });
  }
});

// Organize results
const results: AnalysisResults = {
  totalFiles: files.length,
  totalIssues: issues.length,
  issuesByFile: {},
  issuesByCategory: {},
  topFiles: []
};

// Group by file
issues.forEach(issue => {
  if (!results.issuesByFile[issue.file]) {
    results.issuesByFile[issue.file] = [];
  }
  results.issuesByFile[issue.file].push(issue);
});

// Group by category
issues.forEach(issue => {
  if (!results.issuesByCategory[issue.category]) {
    results.issuesByCategory[issue.category] = [];
  }
  results.issuesByCategory[issue.category].push(issue);
});

// Get top files with most issues
results.topFiles = Object.entries(results.issuesByFile)
  .map(([file, issues]) => ({ file, count: issues.length }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 20);

// Print summary to console
console.log(`\nAnalysis complete. Found ${results.totalIssues} implicit 'any' issues in ${Object.keys(results.issuesByFile).length} files.`);

console.log('\nTop 20 files with most issues:');
results.topFiles.forEach(({ file, count }) => {
  console.log(`${file}: ${count} issues`);
});

console.log('\nIssues by category:');
Object.entries(results.issuesByCategory)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([category, issues]) => {
    console.log(`${category}: ${issues.length} issues`);
  });

// Write detailed report to file
const reportPath = path.resolve(__dirname, '../implicit-any-report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

// Write a more readable markdown report
const markdownPath = path.resolve(__dirname, '../implicit-any-report.md');
const markdownContent = generateMarkdownReport(results);
fs.writeFileSync(markdownPath, markdownContent);

console.log(`\nDetailed report written to ${reportPath}`);
console.log(`Markdown report written to ${markdownPath}`);

/**
 * Generates a markdown report from analysis results
 */
function generateMarkdownReport(results: AnalysisResults): string {
  let markdown = `# Implicit 'any' Analysis Report\n\n`;
  
  markdown += `## Summary\n\n`;
  markdown += `- **Total TypeScript files analyzed:** ${results.totalFiles}\n`;
  markdown += `- **Files with implicit 'any' issues:** ${Object.keys(results.issuesByFile).length}\n`;
  markdown += `- **Total implicit 'any' issues found:** ${results.totalIssues}\n\n`;
  
  markdown += `## Issues by Category\n\n`;
  markdown += `| Category | Count |\n`;
  markdown += `| -------- | ----- |\n`;
  
  Object.entries(results.issuesByCategory)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([category, issues]) => {
      markdown += `| ${category} | ${issues.length} |\n`;
    });
  
  markdown += `\n## Top Files with Issues\n\n`;
  markdown += `| File | Issues |\n`;
  markdown += `| ---- | ------ |\n`;
  
  results.topFiles.forEach(({ file, count }) => {
    markdown += `| ${file} | ${count} |\n`;
  });
  
  markdown += `\n## Detailed Issues by File\n\n`;
  
  Object.entries(results.issuesByFile)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([file, issues]) => {
      markdown += `### ${file} (${issues.length} issues)\n\n`;
      markdown += `| Line:Column | Category | Message |\n`;
      markdown += `| ----------- | -------- | ------- |\n`;
      
      issues.forEach(issue => {
        markdown += `| ${issue.line}:${issue.column} | ${issue.category} | ${issue.message.replace(/\|/g, '\\|')} |\n`;
      });
      
      markdown += `\n`;
    });
  
  markdown += `\n## Recommendations\n\n`;
  markdown += `1. Start with fixing function parameters, as they are typically the easiest to address\n`;
  markdown += `2. Address variable declarations next\n`;
  markdown += `3. Focus on files with the highest number of issues for maximum impact\n`;
  markdown += `4. Consider creating interfaces for common object patterns\n`;
  markdown += `5. Use type assertions where appropriate for third-party libraries\n`;
  
  return markdown;
}