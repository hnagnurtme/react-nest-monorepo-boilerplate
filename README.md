# Nest + React Multi-Tenant Auth Boilerplate

A production-oriented monorepo boilerplate for multi-tenant authentication and user management. It combines a NestJS API, a React SPA, and shared packages for API contracts, types, linting, and TypeScript configuration.

It ships a complete auth flow (login, refresh-token rotation, OTP, password reset), tenant isolation enforced by Postgres Row Level Security, CASL/ABAC authorization, and a `users` module that serves as the reference implementation of a tenant-scoped feature slice. Add your own business entities on top.

This repository is intentionally opinionated. The goal is to keep backend, frontend, and contract changes moving together without losing type safety, security boundaries, or operational discipline.

## Stack

| Area      | Technology                                                                     |
| :-------- | :----------------------------------------------------------------------------- |
| Monorepo  | pnpm workspaces, Turborepo, `just` command recipes                             |
| Backend   | NestJS, Drizzle ORM, Postgres 16, Redis 7, Zod DTOs, Pino, OpenTelemetry       |
| Web       | React 19, Vite, Tailwind CSS v4, TanStack Query, Zustand, React Hook Form, Zod |
| Contracts | OpenAPI export, generated `@repo/api-contract`, shared TypeScript DTO helpers  |
| Quality   | ESLint, Prettier, Vitest, Node test runner, gitleaks, dependency audit         |

## Multi-Tenancy Model

- A `tenants` table holds one row per workspace. Each user belongs to exactly one tenant (`users.tenant_id`); the column is null only for `PLATFORM_ADMIN`.
- Roles: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `TENANT_MEMBER`.
- The web app has no sign-up page and no social login; accounts are meant to be created by an admin. The API still exposes `POST /auth/register`, which creates a tenant (`"<name>'s workspace"`) and its first `TENANT_ADMIN`.
- Isolation is enforced in Postgres: every query runs inside a transaction that sets `app.access_mode` (`admin` or `tenant`) and `app.tenant_id`, and RLS policies filter on them.

## Repository Layout

```text
apps/
  api/          NestJS modular monolith
  web/          React + Vite SPA
packages/
  api-contract/ Generated OpenAPI client types
  shared-types/ Cross-app TypeScript types (roles, CASL abilities)
  eslint-config/ Shared ESLint configs
  tsconfig/     Shared TypeScript configs
docs/
  adr/          Architecture Decision Records
  rules/        Coding rules by domain
scripts/        Repository automation
```

## Command Policy

Use `just` for repository tasks. If a `just` recipe exists, use it instead of calling `pnpm`, `npm`, `yarn`, or tool binaries directly.

Common commands:

```bash
just install        # install workspace dependencies
just up             # start local Postgres and Redis
just dev            # run all dev servers
just api            # run only the NestJS API
just web            # run only the React web app
just typecheck      # TypeScript checks
just lint           # ESLint checks
just test           # unit tests
just build          # build all workspaces
just contract       # export OpenAPI and regenerate @repo/api-contract
just verify         # format, lint, typecheck, test, build, audit
```

See [setup.md](setup.md) for a full local setup guide.

## Architecture Rules

The codebase follows these binding decisions:

- The backend is a modular monolith, not microservices.
- Database access uses Drizzle, not Prisma.
- Data authorization is enforced with Postgres RLS, not application-only filtering.
- Authorization uses CASL/ABAC, not plain RBAC.
- The web app is a Vite SPA, not Next.js.

Detailed decisions live in [docs/adr](docs/adr). Coding rules live in [docs/rules](docs/rules).

## Feature Implementation Workflow

Use this flow for any new feature that touches backend and frontend. The order matters because the web app consumes generated API contracts, not hand-written response guesses.

### 1. Define the Capability

Before coding, write down:

- the user action or system event
- the domain entity being created, read, updated, or deleted
- the access rules for each role
- the expected loading, empty, error, and success states
- the API endpoints and response shapes
- the database tables, indexes, and RLS policies needed
- the tests that prove the feature works

Keep the first implementation narrow. Avoid speculative abstractions until duplication is real.

### 2. Backend Implementation

Backend feature code belongs in `apps/api/src/modules/<feature>/`.

Recommended structure:

```text
apps/api/src/modules/users/
  dto/
    create-user.dto.ts
    update-user.dto.ts
    index.ts
  __tests__/
    users.service.spec.ts
  user.controller.ts
  user.module.ts
  user.openapi.ts
  user.repository.ts
  user.service.ts
  user.types.ts
  index.ts
```

Backend rules:

- Controllers only handle HTTP concerns: route, decorators, status codes, request DTOs, and response decorators.
- Services own business logic and orchestration.
- Repositories own database access and never bypass RLS accidentally.
- DTOs are validated with Zod through `nestjs-zod`.
- Errors must become RFC 9457 problem responses through existing error infrastructure.
- Public endpoints must be explicitly marked. Protected endpoints must rely on guards and policies.
- New database schema changes go through Drizzle migrations.
- New list endpoints must support pagination when the result can grow.
- OpenAPI decorators must describe success and relevant problem responses accurately.

