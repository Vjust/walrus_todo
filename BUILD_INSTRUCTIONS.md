# Docker Build Instructions for WalTodo CLI

## Prerequisites

Before building the Docker image, you need to prepare the project:

### 1. Build the Project Locally

```bash
# Install dependencies
pnpm install

# Build workspace packages
pnpm run build:shared

# Build the CLI (development build to avoid TypeScript issues)
pnpm run build:dev
```

### 2. Verify Build Success

```bash
# Test the CLI locally
./bin/waltodo --help

# Or test with Node directly
node dist/src/index.js --help
```

## Docker Deployment

### Option 1: Simple Container (Recommended)

If the local build works, use this simpler Dockerfile:

```dockerfile
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache bash tini git

# Create non-root user
RUN addgroup -g 1001 -S waltodo && \
    adduser -S waltodo -u 1001 -G waltodo

WORKDIR /app

# Copy the entire built project
COPY --chown=waltodo:waltodo . .

# Install production dependencies
RUN npm ci --only=production

# Create required directories
RUN mkdir -p /app/Todos /home/waltodo/.config/waltodo && \
    chown -R waltodo:waltodo /app /home/waltodo

USER waltodo

# Environment setup
ENV NODE_ENV=production
ENV PATH="/app/bin:$PATH"
ENV HOME="/home/waltodo"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD ./bin/waltodo --version || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./bin/waltodo", "--help"]
```

### Option 2: Multi-stage Build (Advanced)

For a more optimized build that compiles in Docker:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

RUN apk add --no-cache python3 make g++ git
RUN corepack enable

WORKDIR /app

# Copy source
COPY . .

# Install and build
RUN pnpm install
RUN pnpm run build:shared
RUN pnpm run build:dev

# Runtime stage
FROM node:18-alpine AS runtime

RUN apk add --no-cache bash tini git
RUN addgroup -g 1001 -S waltodo && \
    adduser -S waltodo -u 1001 -G waltodo

WORKDIR /app

# Copy built artifacts
COPY --from=builder --chown=waltodo:waltodo /app/dist ./dist
COPY --from=builder --chown=waltodo:waltodo /app/bin ./bin
COPY --from=builder --chown=waltodo:waltodo /app/packages ./packages
COPY --from=builder --chown=waltodo:waltodo /app/node_modules ./node_modules
COPY --from=builder --chown=waltodo:waltodo /app/package*.json ./

USER waltodo
ENV NODE_ENV=production

CMD ["./bin/waltodo", "--help"]
```

## Build Commands

```bash
# Build production image
docker build -t waltodo-cli:latest .

# Test the image
docker run --rm waltodo-cli:latest

# Run with persistent data
docker run --rm -it \
  -v $(pwd)/docker-data:/app/Todos \
  waltodo-cli:latest waltodo list

# Use Docker Compose
docker-compose up waltodo-cli
```

## Troubleshooting

### Common Issues

1. **Module not found errors**: Ensure workspace packages are built
2. **Permission errors**: Check file ownership in container
3. **CLI binary not found**: Verify bin/waltodo exists and is executable
4. **Build failures**: Try building locally first to identify issues

### Debug Commands

```bash
# Check container contents
docker run --rm -it waltodo-cli:latest /bin/sh

# Test CLI directly
docker run --rm waltodo-cli:latest node dist/src/index.js --help

# Check file permissions
docker run --rm waltodo-cli:latest ls -la bin/

# Test workspace packages
docker run --rm waltodo-cli:latest ls -la packages/
```

## Production Deployment

### Using Docker Compose

Create a `docker-compose.prod.yml`:

```yaml
version: '3.8'
services:
  waltodo:
    image: waltodo-cli:latest
    container_name: waltodo-cli
    restart: unless-stopped
    volumes:
      - ./data/todos:/app/Todos
      - ./data/config:/home/waltodo/.config/waltodo
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "./bin/waltodo", "--version"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Using Kubernetes

Create deployment manifests:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: waltodo-cli
spec:
  replicas: 1
  selector:
    matchLabels:
      app: waltodo-cli
  template:
    metadata:
      labels:
        app: waltodo-cli
    spec:
      containers:
      - name: waltodo-cli
        image: waltodo-cli:latest
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: todos-data
          mountPath: /app/Todos
        env:
        - name: NODE_ENV
          value: "production"
      volumes:
      - name: todos-data
        persistentVolumeClaim:
          claimName: waltodo-data
```

## Image Optimization

Current image characteristics:
- Base: Alpine Linux (~5MB)
- Node.js 18: ~40MB
- Dependencies: ~200MB
- Total: ~250MB

Optimization strategies:
1. Multi-stage builds to exclude dev dependencies
2. Alpine-based images for smaller size
3. Layer caching for faster builds
4. .dockerignore to exclude unnecessary files

## Security Considerations

- Runs as non-root user (UID 1001)
- Read-only root filesystem (optional)
- Resource limits configured
- Security updates via Alpine packages
- No unnecessary capabilities