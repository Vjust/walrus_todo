# Multi-stage Dockerfile for Waltodo

# Builder stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the project
RUN pnpm run build

# Runtime stage
FROM node:20-alpine AS runtime

# Install required runtime dependencies
RUN apk add --no-cache \
    bash \
    curl \
    jq \
    git

# Install pnpm for runtime (needed for global installs)
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

# Create app directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/node_modules ./node_modules

# Create directories for data persistence
RUN mkdir -p /app/data /app/config

# Set environment variables
ENV NODE_ENV=production
ENV WALTODO_DATA_DIR=/app/data
ENV WALTODO_CONFIG_DIR=/app/config

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Make the CLI executable
RUN chmod +x /app/dist/index.js

# Add the app to PATH
ENV PATH="/app/dist:${PATH}"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Default command
ENTRYPOINT ["node", "/app/dist/index.js"]
CMD ["--help"]