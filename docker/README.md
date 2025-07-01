# WalTodo Docker Compose Testing Environment

This directory contains comprehensive Docker Compose configuration for WalTodo CLI testing and development.

## Quick Start

### 1. Environment Setup

```bash
# Copy the Docker environment template
cp .env.docker .env

# Edit environment variables as needed
vim .env
```

### 2. Basic Usage

```bash
# Start the default testing environment
docker-compose up

# Start specific profile
docker-compose --profile development up
docker-compose --profile testing up
docker-compose --profile performance up

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f waltodo-cli
```

## Available Profiles

### Development Profile (`development`)
- **Services**: `waltodo-cli`, `waltodo-dev`
- **Purpose**: Interactive development with live code mounting
- **Features**: 
  - Source code hot-reloading
  - Debug port exposed (9229)
  - Interactive terminal access
  - Development logging level

```bash
docker-compose --profile development up
```

### Testing Profile (`testing`)
- **Services**: `waltodo-cli`, `waltodo-cli-optimized`, `log-aggregator`, `test-runner`
- **Purpose**: Comprehensive automated testing
- **Features**:
  - Unit, integration, and security tests
  - Log aggregation with Fluent Bit
  - Performance testing variants
  - CI/CD compatible

```bash
docker-compose --profile testing up
```

### Performance Profile (`performance`)
- **Services**: `waltodo-cli-optimized`
- **Purpose**: Performance testing and benchmarking
- **Features**:
  - Optimized build configuration
  - Higher resource allocation
  - Production-like environment
  - Minimal logging overhead

```bash
docker-compose --profile performance up
```

### Monitoring Profile (`monitoring`)
- **Services**: `log-aggregator`
- **Purpose**: Log collection and monitoring
- **Features**:
  - Centralized log aggregation
  - Structured JSON logging
  - Log rotation and compression
  - Real-time log streaming

```bash
docker-compose --profile monitoring up
```

## Service Descriptions

### waltodo-cli
- **Container**: `waltodo-cli-test`
- **Purpose**: Main CLI testing service
- **Profiles**: `development`, `testing`, `default`
- **Features**:
  - Complete WalTodo environment
  - Health checks
  - Comprehensive logging
  - Volume persistence

### waltodo-cli-optimized
- **Container**: `waltodo-cli-optimized`
- **Purpose**: Performance-optimized CLI service
- **Profiles**: `performance`, `testing`
- **Features**:
  - Production build
  - Higher resource limits
  - Reduced logging overhead
  - Faster startup time

### test-runner
- **Container**: `waltodo-test-runner`
- **Purpose**: Automated test execution
- **Profiles**: `testing`, `ci`
- **Features**:
  - Automated test suite execution
  - Coverage reporting
  - CI/CD integration
  - Parallel test execution

### waltodo-dev
- **Container**: `waltodo-dev`
- **Purpose**: Interactive development environment
- **Profiles**: `development`
- **Features**:
  - Interactive terminal
  - Live code mounting
  - Debug port access
  - Development tools

### log-aggregator
- **Container**: `waltodo-log-aggregator`
- **Purpose**: Centralized logging
- **Profiles**: `testing`, `monitoring`
- **Features**:
  - Fluent Bit log collection
  - JSON structured logs
  - Log filtering and routing
  - Output to files and stdout

## Volume Management

### Data Volumes
- `todo_data`: Persistent todo data storage
- `test_data`: Test data and fixtures
- `test_results`: Test execution results
- `logs_data`: Application logs

### Configuration Volumes
- `walrus_config`: Walrus client configuration
- `sui_config`: Sui blockchain configuration

### Cache Volumes
- `cli_node_modules`: Node.js dependencies cache
- `frontend_node_modules`: Frontend dependencies cache
- `build_cache`: Build artifacts cache
- `pnpm_cache`: Package manager cache

### Development Volumes
- `dev_logs`: Development logs
- `coverage_reports`: Test coverage reports
- `aggregated_logs`: Processed log outputs

## Common Commands

### Development Workflow

```bash
# Start development environment
docker-compose --profile development up -d

# Access interactive development container
docker-compose exec waltodo-dev bash

# Install dependencies
docker-compose exec waltodo-dev pnpm install

# Build the CLI
docker-compose exec waltodo-dev pnpm build:dev

# Run CLI commands
docker-compose exec waltodo-dev ./bin/waltodo --help
```

