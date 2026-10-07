---
title: Monorepo & Tooling
description: Turborepo, pnpm workspaces, tsconfig, ESLint boundaries
status: stable
updated: 2026-10-07
owner: Platform Team
---

# Kế hoạch Boilerplate 01: Thiết lập Monorepo & Tooling Chuẩn mực

> **Mục tiêu:** Xây dựng nền tảng Monorepo vững chắc với Turborepo, pnpm workspaces, chia sẻ TypeScript configs, và cưỡng chế kiến trúc bằng ESLint boundaries.

---

## 1. Cấu trúc Root Monorepo

### 1.1 `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 1.2 `package.json` (Root)

```json
{
  "name": "nest-react-turbo-boilerplate",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "db:generate": "turbo run db:generate --filter=@repo/api",
    "db:migrate": "turbo run db:migrate --filter=@repo/api",
    "db:studio": "turbo run db:studio --filter=@repo/api"
  },
  "devDependencies": {
    "prettier": "^3.4.2",
    "turbo": "^2.3.4",
    "typescript": "^5.7.3"
  }
}
```

### 1.3 `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local", "tsconfig.base.json"],
  "globalEnv": ["NODE_ENV", "CI"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": ["VITE_API_URL", "VITE_APP_ENV"],
      "outputs": ["dist/**", "build/**"]
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"],
      "outputs": ["coverage/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

> ⚠️ **`globalEnv` và `env` là bắt buộc, không phải tùy chọn.** Turborepo băm các biến môi trường được khai báo vào cache key. Thiếu khai báo, đổi `VITE_API_URL` từ staging sang production sẽ **cache hit** và trả về bundle cũ trỏ vào staging — một lỗi im lặng, chỉ phát hiện khi đã lên production.

## 2. Shared Packages

### 2.1 `packages/tsconfig`

Cung cấp các cấu hình base chuẩn, bật toàn diện `strict: true` và `noUncheckedIndexedAccess: true`:

- `base.json`: Base configuration cho Node.js và TS chung.
- `nest.json`: Kế thừa `base.json`, bật `emitDecoratorMetadata` và `experimentalDecorators`.
- `react.json`: Kế thừa `base.json`, cấu hình `jsx: react-jsx`, DOM types.

### 2.2 `packages/eslint-config`

Sử dụng ESLint 9 Flat Config kết hợp `eslint-plugin-boundaries` để cưỡng chế ranh giới:

#### Ranh giới Tầng Backend (5 Tầng):

```
modules ──▶ integrations ──▶ core ──▶ common ──▶ config
   │            │              ▲
   │            └──────────────┤
   └───────────────────────────┘
```

- `common` cấm import từ `core`, `integrations` và `modules`.
- `core` cấm import từ `integrations` và `modules`.
- `integrations` (Outbound Adapters gọi hệ thống ngoài; hiện để trống) chỉ import từ `core`, `common`, `config`. Cấm import từ `modules`.
- `modules` (Domain Business Slices) được import từ `config`, `common`, `core` và `integrations`.
- `config` không import bất kỳ tầng nào.

Cấu hình ESLint:

```javascript
'boundaries/element-types': ['error', {
  default: 'disallow',
  rules: [
    { from: 'config',       allow: [] },
    { from: 'common',       allow: ['config'] },
    { from: 'core',         allow: ['config', 'common'] },
    { from: 'integrations', allow: ['config', 'common', 'core'] },
    { from: 'modules',      allow: ['config', 'common', 'core', 'integrations', 'modules'] },
  ],
}]
```

#### Ranh giới Tầng Frontend:

```
app ──▶ features ──▶ entities ──▶ shared ──▶ lib
```

- `lib` cấm import từ `shared`, `entities`, `features`, `app`.
- `features` cấm import chéo trực tiếp từ nội bộ của feature khác, chỉ được import qua `index.ts` public interface.

### 2.3 `packages/shared-types`

- Chứa các types dùng chung giữa Backend và Frontend:
  - `ApiResponse<T>`, `PaginationMeta`, `PaginatedData<T>`.
  - `ProblemDetails` theo chuẩn RFC 9457.
  - Các Enum dùng chung: `UserRole` (`PLATFORM_ADMIN`, `TENANT_ADMIN`, `TENANT_MEMBER`), `TokenType`, `SystemStatus`.
  - Hàm tạo CASL Ability: `defineAbilityFor(user)`.

### 2.4 `packages/api-contract`

- Package chứa code sinh tự động từ OpenAPI specs của Backend:
  - Sinh TypeScript types tương ứng với các DTOs.
  - Sinh React Query hooks hoặc Fetcher functions cho Frontend.
  - Công cụ: `openapi-typescript` hoặc `orval`.

---

## 3. Checklist Thực thi & Kiểm tra

- [ ] `pnpm install` chạy mượt mà, không gặp xung đột peer dependencies.
- [ ] Chạy `pnpm build` biên dịch thành công các shared packages.
- [ ] Cố tình import sai tầng (ví dụ: `common` import từ `core`) và kiểm tra lệnh `pnpm lint` bắt được lỗi chính xác.
- [ ] Chạy `pnpm typecheck` kiểm tra tính toàn vẹn kiểu dữ liệu toàn monorepo.
