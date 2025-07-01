# Docker Deployment Guide for WalTodo CLI

This guide provides comprehensive instructions for building and deploying the WalTodo CLI using Docker.

## Quick Start

**Important**: Build the project locally first before creating Docker images.

### 1. Prepare the Project

```bash
# Install dependencies
pnpm install

# Build workspace packages
pnpm run build:shared

# Build the CLI (development build to avoid TypeScript strict mode issues)
pnpm run build:dev

# Test locally to ensure it works
./bin/waltodo --help
```

### 2. Build and Run Docker Image

```bash
# Build the production image (simple approach)
docker build -f Dockerfile.simple -t waltodo-cli:latest .

# Run the CLI container
docker run --rm -it waltodo-cli:latest

# Run with persistent data
docker run --rm -it \
  -v $(pwd)/docker-data/todos:/app/Todos \
  -v $(pwd)/docker-data/config:/home/waltodo/.config/waltodo \
  waltodo-cli:latest
```

### 3. Using Docker Compose

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up waltodo-cli

# Run CLI command
docker-compose -f docker-compose.prod.yml exec waltodo-cli /app/bin/waltodo --help

# Stop services
docker-compose -f docker-compose.prod.yml down
```

## Docker Image Architecture

### Multi-Stage Build Process

The Dockerfile uses a two-stage build process for optimization:

1. **Builder Stage** (`node:18-alpine`)
   - Installs build dependencies (Python, make, g++)
   - Installs pnpm package manager
   - Copies source code and builds the application
   - Generates manifest and prunes dev dependencies

2. **Runtime Stage** (`node:18-alpine`)
   - Minimal runtime environment
   - Security hardening with non-root user
   - Includes only production dependencies
   - Configured for CLI operation

### Security Features

- **Non-root user**: Runs as user `waltodo` (UID 1001)
- **Minimal attack surface**: Alpine Linux base with only essential packages
- **Security updates**: Automatic package updates during build
- **Signal handling**: Uses `tini` as init system for proper process management
- **No new privileges**: Security option prevents privilege escalation

### Optimization Features

- **Layer caching**: Dependencies installed before source code copy
- **Production build**: Optimized TypeScript compilation
- **Pruned dependencies**: Only production packages in final image
- **Health checks**: Container validation with CLI version check
- **Resource limits**: Configurable memory and CPU constraints

## Build Commands

### Basic Build

```bash
# Build production image
docker build -t waltodo-cli:latest .

# Build with specific tag
docker build -t waltodo-cli:v1.0.0 .

# Build development image (builder stage only)
docker build --target builder -t waltodo-cli:dev .
```

### Advanced Build Options

```bash
# Build with build arguments
docker build \
  --build-arg NODE_ENV=production \
  --build-arg PNPM_VERSION=10.11.0 \
  -t waltodo-cli:latest .

# Build with cache optimization
docker build \
  --cache-from waltodo-cli:latest \
  -t waltodo-cli:latest .

# Multi-platform build
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t waltodo-cli:latest .
```

## Docker Testing

### Comprehensive Test Runner

The `docker-test.sh` script provides comprehensive testing of the Docker environment with validation, build, run, test, monitor, and cleanup pipeline.

#### Quick Testing

```bash
# Run complete test suite
./docker-test.sh

# Quick validation test
./docker-test.sh --quick

# Run with verbose debug output
./docker-test.sh --verbose

# Test existing containers (skip build)
./docker-test.sh --test-only
```

#### Build and Test Options

```bash
# Only build Docker image
./docker-test.sh --build-only

# Skip Docker image build
./docker-test.sh --skip-build

# Skip health check validation
./docker-test.sh --skip-health-check

# Keep containers running after test
./docker-test.sh --no-cleanup
```

#### Performance Testing

```bash
# Include memory usage testing
./docker-test.sh --memory-test

# Include performance benchmarking
./docker-test.sh --performance-test

