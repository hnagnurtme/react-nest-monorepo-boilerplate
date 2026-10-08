# AGENTS.md — AI Agent Guidance & Operating Protocols

> **Source of truth for coding rules:** [`docs/rules/`](docs/rules/) (written in Vietnamese). **Architectural decisions:** [`docs/adr/`](docs/adr/). This file covers only what an agent would likely get wrong without help. Where docs conflict with this file, `docs/` wins; where docs conflict with the code, the code wins and the docs get fixed.

This is a multi-tenant auth + users boilerplate: `apps/api` (NestJS), `apps/web` (React SPA), `packages/{api-contract,shared-types,eslint-config,tsconfig}`. There is no mobile app and no Python worker.

---

## 1. Command Protocol — Never Bypass `just`

All build, test, lint, migration, and dev commands **MUST** go through `just`. Never call `pnpm`, `npm`, or `drizzle-kit` directly when a `just` recipe exists.

| Command                 | What it actually runs                                                                             |
| :---------------------- | :------------------------------------------------------------------------------------------------ |
| `just install`          | `pnpm install --frozen-lockfile`                                                                  |
| `just up` / `just down` | `docker compose up -d` / `docker compose down` (Postgres 16 + Redis 7)                            |
| `just stop`             | `docker compose stop` and kills listeners on ports 3000 and 5173                                  |
| `just dev`              | `turbo run dev` (api + web)                                                                       |
| `just api` / `just web` | `pnpm --filter @repo/<app> dev`                                                                   |
| `just db-generate`      | `drizzle-kit generate`                                                                            |
| `just db-migrate`       | `tsx src/core/database/migrate.ts` — **not** `drizzle-kit migrate`                                |
| `just db-seed`          | `tsx src/core/database/seed.ts` (dev tenants and accounts)                                        |
| `just contract`         | export OpenAPI from NestJS → generate `packages/api-contract/src/generated.ts`                    |
| `just verify`           | format-check → lint → typecheck → test → build → audit (in that order)                            |
| `just secrets`          | `gitleaks detect --config .gitleaks.toml --no-banner --redact` — requires `brew install gitleaks` |

- `just db-migrate`, `just db-seed`, `just db-studio` require a running Postgres — run `just up` first.
- `just test` runs **unit tests only**. Integration tests: `pnpm test:integration` (inside `apps/api`, needs `just up` + `just db-migrate`).
- Node `>=20.18.0`; package manager `pnpm@9.15.4` (enforced by `packageManager` field).
- The seed creates one account — `admin@platform.com` / `Password123!` (`PLATFORM_ADMIN`, no tenant) — plus two empty tenants (Acme, Globex). It is deliberately the only one: every other account is created through the API by that admin, and roles are assigned through `user_roles`.

### Gotcha: the API dev runner must keep decorator metadata

`apps/api` `dev` runs `node --watch --import @swc-node/register/esm-register src/main.ts`. swc emits decorator metadata and resolves the `@/` aliases. **Do not switch it to `tsx` / esbuild**: they do not emit `emitDecoratorMetadata`, so `ZodValidationPipe` silently skips validation of `@Body()` / `@Query()` DTOs in dev and invalid input reaches the services with no error. Do not use `nest start --watch` either: on this ESM setup it fails on `@/` aliases unless the output is post-processed with `tsc-alias` (only the `build` script does that). `tsx` is still fine for one-off scripts: `migrate.ts`, `seed.ts`, `export-openapi.ts`.

---

## 2. Verification Harness — Run Before Declaring Done

| Changed area                             | Required commands                                                  |
| :--------------------------------------- | :----------------------------------------------------------------- |
| Any TS/JS file                           | `just typecheck` + `just lint`                                     |
| Any `apps/web` component or style        | `just lint-ui` (design-system conventions)                         |
| Any API endpoint, DTO, or response shape | `just contract` then commit both `openapi.json` and `generated.ts` |
| Schema, RLS, or auth changes             | integration tests (`pnpm test:integration` in `apps/api`)          |
| Non-trivial feature or PR                | `just verify`                                                      |

Lint runs with `--max-warnings=0` in CI — zero warnings allowed. Fix the root cause; never suppress with `any` or `@ts-ignore`.

