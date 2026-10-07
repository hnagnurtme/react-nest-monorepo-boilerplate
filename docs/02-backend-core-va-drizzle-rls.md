---
title: Backend Core & RLS
description: Kiến trúc 5 tầng NestJS, Drizzle ORM, Postgres RLS, envelope & error filter
status: stable
updated: 2026-10-07
owner: Platform Team
---

# Kế hoạch Boilerplate 02: Backend Core, Drizzle ORM & Postgres RLS

> **Mục tiêu:** Xây dựng khung NestJS Modular Monolith 5 tầng, tích hợp Drizzle ORM với PostgreSQL Row Level Security (RLS) transaction-local, hệ thống lọc exception RFC 9457 và response envelope chuẩn.

---

## 1. Cấu trúc 5 Tầng Backend (`apps/api/src/`)

```
src/
├── config/                  # TẦNG 1: Validate biến môi trường bằng Zod
│   ├── env.schema.ts        # nguồn sự thật của mọi biến môi trường
│   ├── app.config.ts        # AppConfig: truy cập env đã validate qua DI
│   └── load-env-file.ts
│
├── common/                  # TẦNG 2: Tiện ích thuần túy, KHÔNG dính DB/Redis/HTTP/FS
│   ├── constants/           # error-codes, http (header, body limit), regex
│   ├── decorators/          # @Public(), @CurrentUser(), @ClientInfoParam(), @NoEnvelope(), ApiProblemResponses
│   ├── dto/                 # pageQuerySchema, parseSort, buildPaginationMeta
│   ├── types/               # AuthContext, ClientInfo
│   └── utils/               # duration, slug
│
├── core/                    # TẦNG 3: Hạ tầng kỹ thuật, nạp 1 lần tại CoreModule
│   ├── database/            # DrizzleModule, TransactionManager, request-context, schema/, sql/, migrate.ts, seed.ts
│   ├── audit/               # AuditService: ghi audit_logs trong transaction của caller
│   ├── auth/                # AccessTokenService: ký/verify JWT, denylist jti trong Redis
│   ├── guards/              # JwtAuthGuard (global), PoliciesGuard + @CheckPolicies
│   ├── middleware/          # CsrfMiddleware (double-submit)
│   ├── errors/              # AppError và các domain error
│   ├── filters/             # GlobalExceptionFilter (RFC 9457)
│   ├── interceptors/        # TransformInterceptor ({ data, meta })
│   ├── logger/              # Pino + mixin (traceId, userId, tenantId) + redact
│   ├── mail/                # MailService (SMTP, template HTML)
│   ├── openapi/             # hỗ trợ CSRF cho Swagger UI
│   ├── redis/               # RedisService, throttler storage
│   └── telemetry/           # OpenTelemetry SDK bootstrap (import đầu tiên của main.ts)
│
├── integrations/            # TẦNG 4: Outbound Adapters gọi hệ thống ngoài (hiện chỉ có README, thêm adapter khi cần)
│
└── modules/                 # TẦNG 5: Các lát cắt nghiệp vụ (Feature Slices)
    ├── health/              # /healthz (Liveness) & /readyz (Readiness)
    ├── auth/                # login, refresh rotation, logout, me, forgot/reset/change password
    ├── users/               # list/get/create/update/soft-delete user — slice mẫu
    └── tenants/             # list/get/create/update tenant
```

**Không có tự đăng ký.** Tài khoản chỉ do admin tạo: `PLATFORM_ADMIN` tạo tenant (`POST /tenants`) và user ở bất kỳ tenant nào (`POST /users` kèm `tenantId`); `TENANT_ADMIN` tạo `TENANT_ADMIN`/`TENANT_MEMBER` trong tenant của mình. User mới ở trạng thái active + đã xác minh email, với mật khẩu do admin đặt. Các route `auth/register`, `verify-email`, `resend-otp` đã bị gỡ.

---

## 2. Drizzle ORM & Quản lý Multi-tenant RLS

### 2.1 Thiết lập Database Roles trong PostgreSQL

Hệ thống sử dụng **3 database roles** riêng biệt, tạo bởi `src/core/database/sql/00-roles.sql` (idempotent, chạy trước mỗi lần migrate):