# Full performance suite
./docker-test.sh --memory-test --performance-test --verbose
```

#### Test Features

The docker-test.sh script provides:

- ✅ **Health Check Validation** - Container health and readiness
- ✅ **CLI Command Testing** - All basic and extended CLI operations
- ✅ **Log Monitoring** - Container log analysis for errors
- ✅ **Performance Benchmarking** - Memory, CPU, and response time testing
- ✅ **Automated Cleanup** - Container and volume cleanup
- ✅ **Detailed Reporting** - HTML and text reports with analysis
- ✅ **Error Pattern Detection** - Automatic log analysis for common issues

#### Test Output

```bash
# Test results location
logs-docker/          # Detailed test logs
test-results/         # Test result files and analysis
test-results/docker-test-report_[timestamp].html  # Comprehensive HTML report
```

#### Example Test Run

```bash
$ ./docker-test.sh --quick
🔹 WalTodo Docker Test Runner

============================================= 
 Prerequisites Validation 
=============================================

✅ Docker is available
✅ Docker service is running  
✅ Docker Compose is available
✅ Found docker-compose.yml
✅ Found Dockerfile.test
✅ Found package.json
✅ All prerequisites validated successfully

============================================= 
 Building Docker Image 
=============================================

🔹 Building Docker image: waltodo-test:latest
✅ Docker image built successfully

============================================= 
 CLI Functionality Testing 
=============================================

🔹 Testing basic CLI commands
🔹 Testing: waltodo --help
✅ waltodo --help
🔹 Testing: waltodo --version  
✅ waltodo --version
🔹 Testing: waltodo list
✅ waltodo list

✅ CLI functionality tests passed (100% success rate)

🎉 All Docker tests completed successfully!
```

### Manual Testing Commands

For manual validation and troubleshooting:

```bash
# Start test environment
docker-compose --profile testing up -d

# Run individual tests
docker-compose exec waltodo-cli waltodo --help
docker-compose exec waltodo-cli waltodo list
docker-compose exec waltodo-cli waltodo config --show

# Check container health
docker-compose ps
docker inspect waltodo-cli-test --format='{{.State.Health.Status}}'

# Monitor logs
docker-compose logs -f waltodo-cli

# Stop test environment
docker-compose --profile testing down
```

### Integration with CI/CD

The docker-test.sh script is designed for CI/CD integration:

```yaml
# Example GitHub Actions step
- name: Run Docker Tests
  run: |
    chmod +x docker-test.sh
    ./docker-test.sh --performance-test
    
# Example Jenkins pipeline step
stage('Docker Testing') {
    steps {
        sh './docker-test.sh --verbose --performance-test'
        publishHTML([
            allowMissing: false,
            alwaysLinkToLastBuild: true,
            keepAll: true,
            reportDir: 'test-results',
            reportFiles: 'docker-test-report_*.html',
            reportName: 'Docker Test Report'
        ])
    }
}
```

## Usage Examples

### Basic CLI Commands

```bash
# Show help
docker run --rm waltodo-cli:latest

# List todos
docker run --rm -v $(pwd)/docker-data:/app/Todos waltodo-cli:latest waltodo list

# Add a todo
docker run --rm -v $(pwd)/docker-data:/app/Todos waltodo-cli:latest waltodo add "Buy groceries"

# Interactive mode
docker run --rm -it -v $(pwd)/docker-data:/app/Todos waltodo-cli:latest waltodo interactive
```

### Development Usage

```bash
# Run development container with source mounting
docker run --rm -it \
  -v $(pwd):/app \
  -v /app/node_modules \
  waltodo-cli:dev \
  /bin/sh

# Development with Docker Compose
docker-compose --profile dev up waltodo-dev
```

### Production Deployment

```bash
# Create required directories
mkdir -p docker-data/{production,development}/{todos,config}

# Start production service
docker-compose up -d waltodo-cli

