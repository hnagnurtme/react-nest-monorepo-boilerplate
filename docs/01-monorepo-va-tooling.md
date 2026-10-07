---
title: Monorepo & Tooling
description: Turborepo, pnpm workspaces, tsconfig, ESLint boundaries, git hooks
status: stable
updated: 2026-10-07
owner: Platform Team
---

# Kế hoạch Boilerplate 01: Monorepo & Tooling

> **Mục tiêu:** Nền tảng Monorepo với Turborepo, pnpm workspaces, chia sẻ TypeScript/ESLint configs, và cưỡng chế kiến trúc bằng ESLint boundaries. Mọi lệnh hằng ngày đi qua `just` (xem [`justfile`](../justfile)); `just` chỉ là lớp bọc quanh script `pnpm` ở root.

---

## 1. Cấu trúc Root Monorepo

### 1.1 `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 1.2 `package.json` (Root) — các script chính

| Script                    | Làm gì                                                                                     |
| :------------------------ | :----------------------------------------------------------------------------------------- |
| `dev` / `build` / `start` | `turbo run dev` / `build` / `start`                                                        |
| `lint` / `typecheck`      | `turbo run lint` / `typecheck`                                                             |
| `test`                    | `turbo run test` (chỉ unit test)                                                           |
| `test:integration`        | `turbo run test:integration` (cần Postgres + Redis đang chạy)                              |
| `format` / `format:check` | Prettier cho `**/*.{ts,tsx,md,json,yaml}`                                                  |
| `db:generate`/`migrate`   | `turbo run db:generate` / `db:migrate --filter=@repo/api` (cũng có `db:seed`, `db:studio`) |
| `contract:generate`       | Xuất OpenAPI từ NestJS rồi sinh `packages/api-contract/src/generated.ts`                   |
| `secrets:scan`            | `gitleaks detect --config .gitleaks.toml` (báo lỗi nếu chưa cài gitleaks)                  |
| `audit:ci`                | `node scripts/audit.mjs` — quét lỗ hổng dependency                                         |

Yêu cầu: Node `>=20.18.0` (CI dùng Node 24), `packageManager: pnpm@9.15.4`.

### 1.3 `turbo.json`

Các điểm quan trọng (xem file thật để biết đầy đủ):

- `globalEnv: ["NODE_ENV", "CI"]`; task `build` khai `env: ["VITE_API_URL", "VITE_APP_ENV"]`.
- `lint`, `typecheck`, `test` phụ thuộc `^build` (build các package workspace trước).
- Các task chạm DB (`db:*`, `test:integration`, `export:openapi`) tắt cache và khai danh sách biến env cần thiết (`DATABASE_URL`, `MIGRATION_DATABASE_URL`, `REDIS_URL`, `JWT_*_SECRET`, `COOKIE_*`).
- `dev` và `db:studio` là `persistent`, không cache.

> ⚠️ **`globalEnv` và `env` là bắt buộc, không phải tùy chọn.** Turborepo băm các biến môi trường được khai báo vào cache key. Thiếu khai báo, đổi `VITE_API_URL` từ staging sang production sẽ **cache hit** và trả về bundle cũ trỏ vào staging — một lỗi im lặng, chỉ phát hiện khi đã lên production. Thêm biến `VITE_*` mới ➔ thêm vào `env` của task `build`.

### 1.4 Git hooks (`.husky/`)

- `commit-msg`: `commitlint` theo [`commitlint.config.mjs`](../commitlint.config.mjs) (Conventional Commits).
- `pre-commit`: `lint-staged` (ESLint `--fix` + Prettier cho `*.{ts,tsx}`, Prettier cho `*.{json,md,yaml,yml}`), rồi `gitleaks protect --staged` nếu máy có cài gitleaks (không có thì chỉ cảnh báo, CI vẫn quét).

## 2. Shared Packages

### 2.1 `packages/tsconfig`

