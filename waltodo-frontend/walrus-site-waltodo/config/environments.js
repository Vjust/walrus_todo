/**
 * Environment-specific Configuration Manager
 * 
 * Manages different configurations for development, staging, and production environments
 * Provides optimized settings for each environment type
 */

const fs = require('fs');
const path = require('path');

class EnvironmentConfig {
  constructor() {
    this.environments = {
      development: this.getDevelopmentConfig(),
      staging: this.getStagingConfig(),
      production: this.getProductionConfig()
    };
  }

  // Development configuration - optimized for fast iteration
  getDevelopmentConfig() {
    return {
      siteName: 'waltodo-dev',
      network: 'testnet',
      
      headers: {
        // Minimal caching for development
        "/*": [
          "Cache-Control: no-cache, no-store, must-revalidate",
          "Pragma: no-cache",
          "Expires: 0",
          "X-Content-Type-Options: nosniff"
        ],
        
        // Allow hot reloading
        "/_next/webpack-hmr": [
          "Cache-Control: no-cache",
          "Access-Control-Allow-Origin: *"
        ],
        
        // Basic security for development
        "*.html": [
          "X-Frame-Options: SAMEORIGIN",
          "Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval' *; connect-src 'self' ws: wss: *"
        ]
      },
      
      redirects: [
        {
          from: "/api/*",
          to: "http://localhost:3001/api/*",
          status: 307
        }
      ],
      
      errorPages: {
        404: "/404.html"
      },
      
      performance: {
        compression: {
          enabled: false // Disable for faster builds
        },
        minification: false,
        sourceMaps: true,
        hotReload: true
      },
      
      debugging: {
        verbose: true,
        showBuildStats: true,
        preserveConsole: true
      }
    };
  }

  // Staging configuration - production-like with debugging
  getStagingConfig() {
    return {
      siteName: 'waltodo-staging',
      network: 'testnet',
      
      headers: {
        // Moderate caching for staging
        "/_next/static/*": [
          "Cache-Control: public, max-age=3600, immutable",
          "X-Content-Type-Options: nosniff"
        ],
        
        "/images/*": [
          "Cache-Control: public, max-age=1800",
          "X-Content-Type-Options: nosniff"
        ],
        
        "*.{js,css}": [
          "Cache-Control: public, max-age=1800",
          "X-Content-Type-Options: nosniff"
        ],
        
        "*.html": [
          "Cache-Control: public, max-age=300",
          "X-Content-Type-Options: nosniff",
          "X-Frame-Options: DENY",
          "X-XSS-Protection: 1; mode=block",
          "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; connect-src 'self' https: wss:"
        ],
        
        "/*": [
          "Cache-Control: public, max-age=300",
          "X-Content-Type-Options: nosniff",
          "X-Frame-Options: DENY"
        ]
      },
      
      redirects: [
        {
          from: "/api/*",
          to: "https://staging-api.waltodo.com/api/*",
          status: 307
        }
      ],
      
      errorPages: {
        404: "/404.html",
        500: "/404.html"
      },
      
      performance: {
        compression: {
          enabled: true,
          level: 4
        },
        minification: true,
        sourceMaps: true, // Keep for debugging
        monitoring: true
      },
      
      debugging: {
        verbose: true,
        showBuildStats: true,
        preserveConsole: false
      }
    };
  }