# Execute CLI commands
docker-compose exec waltodo-cli waltodo --version
docker-compose exec waltodo-cli waltodo list
docker-compose exec waltodo-cli waltodo add "Containerized todo"

# View logs
docker-compose logs -f waltodo-cli

# Stop services
docker-compose down
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node.js environment | `production` |
| `WALTODO_CONFIG_DIR` | Configuration directory | `/app/config` |
| `WALTODO_DEBUG` | Enable debug logging | `false` |
| `HOME` | User home directory | `/home/waltodo` |

### Volume Mounts

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `./docker-data/todos` | `/app/Todos` | Todo data persistence |
| `./docker-data/config` | `/home/waltodo/.config/waltodo` | CLI configuration |

### Network Configuration

The Docker Compose setup creates an isolated network (`waltodo-network`) with:
- Bridge driver for container communication
- Subnet: `172.20.0.0/16`
- Automatic DNS resolution between services

## Troubleshooting

### Common Issues

1. **Permission Issues**
   ```bash
   # Fix ownership of mounted volumes
   sudo chown -R 1001:1001 docker-data/
   ```

2. **Build Failures**
   ```bash
   # Clear Docker build cache
   docker builder prune -a
   
   # Rebuild without cache
   docker build --no-cache -t waltodo-cli:latest .
   ```

3. **Container Health Check Failures**
   ```bash
   # Check container logs
   docker logs waltodo-cli
   
   # Inspect health status
   docker inspect waltodo-cli | grep -A 5 Health
   ```

### Debug Mode

```bash
# Run with debug output
docker run --rm -it \
  -e WALTODO_DEBUG=true \
  -e NODE_ENV=development \
  waltodo-cli:latest waltodo --help

# Access container shell
docker run --rm -it waltodo-cli:latest /bin/sh
```

### Resource Monitoring

```bash
# Monitor container resources
docker stats waltodo-cli

# Check container processes
docker exec waltodo-cli ps aux

# Inspect container configuration
docker inspect waltodo-cli
```

## Performance Optimization

### Image Size Optimization

- Current image size: ~200MB (Alpine base + Node.js runtime)
- Multi-stage build reduces size by ~60%
- `.dockerignore` excludes unnecessary files
- Production dependencies only in runtime stage

### Runtime Performance

- Memory limit: 512MB (configurable)
- CPU limit: 0.5 cores (configurable)
- Health check interval: 30 seconds
- Startup time: ~5-10 seconds

### Build Performance

- Layer caching for dependencies
- Parallel dependency installation with pnpm
- Frozen lockfile for consistent builds
- Build context optimization with `.dockerignore`

## Security Considerations

1. **Base Image**: Uses official Node.js Alpine images with security updates
2. **User Permissions**: Runs as non-root user (UID 1001)
3. **Attack Surface**: Minimal package installation
4. **Secrets**: Environment variables for sensitive configuration
5. **Network**: Isolated container network
6. **Resource Limits**: Prevents resource exhaustion attacks

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Build and Deploy Docker Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t waltodo-cli:${{ github.sha }} .
      - name: Test image
        run: docker run --rm waltodo-cli:${{ github.sha }} waltodo --version
```

### Production Deployment

```bash
# Tag for registry
docker tag waltodo-cli:latest your-registry.com/waltodo-cli:latest

# Push to registry
docker push your-registry.com/waltodo-cli:latest

# Deploy with compose
docker-compose -f docker-compose.prod.yml up -d
```

## Monitoring and Logging

### Health Monitoring

```bash
# Check health status
docker-compose ps

# Health check logs
docker-compose logs waltodo-cli | grep health
```

### Application Logs

```bash
# Follow logs
docker-compose logs -f waltodo-cli

# Export logs
docker-compose logs waltodo-cli > waltodo-cli.log
```

### Metrics Collection

The container exposes health check endpoints and can be integrated with monitoring solutions like:
- Prometheus + Grafana
- ELK Stack
- Docker native monitoring
- Cloud provider monitoring (AWS CloudWatch, etc.)