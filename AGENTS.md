# AGENTS.md — AI Agent Guidance & Operating Protocols

> **Source of truth for coding rules:** [`docs/rules/`](docs/rules/) (written in Vietnamese). **Architectural decisions:** [`docs/adr/`](docs/adr/). This file covers only what an agent would likely get wrong without help. Where docs conflict with this file, `docs/` wins.
>
> This repo is a generic **multi-tenant Auth + Users boilerplate**: `apps/api` (NestJS) and `apps/web` (React SPA). Add your own business entities on top of the `users` reference slice.

---

## 1. Command Protocol — Never Bypass `just`

All build, test, lint, migration, and dev commands **MUST** go through `just`. Never call `pnpm`, `npm`, or `drizzle-kit` directly when a `just` recipe exists.

| Command                 | What it actually runs                                                                             |
| :---------------------- | :------------------------------------------------------------------------------------------------ |
| `just install`          | `pnpm install --frozen-lockfile`                                                                  |
| `just up` / `just down` | `docker compose up -d` / `docker compose down` (Postgres 16 + Redis 7)                            |
| `just api` / `just web` | `pnpm --filter @repo/<app> dev`                                                                   |
| `just db-generate`      | `drizzle-kit generate`                                                                            |
| `just db-migrate`       | `tsx src/core/database/migrate.ts` — **not** `drizzle-kit migrate`                                |
| `just db-seed`          | seeds two tenants (`Acme Inc.`, `Globex Corp.`) and a platform admin                              |
| `just contract`         | export OpenAPI from NestJS → generate `packages/api-contract/src/generated.ts`                    |
| `just verify`           | format-check → lint → typecheck → test → build → audit (in that order)                            |
| `just secrets`          | `gitleaks detect --config .gitleaks.toml --no-banner --redact` — requires `brew install gitleaks` |

- `just db-migrate`, `just db-seed`, `just db-studio` require a running Postgres — run `just up` first.
- `just test` runs **unit tests only**. Integration tests: `pnpm test:integration` (inside `apps/api`).
- Node `>=20.18.0`; package manager `pnpm@9.15.4` (enforced by `packageManager` field).

---

## 2. Verification Harness — Run Before Declaring Done

| Changed area                             | Required commands                                                  |
| :--------------------------------------- | :----------------------------------------------------------------- |
| Any TS/JS file                           | `just typecheck` + `just lint`                                     |
| Any API endpoint, DTO, or response shape | `just contract` then commit both `openapi.json` and `generated.ts` |
| Non-trivial feature or PR                | `just verify`                                                      |

Lint runs with `--max-warnings=0` in CI — zero warnings allowed. Fix the root cause; never suppress with `any` or `@ts-ignore`.

---

## 3. Database — The Two-URL Rule (Critical Gotcha)

There are two `DATABASE_URL`-style variables that **must never be swapped**:

| Variable                 | Role                                                               | Used by               |
| :----------------------- | :----------------------------------------------------------------- | :-------------------- |
| `DATABASE_URL`           | `boilerplate_app` (DML, `NOBYPASSRLS`)                             | NestJS app at runtime |
| `MIGRATION_DATABASE_URL` | `postgres` superuser → drops to `boilerplate_owner` via `SET ROLE` | `migrate.ts` only     |

Pointing the app at the owner role **silently disables RLS for all queries** — data leaks across tenants with no errors. A third role, `boilerplate_readonly`, exists for reporting.

**Migration sequence** (`apps/api/src/core/database/migrate.ts`):

1. Connect with `MIGRATION_DATABASE_URL` (superuser, `max: 1` pool so `SET ROLE` is session-local)
2. Run `sql/00-roles.sql` — creates `boilerplate_owner`, `boilerplate_app` (and readonly) roles
3. `SET ROLE boilerplate_owner` — tables end up owned by this role, not the superuser
4. Apply Drizzle migrations from `apps/api/drizzle/`
5. Run `sql/99-grants.sql`

