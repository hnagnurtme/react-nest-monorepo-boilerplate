# Nest + React Multi-Tenant Auth Boilerplate

A monorepo boilerplate for multi-tenant authentication and user management. It combines a NestJS API, a React SPA, and shared packages for API contracts, types, linting, and TypeScript configuration.

It ships a login flow (access token + rotating refresh cookie, password reset by emailed OTP), tenant isolation enforced by Postgres Row Level Security, CASL/ABAC authorization, an audit log, and admin-managed `tenants` and `users` modules that serve as the reference implementation of a tenant-scoped feature slice. Add your own business entities on top.

There is **no self sign-up**. Accounts are created only by admins (see below). The API has no register, verify-email, or resend-OTP endpoints, and the web app has no sign-up page and no social login.

This repository is intentionally opinionated. The goal is to keep backend, frontend, and contract changes moving together without losing type safety, security boundaries, or operational discipline.

## Stack

| Area      | Technology                                                                                       |
| :-------- | :----------------------------------------------------------------------------------------------- |
| Monorepo  | pnpm workspaces, Turborepo, `just` command recipes                                               |
| Backend   | NestJS 11, Drizzle ORM, Postgres 16, Redis 7, Zod DTOs (`nestjs-zod`), Pino, OpenTelemetry       |
| Web       | React 19, Vite, Tailwind CSS v4, React Router, TanStack Query, Zustand, React Hook Form, i18next |
| Contracts | OpenAPI export, generated `@repo/api-contract` types, shared types and CASL abilities            |
| Quality   | ESLint, Prettier, Vitest, commitlint, gitleaks, dependency audit                                 |

## Quickstart

Requires Node `>=20.18.0`, pnpm `9.15.4`, `just`, and Docker. See [setup.md](setup.md) for details and troubleshooting.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

just install     # pnpm install --frozen-lockfile
just up          # Postgres 16 + Redis 7 via docker compose
just db-migrate  # create roles, apply migrations (RLS policies included)
just db-seed     # dev tenants and accounts
just api         # NestJS API on http://localhost:3000 (Swagger at /api/docs)
just web         # Vite dev server on http://localhost:5173
```

Seeded accounts (all use the password `Password123!`):

| Email                  | Role             | Tenant       |
| :--------------------- | :--------------- | :----------- |
| `admin@example.com`    | `PLATFORM_ADMIN` | none         |
| `admin-a@example.com`  | `TENANT_ADMIN`   | Acme Inc.    |
| `member-a@example.com` | `TENANT_MEMBER`  | Acme Inc.    |
| `admin-b@example.com`  | `TENANT_ADMIN`   | Globex Corp. |

## Multi-Tenancy Model

- A `tenants` table holds one row per workspace. Each user belongs to exactly one tenant (`users.tenant_id`); the column is null only for `PLATFORM_ADMIN` (enforced by a CHECK constraint).
- Roles: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `TENANT_MEMBER`.
- Who creates what:
  - `PLATFORM_ADMIN` creates tenants (`POST /api/v1/tenants`) and users in any tenant (`POST /api/v1/users` with `tenantId`).
  - `TENANT_ADMIN` creates `TENANT_ADMIN` / `TENANT_MEMBER` users in its own tenant.
  - Created users are active and email-verified, with the password the admin chose. Users, tenants, and their changes are written to `audit_logs` in the same transaction.
- Isolation is enforced in Postgres: every query runs inside a transaction that sets `app.access_mode` (`admin` or `tenant`) and `app.tenant_id`, and one RLS policy per table filters on them.

## API Surface

All routes are under `/api/v1` and wrapped in `{ data, meta? }`; errors are RFC 9457 problem responses.

| Area    | Endpoints                                                                                                |
| :------ | :------------------------------------------------------------------------------------------------------- |
| auth    | `login`, `refresh`, `logout`, `logout-all`, `me`, `forgot-password`, `reset-password`, `change-password` |
| users   | list, get, create, update, soft-delete                                                                   |
| tenants | list, get, create, update                                                                                |
| health  | `/healthz` (liveness), `/readyz` (readiness) outside the `/api` prefix                                   |

## Repository Layout

```text
apps/
  api/            NestJS modular monolith
  web/            React + Vite SPA
packages/
  api-contract/   Generated OpenAPI types (openapi.json, src/generated.ts)
  shared-types/   Cross-app types: API envelope, problem details, roles, CASL abilities
  eslint-config/  Shared ESLint configs (layer boundaries live here)
  tsconfig/       Shared TypeScript configs
docs/
  adr/            Architecture Decision Records
  rules/          Coding rules by domain
