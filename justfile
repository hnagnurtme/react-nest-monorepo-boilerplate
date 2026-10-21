default:
  @just --list

# Install JavaScript workspace dependencies from the committed lockfile.
install:
  pnpm install --frozen-lockfile

# Postgres 16, Redis 7, Mailpit and MinIO for local development.
# The observability stack is behind the `tracing` profile: `just observability`.
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

# Empty every table, re-sync the code-owned catalog and seed the platform admin
# again. Development only: the data is gone for good.
db-reset:
  pnpm db:reset --yes

# Mailpit catches every email the dev API sends.
mail:
  open http://localhost:8025 || echo "Mailpit UI: http://localhost:8025"

# The MinIO console, where the dev bucket's objects are visible.
storage:
  open http://localhost:9001 || echo "MinIO console: http://localhost:9001"

# Start Tempo, Prometheus, Loki and Grafana (the `tracing` profile) and open
# the dashboards. The API ships nothing until apps/api/.env carries all three:
#   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
#   PROMETHEUS_METRICS_PORT=9464
#   LOKI_URL=http://localhost:3100
# Restart the API after changing them.
observability:
  docker compose --profile tracing up -d tempo prometheus loki grafana
  open http://localhost:3001 || echo "Grafana: http://localhost:3001"

# Kept as the short name for the same stack.
traces: observability


db-studio:
  pnpm db:studio

clean:
  pnpm clean
