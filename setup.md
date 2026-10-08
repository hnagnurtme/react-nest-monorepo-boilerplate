# Local Setup Guide

This guide explains how to run the multi-tenant auth boilerplate locally and how to verify backend and frontend changes.

## Requirements

| Tool     | Required Version | Purpose                                    |
| :------- | :--------------- | :----------------------------------------- |
| Node.js  | `>=20.18.0`      | JavaScript runtime                         |
| pnpm     | `9.15.4`         | Workspace package manager                  |
| just     | latest stable    | Repository command runner                  |
| Docker   | latest stable    | Local Postgres and Redis                   |
| gitleaks | latest stable    | Secret scanning (`just secrets`, git hook) |

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
cp .env.example .env                   # optional: only docker-compose host ports (POSTGRES_PORT, REDIS_PORT)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

The API reads `apps/api/.env` (it loads `.env` from its working directory). The web app reads `apps/web/.env`. The defaults in the `.env.example` files work with `just up` unchanged.

## Local Infrastructure

Start Postgres 16 and Redis 7:

```bash
just up
```

Check containers (`boilerplate-postgres`, `boilerplate-redis`):

```bash
docker compose ps
```

Defaults: Postgres on `localhost:5432` (user `postgres`, database `boilerplate_dev`), Redis on `localhost:6379`.

Stop infrastructure with `just down`. `just stop` also stops the containers and kills anything listening on ports 3000 and 5173.

## Environment Variables

Every API variable is declared in `apps/api/src/config/env.schema.ts` and listed in `apps/api/.env.example`. The app validates them at startup and exits with a table of problems if something is missing or malformed. The ones you are most likely to touch:

```env
PORT=3000
DATABASE_URL=postgres://boilerplate_app:app@localhost:5432/boilerplate_dev
MIGRATION_DATABASE_URL=postgres://postgres:postgres@localhost:5432/boilerplate_dev
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=http://localhost:5173,http://localhost:4173
WEB_ORIGIN=http://localhost:5173
COOKIE_SECURE=false
SMTP_USER=            # leave empty to skip real email (OTP goes to the API log)
```

- `DATABASE_URL` (role `boilerplate_app`, no RLS bypass) and `MIGRATION_DATABASE_URL` (superuser, used by `db:migrate`, `db:seed`, and drizzle-kit) must differ; the env schema rejects equal values. Never swap them.
- `WEB_ORIGIN` must equal the origin the browser loads the web app from: `http://localhost:5173` for `just web` (Vite dev server), `http://localhost:4173` for Vite preview. The CSRF middleware compares it exactly.
- Password-reset OTPs are emailed over SMTP (`SMTP_*`). With `SMTP_USER` / `SMTP_PASS` empty no mail is sent, and the OTP is printed in the API log instead (`MailService` logs it at debug level, only in this no-SMTP mode), which is enough for local testing of `forgot-password` and `reset-password`.

Web (`apps/web/.env`):

```env
VITE_API_URL=http://localhost:3000

# Branding: sign-in page, home page and browser tab title
VITE_APP_NAME=Starter App
VITE_APP_SLOGAN=            # empty = translated default tagline
VITE_APP_THUMBNAIL_URL=     # absolute URL or a path under apps/web/public; empty = no image
```

API (`apps/api/.env`) has a matching `APP_NAME`, used in password-reset emails and the Swagger title.

`VITE_*` values are embedded in the build output; never put secrets there.

## Database Setup

Start infrastructure first (`just up`), then apply migrations:

```bash
just db-migrate
```

This runs `apps/api/src/core/database/migrate.ts`, which connects with `MIGRATION_DATABASE_URL`, creates the roles (`sql/00-roles.sql`), switches to `boilerplate_owner`, applies the Drizzle migrations (RLS policies are inside them), runs `sql/99-grants.sql`, and finally syncs the permission catalog and system roles from `@repo/shared-types` into the database (`authz-sync.ts`). It is idempotent. A new entry in `PERMISSION_CATALOG` is not visible to the API until you run `just db-migrate`; the sync does not run at API startup.

Seed development data (idempotent):

```bash
just db-seed
```

| Email                | Role             | Tenant | Password       |
| :------------------- | :--------------- | :----- | :------------- |
| `admin@platform.com` | `PLATFORM_ADMIN` | none   | `Password123!` |

The seed also creates two empty tenants, Acme Inc. and Globex Corp.

There is no sign-up, and this is the only account the seed creates: it is the one that cannot be made through the API. Log in as `admin@platform.com` to create more tenants (`POST /api/v1/tenants`) and the first administrator of each (`POST /api/v1/users` with `tenantId` and `roleIds`); that administrator then creates the rest of its tenant's users. New accounts are emailed an invitation unless you choose a password for them.

### Creating a Custom Role

Roles and permissions live in the database. Log in as a tenant admin (one you created with the platform account) and either use the roles page in the web app or call the API with the access token. A tenant admin must send the tenant it is acting in on every call:

```bash
# 0. Log in and copy data.accessToken from the response
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin-a@acme.test","password":"Password123!"}'
export TOKEN=<accessToken>
# Copy data.user.tenants[0].id from the same response
export TENANT=<tenantId>

# 1. What may I put into a role?
curl -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  http://localhost:3000/api/v1/permissions

# 2. Create the role (a platform admin must also send "tenantId")
curl -X POST http://localhost:3000/api/v1/roles \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Support","permissions":[{"action":"read","subject":"User","preset":"own_tenant"}]}'

# 3. Assign it to a user of the same tenant
curl -X PUT http://localhost:3000/api/v1/users/<user-id>/roles \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"roleIds":["<role-id>"]}'
```

You can only grant permissions you hold yourself, and custom roles cannot use the `any` reach or platform-only permissions.

Other database commands:

```bash
just db-studio      # Drizzle Studio
just db-generate    # generate a migration after editing schema files
```

Edit `apps/api/src/core/database/schema/*.ts`, never the generated SQL in `apps/api/drizzle/` once it is merged to `main`; fix forward with a new migration. RLS policies are hand-written below the generated DDL in the migration file.

## Running the Apps

```bash
just dev      # api and web together (turbo)
just api      # NestJS only
just web      # Vite only
```

| App         | URL                              |
| :---------- | :------------------------------- |
| API         | `http://localhost:3000`          |
| API docs    | `http://localhost:3000/api/docs` |
| Web dev     | `http://localhost:5173`          |
| Web preview | `http://localhost:4173`          |

The API dev server runs through swc (`node --watch --import @swc-node/register/esm-register src/main.ts`). Do not switch it to `tsx`/esbuild: they do not emit decorator metadata, so `ZodValidationPipe` silently skips validation of request bodies in dev. `nest start --watch` is not an option either: it fails on the ESM `@/` aliases unless built with `tsc-alias`.

## Contract Generation

When an API route, DTO, response schema, status code, or OpenAPI decorator changes:

```bash
just contract
```

Commit both generated files (never edit them by hand):

```text
packages/api-contract/openapi.json
packages/api-contract/src/generated.ts
```

CI regenerates them and fails if `git diff` is not empty. Add or update tests in `packages/api-contract/test/` for important contract behavior.

## Implementing a New Backend Feature

Use the `users` module (`apps/api/src/modules/users/`) as the reference. The sequence mirrors "Feature Implementation Workflow" in the README.

1. **Storage and permissions.** Add a Drizzle schema under `apps/api/src/core/database/schema/`, export it from `index.ts`, add indexes (at least on `tenant_id`), run `just db-generate`, then add `ENABLE` + `FORCE ROW LEVEL SECURITY` and one policy to the generated migration and run `just db-migrate`. If the entity needs permissions: add the subject to `SubjectShapes` and `conditionsFor`, add catalog entries (and `SYSTEM_ROLES` grants if a system role needs them) in `packages/shared-types/src/authz/`, then run `just db-migrate` so the catalog is synced. Full checklists: `docs/02-backend-core-va-drizzle-rls.md`, section 7, and `docs/03-auth-flow-va-casl-abac.md`, section 2.7.
2. **Isolation test.** Extend or add an integration test connected as `boilerplate_app` with two tenants.
3. **Module** under `apps/api/src/modules/<feature>/`: `dto/`, `<feature>.controller.ts`, `.module.ts`, `.openapi.ts`, `.repository.ts`, `.service.ts`, `.types.ts`, `index.ts`. Export only the module surface from `index.ts`.
4. **DTOs** are Zod schemas via `nestjs-zod`. Use `.strict()` so unknown fields are rejected. Do not put `tenantId` in a DTO unless a platform admin legitimately chooses the tenant (the only cases today are `POST /users` and `POST /roles`).
5. **Repository** receives a `tx` and never filters `tenant_id` by hand; RLS does it.
6. **Service** runs every query through `TransactionManager.runInRequestContext`, gets the caller's ability from `AuthzService.current()` and checks permissions on the loaded record with `subject('Name', entity)`, writes an audit row with `AuditService` for sensitive changes, and throws domain errors.
7. **Controller** adds `@CheckPolicies(...)` (role-level), OpenAPI decorators for success and problem responses, `201` plus `Location` for `POST`, and `@Public()` only when intentionally public.
8. Run `just contract` and `just test`.

## Implementing a New Frontend Feature

Use `apps/web/src/features/auth` and `features/users` as references.

1. **Slice** under `apps/web/src/features/<feature>/` with `api/`, `components/`, `hooks/`, `pages/`, `schemas/`, `types.ts`, `index.ts` as needed.
2. **Types** come from the generated contract through `@/lib/http/types`, never hand-written:

   ```typescript
   import type { ApiRequestBody, ApiResponseData } from '@/lib/http/types';

   export type CreateUserBody = ApiRequestBody<'/api/v1/users', 'post'>;
   export type UserResponse = ApiResponseData<'/api/v1/users/{id}', 'get'>;
   ```