Backend checklist:

```text
1. Add or update Drizzle schema if storage changes.
2. Generate a migration with `just db-generate`.
3. Apply the migration locally with `just db-migrate`.
4. Add or update RLS policies when data visibility changes.
5. Add DTO schemas and request validation.
6. Add repository methods with narrow column selection.
7. Add service methods with business rules.
8. Add controller endpoints and OpenAPI response schemas.
9. Add service, controller, or integration tests based on risk.
10. Run `just contract` after the API shape changes.
```

### 3. Contract Update

The API contract is the source of truth for frontend request and response types.

When backend endpoints, DTOs, or response schemas change:

```bash
just contract
```

This updates:

- `packages/api-contract/openapi.json`
- `packages/api-contract/src/generated.ts`

Then add or update contract tests in `packages/api-contract/test/` for important endpoint guarantees. Examples include auth response envelopes, security schemes, pagination metadata, and documented error responses.

### 4. Frontend Implementation

Frontend feature code belongs in `apps/web/src/features/<feature>/`.

Recommended structure:

```text
apps/web/src/features/users/
  api/
    use-users.ts
    use-create-user.ts
  components/
    user-form.tsx
    user-table.tsx
  hooks/
    use-user-form.ts
  pages/
    users-page.tsx
  schemas/
    user.schema.ts
  endpoints.ts
  index.ts
  types.ts
```

Frontend dependency direction:

```text
app -> features -> entities -> shared -> lib -> config
```

Frontend rules:

- Use `@/lib/http` for all HTTP calls. Do not call `fetch` or `axios` in components.
- Define endpoint constants in the feature `endpoints.ts` file.
- Derive request and response types from `@repo/api-contract` through `@/lib/http/types`.
- Use TanStack Query for server state.
- Keep Zustand for global client state only.
- Use React Hook Form with Zod for forms.
- Put reusable UI primitives in `shared/ui`.
- Put domain-specific components in `features/<feature>/components`.
- Prefer one meaningful component per file.
- Do not use `React.FC`.
- Let TypeScript infer component return types in `.tsx` files.
- Handle loading, empty, error, and success states.
- Keep visual styling token-based. Prefer Tailwind theme tokens over arbitrary pixel values.

Frontend checklist:

```text
1. Add endpoint constants in `features/<feature>/endpoints.ts`.
2. Add feature request and response aliases in `features/<feature>/types.ts`.
3. Add API hooks under `features/<feature>/api/`.
4. Add form schemas under `features/<feature>/schemas/` if needed.
5. Add reusable feature logic under `features/<feature>/hooks/`.
6. Add page and component files with one meaningful component per file.
7. Move repeated UI shapes to `shared/ui` or repeated icons to `shared/icons`.
8. Export only the public surface from `features/<feature>/index.ts`.
9. Add tests for shared primitives, page states, and risky behavior.
10. Wire the route in `apps/web/src/app/router.tsx` only after the page is ready.
```

### 5. End-to-End Feature Checklist

Use this final checklist before opening a pull request:

```text
Backend:
- DTO validation exists.
- Business rules live in services.
- Database access lives in repositories.
- RLS and policies are updated when data visibility changes.
- OpenAPI documents success and important failures.

Contract:
- `just contract` was run after API shape changes.
- Generated files are committed.
- Contract tests cover important guarantees.

Frontend:
- No component reaches directly into another feature internals.
- API hooks use typed endpoints and generated contract types.
- Server state uses TanStack Query.
- Forms use React Hook Form and Zod.
- All UI states are handled.
- Shared UI is used for repeated primitives.

Quality:
- Tests cover the new behavior.
- `just typecheck` passes.
- `just lint` passes.
- `just test` passes.
- `just verify` passes for non-trivial changes.
```

## Testing Strategy

Use tests where they catch real regressions:

- Unit tests for pure business rules, schemas, utilities, and services.
- Integration tests for database behavior, RLS-sensitive flows, and API wiring.
- Contract tests for OpenAPI guarantees consumed by other apps.
- Web tests for page states, shared primitives, and critical user flows.

Do not hide type errors with `any`, `@ts-ignore`, or unchecked casts. Validate external data at the boundary.

## Security Expectations

- Never commit secrets.
- Keep local secrets in ignored `.env` files.
- Keep examples in `.env.example` with safe placeholder values.
- Run `just secrets` before sensitive changes.
- Treat auth, cookies, CSRF, CORS, RLS, and permissions as high-risk code.
- Update documentation in the same change when behavior changes.

## Documentation Map

- [setup.md](setup.md): local setup and troubleshooting.
- [docs/README.md](docs/README.md): technical documentation index.
- [docs/rules](docs/rules): mandatory coding rules.
- [docs/adr](docs/adr): architecture decisions.
- [docs/glossary.md](docs/glossary.md): domain vocabulary.