---

## 3. Database — The Two-URL Rule (Critical Gotcha)

There are two `DATABASE_URL`-style variables that **must never be swapped**:

| Variable                 | Role                                                               | Used by                              |
| :----------------------- | :----------------------------------------------------------------- | :----------------------------------- |
| `DATABASE_URL`           | `boilerplate_app` (DML, `NOBYPASSRLS`)                             | NestJS app at runtime                |
| `MIGRATION_DATABASE_URL` | `postgres` superuser → drops to `boilerplate_owner` via `SET ROLE` | `migrate.ts`, `seed.ts`, drizzle-kit |

Pointing the app at the owner role **silently disables RLS for all queries** — data leaks across tenants with no errors. The env schema rejects identical values, but not a wrong-role value.

**Migration sequence** (`apps/api/src/core/database/migrate.ts`):

1. Connect with `MIGRATION_DATABASE_URL` (superuser, `max: 1` pool so `SET ROLE` is session-local)
2. Run `sql/00-roles.sql` — creates `boilerplate_owner`, `boilerplate_app`, `boilerplate_readonly`
3. `SET ROLE boilerplate_owner` — tables end up owned by this role, not the superuser
4. Apply Drizzle migrations from `apps/api/drizzle/`
5. Run `sql/99-grants.sql`
6. `syncAuthzCatalog` (`authz-sync.ts`): upsert `PERMISSION_CATALOG` into `permissions` and `SYSTEM_ROLES` (with grants) into `roles`/`role_permissions`, as `boilerplate_app` in `admin` mode with `app.system_roles_write = 'on'`

**Schema files** (edit these, never the generated migration SQL): `apps/api/src/core/database/schema/` — `users.ts`, `tenants.ts`, `sessions.ts`, `audit-logs.ts`, `permissions.ts`, `roles.ts`, `role-permissions.ts`, `user-roles.ts`, `user-tenants.ts`, `tenant-invitations.ts`, `index.ts`.

**Never edit** `apps/api/drizzle/` migration files or `drizzle/meta/` after they are merged to `main`. Fix forward with a new migration.

**Type conventions** (the first three are checked by the CI `conventions` job; the rest are review rules):

- Timestamps: always `timestamp('...', { withTimezone: true })`. Bare `timestamp()` fails CI.
- Enums: `text` + `CHECK` constraint. `pgEnum` fails CI — `ALTER TYPE ADD VALUE` cannot run inside a transaction and cannot be rolled back.
- Soft deletes: `deleted_at timestamptz`, not `is_deleted boolean`.
- Boolean columns: `is_` / `has_` prefix. Timestamp columns: `_at` suffix.
- Money (when you add it): `bigint` in minor units, named `*_minor`, with a `currency_code char(3)`. There is no money column or util in the boilerplate today.

---

## 4. RLS — Invariants That Break Silently

Every table needs **both** `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`. Without `FORCE`, the table-owner role bypasses its own policies (the migration role owns all tables).

**Exactly one policy per table.** Two `PERMISSIVE` policies are `OR`-ed by Postgres (see ADR-0003).

Both rules are checked by the `coverage` tests in `apps/api/src/core/database/__tests__/rls-isolation.integration.spec.ts` (every public table has RLS enabled and forced; at most one policy per table). That is an integration test, so it runs in CI's `integration` job and locally only with Postgres up. There is no separate CI grep for RLS.

RLS is controlled by the transaction-local settings `app.access_mode` and `app.tenant_id`, set via `set_config(..., true)` (`true` = is_local, resets at transaction end). Access modes: `'admin'` (needs a `reason`; used by callers whose profile scope is `platform`, and by system flows such as the auth flow for `sessions`, `AuthzService.loadProfile`, and the catalog sync) and `'tenant'` (needs a `tenantId`). There is **no `public` mode**. `sessions` is reachable only in `admin` mode. `JwtAuthGuard` picks the mode from the DB-loaded profile, never from the token, and the tenant from the `x-tenant-id` header validated against the profile's memberships.