**Schema files** (edit these, never the generated migration SQL):
`apps/api/src/core/database/schema/` — `tenants.ts`, `users.ts`, `sessions.ts`, `audit-logs.ts`, `index.ts`

**Never edit** `apps/api/drizzle/` migration files or `drizzle/meta/` after they are merged to `main`. Fix forward with a new migration. The history is currently one squashed migration, `drizzle/0000_*.sql`, which also holds the hand-written RLS policies.

**Type conventions** (enforced by CI grep):

- Money: `bigint` in minor units, column named `price_minor`, companion `currency_code char(3)`. Never `numeric`/`float`.
- Timestamps: always `timestamp('...', { withTimezone: true })`. Bare `timestamp()` is rejected.
- Enums: `text` + `CHECK` constraint (e.g. `ck_users_role`). Not `pgEnum` — `ALTER TYPE ADD VALUE` cannot run inside a transaction and cannot be rolled back.
- Soft deletes: `deleted_at timestamptz`, not `is_deleted boolean`.
- Boolean columns: `is_` / `has_` prefix. Timestamp columns: `_at` suffix.

---

## 4. Multi-Tenancy & RLS — Invariants That Break Silently

**Model:** table `tenants`; `users.tenant_id` (one user = one tenant; null only for `PLATFORM_ADMIN`, enforced by `ck_users_tenant_role`). Roles: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `TENANT_MEMBER` (`ck_users_role`). Registration creates a tenant (`"<name>'s workspace"`) and its first `TENANT_ADMIN`.

Every table needs **both** `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`. Without `FORCE`, the table-owner role bypasses its own policies (the migration role owns all tables).

**Exactly one policy per table** (`tenants`, `users`, `sessions`, `audit_logs`). Two `PERMISSIVE` policies are `OR`-ed by Postgres — this caused a real security incident (ADR-0003). `sessions` has no `tenant_id` and is admin-only.

RLS is controlled by transaction-local session variables set via `set_config(..., true)` (`true` = is_local, resets at transaction end):

- `app.access_mode`: `'admin'` or `'tenant'` only (there is no `'public'` or `'customer'` mode).
- `app.tenant_id`: the caller's tenant, empty otherwise.

`AccessContext` is `{ accessMode: 'tenant', tenantId } | { accessMode: 'admin', reason }` (`core/database/request-context.ts`). Admin mode always requires a `reason` and is logged.

**All business queries must go through `TransactionManager`**:

```typescript
// Correct
this.txManager.runInTenantContext(user.tenantId, async (tx) => { ... });
this.txManager.runInRequestContext(async (tx) => { ... });   // context set by JwtAuthGuard
this.txManager.runAsAdmin('reason for crossing tenants', async (tx) => { ... });
this.txManager.run({ accessMode: 'tenant', tenantId }, async (tx) => { ... });

// NEVER in business code
this.txManager.raw; // escape hatch only (health probes, migrations)
db.select();        // direct db access — bypasses RLS setup
```

A query outside a `TransactionManager`-managed transaction sees `app.access_mode` unset → **returns zero rows silently** (fail-closed). This manifests as "data disappeared" and is extremely hard to debug. Likewise, a `@Public()` route called without a token gets **no** access context.

**RLS testing requirement:** Integration tests must connect as `boilerplate_app`, not `postgres`/owner. Tests using the owner role pass while the policy is completely broken. `vitest.integration.config.ts` sets `fileParallelism: false` — integration specs cannot run in parallel.

**RLS policies are hand-written** below the generated DDL inside the same migration `.sql` file. This is explicitly permitted by rule `03-database-drizzle.md F1`.

---

## 5. API Contract — Do Not Edit Generated Files

`just contract` runs two steps:

1. Starts NestJS with dummy env vars (no real Postgres/Redis — connections are lazy) and writes `packages/api-contract/openapi.json`
2. Generates `packages/api-contract/src/generated.ts` from that JSON

**Never manually edit:**