1. `boilerplate_owner`: sở hữu mọi bảng, có quyền DDL. Chỉ dùng cho migration: `migrate.ts` (lệnh `just db-migrate`) kết nối bằng `MIGRATION_DATABASE_URL` (superuser) rồi `SET ROLE boilerplate_owner`. Không dùng `drizzle-kit migrate`.
2. `boilerplate_app`: Dùng cho ứng dụng NestJS runtime kết nối bình thường, không bypass được RLS (`NOBYPASSRLS`).
3. `boilerplate_readonly`: Dùng cho báo cáo, phân tích đọc dữ liệu (Read-only replicas).

### 2.2 Access Mode — Nguồn sự thật duy nhất cho RLS

> ⚠️ **Sai lầm chết người cần tránh:** Nhiều hệ thống tạo 2 policy PERMISSIVE riêng biệt (một cho tenant, một cho admin). PostgreSQL **OR** các policy PERMISSIVE lại với nhau, nên một policy thừa sẽ mở rộng quyền thay vì thu hẹp → **thủng cách ly** giữa các tenant (xem [ADR-0003](adr/0003-rls-thay-vi-loc-o-tang-ung-dung.md)).
>
> Giải pháp: **chỉ dùng 1 policy duy nhất trên mỗi bảng**, và đưa _chế độ truy cập_ vào session context.

Mọi transaction bắt buộc khai báo `app.access_mode`, nhận đúng 1 trong 2 giá trị:

| `app.access_mode` | Ngữ cảnh                                            | Biến kèm theo   | Phạm vi dữ liệu                                   |
| :---------------- | :-------------------------------------------------- | :-------------- | :------------------------------------------------ |
| `tenant`          | TENANT_ADMIN / TENANT_MEMBER đã đăng nhập           | `app.tenant_id` | Chỉ dữ liệu của đúng tenant đó, đọc lẫn ghi       |
| `admin`           | PLATFORM_ADMIN, hoặc luồng hệ thống (auth) có lý do | —               | Toàn hệ thống, đọc lẫn ghi; luôn ghi log `reason` |

Không có giá trị mặc định và **không có chế độ `public`**. Nếu transaction quên khai báo, `current_setting('app.access_mode', true)` trả `NULL`, mọi nhánh trong policy đều `false` → truy vấn trả 0 dòng và mọi ghi đều bị chặn. Đây là hành vi **fail-closed** có chủ đích. Route `@Public()` gọi không kèm token cũng không có access context, nên một query lạc vào đó đọc ra 0 dòng.

Kiểu `AccessContext` (`core/database/request-context.ts`) là union phân biệt, để không thể xin `tenant` mà thiếu tenant, hay xin `admin` mà không nêu lý do:

```typescript
export type AccessContext = { accessMode: 'tenant'; tenantId: string } | { accessMode: 'admin'; reason: string };
```

Bảng `sessions` chỉ truy cập được ở chế độ `admin` (luồng auth chạy với `reason` rõ ràng, ví dụ `auth:refresh`); mọi caller khác thấy bảng rỗng. `JwtAuthGuard` suy ra access mode từ role trong token: `PLATFORM_ADMIN` ➔ `admin` (reason `platform-admin:<id>`), role thuộc tenant ➔ `tenant` kèm `tenantId` (token thiếu tenant bị từ chối).

### 2.3 Transaction-local Session Context

- Ngữ cảnh request (`accessContext`, `authContext`, `userId`, `tenantId`, `traceId`) được lưu trong `AsyncLocalStorage` qua `nestjs-cls`.
- `TransactionManager` mở transaction và nạp context **bằng tham số hóa**, tuyệt đối không nội suy chuỗi vào SQL:

```typescript
// core/database/transaction.manager.ts
await db.transaction(async (tx) => {
  await tx.execute(
    sql`SELECT set_config('app.access_mode', ${ctx.accessMode}, true),
               set_config('app.tenant_id',   ${tenantId}, true)`,
  );
  return work(tx);
});
```

_(Tham số thứ 3 là `true` → biến chỉ sống trong transaction hiện tại và tự hủy khi commit/rollback. Bắt buộc, vì connection pool tái sử dụng connection cho request khác.)_

**Ràng buộc kèm theo:**