**Authorization tables** (`permissions`, `roles`, `role_permissions`, `user_roles`) follow the same one-policy rule, plus triggers a policy cannot express: system roles (`tenant_id` NULL, `is_system`) and their grants are immutable unless `app.system_roles_write = 'on'` (only the migrate job sets it, so not even an `admin`-mode API call can edit them); `user_roles` assignment validity is checked, and `user_roles.tenant_id` is supplied by the caller (not stamped) and must name a tenant the account belongs to. Platform-scope system roles are hidden from `tenant` mode. A user has no `role` column any more: a platform user is `tenant_id` NULL plus a platform-scope role.

**An account can belong to several tenants.** `user_tenants` is the authority for membership; `users.tenant_id` survives only as the home tenant (NULL marks a platform account) and may be changed in `admin` mode alone. The `users` policy resolves visibility through `user_tenants`, so a tenant admin sees an account that joined their tenant while living elsewhere. A request still acts in exactly one tenant: `app.tenant_id` stays a single uuid, so every other policy is unchanged.

**All business queries must go through `TransactionManager`** (`apps/api/src/core/database/transaction.manager.ts`):

```typescript
// Correct
this.transactions.runInRequestContext(async (tx) => { ... });   // context set by JwtAuthGuard
this.transactions.run({ accessMode: 'admin', reason: 'auth:login' }, async (tx) => { ... });

// NEVER in business code
this.transactions.raw; // escape hatch for health probes / migrations only
db.select();           // direct db access — bypasses RLS setup (ESLint blocks `db.*` in modules/)
```

A query outside a `TransactionManager`-managed transaction sees `app.access_mode` unset → **returns zero rows silently** (fail-closed). This manifests as "data disappeared" and is extremely hard to debug.

**RLS testing requirement:** integration tests must connect as `boilerplate_app` (`DATABASE_URL`), not `postgres`/owner. Tests using the owner role pass while the policy is completely broken. `vitest.integration.config.ts` sets `fileParallelism: false` — integration specs cannot run in parallel.

**RLS policies are hand-written** below the generated DDL inside the same migration `.sql` file (rule `03-database-drizzle.md` F1).

**Audit log:** `core/audit/AuditService.record(tx, entry)` writes `audit_logs` inside the caller's transaction (it commits or rolls back with the change). Currently used for `user.create|update|delete`, `user.roles.update`, `tenant.create|update`, and `role.create|update|permissions.update|delete`, `user.tenant.invite|invite.revoke|join|remove`. Never put password hashes in before/after snapshots.

---

## 5. API Contract — Do Not Edit Generated Files

`just contract` runs two steps:

1. Boots NestJS with placeholder env vars (no real Postgres/Redis — connections are lazy) and writes `packages/api-contract/openapi.json`
2. Generates `packages/api-contract/src/generated.ts` from that JSON (`openapi-typescript`)

**Never manually edit:**

- `packages/api-contract/openapi.json`
- `packages/api-contract/src/generated.ts`

CI runs an `openapi-drift` job that regenerates and fails on any `git diff`. After any API shape change, run `just contract` and commit both files.

The frontend must consume types **exclusively** from `@repo/api-contract` (through `@/lib/http/types`). Hand-writing response shapes diverges silently.

---

## 6. Backend Architecture — 5-Layer Rule

Dependency direction (one-way, enforced by `eslint-plugin-boundaries`):

```
config ← common ← core ← integrations ← modules
```

- `config/`: Zod env schema (`src/config/env.schema.ts`). Every env var must appear in both this file and `apps/api/.env.example` (a convention; CI does not compare them). No `.default()` for secrets.
- `common/`: Pure helpers, shared decorators, shared DTOs. Cannot import `core`, `integrations`, or `modules`.
- `core/`: Drizzle, Pino logger, OpenTelemetry, `TransactionManager`, audit, auth token service, mail, Redis, CSRF middleware, global filters/interceptors/guards.
- `integrations/`: Outbound adapters (currently empty). Importing `axios`, `node-fetch`, AWS/OpenAI SDKs, or `ioredis` inside `modules/` is a lint error.
- `modules/`: Business slices: `auth`, `users`, `tenants`, `roles`, `health`. Cannot call `db.*` directly.

