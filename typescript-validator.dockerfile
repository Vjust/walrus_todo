FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY tsconfig.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Run TypeScript validation
CMD ["pnpm", "typecheck"]