  // Production configuration - fully optimized
  getProductionConfig() {
    return {
      siteName: 'waltodo-prod',
      network: 'mainnet',
      
      headers: {
        // Aggressive caching for static assets
        "/_next/static/*": [
          "Cache-Control: public, max-age=31536000, immutable",
          "X-Content-Type-Options: nosniff",
          "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload"
        ],
        
        "/images/*": [
          "Cache-Control: public, max-age=604800",
          "X-Content-Type-Options: nosniff",
          "Accept-Ranges: bytes"
        ],
        
        "*.{js,css,mjs}": [
          "Cache-Control: public, max-age=604800",
          "X-Content-Type-Options: nosniff"
        ],
        
        "*.{woff,woff2,ttf,eot}": [
          "Cache-Control: public, max-age=31536000",
          "X-Content-Type-Options: nosniff",
          "Access-Control-Allow-Origin: https://waltodo.com"
        ],
        
        "/config/*.json": [
          "Cache-Control: public, max-age=600",
          "Content-Type: application/json",
          "X-Content-Type-Options: nosniff"
        ],
        
        "*.html": [
          "Cache-Control: public, max-age=600",
          "X-Content-Type-Options: nosniff",
          "X-Frame-Options: DENY",
          "X-XSS-Protection: 1; mode=block",
          "Referrer-Policy: strict-origin-when-cross-origin",
          "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; connect-src 'self' https: wss:; font-src 'self' https: data:; object-src 'none'; media-src 'self' https:; worker-src 'self' blob:; child-src 'self' https:; form-action 'self'; upgrade-insecure-requests",
          "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload"
        ],
        
        "/*": [
          "Cache-Control: public, max-age=600",
          "X-Content-Type-Options: nosniff",
          "X-Frame-Options: DENY",
          "X-XSS-Protection: 1; mode=block",
          "Referrer-Policy: strict-origin-when-cross-origin",
          "Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()",
          "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload"
        ]
      },
      
      redirects: [
        {
          from: "/api/*",
          to: "https://api.waltodo.com/api/*",
          status: 307
        },
        {
          from: "http://*",
          to: "https://*",
          status: 301
        }
      ],
      
      errorPages: {
        404: "/404.html",
        500: "/404.html",
        503: "/404.html"
      },
      
      performance: {
        compression: {
          enabled: true,
          level: 9,
          types: [
            "text/html",
            "text/css", 
            "text/javascript",
            "application/javascript",
            "application/json",
            "text/xml",
            "application/xml",
            "image/svg+xml"
          ]
        },
        minification: true,
        sourceMaps: false, // Remove for production
        monitoring: true,
        cdn: {
          enabled: true,
          domains: ["cdn.waltodo.com"]
        }
      },
      
      debugging: {
        verbose: false,
        showBuildStats: false,
        preserveConsole: false
      }
    };
  }

  // Get configuration for specific environment
  getConfig(environment = 'development') {
    if (!this.environments[environment]) {
      throw new Error(`Unknown environment: ${environment}. Available: ${Object.keys(this.environments).join(', ')}`);
    }
    
    return {
      environment,
      timestamp: new Date().toISOString(),
      ...this.environments[environment]
    };
  }

  // Generate YAML configuration for deployment
  generateYAML(environment = 'development', outputPath = null) {
    const config = this.getConfig(environment);
    const yaml = require('js-yaml');
    
    const yamlContent = yaml.dump({
      [config.siteName]: {
        source: path.resolve(__dirname, '..', 'out'),
        network: config.network,
        headers: config.headers,
        redirects: config.redirects,
        error_pages: config.errorPages,
        performance: config.performance
      }
    }, {
      indent: 2,
      lineWidth: 120
    });

    const header = `# Walrus Sites Configuration for WalTodo Frontend
# Environment: ${environment}
# Generated: ${config.timestamp}
# Auto-generated - do not edit manually

`;

    const fullContent = header + yamlContent;

    if (outputPath) {
      fs.writeFileSync(outputPath, fullContent);
      console.log(`✅ Generated ${environment} configuration: ${outputPath}`);
    }

    return fullContent;
  }

  // Validate environment configuration
  validateConfig(environment = 'development') {
    const config = this.getConfig(environment);
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!config.siteName) errors.push('Missing siteName');
    if (!config.network) errors.push('Missing network');
    if (!config.headers) errors.push('Missing headers');

    // Environment-specific validations
    if (environment === 'production') {
      // Production should have HTTPS redirects
      const hasHttpsRedirect = config.redirects?.some(r => 
        r.from.includes('http://') && r.to.includes('https://')
      );
      if (!hasHttpsRedirect) {
        warnings.push('Production should redirect HTTP to HTTPS');
      }

      // Production should have HSTS headers
      const hasHSTS = Object.values(config.headers).some(headers =>
        headers.some(h => h.includes('Strict-Transport-Security'))
      );
      if (!hasHSTS) {
        warnings.push('Production should include HSTS headers');
      }
    }

    return { errors, warnings, isValid: errors.length === 0 };
  }
}

module.exports = { EnvironmentConfig };

// CLI usage
if (require.main === module) {
  const envConfig = new EnvironmentConfig();
  const environment = process.argv[2] || 'development';
  const outputPath = process.argv[3];

  try {
    // Validate configuration
    const validation = envConfig.validateConfig(environment);
    
    if (validation.errors.length > 0) {
      console.error('❌ Configuration errors:', validation.errors);
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      console.warn('⚠️  Configuration warnings:', validation.warnings);
    }

    // Generate YAML
    const yamlContent = envConfig.generateYAML(environment, outputPath);
    
    if (!outputPath) {
      console.log(yamlContent);
    }

    console.log(`✅ Environment configuration ready: ${environment}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}