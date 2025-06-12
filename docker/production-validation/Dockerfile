# Production Validation Dockerfile
# Clean environment for comprehensive production readiness testing

FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm@latest

# Install system dependencies
RUN apk add --no-cache git

# Create app directory
WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cli/package.json ./apps/cli/
COPY waltodo-frontend/package.json ./waltodo-frontend/
COPY packages/*/package.json ./packages/*/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy all source code
COPY . .

# Create validation script
COPY docker/production-validation/validate-production.sh /usr/local/bin/validate-production
RUN chmod +x /usr/local/bin/validate-production

# Set working directory to app
WORKDIR /app

# Default command runs validation
CMD ["validate-production"]