- `TransactionManager` có các phương thức: `run(context, fn)`, `runInRequestContext(fn)` (lấy context do `JwtAuthGuard` đặt), `runAsAdmin(reason, fn)`, `runInTenantContext(tenantId, fn)` và `raw` (chỉ cho health probe/migration).
- Mọi truy vấn nghiệp vụ **phải** nằm trong transaction do `TransactionManager` mở. Query chạy ngoài transaction sẽ không có context → fail-closed.
- `DATABASE_URL` lúc runtime **phải** trỏ tới role `boilerplate_app`. Role `boilerplate_owner` là chủ sở hữu bảng nên có thể bỏ qua RLS nếu thiếu `FORCE ROW LEVEL SECURITY` — chỉ dùng cho migration. Env schema từ chối `DATABASE_URL === MIGRATION_DATABASE_URL`, nhưng không kiểm tra được bạn trỏ nhầm sang role owner.
- Nếu dùng PgBouncer, bắt buộc **transaction pooling mode** (session mode sẽ giữ GUC rò sang request khác khi thiếu `is_local = true`).

### 2.4 Mẫu Bảng có RLS trong Drizzle (bảng `users`)

Schema nằm ở `apps/api/src/core/database/schema/` (`tenants.ts`, `users.ts`, `sessions.ts`, `audit-logs.ts`). Chỉ sửa các file này rồi `just db-generate`; không sửa tay migration đã merge. Rút gọn:

```typescript
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique('uq_tenants_slug'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  role: text('role').notNull().default('TENANT_MEMBER'),
  // null chỉ hợp lệ với PLATFORM_ADMIN (ràng buộc ck_users_tenant_role)
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'restrict' }),
  // ... fullName, passwordHash, isActive, isEmailVerified, timestamps, deletedAt
});
```

Ràng buộc CHECK trong migration: `ck_users_role` (`role IN ('PLATFORM_ADMIN','TENANT_ADMIN','TENANT_MEMBER')`) và `ck_users_tenant_role` (`role` thuộc tenant ⇔ `tenant_id IS NOT NULL`).

Policy RLS được viết tay bên dưới phần DDL do drizzle-kit sinh, trong cùng file `apps/api/drizzle/0000_*.sql` — **một policy duy nhất** cho cả 2 chế độ:

```sql
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_access_policy" ON "users"
  FOR ALL
  TO boilerplate_app
  USING (
    current_setting('app.access_mode', true) = 'admin'
    OR (
      current_setting('app.access_mode', true) = 'tenant'
      AND "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.access_mode', true) = 'admin'
    OR (
      current_setting('app.access_mode', true) = 'tenant'
      AND "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  );
```

Ghi chú theo bảng:

- `tenants`: policy so khớp trên chính `id` — tenant sửa được hàng của mình nhưng không tạo được tenant khác (`WITH CHECK`).
- `sessions`: không có `tenant_id`; policy chỉ cho `admin`.
- `audit_logs`: `tenant_id` nullable (hành động của platform), cùng khuôn `admin OR tenant`; tenant không ghi được dòng gán cho tenant khác.

### 2.5 Checklist Bắt buộc Khi Thêm Bảng Mới

Mỗi bảng nghiệp vụ có cột `tenant_id` bắt buộc đi kèm trong cùng một migration:

- [ ] `ENABLE ROW LEVEL SECURITY` **và** `FORCE ROW LEVEL SECURITY`.
- [ ] Đúng **một** policy `FOR ALL`, đặt tên `<table>_access_policy`.
- [ ] Index trên `tenant_id` (policy chạy trên mọi câu truy vấn, thiếu index là seq scan toàn bảng).
- [ ] Integration test cách ly: tạo dữ liệu 2 tenant, assert tenant A không đọc/ghi được dữ liệu tenant B, và `admin` mode thấy cả hai.

