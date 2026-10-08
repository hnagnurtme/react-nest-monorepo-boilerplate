default:
  @just --list

# Install JavaScript workspace dependencies from the committed lockfile.
install:
  pnpm install --frozen-lockfile

# Postgres 16 + Redis 7 for local development.
up:
  docker compose up -d

down:
  docker compose down

# Stop docker containers and kill running dev servers (api, web)
stop:
  docker compose stop
  -lsof -ti :3000,5173 | xargs kill -9 >/dev/null 2>&1

format:
  pnpm format

format-check:
  pnpm format:check

lint:
  pnpm lint

# Design-system conventions for apps/web (docs/rules/11-ui-design-system.md).
lint-ui:
  pnpm lint:ui

typecheck:
  pnpm typecheck

test:
  pnpm test

build:
  pnpm build

verify: format-check lint lint-ui typecheck test build audit

audit:
  pnpm audit:ci

secrets:
  pnpm secrets:scan

contract:
  pnpm contract:generate

dev:
  pnpm dev

start:
  pnpm start

api:
  pnpm --filter @repo/api dev

web:
  pnpm --filter @repo/web dev

db-generate:
  pnpm db:generate

db-migrate:
  pnpm db:migrate

# Development data: two tenants plus a platform admin.
db-seed:
  pnpm db:seed

db-studio:
  pnpm db:studio

clean:
  pnpm clean
