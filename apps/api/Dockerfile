# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS builder
WORKDIR /app

# Build dependencies for native modules across architectures (e.g. argon2)
RUN apk add --no-cache python3 make g++

# Copy dependency manifests & packages
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies and compile monorepo dependencies
RUN find . -name "*.tsbuildinfo" -delete
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@repo/api

# Isolate production dependencies and bundle artifacts
RUN pnpm --filter=@repo/api --prod deploy /app/deployed
RUN cp -r apps/api/dist/. /app/deployed/dist/
RUN mkdir -p /app/deployed/dist/core/database/sql && \
    cp -r apps/api/src/core/database/sql/* /app/deployed/dist/core/database/sql/ 2>/dev/null || true

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Security: Run as non-root user (docs/rules/10-infra-devops.md B2)
RUN addgroup -g 10001 -S appgroup && adduser -u 10001 -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/deployed ./

USER appuser
EXPOSE 3000

# Liveness probe (docs/rules/10-infra-devops.md B5 & D1)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["node", "dist/main.js"]
