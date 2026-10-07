# Local Setup Guide

This guide explains how to run the multi-tenant auth boilerplate monorepo locally and how to verify backend and frontend changes safely.

## Requirements

Install these tools before starting:

| Tool     | Required Version | Purpose                   |
| :------- | :--------------- | :------------------------ |
| Node.js  | `>=20.18.0`      | JavaScript runtime        |
| pnpm     | `9.15.4`         | Workspace package manager |
| just     | latest stable    | Repository command runner |
| Docker   | latest stable    | Local Postgres and Redis  |
| gitleaks | latest stable    | Secret scanning           |

Recommended installs on macOS:

```bash
brew install just gitleaks
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

## First-Time Setup

From the repository root:

```bash
just install
```

Create local environment files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

The API reads `apps/api/.env`. The web app reads `apps/web/.env`.

## Local Infrastructure

Start Postgres and Redis:

```bash
just up
```

Check containers:

```bash
docker compose ps
```

Expected services:

- Postgres on `localhost:5432`
- Redis on `localhost:6379`

Stop infrastructure:

```bash
just down
```

Stop dev servers and containers:

```bash
just stop
```

## Environment Variables

### API

`apps/api/.env` must contain:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://boilerplate_app:app@localhost:5432/boilerplate_dev
MIGRATION_DATABASE_URL=postgres://postgres:postgres@localhost:5432/boilerplate_dev
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=http://localhost:5173,http://localhost:4173
WEB_ORIGIN=http://localhost:4173
COOKIE_SECURE=false
```

Use `WEB_ORIGIN=http://localhost:5173` if the web app runs through Vite dev server. Use `WEB_ORIGIN=http://localhost:4173` if the web app runs through Vite preview. The CSRF middleware checks this value exactly.

### Web

`apps/web/.env` must contain:

```env
VITE_API_URL=http://localhost:3000
```

The web client uses this value for typed API calls through `@/lib/http`.

## Database Setup

Start infrastructure first:

```bash
just up
```

Apply migrations:

```bash
just db-migrate
```

Seed development data (two tenants, `Acme Inc.` and `Globex Corp.`, plus one platform admin; every seeded account uses the password printed by the seed script):

```bash
just db-seed
```

Seeded accounts: `admin@example.com` (`PLATFORM_ADMIN`), `admin-a@example.com` / `member-a@example.com` (Acme), `admin-b@example.com` (Globex).

Open Drizzle Studio:

```bash
just db-studio
```

Generate a migration after schema changes:

```bash
just db-generate
```

## Running the Apps

Run everything:

```bash
just dev
```

Run one service:

```bash
just api
just web
```

Typical local URLs:

| App         | URL                              |
| :---------- | :------------------------------- |
| API         | `http://localhost:3000`          |
| API docs    | `http://localhost:3000/api/docs` |
| Web dev     | `http://localhost:5173`          |
| Web preview | `http://localhost:4173`          |

## Contract Generation

When an API route, DTO, response schema, status code, or OpenAPI decorator changes, regenerate the contract:

```bash
just contract
```

Commit the generated files:

```text
packages/api-contract/openapi.json
packages/api-contract/src/generated.ts
```

Add or update tests in `packages/api-contract/test/` for important contract behavior.

## Implementing a New Backend Feature

Use this sequence for a new backend capability. The `users` module (`apps/api/src/modules/users/`) is the reference implementation of a tenant-scoped slice.

### 1. Create the Module

Add a feature module under:

```text
apps/api/src/modules/<feature>/
```

Recommended files:

```text
dto/
  create-<feature>.dto.ts
  update-<feature>.dto.ts
  index.ts
<feature>.controller.ts
<feature>.module.ts
<feature>.openapi.ts
<feature>.repository.ts
<feature>.service.ts
<feature>.types.ts
index.ts
```

Export only the public module surface from `index.ts`.

### 2. Add Storage

If the feature needs persistence:

1. Add Drizzle schema under `apps/api/src/core/database/schema/`.
2. Export it from the schema index.
3. Add indexes for common filters and joins.
4. Add `tenant_id` and a single RLS policy (`ENABLE` + `FORCE`) when rows are tenant scoped. See `docs/02-backend-core-va-drizzle-rls.md`, section 9, for the full checklist.
5. Run `just db-generate`.
6. Run `just db-migrate`.

Do not rely on application-only filtering for authorization-sensitive data.

### 3. Add DTOs

Use Zod DTOs with `nestjs-zod`.

Rules:

- Validate all external input.
- Keep DTOs close to the module.
- Do not use `any`.
- Use explicit types at exported `.ts` boundaries.
- Map validation failures into the existing problem response flow.

### 4. Add Repository Logic

Repositories own database access.

Rules:

- Select only required columns.
- Avoid N+1 queries.
- Keep filters explicit.
- Use transactions through existing transaction infrastructure when multiple writes must commit together.
- Never bypass RLS unless the code has a documented admin-mode reason.

### 5. Add Service Logic