3. **API hooks** use TanStack Query and the client in `@/lib/http/client` (`apiClient` for single resources, `rawPagedRequest` for lists so `meta` is kept). No raw `fetch` or `axios` in components.
4. **Forms** use React Hook Form with a Zod schema; map `invalidParams` from API errors to field errors; disable submit while pending.
5. **Components**: one meaningful component per file, shared primitives in `shared/ui`, no `React.FC`.
6. **Route** in `apps/web/src/app/router.tsx` last, lazy-loaded and wrapped in `RouteGuard` (with `checkAbility`) when protected. Show or hide actions with `CanAction`; the ability comes from `GET /api/v1/auth/me/abilities`.
7. **Tests** in `apps/web/test/` for page states and risky behavior.

## Verification Before Commit

```bash
just typecheck && just lint && just test    # any TS change
just contract                               # any API shape change
just verify                                 # non-trivial changes
```

Integration tests (`pnpm test:integration` inside `apps/api`) need `just up` and `just db-migrate` first. CI also runs a `conventions` job of grep checks (no bare `timestamp()` or `pgEnum` in the schema, no `axios` import under `modules/`); `just lint` already covers the axios rule.

## Troubleshooting

### CORS Fails From the Web App

`CORS_ORIGINS` in `apps/api/.env` controls browser CORS and must contain the web origin (`http://localhost:5173`). Restart the API after changing env values.

### CSRF Validation Fails (403 `CSRF_VALIDATION_FAILED`)

Login works but a later POST, PATCH, or DELETE returns 403. How the check works: the API sets a readable `csrf_token` cookie on login and refresh. Once that cookie exists, every unsafe request must send the same value in `x-csrf-token`, and its `Origin` header must equal `WEB_ORIGIN` exactly. The web client does this automatically.

Common causes:

1. **`WEB_ORIGIN` does not match the dev server.** It must be `http://localhost:5173` for `just web`. A value of `http://localhost:4173` (Vite preview) lets login succeed because no csrf cookie exists yet, then rejects every later write.
2. **Stale `csrf_token` cookie from another project on `localhost`.** Cookies are shared across ports on the same host, so another app that also uses a `csrf_token` cookie overwrites yours with a value this API never issued. The web client expires the cookie and retries once for login and refresh; for anything else, delete the `csrf_token` cookie for `localhost` in DevTools (Application, Cookies) and log in again.
3. The request has no `x-csrf-token` header (custom `fetch`, curl with cookies). Bearer-only requests without cookies are not affected.

Restart the API after env changes.

### Port Clashes and Container Names

`just up` fails with "port is already allocated" or "container name already in use" when another project holds `5432` or `6379`, or already has containers named `boilerplate-postgres` / `boilerplate-redis`.

- Change the host ports in the root `.env` (used by docker-compose): `POSTGRES_PORT=5433` and/or `REDIS_PORT=6380`.
- Then update `apps/api/.env` to match: `REDIS_URL=redis://localhost:6380`, and the port inside `DATABASE_URL` and `MIGRATION_DATABASE_URL` (`...@localhost:5433/...`).
- If containers with the same names exist from another checkout, run `docker compose down` there or remove them with `docker rm`.
- `just stop` kills whatever listens on 3000 and 5173; check for stray dev servers if the API or Vite say the port is busy.

### Redis Throttling Fails

Rate limits are stored in Redis, so a dead Redis breaks login. Check it:

```bash
docker compose ps
nc -zv localhost 6379     # use your REDIS_PORT
```

Then `just down && just up`.

### Database Connection Fails

```bash
docker compose ps
nc -zv localhost 5432     # use your POSTGRES_PORT
just db-migrate
```

If queries return no rows while the data is there, the session is missing its RLS context: the code is querying outside `TransactionManager`, or `DATABASE_URL` points at the wrong role.

### A New Permission Does Not Show Up

The permission catalog lives in code but is synced to the database by `just db-migrate`, not at API startup. Run it after adding a `PERMISSION_CATALOG` or `SYSTEM_ROLES` entry. Profiles are cached in Redis for up to 300 seconds; changes made through the API evict the cache, but edits made directly in the database wait for the TTL.

### Request Validation Seems To Be Skipped

You are running the API with `tsx` or another runner that does not emit decorator metadata. Use `just api` (swc runner).

### Generated Contract Looks Stale

Run `just contract`, then restart the web dev server if Vite or TypeScript still sees old types.

## Commit Checklist

```text
- Related files are grouped into coherent commits (Conventional Commits, see commitlint.config.mjs).
- Generated contract files are included when the API shape changed.
- Migrations are included when the schema changed.
- Documentation is updated when behavior changed.
- No secrets are staged.
- `just typecheck`, `just lint`, and `just test` pass.
```
