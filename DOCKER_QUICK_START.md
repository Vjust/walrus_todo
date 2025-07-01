# WalTodo Docker Compose Quick Start

This guide helps you quickly get started with the WalTodo Docker testing environment.

## 🚀 Quick Start (30 seconds)

```bash
# 1. Validate environment
./validate-docker-compose.sh

# 2. Start development environment
./docker-start.sh

# 3. Check status
./docker-status.sh
```

## 📋 Prerequisites

- Docker (>= 20.10)
- Docker Compose (>= 2.0)
- 4GB+ available memory
- 10GB+ available disk space

## 🛠️ Available Commands

### Startup Scripts
- `./docker-start.sh` - Interactive startup with options
- `./docker-start.sh -p testing -d` - Background testing environment
- `./docker-start.sh -p development` - Development with live code
- `./docker-start.sh -p performance -r` - Performance testing with rebuild

### Management Scripts
- `./validate-docker-compose.sh` - Validate configuration
- `./docker-status.sh` - Show environment status
- `docker-compose logs -f` - View live logs
- `docker-compose down` - Stop all services

## 🔧 Profiles Explained

| Profile | Services | Purpose | Use Case |
|---------|----------|---------|----------|
| `development` | CLI + Dev | Interactive development | Code changes, debugging |
| `testing` | CLI + Tests + Logs | Automated testing | CI/CD, validation |
| `performance` | Optimized CLI | Performance testing | Benchmarking, load testing |
| `monitoring` | Log Aggregator | Log collection | Monitoring, analysis |

## 📂 Key Files Created

```
docker-compose.yml          # Main compose configuration
.env.docker                 # Environment template  
.env                        # Active environment (created)
docker/
  ├── README.md            # Detailed documentation
  └── fluent-bit.conf      # Log aggregation config
docker-start.sh             # Easy startup script
docker-status.sh            # Status checker
validate-docker-compose.sh  # Validation script
```

## 🐳 Container Architecture

### Main Services
- **waltodo-cli**: Main CLI testing container with full environment
- **waltodo-cli-optimized**: Performance-optimized variant
- **test-runner**: Automated test execution
- **waltodo-dev**: Interactive development environment
- **log-aggregator**: Fluent Bit log collection

### Data Persistence
- **todo_data**: Todo files and user data
- **test_results**: Test execution results  
- **logs_data**: Application logs
- **walrus_config**: Walrus blockchain configuration
- **sui_config**: Sui blockchain configuration

## 🔍 Logging Features

### Structured JSON Logs
- Service identification tags
- Log level filtering
- Automatic rotation (10MB, 3 files)
- Centralized aggregation with Fluent Bit

### Log Locations
- Container logs: `docker-compose logs -f`
- Aggregated logs: `logs-docker/` volume
- Real-time: Fluent Bit web interface (port 2020)

## 🌐 Network Configuration

- **Isolated network**: `waltodo-test-network`
- **Subnet**: `172.20.0.0/16`
- **Service discovery**: Automatic between containers
- **External access**: Only development debug port (9229)

## ⚡ Performance Optimizations

### Resource Limits
- **Development**: 2 CPU, 4GB RAM
- **Performance**: 4 CPU, 8GB RAM
- **Testing**: 2 CPU, 6GB RAM

### Cache Strategy
- Node modules volume mounting
- Build cache persistence
- Package manager cache
- Multi-stage Docker builds

## 🔒 Security Features

- Non-root user in containers (`testuser`)
- Isolated networks
- Secret management via environment variables
- Health checks for service validation
- Resource limits to prevent abuse

## 🐛 Troubleshooting

### Common Issues

#### Permission Errors
```bash
# Fix volume permissions
docker-compose exec waltodo-cli sudo chown -R testuser:testuser /home/testuser/waltodo
```

#### Memory Issues
```bash
# Increase memory limits in .env
echo "NODE_OPTIONS=--max-old-space-size=8192" >> .env
```

#### Port Conflicts
```bash
# Check for conflicts
docker-compose ps
netstat -tulpn | grep :9229
```

#### Build Failures
```bash
# Clean rebuild
./docker-start.sh -r
# or
docker-compose build --no-cache
```

### Health Checks
```bash
# Check service health
docker-compose ps
./docker-status.sh

# Manual health test
docker-compose exec waltodo-cli ./bin/waltodo --help
```

### Log Debugging
```bash
# View specific service logs
docker-compose logs waltodo-cli
docker-compose logs test-runner

# Follow logs in real-time
docker-compose logs -f --tail=50

# Access log aggregator
docker-compose exec log-aggregator cat /output/waltodo-aggregated.log
```

## 🚀 Advanced Usage

### Custom Environment
```bash
# Create custom .env
cp .env.docker .env.custom
# Edit .env.custom
docker-compose --env-file .env.custom up
```

### Development Workflow
```bash
# Start development environment
./docker-start.sh -p development

# Access container
docker-compose exec waltodo-dev bash

# Live development
# Files are mounted from host, changes reflect immediately
```

### CI/CD Integration
```bash
# For automated testing
./docker-start.sh -p testing -d
docker-compose exec test-runner pnpm test:ci
docker-compose down
```

### Performance Testing
```bash
# Start optimized environment
./docker-start.sh -p performance -d

# Run benchmarks
docker-compose exec waltodo-cli-optimized pnpm test:stress
docker-compose exec waltodo-cli-optimized pnpm test:performance
```

## 📊 Monitoring & Metrics

### Resource Monitoring
```bash
# Container resource usage
docker stats

# Disk usage
docker system df
./docker-status.sh
```

### Application Metrics
- Health check endpoints in containers
- Structured logging with metrics
- Performance test results in `test_results/`

## 🔗 Next Steps

1. **Read detailed docs**: `docker/README.md`
2. **Explore services**: Try different profiles
3. **Customize environment**: Edit `.env` file
4. **Integrate CI/CD**: Use testing profile
5. **Monitor performance**: Use performance profile

## 💡 Tips

- Use `./docker-status.sh` to check environment health
- Logs are automatically rotated and compressed
- Development changes reflect immediately (live mounting)
- Each profile serves different purposes - use appropriately
- Volume data persists between container restarts

---

**Quick Reference**: `./docker-start.sh -h` for all options