Xem thêm [mục 6](#6-checklist-thêm-một-entity-thuộc-tenant-mới) cho quy trình đầy đủ từ schema tới contract.

### 2.6 Kiểm tra Tự động — Không Bảng Nào Bị Bỏ Sót

Chốt chặn nằm trong integration test, **không** phải một bước riêng của `ci.yml`: describe `coverage` của `apps/api/src/core/database/__tests__/rls-isolation.integration.spec.ts` kiểm tra

1. mọi bảng trong schema `public` đều `relrowsecurity` **và** `relforcerowsecurity`;
2. không bảng nào có quá một policy (`pg_policies`).

Test này chạy trong job `integration` của CI (Postgres service container + role `boilerplate_app`); chạy local bằng `pnpm test:integration` trong `apps/api` sau `just up` và `just db-migrate`. Thêm bảng mới mà quên RLS ➔ job `integration` đỏ.

---

## 3. Envelope & Exception Filter

### 3.1 `TransformInterceptor`

Mọi API response thành công đều tự động được bọc:

```json
{
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

Handler trả `{ items, meta }` ➔ interceptor đổi thành `{ data: items, meta }`; trả object/mảng thường ➔ `{ data }`; `204` không có body. `@NoEnvelope()` bỏ qua việc bọc (stream, file).

Header phản hồi:

- `x-trace-id: 0af7651916cd43dd8448eb211c80319c` (khi có span đang hoạt động)

### 3.2 `GlobalExceptionFilter` (RFC 9457)

Mọi lỗi HTTP / Hệ thống đều trả về:

```json
{
  "type": "https://api.boilerplate.com/errors/RESOURCE_NOT_FOUND",
  "title": "Not Found",
  "status": 404,
  "detail": "User with ID '...' does not exist",
  "instance": "/api/v1/users/...",
  "code": "RESOURCE_NOT_FOUND",
  "traceId": "0af7651916cd43dd8448eb211c80319c"
}
```

Content-Type: `application/problem+json`. `invalidParams` (`[{ name, reason }]`) chỉ có với lỗi validation (`422 VALIDATION_FAILED`). Danh sách `code` ổn định ở `src/common/constants/error-codes.ts`.

Filter cũng **mở lớp `cause` của lỗi Drizzle** để ánh xạ mã SQLSTATE của Postgres thành lỗi API ổn định, nên service không cần tự bắt lỗi driver:

| SQLSTATE | HTTP | `code`                 | Ví dụ                                    |
| :------- | :--- | :--------------------- | :--------------------------------------- |
| `23505`  | 409  | `RESOURCE_CONFLICT`    | tạo user trùng email, tenant trùng slug  |
| `23503`  | 409  | `REFERENCE_CONSTRAINT` | tham chiếu không tồn tại / còn đang dùng |
| `23514`  | 422  | `VALIDATION_FAILED`    | vi phạm `CHECK` constraint               |

---

## 4. Fail-Fast Environment Validation

Trong `src/config/env.schema.ts`, toàn bộ biến môi trường được kiểm định bằng Zod. Các nhóm chính (xem `apps/api/.env.example`): `DATABASE_URL` / `MIGRATION_DATABASE_URL` / `DATABASE_POOL_MAX`, `REDIS_URL`, `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL`, `ARGON2_MEMORY_COST`, `CORS_ORIGINS` / `WEB_ORIGIN` / cookie + CSRF, `OTEL_*`, `SMTP_*`.

```typescript
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  // ... xem file thực tế cho danh sách đầy đủ
});