- `packages/api-contract/openapi.json`
- `packages/api-contract/src/generated.ts`

CI runs an `openapi-drift` job that regenerates and fails on any `git diff`. After any API shape change, run `just contract` and commit both files before opening a PR.

The frontend must consume types **exclusively** from `@repo/api-contract`. Hand-writing response shapes diverges silently.

---

## 6. Backend Architecture — 5-Layer Rule

Dependency direction (one-way, enforced by `eslint-plugin-boundaries`):

```
config ← common ← core ← integrations ← modules
```

- `config/`: Zod env schema (`src/config/env.schema.ts`). Every env var must appear in both this file and `apps/api/.env.example` — CI checks they match. No `.default()` for secrets.
- `common/`: Pure helpers, shared decorators, shared DTOs. Cannot import `core`, `integrations`, or `modules`.
- `core/`: Drizzle, Pino logger, OpenTelemetry, `TransactionManager`, global filters/interceptors/guards.
- `integrations/`: All outbound HTTP (`axios`, third-party SDKs). Currently empty (README only). Importing `axios` inside `modules/` is a linter error.
- `modules/`: Business slices (`auth`, `users`, `health`). Cannot call `db.select()` directly.

**Module structure** (`modules/<feature>/`) — `modules/users/` is the reference slice (list/get/update/soft-delete within a tenant):

```
<feature>.module.ts
<feature>.controller.ts
<feature>.service.ts
<feature>.repository.ts
dto/
errors/
index.ts   ← the ONLY public surface; Repository is never exported from index
```

Services throw domain errors, **not** `HttpException`. `GlobalExceptionFilter` maps them to RFC 9457 responses. Do not `throw new NotFoundException()` in a service.

**Repositories add no tenant filter.** Isolation comes from RLS (ADR-0003); do not add `WHERE tenant_id = ...` as a substitute.

**CASL critical pitfall:** `ability.can('update', 'User')` with a string subject ignores all conditions and returns `true`. Ownership checks require `subject('User', entity)` — always. Subjects live in `SubjectShapes` (`packages/shared-types/src/auth/ability.ts`): `User`, `Tenant`. Every tenant-owned subject carries `tenantId`. Add your own entities by extending `SubjectShapes`.

**Auth:** access token claims are `sub`, `email`, `role`, `tenantId?`, `jti`. There are no memberships and no active-tenant switching.

**Adding a tenant-scoped entity:** follow the checklist in `docs/02-backend-core-va-drizzle-rls.md` section 9 (schema with `tenant_id` + RLS policy → repository → service ability check → contract → web).

---

## 7. API Design Conventions

- All endpoints prefixed `/api/v1`. No unversioned endpoints.
- `tenantId` must **never** be accepted from the client in request DTOs — always read from the JWT via `@CurrentUser()`. (Note: today `ci.yml` has no grep enforcing this; rely on review.)
- All endpoints are authenticated by default (global `JwtAuthGuard`). Public endpoints require `@Public()` — omitting it gives a silent `401`.
- `ValidationPipe` is global with `whitelist: true` + `forbidNonWhitelisted: true`. Extra fields are rejected.
- `201 POST` must include a `Location` header. `204 DELETE` has no body.

**Response envelope — always:**

```json
{ "data": <payload> }
{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 } }
```

Never return a bare array — no place to add `meta` later without a breaking change.

**Error format:** RFC 9457 with `Content-Type: application/problem+json`. Must include `code` (stable `SCREAMING_SNAKE_CASE`), `traceId`, and `invalidParams` for validation failures.

**Health endpoints** (excluded from `/api` prefix):

- `/healthz` — liveness: must NOT check DB. Failure → container restart.
- `/readyz` — readiness: checks DB + Redis. Failure → traffic removed.

---

## 8. TypeScript Strict Flags — Non-Negotiable

From `packages/tsconfig/base.json` (do not disable at app level):

