# Waltodo Docker Environment

This directory contains the Docker setup for running and testing Waltodo in containerized environments.

## Structure

```
docker/
├── Dockerfile          # Multi-stage build for optimized images
├── docker-compose.yml  # Container orchestration
├── .env.example       # Example environment configuration
├── run-e2e-tests.sh   # Convenient test runner script
└── e2e/
    └── workflows.sh   # Comprehensive E2E test suite
```

## Quick Start

1. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Run E2E tests**:
   ```bash
   ./run-e2e-tests.sh
   ```

3. **Run with Docker Compose**:
   ```bash
   docker-compose up -d
   docker exec -it waltodo-app node /app/dist/index.js --help
   ```

## Features

### Multi-Stage Dockerfile
- **Builder stage**: Compiles TypeScript and prepares the application
- **Runtime stage**: Minimal Alpine Linux image with only necessary dependencies
- **Security**: Runs as non-root user
- **Health checks**: Built-in container health monitoring

### Docker Compose Setup
- **Volume mounts**: Persistent data and configuration
- **Network isolation**: Dedicated bridge network
- **Environment configuration**: Flexible configuration via .env file
- **Optional Walrus simulator**: Commented configuration for local testing

### E2E Test Suite
- **Complete lifecycle testing**: CRUD operations on TODOs
- **Data persistence tests**: Verifies data survives container restarts
- **Error handling tests**: Validates graceful error handling
- **Concurrent operations**: Tests parallel TODO operations
- **Colorful output**: Clear test results with color coding

## Usage Examples

### Running specific commands
```bash
# Add a TODO
docker exec -it waltodo-app node /app/dist/index.js add "My TODO"

# List TODOs
docker exec -it waltodo-app node /app/dist/index.js list

# View TODO details
docker exec -it waltodo-app node /app/dist/index.js view <todo-id>
```

### Development mode
```bash
# Build and run with source code mounted
docker-compose -f docker-compose.yml up --build
```

### Running tests with options
```bash
# Skip image rebuild
./run-e2e-tests.sh --skip-build

# Keep containers running after tests
./run-e2e-tests.sh --keep-running

# Clean up before running
./run-e2e-tests.sh --clean
```

## Environment Variables

Key environment variables (see `.env.example` for full list):

- `WALRUS_AGGREGATOR_URL`: Walrus aggregator endpoint
- `WALRUS_PUBLISHER_URL`: Walrus publisher endpoint
- `NODE_ENV`: Application environment (production/development)
- `LOG_LEVEL`: Logging verbosity (debug/info/warn/error)
- `E2E_TEST_MODE`: Enable test mode features

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs waltodo

# Verify build
docker-compose build --no-cache
```

### Tests failing
```bash
# Run in debug mode
LOG_LEVEL=debug ./run-e2e-tests.sh

# Check container health
docker ps
docker exec waltodo-app node -e "console.log('Health check')"
```

### Permission issues
```bash
# Fix ownership
docker exec -u root waltodo-app chown -R nodejs:nodejs /app/data /app/config
```

## Local Walrus Testing

To test with a local Walrus simulator:

1. Uncomment the `walrus-simulator` service in `docker-compose.yml`
2. Update `.env` to use local endpoints:
   ```
   WALRUS_AGGREGATOR_URL=http://walrus-simulator:8080
   WALRUS_PUBLISHER_URL=http://walrus-simulator:8081
   ```
3. Run: `docker-compose up -d`

## Performance Optimization

The Docker setup is optimized for:
- **Small image size**: Multi-stage build removes build dependencies
- **Fast startup**: Minimal runtime dependencies
- **Efficient caching**: Layer optimization for faster rebuilds
- **Resource limits**: Can be configured in docker-compose.yml

## Security Considerations

- Runs as non-root user (nodejs:1001)
- No unnecessary packages in runtime image
- Environment variables for sensitive configuration
- Network isolation between services
- Health checks for monitoring