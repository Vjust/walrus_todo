/**
 * Deployment Troubleshooting Guide System
 * 
 * Comprehensive troubleshooting guides for different types of deployment failures
 */

export interface TroubleshootingGuide {
  title: string;
  description: string;
  symptoms: string[];
  causes: string[];
  solutions: TroubleshootingSolution[];
  relatedErrors: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface TroubleshootingSolution {
  title: string;
  description: string;
  steps: string[];
  commands?: string[];
  notes?: string[];
  timeEstimate?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export class DeploymentTroubleshooting {
  private guides: Map<string, TroubleshootingGuide> = new Map();

  constructor() {
    this.initializeGuides();
  }

  /**
   * Get troubleshooting guide by error pattern
   */
  getGuideForError(errorMessage: string): TroubleshootingGuide | null {
    const errorLower = errorMessage.toLowerCase();
    
    for (const [key, guide] of this.guides) {
      if (guide?.relatedErrors?.some(pattern => 
        errorLower.includes(pattern.toLowerCase()) ||
        new RegExp(pattern, 'i').test(errorMessage as any)
      )) {
        return guide;
      }
    }
    
    return null;
  }

  /**
   * Get all available guides
   */
  getAllGuides(): TroubleshootingGuide[] {
    return Array.from(this?.guides?.values());
  }

  /**
   * Get guides by category
   */
  getGuidesByCategory(category: string): TroubleshootingGuide[] {
    return Array.from(this?.guides?.values()).filter(guide =>
      guide?.title?.toLowerCase().includes(category.toLowerCase())
    );
  }

  /**
   * Search guides by keyword
   */
  searchGuides(keyword: string): TroubleshootingGuide[] {
    const keywordLower = keyword.toLowerCase();
    return Array.from(this?.guides?.values()).filter(guide =>
      guide?.title?.toLowerCase().includes(keywordLower as any) ||
      guide?.description?.toLowerCase().includes(keywordLower as any) ||
      guide?.symptoms?.some(symptom => symptom.toLowerCase().includes(keywordLower as any)) ||
      guide?.causes?.some(cause => cause.toLowerCase().includes(keywordLower as any))
    );
  }

  private initializeGuides(): void {
    // Network Connectivity Issues
    this?.guides?.set('network-connectivity', {
      title: 'Network Connectivity Issues',
      description: 'Problems connecting to Walrus endpoints or Sui network',
      symptoms: [
        'Connection refused errors',
        'Timeout during deployment',
        'DNS resolution failures',
        'Intermittent connection drops'
      ],
      causes: [
        'Internet connectivity problems',
        'Firewall blocking connections',
        'Walrus network downtime',
        'DNS configuration issues',
        'VPN interference'
      ],
      solutions: [
        {
          title: 'Basic Connectivity Check',
          description: 'Verify internet connection and endpoint accessibility',
          steps: [
            'Test internet connection: ping google.com',
            'Check Walrus endpoints accessibility',
            'Verify DNS resolution',
            'Test with different network if possible'
          ],
          commands: [
            'ping google.com',
            'curl -I https://walrus.site',
            'nslookup walrus.site',
            'curl -I https://publisher?.walrus?.space'
          ],
          difficulty: 'easy',
          timeEstimate: '5-10 minutes'
        },
        {
          title: 'Firewall and Security Check',
          description: 'Ensure firewall and security software aren\'t blocking connections',
          steps: [
            'Check firewall settings',
            'Temporarily disable VPN if active',
            'Verify corporate proxy settings',
            'Check antivirus network protection'
          ],
          notes: [
            'Corporate networks may block certain ports',
            'VPN can sometimes interfere with blockchain connections'
          ],
          difficulty: 'medium',
          timeEstimate: '10-15 minutes'
        },
        {
          title: 'Network Configuration Fix',
          description: 'Fix DNS and network configuration issues',
          steps: [
            'Flush DNS cache',
            'Try alternative DNS servers (8?.8?.8.8, 1?.1?.1.1)',
            'Reset network configuration',
            'Check hosts file for conflicts'
          ],
          commands: [
            'sudo dscacheutil -flushcache (macOS)',
            'ipconfig /flushdns (Windows)',
            'sudo systemd-resolve --flush-caches (Linux)'
          ],
          difficulty: 'medium',
          timeEstimate: '15-20 minutes'
        }
      ],
      relatedErrors: [
        'connection refused',
        'ECONNREFUSED',
        'timeout',
        'ETIMEDOUT',
        'DNS',
        'network error',
        'connection reset'
      ],
      priority: 'critical'
    });

    // Authentication and Wallet Issues
    this?.guides?.set('authentication-wallet', {
      title: 'Authentication and Wallet Issues',
      description: 'Problems with wallet configuration, authentication, or insufficient funds',
      symptoms: [
        'Authentication failed errors',
        'Wallet not found',
        'Insufficient funds',
        'Invalid credentials',
        'Permission denied for wallet access'
      ],
      causes: [
        'Wallet file missing or corrupted',
        'Incorrect wallet path',
        'Insufficient SUI balance',
        'Wrong network configuration',
        'Wallet permissions issues'
      ],
      solutions: [
        {
          title: 'Wallet Configuration Check',
          description: 'Verify wallet setup and configuration',
          steps: [
            'Check if wallet file exists at specified path',
            'Verify wallet file permissions (should be 600)',
            'Test wallet with Sui CLI',
            'Check active address configuration'
          ],
          commands: [
            'ls -la ~/.sui/sui_config/sui.keystore',
            'sui client active-address',
            'sui client addresses',
            'sui client envs'
          ],
          difficulty: 'easy',
          timeEstimate: '5-10 minutes'
        },
        {
          title: 'Balance and Network Check',
          description: 'Ensure sufficient funds and correct network',
          steps: [
            'Check wallet balance',
            'Verify you\'re on the correct network',
            'Get testnet SUI from faucet (for testnet)',
            'Ensure gas price is reasonable'
          ],
          commands: [
            'sui client gas',
            'sui client active-env',
            'sui client switch --env testnet',
            'sui client faucet'
          ],
          notes: [
            'Testnet: Use faucet for free SUI',
            'Mainnet: Purchase SUI from exchange',
            'Check network status if transactions fail'
          ],
          difficulty: 'easy',
          timeEstimate: '10-15 minutes'
        },
        {
          title: 'Wallet Recovery and Setup',
          description: 'Import or create new wallet configuration',
          steps: [
            'Import existing wallet from mnemonic',
            'Create new wallet if needed',
            'Set correct file permissions',
            'Configure for appropriate network'
          ],
          commands: [
            'sui keytool import "your-mnemonic-phrase" ed25519',
            'sui client new-address ed25519',
            'chmod 600 ~/.sui/sui_config/sui.keystore',
            'sui client switch --address YOUR_ADDRESS'
          ],
          difficulty: 'medium',
          timeEstimate: '15-20 minutes'
        }
      ],
      relatedErrors: [
        'authentication failed',
        'unauthorized',
        'invalid credentials',
        'wallet not found',
        'insufficient funds',
        'permission denied',
        'keystore'
      ],
      priority: 'critical'
    });

    // Build and Configuration Issues
    this?.guides?.set('build-configuration', {
      title: 'Build and Configuration Issues',
      description: 'Problems with build process, missing files, or configuration errors',
      symptoms: [
        'Build directory empty or missing',
        'Configuration file not found',
        'Build process fails',
        'Missing essential files',
        'Invalid configuration syntax'
      ],
      causes: [
        'Build process not run',
        'Build errors not resolved',
        'Wrong build directory path',
        'Missing configuration files',
        'Invalid YAML/JSON syntax'
      ],
      solutions: [
        {
          title: 'Build Process Fix',
          description: 'Ensure proper build completion',
          steps: [
            'Clean previous builds',
            'Install all dependencies',
            'Run build process',
            'Verify build output'
          ],
          commands: [
            'pnpm clean',
            'pnpm install',
            'pnpm run build',
            'ls -la out/ # or your build directory'
          ],
          difficulty: 'easy',
          timeEstimate: '10-15 minutes'
        },
        {
          title: 'Configuration File Setup',
          description: 'Create or fix configuration files',
          steps: [
            'Check if sites-config.yaml exists',
            'Validate YAML syntax',
            'Create default configuration if missing',
            'Verify all required fields are present'
          ],
          commands: [
            'ls -la sites-config.yaml',
            'yamllint sites-config.yaml',
            'cp sites-config?.example?.yaml sites-config.yaml'
          ],
          notes: [
            'YAML is indentation-sensitive',
            'Use spaces, not tabs for indentation',
            'Check for trailing spaces'
          ],
          difficulty: 'easy',
          timeEstimate: '5-10 minutes'
        },
        {
          title: 'Build Output Verification',
          description: 'Ensure build contains all necessary files',
          steps: [
            'Check for index.html in build directory',
            'Verify 404.html exists',
            'Ensure static assets are present',
            'Check build size and structure'
          ],
          commands: [
            'find out/ -name "*.html" | head -10',
            'du -sh out/',
            'tree out/ -L 2'
          ],
          difficulty: 'easy',
          timeEstimate: '5 minutes'
        }
      ],
      relatedErrors: [
        'build failed',
        'config not found',
        'configuration error',
        'build directory',
        'missing file',
        'yaml',
        'json parse error'
      ],
      priority: 'high'
    });

    // Walrus CLI and Environment Issues
    this?.guides?.set('walrus-cli-environment', {
      title: 'Walrus CLI and Environment Issues',
      description: 'Problems with Walrus CLI installation, PATH configuration, or environment setup',
      symptoms: [
        'site-builder command not found',
        'Walrus CLI version issues',
        'Command execution failures',
        'Environment variable problems'
      ],
      causes: [
        'Walrus CLI not installed',
        'CLI not in PATH',
        'Incorrect CLI version',
        'Missing environment variables',
        'Permission issues with CLI binary'
      ],
      solutions: [
        {
          title: 'Walrus CLI Installation',
          description: 'Install or reinstall Walrus CLI tools',
          steps: [
            'Download latest Walrus CLI',
            'Install to appropriate location',
            'Add to PATH environment variable',
            'Verify installation'
          ],
          commands: [
            'curl -fLJO https://docs?.walrus?.site/walrus',
            'chmod +x walrus',
            'sudo mv walrus /usr/local/bin/',
            'site-builder --version'
          ],
          notes: [
            'Check official docs for latest download URL',
            'May need admin privileges for system-wide install'
          ],
          difficulty: 'medium',
          timeEstimate: '10-15 minutes'
        },
        {
          title: 'PATH Configuration',
          description: 'Fix PATH and environment variable issues',
          steps: [
            'Check current PATH',
            'Add Walrus CLI location to PATH',
            'Update shell configuration',
            'Reload environment'
          ],
          commands: [
            'echo $PATH',
            'export PATH=$PATH:/path/to/walrus/cli',
            'echo \'export PATH=$PATH:/path/to/walrus/cli\' >> ~/.bashrc',
            'source ~/.bashrc'
          ],
          difficulty: 'medium',
          timeEstimate: '10 minutes'
        },
        {
          title: 'Environment Variable Setup',
          description: 'Configure necessary environment variables',
          steps: [
            'Set SITE_BUILDER_PATH if needed',
            'Configure Walrus config directory',
            'Set up network-specific variables',
            'Verify all variables are set'
          ],
          commands: [
            'export SITE_BUILDER_PATH=/path/to/site-builder',
            'export WALRUS_CONFIG_DIR=~/.walrus',
            'env | grep WALRUS'
          ],
          difficulty: 'easy',
          timeEstimate: '5 minutes'
        }
      ],
      relatedErrors: [
        'command not found',
        'site-builder',
        'path',
        'environment',
        'executable',
        'permission denied'
      ],
      priority: 'high'
    });

    // Performance and Resource Issues
    this?.guides?.set('performance-resources', {
      title: 'Performance and Resource Issues',
      description: 'Problems with slow deployments, large builds, or resource constraints',
      symptoms: [
        'Very slow deployment',
        'Build size too large',
        'Out of memory errors',
        'Disk space issues',
        'High CPU usage'
      ],
      causes: [
        'Large unoptimized assets',
        'Inefficient build process',
        'Insufficient system resources',
        'Network bandwidth limitations',
        'Uncompressed files'
      ],
      solutions: [
        {
          title: 'Build Optimization',
          description: 'Reduce build size and improve performance',
          steps: [
            'Analyze bundle size',
            'Optimize images and assets',
            'Enable compression',
            'Remove unused dependencies'
          ],
          commands: [
            'npx webpack-bundle-analyzer .next/static/chunks/',
            'npx imagemin-cli src/images/* --out-dir=dist/images',
            'npm ls --depth=0 | grep unused',
            'du -sh .next/static/chunks/*'
          ],
          notes: [
            'Images should be WebP or optimized JPEG/PNG',
            'Use tree shaking to remove unused code',
            'Consider lazy loading for large components'
          ],
          difficulty: 'medium',
          timeEstimate: '30-60 minutes'
        },
        {
          title: 'System Resource Check',
          description: 'Verify and optimize system resources',
          steps: [
            'Check available memory',
            'Monitor CPU usage',
            'Verify disk space',
            'Close unnecessary applications'
          ],
          commands: [
            'free -h',
            'top -o %CPU',
            'df -h',
            'du -sh node_modules/'
          ],
          difficulty: 'easy',
          timeEstimate: '10 minutes'
        },
        {
          title: 'Network Optimization',
          description: 'Optimize for slow network connections',
          steps: [
            'Use compression for uploads',
            'Split large uploads into chunks',
            'Implement retry logic',
            'Choose optimal upload timing'
          ],
          notes: [
            'Deploy during off-peak hours',
            'Use CDN for faster content delivery',
            'Consider geographic proximity to Walrus nodes'
          ],
          difficulty: 'medium',
          timeEstimate: '20-30 minutes'
        }
      ],
      relatedErrors: [
        'too large',
        'size limit',
        'out of memory',
        'disk space',
        'slow',
        'timeout'
      ],
      priority: 'medium'
    });

    // Blockchain and Network Issues
    this?.guides?.set('blockchain-network', {
      title: 'Blockchain and Network Issues',
      description: 'Problems with Sui blockchain connectivity or Walrus network operations',
      symptoms: [
        'Blockchain RPC errors',
        'Transaction failures',
        'Network congestion',
        'Gas estimation failures',
        'Node synchronization issues'
      ],
      causes: [
        'Sui network downtime',
        'High network congestion',
        'RPC endpoint issues',
        'Outdated client software',
        'Walrus storage network problems'
      ],
      solutions: [
        {
          title: 'Network Status Check',
          description: 'Verify blockchain and Walrus network status',
          steps: [
            'Check Sui network status',
            'Verify Walrus network health',
            'Test alternative RPC endpoints',
            'Check for network upgrades'
          ],
          commands: [
            'curl -X POST https://fullnode?.testnet?.sui.io:443 -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","id":1,"method":"sui_getLatestSuiSystemState","params":[]}\'',
            'curl -I https://walrus.site',
            'sui client active-env'
          ],
          notes: [
            'Check official status pages',
            'Join community channels for updates',
            'Network upgrades may cause temporary outages'
          ],
          difficulty: 'easy',
          timeEstimate: '10-15 minutes'
        },
        {
          title: 'RPC Endpoint Configuration',
          description: 'Switch to alternative RPC endpoints',
          steps: [
            'List available RPC endpoints',
            'Test endpoint connectivity',
            'Switch to working endpoint',
            'Update client configuration'
          ],
          commands: [
            'sui client envs',
            'sui client new-env --alias backup-testnet --rpc https://alternative-rpc?.sui?.io',
            'sui client switch --env backup-testnet'
          ],
          difficulty: 'medium',
          timeEstimate: '10 minutes'
        },
        {
          title: 'Transaction Retry Strategy',
          description: 'Handle transaction failures and congestion',
          steps: [
            'Implement exponential backoff',
            'Increase gas budget',
            'Check transaction status',
            'Retry with higher gas price'
          ],
          notes: [
            'Network congestion can cause delays',
            'Higher gas prices improve transaction priority',
            'Some failures are temporary and resolve automatically'
          ],
          difficulty: 'hard',
          timeEstimate: '20-30 minutes'
        }
      ],
      relatedErrors: [
        'rpc error',
        'transaction failed',
        'gas',
        'network congestion',
        'blockchain',
        'sui network'
      ],
      priority: 'high'
    });
  }

  /**
   * Generate markdown troubleshooting guide
   */
  generateMarkdownGuide(guide: TroubleshootingGuide): string {
    let markdown = `# ${guide.title}\n\n`;
    markdown += `${guide.description}\n\n`;
    
    markdown += `**Priority:** ${guide?.priority?.toUpperCase()}\n\n`;
    
    // Symptoms
    markdown += `## Symptoms\n\n`;
    for (const symptom of guide.symptoms) {
      markdown += `- ${symptom}\n`;
    }
    markdown += '\n';
    
    // Causes
    markdown += `## Common Causes\n\n`;
    for (const cause of guide.causes) {
      markdown += `- ${cause}\n`;
    }
    markdown += '\n';
    
    // Solutions
    markdown += `## Solutions\n\n`;
    for (let i = 0; i < guide?.solutions?.length; i++) {
      const solution = guide?.solutions?.[i];
      markdown += `### ${i + 1}. ${solution.title}\n\n`;
      markdown += `${solution.description}\n\n`;
      
      if (solution.timeEstimate) {
        markdown += `**Time Estimate:** ${solution.timeEstimate}\n`;
      }
      markdown += `**Difficulty:** ${solution.difficulty}\n\n`;
      
      markdown += `**Steps:**\n`;
      for (const step of solution.steps) {
        markdown += `1. ${step}\n`;
      }
      markdown += '\n';
      
      if (solution.commands && solution?.commands?.length > 0) {
        markdown += `**Commands:**\n`;
        markdown += '```bash\n';
        for (const command of solution.commands) {
          markdown += `${command}\n`;
        }
        markdown += '```\n\n';
      }
      
      if (solution.notes && solution?.notes?.length > 0) {
        markdown += `**Notes:**\n`;
        for (const note of solution.notes) {
          markdown += `- ${note}\n`;
        }
        markdown += '\n';
      }
    }
    
    return markdown;
  }

  /**
   * Generate complete troubleshooting documentation
   */
  generateCompleteTroubleshootingDoc(): string {
    let doc = `# Walrus Sites Deployment Troubleshooting Guide\n\n`;
    doc += `This comprehensive guide covers common deployment issues and their solutions.\n\n`;
    doc += `## Table of Contents\n\n`;
    
    // Table of contents
    const guides = Array.from(this?.guides?.values());
    for (let i = 0; i < guides.length; i++) {
      doc += `${i + 1}. [${guides[i].title}](#${guides[i].title.toLowerCase().replace(/\s+/g, '-')})\n`;
    }
    doc += '\n';
    
    // Generate each guide
    for (const guide of guides) {
      doc += this.generateMarkdownGuide(guide as any);
      doc += '---\n\n';
    }
    
    return doc;
  }
}