scripts/          Repository automation (dependency audit)
```

## Command Policy

Use `just` for repository tasks. If a `just` recipe exists, use it instead of calling `pnpm`, `npm`, or tool binaries directly.

```bash
just install        # install workspace dependencies
just up / down      # start / stop local Postgres and Redis
just dev            # run all dev servers
just api / web      # run only the NestJS API / the React app
just db-generate    # generate a Drizzle migration after schema changes
just db-migrate     # apply migrations (migration role, then grants)
just db-seed        # seed development data
just typecheck      # TypeScript checks
just lint           # ESLint checks
just test           # unit tests only
just build          # build all workspaces
just contract       # export OpenAPI and regenerate @repo/api-contract
just verify         # format-check, lint, typecheck, test, build, audit
just secrets        # gitleaks scan (needs gitleaks installed)
```

Integration tests need a running Postgres and Redis: run `just up` and `just db-migrate` first, then `pnpm test:integration` from `apps/api`.

## Architecture Rules

- The backend is a modular monolith, not microservices ([ADR-0001](docs/adr/0001-modular-monolith.md)).
- Database access uses Drizzle, not Prisma ([ADR-0002](docs/adr/0002-drizzle-thay-vi-prisma.md)).
- Tenant isolation is enforced with Postgres RLS, not application-only filtering ([ADR-0003](docs/adr/0003-rls-thay-vi-loc-o-tang-ung-dung.md)).
- Authorization uses CASL/ABAC, not plain RBAC ([ADR-0004](docs/adr/0004-casl-abac-thay-vi-rbac.md)).
- The web app is a Vite SPA, not Next.js ([ADR-0006](docs/adr/0006-spa-cho-toan-bo-web.md)).

Docs under `docs/` are written in Vietnamese; this README, `setup.md`, and `AGENTS.md` are in English.

## Feature Implementation Workflow

Use this order for a feature that touches backend and frontend. The web app consumes generated API contracts, not hand-written response shapes.

1. **Schema.** Add or change a table in `apps/api/src/core/database/schema/`, run `just db-generate`, then `just db-migrate`.
2. **RLS.** Hand-write `ENABLE` + `FORCE ROW LEVEL SECURITY` and exactly one policy below the generated DDL in the migration `.sql` file. The coverage test in `apps/api/src/core/database/__tests__/rls-isolation.integration.spec.ts` fails if a table lacks RLS or has more than one policy.
3. **Isolation tests.** Add integration tests (connected as `boilerplate_app`) with two tenants.
4. **Backend slice** in `apps/api/src/modules/<feature>/`: DTOs, repository, service, controller with OpenAPI decorators. Use `modules/users` as the template.
5. **Contract.** Run `just contract` and commit `packages/api-contract/openapi.json` and `packages/api-contract/src/generated.ts`.
6. **Frontend slice** in `apps/web/src/features/<feature>/`, using types from `@repo/api-contract` and the client in `@/lib/http`.
7. **Route.** Wire it in `apps/web/src/app/router.tsx` last.

Backend slice layout (`modules/users` is the real example):

```text
apps/api/src/modules/users/
  dto/
  __tests__/
  users.controller.ts
  users.module.ts
  users.openapi.ts
  users.repository.ts
  users.service.ts
  users.types.ts
  index.ts            # the only public surface; the repository is never exported
```

Backend rules in short: controllers handle HTTP only; services own business rules and throw domain errors (never `HttpException`); repositories receive a `tx` from `TransactionManager`; DTOs are Zod schemas; every endpoint has OpenAPI decorators.

Frontend slice layout (`features/auth` and `features/users` are real examples):

```text
apps/web/src/features/<feature>/
  api/          TanStack Query hooks
  components/
  hooks/
  pages/
  schemas/      Zod form schemas
  endpoints.ts
  index.ts      # public surface; other features import only from here
  types.ts
```

Frontend rules in short: all HTTP goes through `@/lib/http`; server state in TanStack Query; Zustand for global client state only (session, access token in RAM); React Hook Form + Zod for forms; no `React.FC`; handle loading, empty, error, and success states.

## Testing Strategy

- Unit tests (Vitest) for business rules, schemas, utilities, and services.
- Integration tests (`*.integration.spec.ts`) against real Postgres and Redis, including RLS isolation. They connect as the runtime role `boilerplate_app`.
- Contract tests in `packages/api-contract/test/` for OpenAPI guarantees.
- Web tests (Vitest + Testing Library) for page states, shared primitives, and the HTTP client.

Do not hide type errors with `any`, `@ts-ignore`, or unchecked casts. Validate external data at the boundary.

## CI

`.github/workflows/ci.yml` runs on push and pull requests to `main` and `develop`: secret scan, commitlint, format and lint, typecheck, unit tests and dependency audit, integration tests (real Postgres and Redis, RLS), OpenAPI drift, and a small `conventions` job of grep checks. `CI Gate` aggregates all of them and is the only required check. There is no CD workflow; deployment is up to you.

## Security Expectations

- Never commit secrets. Keep local secrets in ignored `.env` files; `.env.example` holds safe development placeholders.
- Run `just secrets` before sensitive changes.
- Treat auth, cookies, CSRF, CORS, RLS, and permissions as high-risk code.
- Update documentation in the same change when behavior changes.

## Documentation Map

- [setup.md](setup.md): local setup and troubleshooting.
- [AGENTS.md](AGENTS.md): guidance for AI coding agents (also a good list of gotchas for humans).
- [docs/README.md](docs/README.md): technical documentation index.
- [docs/rules](docs/rules): coding rules.
- [docs/adr](docs/adr): architecture decisions.
- [docs/glossary.md](docs/glossary.md): domain vocabulary.