- `noUncheckedIndexedAccess: true` — `arr[0]` is `T | undefined`. Every array access needs a guard.
- `exactOptionalPropertyTypes: true` — `{ foo?: string }` means the property can be absent or `string`, not `string | undefined`.
- `verbatimModuleSyntax: true` — type-only imports **must** use `import type { X }`. Especially important with NestJS decorators to avoid circular runtime imports.
- `useUnknownInCatchVariables: true` — `catch (error: unknown)`, never assume `.message` exists.
- `noPropertyAccessFromIndexSignature: true` — index signatures require bracket notation.

Banned by ESLint:

- `any` (`@typescript-eslint/no-explicit-any: 'error'`) — use `unknown` at boundaries, narrow with Zod.
- Non-null assertion `!` — except `createContext(null!)` for React contexts.
- `as` assertions on object literals — use Zod parsing for runtime narrowing.
- `../` relative imports crossing directory boundaries — use `@/` or `@repo/` aliases.
- `No React.FC` — TypeScript infers component return types from `.tsx` files.

---

## 9. Testing Quirks

**Two separate Vitest configs in `apps/api`:**

- `vitest.config.ts` — unit tests (`**/*.spec.ts`, excludes `*.integration.spec.ts`). Runs with `--sequence.shuffle`.
- `vitest.integration.config.ts` — integration tests (`**/*.integration.spec.ts`). `fileParallelism: false`. `testTimeout: 30_000`. Requires live Postgres + Redis.

`just test` = unit tests only. Integration tests require `just up` first.

**Coverage thresholds (Vitest enforces):**

- `src/common/utils/**`: lines/functions/statements 95%, branches 90%
- `src/modules/**`: lines/functions/statements 80%, branches 70%
- `src/core/database/schema/**` is excluded from coverage entirely.

---

## 10. Package Aliases — Must Be Declared in Three Places

Adding a new alias requires updating all three simultaneously or builds/IDE break silently.

**`apps/api`:** `tsconfig.json` paths + `vitest.config.ts` `resolve.alias` + `vitest.integration.config.ts` `resolve.alias`
**`apps/web`:** `tsconfig.json` paths + `vite.config.ts` `resolve.alias` + ESLint import resolver

Canonical aliases:

| App           | Alias                                                                | Target           |
| :------------ | :------------------------------------------------------------------- | :--------------- |
| `apps/api`    | `@/config`, `@/common`, `@/core`, `@/integrations`, `@/modules`      | `src/<layer>`    |
| `apps/web`    | `@/app`, `@/config`, `@/lib`, `@/shared`, `@/entities`, `@/features` | `src/<layer>`    |
| monorepo-wide | `@repo/shared-types`, `@repo/api-contract`                           | `packages/*/src` |

---

## 11. Frontend Architecture

**HTTP layer:** All API calls go through `apps/web/src/lib/http/client.ts`. Never use raw `fetch` or `axios` in components.

**Dependency direction** (enforced by `eslint-plugin-boundaries`):

```
app → features → entities → shared → lib → config
```

Feature A cannot import `features/B/components/Something`. Only `features/B` (its `index.ts` barrel).

**State management:**

- TanStack Query — server state (never copy to Zustand)
- Zustand — global client state only (theme, in-RAM access token)
- URL search params — filters/pagination
- `useState` — local UI state

**`shared/ui/`** contains shadcn primitives — do not edit these files. Add variants via `cva` or wrap in `shared/components/`.

**Routes** wired in `apps/web/src/app/router.tsx` last, after the page is ready. All routes use `lazy()` + `<Suspense>`.

**i18n** locale files: `apps/web/src/lib/i18n/locales/{en,vi}/auth.json`.

---

## 12. CI & Deployment

- CI only runs on push/PR to `main` and `develop`. No CI on other branches.
- Editing only `docs/**`, `*.md`, or `AGENTS.md` on a PR to `develop` skips all code quality jobs (`docs_only=true`). PRs into `main` always run the full suite.
- Only one branch-protection check needed: **`CI Gate`** (aggregates all jobs).
- Migrations must **not** run in the container startup command — multiple replicas would race.
- Docker image is built for `api` only. Production runs via `docker-compose.prod.yml` (api + `cloudflared`; the API is reachable only through the Cloudflare tunnel). Web deployment is Cloudflare Pages (automatic).