### Testing Workflow

```bash
# Run complete test suite
docker-compose --profile testing up

# Run specific test categories
docker-compose exec test-runner pnpm test:unit
docker-compose exec test-runner pnpm test:integration
docker-compose exec test-runner pnpm test:security

# Generate coverage reports
docker-compose exec test-runner pnpm test:coverage
```

### Performance Testing

```bash
# Start optimized environment
docker-compose --profile performance up -d

# Run performance tests
docker-compose exec waltodo-cli-optimized pnpm test:stress
docker-compose exec waltodo-cli-optimized pnpm test:performance
```

### Log Management

```bash
# View real-time logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f waltodo-cli
docker-compose logs -f test-runner

# Access aggregated logs
docker-compose exec log-aggregator cat /output/waltodo-aggregated.log

# Export logs
docker-compose exec log-aggregator cp /output/waltodo-aggregated.log /logs/
```

## Environment Variables

### Core Configuration
- `NODE_ENV`: Environment mode (development/test/production)
- `LOG_LEVEL`: Logging verbosity (error/warn/info/debug)
- `NETWORK`: Blockchain network (testnet/mainnet/devnet)

### Docker-Specific
- `DOCKER_ENVIRONMENT`: Enables Docker-specific configurations
- `CI`: Enables CI/CD mode optimizations
- `FORCE_COLOR`: Enables colored output in containers

### WalTodo-Specific
- `WALTODO_TEST_MODE`: Enables test mode features
- `WALTODO_SUPPRESS_WARNINGS`: Reduces warning output
- `TODO_PACKAGE_ID`: Smart contract package identifier

### AI Configuration
- `AI_DEFAULT_PROVIDER`: AI service provider (xai/openai/anthropic)
- `AI_DEFAULT_MODEL`: Default AI model
- `XAI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`: API credentials

## Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check container status
docker-compose ps

# View container logs
docker-compose logs waltodo-cli

# Rebuild containers
docker-compose build --no-cache
```

#### Permission Issues
```bash
# Fix volume permissions
docker-compose exec waltodo-cli sudo chown -R testuser:testuser /home/testuser/waltodo
```

#### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"
docker-compose up
```

#### Network Issues
```bash
# Reset Docker networks
docker-compose down
docker network prune
docker-compose up
```

### Health Check Failures
```bash
# Check health status
docker-compose ps

# Manual health check
docker-compose exec waltodo-cli ./bin/waltodo --help

# View health check logs
docker-compose logs waltodo-cli | grep health
```

### Log Aggregation Issues
```bash
# Check Fluent Bit status
docker-compose exec log-aggregator fluent-bit --version

# Validate configuration
docker-compose exec log-aggregator fluent-bit --dry-run
```

## Advanced Usage

### Custom Configurations

#### Environment Override
```bash
# Use custom environment file
docker-compose --env-file .env.custom up
```

#### Service Override
```bash
# Create docker-compose.override.yml
version: '3.8'
services:
  waltodo-cli:
    environment:
      - CUSTOM_VAR=custom_value
```

#### Profile Combinations
```bash
# Multiple profiles
docker-compose --profile development --profile monitoring up
```

### Production Deployment

#### Security Considerations
- Use secret management for API keys
- Enable signature verification in production
- Use encrypted storage for sensitive data
- Implement proper network isolation

#### Resource Optimization
- Adjust memory limits based on workload
- Use production-optimized builds
- Enable log rotation and compression
- Monitor resource usage

#### Monitoring Integration
- Export logs to external systems
- Set up alerting for health check failures
- Monitor container resource usage
- Track application performance metrics

## File Structure

```
docker/
├── README.md                 # This documentation
├── fluent-bit.conf          # Log aggregation configuration
└── production-validation/   # Production validation setup
    ├── Dockerfile
    ├── docker-compose.yml
    └── validate-production.sh

.env.docker                  # Docker environment template
docker-compose.yml          # Main compose configuration
Dockerfile.test             # CLI testing Dockerfile
Dockerfile.test.optimized   # Optimized testing Dockerfile
```

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review container logs: `docker-compose logs`
3. Validate configuration: `docker-compose config`
4. Check the main project documentation in `/docs`

## Contributing

When modifying the Docker setup:
1. Test all profiles: `development`, `testing`, `performance`, `monitoring`
2. Validate compose configuration: `docker-compose config`
3. Update this documentation
4. Test on clean environment