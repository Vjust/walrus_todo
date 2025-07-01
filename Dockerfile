# Production Dockerfile for WalTodo CLI
# Assumes project is pre-built and ready for deployment

FROM node:18-alpine

# Install runtime dependencies and security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
        dumb-init \
        tini \
        git \
        bash && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S waltodo && \
    adduser -S waltodo -u 1001 -G waltodo

# Set working directory
WORKDIR /app

# Enable pnpm
RUN corepack enable

# Copy package.json and lock files first for dependency caching
COPY package.json pnpm-lock.yaml ./
COPY apps/cli/package.json ./apps/cli/

# Install all dependencies including TypeScript runtime dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy the built application
COPY --chown=waltodo:waltodo dist/ ./dist/
COPY --chown=waltodo:waltodo bin/ ./bin/
COPY --chown=waltodo:waltodo apps/cli/src/move/ ./apps/cli/src/move/
COPY --chown=waltodo:waltodo oclif.manifest.json ./

# Copy built workspace packages
COPY --chown=waltodo:waltodo packages/ ./packages/

# Copy Docker-optimized CLI script
COPY --chown=waltodo:waltodo docker-waltodo ./docker-waltodo

# Create directories for CLI operation
RUN mkdir -p /app/Todos /home/waltodo/.config/waltodo && \
    chown -R waltodo:waltodo /app /home/waltodo

# Make CLI binaries executable
RUN chmod +x /app/docker-waltodo && \
    chmod +x /app/bin/waltodo 2>/dev/null || echo "Original CLI binary not found"

# Switch to non-root user
USER waltodo

# Set environment variables
ENV NODE_ENV=production
ENV PATH="/app/bin:$PATH"
ENV HOME="/home/waltodo"

# Health check for container validation
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /app/docker-waltodo --version || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Default command - show help
CMD ["/app/docker-waltodo", "--help"]

# Labels for metadata
LABEL maintainer="WalTodo Team"
LABEL description="WalTodo CLI - Blockchain-powered todo management"
LABEL version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/walrus-todo/waltodo"
LABEL org.opencontainers.image.description="A CLI todo application using Sui blockchain and Walrus storage"
LABEL org.opencontainers.image.licenses="ISC"