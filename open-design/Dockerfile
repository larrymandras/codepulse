# Open Design daemon — Docker sidecar for CodePulse Design Studio
# Requires: git clone https://github.com/nexu-io/open-design.git ./open-design
# RESEARCH.md Pitfall 7: MUST use node:24 — better-sqlite3 native binding requires matching ABI
FROM node:24-alpine AS base

# Install curl for healthcheck and git for potential deps
RUN apk add --no-cache curl git

# Enable corepack for pnpm (RESEARCH.md: pnpm 10.33.x via corepack)
RUN corepack enable

WORKDIR /app

# Copy package files first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy remaining source
COPY . .

# Expose daemon default port (RESEARCH.md: 17456)
EXPOSE 17456

# Set data directory (RESEARCH.md: OD_DATA_DIR env var)
ENV OD_DATA_DIR=/app/.od

# Start the daemon (RESEARCH.md: verified start command)
CMD ["pnpm", "tools-dev", "start", "web"]