export type EnvConfig = z.infer<typeof envSchema>;
```

`getEnv()` được gọi từ chunk import đầu tiên của `main.ts` (tracer): parse env trước khi khởi tạo `NestFactory`; thiếu hoặc sai biến ➔ in bảng lỗi chi tiết và `process.exit(1)`. Các ràng buộc chéo (`superRefine`): hai JWT secret phải khác nhau, `DATABASE_URL` phải khác `MIGRATION_DATABASE_URL`, và ở production `COOKIE_SECURE=true` + có `COOKIE_DOMAIN`. Secret (`JWT_*_SECRET`, `DATABASE_URL`, ...) không có `.default()`.

Quy ước: mọi biến phải xuất hiện ở cả `env.schema.ts` lẫN `apps/api/.env.example` (giữ đồng bộ trong cùng PR; **chưa có** bước CI so khớp hai file này).

---

## 5. Audit Log

`AuditService.record(tx, entry)` (`core/audit/audit.service.ts`) thêm một dòng vào `audit_logs` **bằng đúng `tx` của caller**, nên bản ghi commit hoặc rollback cùng thay đổi mà nó mô tả. Hiện được ghi cho `user.create`, `user.update`, `user.delete`, `tenant.create`, `tenant.update`, kèm `actor_id`, `tenant_id`, `resource_type`, `resource_id`, `before_state`/`after_state` (JSON). Không đưa secret (hash mật khẩu) vào snapshot. Bảng này có RLS như các bảng khác: tenant chỉ thấy/ghi dòng của tenant mình. Hiện chưa có endpoint đọc audit log.

---

## 6. Checklist Thực thi

- [ ] `just api` khởi động: thiếu 1 biến env bất kỳ ➔ process exit(1) kèm bảng lỗi Zod, không chạy nửa vời.
- [ ] `DATABASE_URL` runtime trỏ role `boilerplate_app`; xác nhận `SELECT rolbypassrls FROM pg_roles WHERE rolname='boilerplate_app'` trả `false`.
- [ ] Test cách ly: seed 2 tenant, ở `access_mode = 'tenant'` của A, `SELECT` không thấy dòng nào của B, `UPDATE` dòng của B trả 0 rows affected.
- [ ] Test fail-closed: chạy query **không** khai báo `app.access_mode` ➔ trả 0 dòng, không lỗi ngầm.
- [ ] Test `sessions`: ở `access_mode = 'tenant'` ➔ `SELECT` trả 0 dòng; chỉ `admin` mới đọc được.
- [ ] Test `coverage` (mục 2.6) xanh: mọi bảng đã `ENABLE` + `FORCE` RLS, mỗi bảng tối đa một policy.
- [ ] Gọi 1 endpoint lỗi bất kỳ ➔ `Content-Type: application/problem+json`, body đúng RFC 9457, có header `x-trace-id`.
- [ ] Tạo user trùng email ➔ `409 RESOURCE_CONFLICT` (SQLSTATE `23505` được ánh xạ).

---

## 7. Checklist thêm một Entity thuộc Tenant mới

Lấy `apps/api/src/modules/users/` làm mẫu. Ví dụ thêm entity `Project`:

1. **Schema** — tạo `core/database/schema/projects.ts` với `tenant_id uuid NOT NULL REFERENCES tenants(id)`, `timestamp(..., { withTimezone: true })`, `deleted_at` nếu cần soft delete; export trong `schema/index.ts`; index trên `tenant_id`. Chạy `just db-generate`.
2. **RLS** — trong file migration vừa sinh, viết tay `ENABLE` + `FORCE ROW LEVEL SECURITY` và đúng **một** policy `projects_access_policy` theo khuôn `admin OR (tenant AND tenant_id = app.tenant_id)` cho cả `USING` lẫn `WITH CHECK`. Chạy `just db-migrate`.
3. **Test cách ly** — thêm integration test (kết nối bằng role `boilerplate_app`) với 2 tenant: đọc, ghi, và `admin` mode.
4. **Ability** — thêm `Project: { id: string; tenantId: string }` vào `SubjectShapes` trong `packages/shared-types/src/auth/ability.ts`, rồi khai báo `can(...)` theo role trong `defineAbilityFor`.
5. **Repository** — `projects.repository.ts` chỉ nhận `tx`, **không** lọc `tenant_id` thủ công (RLS lo), không export ra `index.ts`.
6. **Service** — mọi truy vấn qua `TransactionManager.runInRequestContext`; ghi `AuditService.record(tx, ...)` cho thay đổi nhạy cảm; kiểm tra quyền trên từng bản ghi bằng `ability.can(action, subject('Project', entity))` (không dùng subject chuỗi); ném domain error, không ném `HttpException`.
7. **Controller + DTO** — `@CheckPolicies(...)` cho quyền cấp route, DTO Zod `.strict()` và **không** chứa `tenantId` (lấy từ JWT qua `@CurrentUser()`; ngoại lệ duy nhất hiện nay là `POST /users`, nơi `PLATFORM_ADMIN` chọn tenant), decorator OpenAPI đầy đủ; `POST` trả `201` + `Location`; envelope `{ data, meta }`.
8. **Contract** — `just contract`, commit cả `openapi.json` và `generated.ts`.
9. **Web** — thêm `features/projects/` dùng type từ `@repo/api-contract`, nối route trong `app/router.tsx` sau cùng.
10. **Kiểm chứng** — `just typecheck`, `just lint`, `just test`, `pnpm test:integration` (trong `apps/api`), và `just verify` cho thay đổi lớn.