- `base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, `isolatedModules`, ...
- `nest.json`: kế thừa `base.json`, chuyển sang ESM `NodeNext` (nên import tương đối **phải** kèm đuôi `.js`), bật `emitDecoratorMetadata` + `experimentalDecorators`, và **tắt** `verbatimModuleSyntax` để metadata của decorator hoạt động. Alias `@/...` của API khai trong `apps/api/tsconfig.json`.
- `react.json`: kế thừa `base.json`, `jsx: react-jsx`, DOM libs, `noEmit`.

### 2.2 `packages/eslint-config`

ESLint 9 Flat Config, ba preset: `base.js`, `nest.js`, `react.js`. `base.js` đánh dấu từng rule bằng mã mục trong `docs/rules/` mà nó cưỡng chế. Lưu ý một số rule "kích thước/độ phức tạp" (`max-depth`, `complexity`, `max-lines`, `max-params`, `no-magic-numbers`) được cố ý **tắt** — chúng là quy tắc review, không phải lint.

#### Ranh giới Tầng Backend (5 tầng, `nest.js`)

```
config ◀── common ◀── core ◀── integrations ◀── modules
```

- `config` không import tầng nào; `common` chỉ import `config`; `core` import `config`, `common`; `integrations` import thêm `core`; `modules` import mọi tầng dưới và `modules` khác.
- `boundaries/entry-point`: một module chỉ import module khác qua `index.ts` của nó.
- Trong `src/modules/**`: cấm import `axios`, `node-fetch`, `stripe`, `ioredis`, `@aws-sdk/*`, `openai`, `@anthropic-ai/*`; cấm global `fetch`; cấm `db.*` trực tiếp (phải qua `TransactionManager`); cấm template literal có biểu thức trong `.execute()`.

#### Ranh giới Tầng Frontend (`react.js`)

```
app ──▶ features ──▶ entities ──▶ shared ──▶ lib ──▶ config
```

- `lib` chỉ import `config`; `shared` import `config`, `lib`; `entities` thêm `shared`; `features` thêm `entities` và `features` khác; `app` import tất cả.
- `boundaries/entry-point`: `features` và `entities` chỉ import qua `index.ts`.
- Trong `features/entities/shared`: cấm `fetch` trần và `axios` (đi qua `@/lib/http`); `shared` cấm import `@/features/*`, `@/entities/*`.

### 2.3 `packages/shared-types`

Types và hàm dùng chung giữa Backend và Frontend (`src/index.ts`):

- `ApiResponse<T>`, `PaginationMeta`, `InvalidParam`, `ProblemDetails` (RFC 9457) và hằng `PROBLEM_CONTENT_TYPE`.
- `USER_ROLES` / `UserRole` (`PLATFORM_ADMIN`, `TENANT_ADMIN`, `TENANT_MEMBER`), `UserContext`.
- CASL: `defineAbilityFor(user)`, `defineAnonymousAbility()`, `SubjectShapes`, `AppAbility`.
- `HealthStatus` / `createHealthStatus`.

### 2.4 `packages/api-contract`

- `openapi.json` do `just contract` sinh từ NestJS; `src/generated.ts` sinh từ đó bằng `openapi-typescript`. Cả hai được commit và **không sửa tay**; CI (`openapi-drift`) sinh lại và fail nếu có `git diff`.
- `src/index.ts` xuất kiểu `paths`/`components`; web dựng type request/response từ đó (`apps/web/src/lib/http/types.ts`). Không sinh hook hay fetcher.
- `test/` chứa contract test chạy bằng `tsx --test`.

---

## 3. Checklist Thực thi & Kiểm tra

- [ ] `just install` chạy mượt mà (`--frozen-lockfile`), không xung đột peer dependencies.
- [ ] `just build` biên dịch thành công các package workspace và hai app.
- [ ] Cố tình import sai tầng (ví dụ: `common` import từ `core`) và kiểm tra `just lint` bắt được lỗi.
- [ ] `just typecheck` kiểm tra tính toàn vẹn kiểu dữ liệu toàn monorepo.
- [ ] Thêm một biến `VITE_*` ➔ đã khai trong `turbo.json` (`build.env`).