The API is **ESM** (`NodeNext`): relative imports carry an explicit `.js` extension, and `@/...` aliases are used for cross-directory imports.

**Module structure** (`modules/<feature>/`):

```
<feature>.module.ts
<feature>.controller.ts
<feature>.service.ts
<feature>.repository.ts
<feature>.types.ts
dto/       ← request AND response Zod schemas (`*-response.dto.ts`); types are `z.infer`
index.ts   ← the ONLY public surface; Repository is never exported from index
```

There are no hand-written OpenAPI JSON schemas. Response shapes are Zod schemas wrapped by `dataEnvelope()` / `pagedEnvelope()` (`common/dto`), turned into DTO classes with `createZodDto`, and attached with `@ApiResponse({ type: XEnvelopeDto })`.

Services throw domain errors (`core/errors`), **not** `HttpException`. `GlobalExceptionFilter` maps them to RFC 9457 responses, and also unwraps Drizzle's `cause` to map Postgres SQLSTATE codes (`23505` → 409 `RESOURCE_CONFLICT`, `23503` → 409 `REFERENCE_CONSTRAINT`, `23514` → 422). Do not `throw new NotFoundException()` in a service.

**CASL critical pitfall:** `ability.can('update', 'User')` with a string subject ignores all conditions and returns `true`. Ownership checks require `subject('User', entity)` — always. `@CheckPolicies` on a controller is layer 1 (permission only); the service re-checks on the loaded record (layer 2); RLS is layer 3.

**Authorization model (ADR-0005): permissions live in the database, the catalog lives in code.**

- `PERMISSION_CATALOG` and `SYSTEM_ROLES` (fixed UUIDs) in `packages/shared-types/src/authz/catalog.ts` are the source of truth. A grant is `(action, subject, preset)` with preset `any | own_tenant | own_record`; `conditionsFor()` in `authz/ability.ts` maps presets to CASL conditions. Tenants choose presets and never author conditions. Tenant roles can never use `any` or `platformOnly` entries (`manage:all`, `Tenant` create/delete). `buildAbility` always adds `cannot update/delete Role { isSystem: true }`.
- **The tenant a request acts in comes from the `x-tenant-id` header**, and only ever as a choice among the memberships the database reports: a header naming another tenant is `401`, and so is a missing one — even for an account with a single tenant. Routes that must work before the choice is made carry `@NoTenantContext()` (`GET /auth/me`, `me/abilities`, `logout-all`, `change-password`) and open their own `admin`-mode transaction. Grants are kept per tenant (`grantsByTenant`), so administering one tenant grants nothing in another; `AuthzService.currentGrants()` and `current()` answer for the active tenant. `DELETE /users/:id` from a tenant removes the membership and that tenant's roles, leaving the account; from platform scope it deletes the account.
- The access token carries only `sub`, `email`, `jti`. `JwtAuthGuard` calls `AuthzService.loadProfile(userId)` on **every** request (DB in `admin` mode, cached in Redis as `authz:profile:<id>`, TTL 300 s, evicted explicitly on role, permission, assignment, and deactivation changes). Tenant, scope, roles, and grants come from that profile; an inactive or missing user gives `401`. Profile scope `platform` means RLS `admin` mode; otherwise `tenant` mode with `profile.tenantId`; neither means `401`.
- Services get the ability from `AuthzService.current()` and check with `subject('User', entity)`; `PoliciesGuard` uses the same ability. Do not rebuild abilities from token claims or `AuthContext.roles`.
- Anti-escalation invariants (do not weaken them): nobody grants or assigns more than they hold (`grantsCover`: same action and subject at an equal or wider reach; `manage:all` covers all); nobody edits their own roles; a tenant always keeps at least one active `TENANT_ADMIN` (409); system roles are immutable even for platform admins; a role cannot be deleted while assigned (409).
- **Gotcha: the permission sync runs in `just db-migrate`, not at app startup** (replicas would race). A new `PERMISSION_CATALOG` or `SYSTEM_ROLES` entry is invisible to the API until you run it, and `just db-migrate` needs `just up` first. Cached profiles also lag up to 300 s when something changes outside the API (a direct DB edit); changes made through the API evict the cache.
- API: `GET /permissions` (what the caller may grant), `GET/POST /roles`, `GET/PATCH/DELETE /roles/:id`, `PUT /roles/:id/permissions`, `PUT /users/:id/roles`, `POST /users` takes `roleIds` (min 1), `GET /auth/me` (`PublicUser` with `scope` and `roles`), `GET /auth/me/abilities` (packed CASL rules; the web builds its ability with `abilityFromPacked`).
- New entity with permissions: add the subject to `SubjectShapes` and `conditionsFor`; add catalog entries (with `platformOnly` and presets); add grants to `SYSTEM_ROLES` if a system role needs them; run `just db-migrate`; add the table with `tenant_id` and RLS; use `AuthzService.current()` and `subject()` in the service; `just contract`; `CanAction` in the web. Full checklist: `docs/03-auth-flow-va-casl-abac.md` section 2.7.