Services own business rules.

Rules:

- Keep controllers thin.
- Keep repository methods data-focused.
- Put cross-entity decisions in services.
- Throw domain errors, not anonymous strings.
- Keep methods small and testable.

### 6. Add Controller Routes

Controllers own HTTP concerns.

Rules:

- Use resource-based URLs.
- Use correct status codes.
- Add `@ApiOperation`, success responses, and problem responses.
- Use `@Public()` only when the endpoint is intentionally public.
- Use guards and policies for protected routes.
- Add throttling when abuse is plausible.

### 7. Update Contracts and Tests

Run:

```bash
just contract
just test
```

Add tests for:

- service business rules
- repository behavior when risk is high
- OpenAPI contract guarantees
- RLS or authorization-sensitive behavior

## Implementing a New Frontend Feature

Use this sequence for a new web capability.

### 1. Create the Feature Slice

Add the feature under:

```text
apps/web/src/features/<feature>/
```

Recommended files:

```text
api/
  use-<feature>.ts
components/
  <feature>-form.tsx
  <feature>-table.tsx
hooks/
  use-<feature>-form.ts
pages/
  <feature>-page.tsx
schemas/
  <feature>.schema.ts
endpoints.ts
index.ts
types.ts
```

### 2. Define Endpoints and Types

Use generated API contract types. Do not duplicate DTOs by hand.

Example:

```typescript
import type { ApiRequestBody, ApiResponseData } from '@/lib/http/types';

import type { USER_ENDPOINTS } from './endpoints';

export type CreateUserDto = ApiRequestBody<typeof USER_ENDPOINTS.CREATE>;
export type UserResponse = ApiResponseData<typeof USER_ENDPOINTS.DETAIL>;
```

### 3. Add API Hooks

Use TanStack Query for server state.

Rules:

- Use `apiClient` from `@/lib/http/client`.
- Keep query keys stable and specific.
- Invalidate the narrowest useful query after mutations.
- Handle mutation errors with toasts or field errors.
- Do not call `fetch` inside components.

### 4. Add Forms

Use React Hook Form and Zod.

Rules:

- Put form schemas in `schemas/`.
- Put form state and submit logic in `hooks/` when JSX would become noisy.
- Map `invalidParams` from API errors into field errors.
- Disable submit buttons while a mutation is pending.

### 5. Add Components

Rules:

- Use one meaningful component per file.
- Keep reusable UI primitives in `shared/ui`.
- Keep domain-specific components in the feature.
- Move repeated icons or brand assets to `shared/icons`.
- Do not use `React.FC`.
- Let TypeScript infer component return types in `.tsx`.
- Use `useTranslation` inside feature-local components that own their copy.
- Pass business data and callbacks through props, not translation functions.

### 6. Add Page and Routing

Add page components under `pages/`.

Wire routes in:

```text
apps/web/src/app/router.tsx
```

Rules:

- Add route guards for protected views.
- Handle loading, empty, error, and success states.
- Lazy-load feature pages when appropriate.
- Keep app-level wiring in `app/`, not inside feature internals.

### 7. Add Tests

Add tests for:

- shared UI primitives
- page loading, empty, error, and success states
- critical mutation behavior
- API client behavior that protects auth, CSRF, or error handling

## Verification Before Commit

For TypeScript changes:

```bash
just typecheck
just lint
just test
```

For API contract changes:

```bash
just contract
just test
```

For non-trivial features:

```bash
just verify
```

## Troubleshooting

### CORS Fails From the Web App

Check `apps/api/.env`:

```env
CORS_ORIGINS=http://localhost:5173,http://localhost:4173
WEB_ORIGIN=http://localhost:4173
```

`CORS_ORIGINS` controls browser CORS. `WEB_ORIGIN` controls the CSRF origin check and must exactly match the web app origin.

Restart the API after changing env values.

### CSRF Validation Fails

The web client reads the `csrf_token` cookie and sends it as `x-csrf-token` on unsafe requests.

If a request fails:

1. Confirm the browser has a readable `csrf_token` cookie.
2. Confirm the request includes `x-csrf-token`.
3. Confirm `WEB_ORIGIN` matches the browser origin exactly.
4. Restart the API after env changes.

### Redis Throttling Fails

Check Redis:

```bash
docker compose ps
nc -zv localhost 6379
```

Restart infrastructure if needed:

```bash
just down
just up
```

### Database Connection Fails

Check Postgres:

```bash
docker compose ps
nc -zv localhost 5432
```

Then rerun migrations:

```bash
just db-migrate
```

### Generated Contract Looks Stale

Run:

```bash
just contract
```

Then restart the web dev server if TypeScript or Vite still sees old generated types.

## Commit Checklist

Before committing:

```text
- Related files are grouped into coherent commits.
- Generated contract files are included when API shape changed.
- Migrations are included when schema changed.
- Documentation is updated when behavior changed.
- No secrets are staged.
- `just typecheck`, `just lint`, and `just test` pass.
```