---

## 13. Feature Implementation Order

When adding a feature that touches both backend and frontend, this order is required:

1. Schema change (with `tenant_id`) → `just db-generate` → `just db-migrate`
2. Hand-write RLS policies below the generated DDL in the migration `.sql` file
3. Write integration tests for RLS isolation (two tenants; verify cross-tenant isolation for read and write, in `tenant` and `admin` modes)
4. Implement DTOs, repository, service (with `subject(...)` ability check), controller (with OpenAPI decorators)
5. `just contract` → commit both `openapi.json` and `generated.ts`
6. Frontend consumes types from `@repo/api-contract` only
7. Wire routes in `apps/web/src/app/router.tsx` last

---

## 14. Naming Conventions

- The domain term is `Tenant`. Do not invent synonyms (Organization, Workspace, Account); register new business terms in `docs/glossary.md`.
- Roles: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `TENANT_MEMBER`.
- Files: `kebab-case` with role suffix — `users.service.ts`, `use-users.ts`.
- Classes/types/interfaces: `PascalCase`, no `I` prefix (`UsersRepository`, not `IUsersRepository`).
- Boolean vars: `is`/`has`/`can`/`should` prefix.
- Async finders: `findX` returns `null`; `findXOrThrow` throws.

---

## 15. Coding Rules Reference

| Area           | Read                                                                                                  |
| :------------- | :---------------------------------------------------------------------------------------------------- |
| Every change   | `docs/rules/00-nguyen-tac-chung.md`, `docs/rules/01-typescript.md`                                    |
| `apps/api`     | `docs/rules/02-backend-nestjs.md`, `docs/rules/03-database-drizzle.md`, `docs/rules/06-api-design.md` |
| `apps/web`     | `docs/rules/04-frontend-react.md`                                                                     |
| Auth / secrets | `docs/rules/07-security.md`                                                                           |
| Tests          | `docs/rules/08-testing.md`                                                                            |
| Commits / CI   | `docs/rules/09-git-va-ci.md`, `docs/rules/10-infra-devops.md`                                         |

ADR constraints in brief:

- **ADR-0001**: Modular monolith — do not split into microservices.
- **ADR-0002**: Drizzle, not Prisma.
- **ADR-0003**: Authorization via Postgres RLS, not app-layer filtering.
- **ADR-0004**: CASL/ABAC, not plain RBAC.
- **ADR-0006**: SPA — no Next.js, server components, or `app/`-style routing. (ADR-0005 does not exist: the HMAC M2M decision was removed together with the AI worker.)

---

## 16. Security Notes

- `.agents/mcp_config.json` is git-ignored. Only `.agents/mcp_config.example.json` (with placeholders) may be committed.
- `VITE_*` env vars are embedded in the build output — never put secrets there.
- `ARGON2_MEMORY_COST` must be `>=19456` (OWASP minimum). Do not lower it.
- File uploads (if you add them) use presigned URLs: client → API for URL → client uploads directly to object storage. Files must not pass through the API body. Magic bytes verify file type, not extension.
- Idempotency-Key is required for payments, refunds, and bulk notifications, and for any expensive write you add.
- Run `just secrets` to check for leaked credentials (`brew install gitleaks` required).

## 19. Git Commit Policy

When making commits on behalf of the user (e.g. via `git-master` skill or any omo workflow):

- **Never add** `Co-authored-by:` trailers or `Ultraworked with [Sisyphus]` footers to commit messages.
- **Never add** any AI attribution lines to commit bodies.
- Commit messages must contain only: subject line, optional body, and conventional commit fields.
- The commit author is always the human developer — not the AI agent.

<!-- CODEGRAPH_START -->

## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
