# Open Design daemon — Docker sidecar for CodePulse Design Studio
FROM node:24-alpine AS base

RUN apk add --no-cache curl git

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

EXPOSE 17456 17573

ENV OD_DATA_DIR=/app/.od

CMD ["pnpm", "tools-dev", "run", "web", "--daemon-port", "17456", "--web-port", "17573"]