---

## 7. API Design Conventions

- All endpoints prefixed `/api/v1`. No unversioned endpoints (except `/healthz`, `/readyz`).
- **Tenant comes from the caller's profile, not the client.** `tenantId` must not appear in request DTOs, with three exceptions: `POST /users`, `POST /roles` and `PUT /users/:id/roles` accept an optional `tenantId` because a platform admin chooses the tenant. For a tenant user the value is validated against their own tenant (a different value is rejected, an absent one is filled in). Any other DTO with `tenantId` is a bug. This is a review rule; there is no CI grep for it.
- System roles: `PLATFORM_ADMIN` (platform scope, no tenant), `TENANT_ADMIN`, `TENANT_MEMBER`; tenants can add custom roles. There is **no self sign-up**: `POST /auth/register`, `/auth/verify-email`, `/auth/resend-otp` do not exist. Accounts are created only by users holding `create:User` (`POST /tenants` needs `create:Tenant`, platform only); created users are active and email-verified.
- Remaining auth endpoints: `login`, `refresh`, `logout`, `logout-all`, `me`, `me/abilities`, `forgot-password` (OTP by email), `reset-password`, `change-password`.
- **An email is one account platform-wide** (`uq_users_email`), so a second tenant cannot create it again: `POST /users` answers 409 `ACCOUNT_ALREADY_EXISTS` and the caller invites that account instead (`POST /tenant-invitations`, then the invitee accepts through `GET /tenant-invitations/:token` + `POST /tenant-invitations/accept`, both `@Public()`). The account accepts for itself on purpose — attaching it directly would let a tenant admin pull in any stranger by guessing the address and then hold `update:User own_tenant` over them. Outstanding invitations live in the `tenant_invitations` table (only the token's SHA-256 is stored, one live row per account and tenant via a partial unique index), **not** in Redis: the tenant has to be able to list, withdraw and resend them, and a cache restart losing the lot turns into a 404 that reads like a bug. `GET`/`DELETE /tenant-invitations/:id` and `POST /tenant-invitations/:id/resend` cover that; `markAccepted` is the lock, so two clicks on one link cannot both add a membership. The account invitations in `InvitationService` still use Redis.
- All endpoints are authenticated by default (global `JwtAuthGuard`). Public endpoints require `@Public()` — omitting it gives a `401`.
- Validation is `ZodValidationPipe` (global, `nestjs-zod`) with `.strict()` DTO schemas, so extra fields are rejected with 422. There is no class-validator `ValidationPipe`.
- `201 POST` must include a `Location` header. `204 DELETE` has no body.
- Lists use offset pagination: `?page=1&limit=20` (max 100), `sortBy` must be allow-listed per repository.

**Response envelope — always:**

```json
{ "data": <payload> }
{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 } }
```

Never return a bare array — no place to add `meta` later without a breaking change.

**Error format:** RFC 9457 with `Content-Type: application/problem+json`. Includes `code` (stable `SCREAMING_SNAKE_CASE`, see `common/constants/error-codes.ts`), `traceId` when a span is active, and `invalidParams` for validation failures.

**Health endpoints** (excluded from `/api` prefix):

- `/healthz` — liveness: must NOT check DB. Failure → container restart.
- `/readyz` — readiness: checks DB + Redis. Failure → traffic removed.

**Auth/CSRF facts that bite:**

- Web clients get the refresh token in an httpOnly `refresh_token` cookie (`Path=/api/v1/auth`, `SameSite=Lax`) plus a readable `csrf_token` cookie. `CsrfMiddleware` (global) only enforces when a `csrf_token` cookie is present: it then needs a matching `x-csrf-token` header **and** `Origin === WEB_ORIGIN`. `WEB_ORIGIN` must equal the web dev origin (`http://localhost:5173`), or POSTs fail with 403 once the cookie exists. A stale `csrf_token` cookie set by another project on `localhost` causes the same 403 (see `setup.md`).
- `POST /auth/refresh` and `/auth/logout` accept a missing body: the browser sends none and the token comes from the `refresh_token` cookie.
- Login is throttled per IP (5/min), refresh 30/min, forgot/reset 5/min; the counters live in Redis, so a dead Redis breaks auth.

---

## 8. TypeScript Strict Flags — Non-Negotiable

From `packages/tsconfig/base.json` (do not disable at app level):

- `noUncheckedIndexedAccess: true` — `arr[0]` is `T | undefined`. Every array access needs a guard.
- `exactOptionalPropertyTypes: true` — `{ foo?: string }` means the property can be absent or `string`, not `string | undefined`.
- `useUnknownInCatchVariables: true` — `catch (error: unknown)`, never assume `.message` exists.
- `noPropertyAccessFromIndexSignature: true` — index signatures require bracket notation.
- `verbatimModuleSyntax: true` in `base.json` (web); `packages/tsconfig/nest.json` turns it **off** for the API so Nest decorator metadata keeps working. Still use `import type` for type-only imports (ESLint `consistent-type-imports`).

Enforced by ESLint (`packages/eslint-config`):

- `any` (`no-explicit-any`, `no-unsafe-*`) — use `unknown` at boundaries, narrow with Zod.
- Non-null assertion `!`.
- `as` assertions on object literals — use Zod parsing for runtime narrowing.
- `../` relative imports — use `@/` or `@repo/` aliases.
- `no-console`, `import/no-cycle`, `import/order`, `unicorn/filename-case`, `consistent-type-definitions: interface`.
- `React.FC` is a review rule, not a lint rule — still do not use it.

Not enforced by tooling despite older docs: `max-depth`, `complexity`, `max-lines`, `max-params`, `no-magic-numbers` are switched off in the shared config.

---

## 9. Testing Quirks

**Two separate Vitest configs in `apps/api`:**

- `vitest.config.ts` — unit tests (`src/**/*.spec.ts`, `test/**/*.spec.ts`; excludes `*.integration.spec.ts`). Runs with `sequence.shuffle`, so tests must not depend on order.
- `vitest.integration.config.ts` — integration tests (`*.integration.spec.ts`). `fileParallelism: false`. `testTimeout: 30_000`. Requires live Postgres + Redis (CI uses service containers, not Testcontainers).

**Coverage thresholds (Vitest enforces, only when run with coverage):**

- `apps/api` `src/common/utils/**`: lines/functions/statements 95%, branches 90%
- `apps/api` `src/modules/**`: lines/functions/statements 80%, branches 70%
- `apps/web`: thresholds on `src/lib/http/**`, `src/lib/auth/**`, `route-guard.tsx`, `features/auth/api/**` (see `apps/web/vite.config.ts`)
- `src/core/database/schema/**` is excluded from API coverage.

`just test` = unit tests only. Web tests live in `apps/web/test/` (Vitest + Testing Library).

---

## 10. Package Aliases — Must Be Declared in All Places

Adding a new alias requires updating every place or builds/tests break silently.

**`apps/api`:** `tsconfig.json` paths + `vitest.config.ts` `resolve.alias` + `vitest.integration.config.ts` `resolve.alias`.
**`apps/web`:** `tsconfig.json` paths + `vite.config.ts` `resolve.alias` (ESLint resolves through the tsconfig).

| App           | Alias                                                           | Target           |
| :------------ | :-------------------------------------------------------------- | :--------------- |
| `apps/api`    | `@/config`, `@/common`, `@/core`, `@/integrations`, `@/modules` | `src/<layer>`    |
| `apps/web`    | `@/*` (one catch-all alias)                                     | `src/*`          |
| monorepo-wide | `@repo/shared-types`, `@repo/api-contract`                      | `packages/*/src` |

---

## 11. Frontend Architecture

**HTTP layer:** All API calls go through `apps/web/src/lib/http/client.ts` (a `fetch` wrapper — there is no axios). Never use raw `fetch` or `axios` in features, entities, or shared (ESLint-enforced). The client unwraps the `{ data }` envelope, attaches the bearer token, adds `x-csrf-token` to unsafe methods, and does single-flight refresh on 401 (`lib/http/refresh.ts`, with a cross-tab lock).

**Dependency direction** (enforced by `eslint-plugin-boundaries`):

```
app → features → entities → shared → lib → config
```

Feature A cannot import `features/B/components/Something`. Only `features/B` (its `index.ts` barrel).

**Features:** `auth` (login, forgot/reset password, CASL ability provider fed by `GET /auth/me/abilities`), `users` and `tenants` (admin UIs, including the create-user and create-tenant forms), `roles` (roles page with a permission matrix), `home`, `status`. Route guards and `CanAction` use abilities, never hardcoded role lists. There is no sign-up page and no social login.

**State management:**

- TanStack Query — server state (never copy to Zustand)
- Zustand — global client state only (`entities/session`: user and in-RAM access token)
- URL search params — filters/pagination
- `useState` — local UI state

**`shared/ui/`** is the only primitive directory (there is no `shared/components/`): small hand-written primitives, not generated shadcn output. It holds the design system's shared pieces — the control height scale (`control.ts`), the one focus ring (`focus-ring.ts`), the text-control shell (`field.ts`), `TEXT_LINK` and `buttonVariants`. Add variants rather than domain logic; keep it free of `features/` / `entities/` imports (ESLint-enforced).

**Styling is token-only** (`docs/rules/11-ui-design-system.md`): colour, radius, shadow and type come from `@theme` in `app/styles/globals.css` — `rounded-control`/`rounded-surface`/`rounded-overlay`/`rounded-inner`/`rounded-pill`, `shadow-raised`/`shadow-floating`/`shadow-overlay`, `text-display`/`text-title`/`text-heading`/`text-body`/`text-label`/`text-caption`. Default Tailwind utilities for those (`rounded-xl`, `text-sm`, `shadow-md`) and the default palette (`bg-slate-500`) are rejected by `just lint-ui`, as are hex values, pixel arbitrary values, emoji anywhere under `apps/web/src`, and `h-4 w-4` in place of `size-4`. One icon set: `lucide-react`. A raw `<button>`/`<input>`/`<select>`/`<textarea>` outside `shared/ui` is an ESLint error.

**Routes** wired in `apps/web/src/app/router.tsx` last, after the page is ready. All routes use `lazy()` + `<Suspense>`; protected ones sit inside `RouteGuard`.

**i18n:** `apps/web/src/lib/i18n/locales/{en,vi}/*.json` (`auth`, `users`, ...). The default language is English; Vietnamese is available. Add every new string to both locales.

---

## 12. CI Pipeline

- CI only runs on push/PR to `main` and `develop`. No CI on other branches. There is **no CD workflow**.
- Jobs: `secret-scan`, `commitlint`, `quality` (format + lint with `--max-warnings=0`), `typecheck`, `test-unit` (+ `pnpm audit:ci`), `integration` (Postgres 16 + Redis 7 service containers, runs `db:migrate` twice to prove idempotency, then `test:integration` as the app role), `openapi-drift`, `conventions` (grep checks, below).
- `conventions` fails when: a bare `timestamp(` without `withTimezone` appears in `apps/api/src/core/database/schema/*.ts`; `pgEnum(` appears there; or `from 'axios'` appears under `apps/api/src/modules`. Those are the only CI greps. Everything else described as "CI greps ..." in older docs is not implemented.
- Editing only `docs/**`, `*.md`, or `AGENTS.md` skips the code jobs on PRs to `develop` (`docs_only`); PRs into `main` always run everything.
- Only one branch-protection check is needed: **`CI Gate`** (aggregates all jobs).
- Migrations must **not** run in the container startup command — multiple replicas would race. Only `apps/api` has a Dockerfile.

---

## 13. Feature Implementation Order

When adding a feature that touches both backend and frontend, this order is required:

1. Schema change → `just db-generate` → `just db-migrate`
2. Hand-write RLS policies below the generated DDL in the migration `.sql` file
3. Write integration tests for RLS isolation (two tenants; verify read, write, and cross-tenant insert)
   If the entity has permissions: add the subject to `SubjectShapes`/`conditionsFor` and the catalog entries (and `SYSTEM_ROLES` grants) in `packages/shared-types`, then run `just db-migrate` to sync them
4. Implement DTOs, repository, service (with `AuditService` for sensitive writes), controller (with OpenAPI decorators)
5. `just contract` → commit both `openapi.json` and `generated.ts`
6. Frontend consumes types from `@repo/api-contract` only
7. Wire routes in `apps/web/src/app/router.tsx` last

---

## 14. Naming Conventions

- Domain terms: use `Tenant` (not Organization, Workspace, Account). See `docs/glossary.md`.
- System role keys: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `TENANT_MEMBER`. Permission keys are `action:subject` (`update:User`); presets are `any`, `own_tenant`, `own_record`.
- Files: `kebab-case` with role suffix — `users.service.ts`, `use-users.ts`.
- Classes/types/interfaces: `PascalCase`, no `I` prefix (`UsersRepository`, not `IUsersRepository`).
- Boolean vars: `is`/`has`/`can`/`should` prefix.
- Async finders: `findX` returns `null`/`undefined`; `findXOrThrow` throws.

---

## 15. Coding Rules Reference

| Area           | Read                                                                                                  |
| :------------- | :---------------------------------------------------------------------------------------------------- |
| Every change   | `docs/rules/00-nguyen-tac-chung.md`, `docs/rules/01-typescript.md`                                    |
| `apps/api`     | `docs/rules/02-backend-nestjs.md`, `docs/rules/03-database-drizzle.md`, `docs/rules/06-api-design.md` |
| `apps/web`     | `docs/rules/04-frontend-react.md`, `docs/rules/11-ui-design-system.md`                                |
| Auth / secrets | `docs/rules/07-security.md`                                                                           |
| Tests          | `docs/rules/08-testing.md`                                                                            |
| Commits / CI   | `docs/rules/09-git-va-ci.md`, `docs/rules/10-infra-devops.md`                                         |

ADR constraints in brief:

- **ADR-0001**: Modular monolith — do not split into microservices.
- **ADR-0002**: Drizzle, not Prisma.
- **ADR-0003**: Tenant isolation via Postgres RLS, not app-layer filtering.
- **ADR-0004**: CASL/ABAC, not plain RBAC.
- **ADR-0005**: Roles and permissions live in the database (code owns the catalog, presets are a closed vocabulary), refining ADR-0004.
- **ADR-0006**: SPA — no Next.js, server components, or `app/`-style routing.

---

## 16. Security Notes

- `.agents/mcp_config.json` is git-ignored. Only `.agents/mcp_config.example.json` (with placeholders) may be committed.
- `VITE_*` env vars are embedded in the build output — never put secrets there.
- `ARGON2_MEMORY_COST` must be `>=19456` (OWASP minimum); the env schema enforces it. Do not lower it.
- Run `just secrets` to check for leaked credentials (`brew install gitleaks` required); the pre-commit hook also runs gitleaks when installed.
- Rate limiting and the access-token denylist live in Redis (`auth:denylist:<jti>`); refresh tokens are opaque random values stored only as HMAC-SHA256 hashes in `sessions`.

## 17. Git Commit Policy

When making commits on behalf of the user (e.g. via `git-master` skill or any omo workflow):

- **Never add** `Co-authored-by:` trailers or `Ultraworked with [Sisyphus]` footers to commit messages.
- **Never add** any AI attribution lines to commit bodies.
- Commit messages must contain only: subject line, optional body, and conventional commit fields.
- The commit author is always the human developer — not the AI agent.

## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
