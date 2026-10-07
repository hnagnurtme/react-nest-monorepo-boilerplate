---
title: Tổng quan Boilerplate
description: Triết lý thiết kế, tech stack, layout monorepo, hướng dẫn nhân bản
status: stable
updated: 2026-10-07
owner: Platform Team
---

# Kế hoạch Boilerplate 00: Tổng quan Bộ khung Fullstack Đa Dự án (nest-react-turbo-boilerplate)

> **Mục tiêu:** Cung cấp bộ khung Enterprise Modular Monolith hoàn chỉnh, chuẩn mực, chỉ chứa phần **Auth + Users đa tenant** (đăng ký, đăng nhập, refresh-token rotation, OTP, reset mật khẩu, quản lý user trong tenant), sẵn sàng nhân bản để làm nền tảng cho bất kỳ sản phẩm SaaS multi-tenant hoặc hệ thống quản trị nội bộ nào. Nghiệp vụ riêng của dự án được thêm vào sau, theo [checklist thêm entity](02-backend-core-va-drizzle-rls.md#9-checklist-thêm-một-entity-thuộc-tenant-mới).

---

## 1. Triết lý Thiết kế Cốt lõi

1. **Zero-leakage Tenant Isolation qua Access Mode (Cách ly dữ liệu giữa các tenant triệt để):**
   - Không dựa vào câu lệnh `WHERE tenant_id = ...` thủ công (dễ bị lập trình viên bỏ quên). Sử dụng **PostgreSQL Row Level Security (RLS)** ở cấp database với **đúng một policy trên mỗi bảng**, điều khiển bằng biến session `app.access_mode` (`tenant` | `admin`) cùng `app.tenant_id`, thiết lập transaction-local qua `set_config(..., true)`.
   - Một policy duy nhất là bắt buộc: nhiều policy PERMISSIVE sẽ bị PostgreSQL OR lại với nhau và làm thủng cách ly. Chi tiết tại [02-backend-core-va-drizzle-rls.md](02-backend-core-va-drizzle-rls.md).
   - Thiếu khai báo context ➔ policy trả `false` ở mọi nhánh ➔ truy vấn trả rỗng. **Fail-closed có chủ đích.**
2. **Single Source of Truth (Một nguồn sự thật duy nhất cho API Contract):**
   - Backend NestJS xuất OpenAPI Swagger specification.
   - Frontend React tự động sinh TypeScript types từ OpenAPI codegen (`@repo/api-contract`). Không bao giờ gõ tay DTO ở hai nơi.
3. **Fail-Fast Configuration (Thất bại sớm nếu thiếu cấu hình):**
   - Toàn bộ biến môi trường (`process.env`) được kiểm định bằng **Zod schema** ngay khi ứng dụng khởi động (`bootstrap`). Thiếu hoặc sai kiểu biến là process crash ngay lập tức, không chạy nửa vời.
4. **Uniform Response & Error Format (Định dạng phản hồi và lỗi nhất quán):**
   - Thành công: Envelope `{ data, meta }`.
   - Lỗi: Chuẩn quốc tế **RFC 9457 Problem Details** (`application/problem+json`).
5. **Strict Architectural Boundaries (Cưỡng chế ranh giới tầng bằng Linter):**
   - Cưỡng chế bằng `eslint-plugin-boundaries`, biến các quy tắc kiến trúc thành lỗi biên dịch (Compile/Lint Errors) nếu dev import sai chiều.

---

## 2. Danh mục Công nghệ Chuẩn mực (Tech Stack Matrix)

| Thành phần            | Công nghệ lựa chọn              | Mục đích & Ràng buộc                                                             |
| :-------------------- | :------------------------------ | :------------------------------------------------------------------------------- |
| **Monorepo Manager**  | **Turborepo + pnpm workspaces** | Quản lý đa package, build caching siêu tốc, symlink nội bộ                       |
| **Backend Framework** | **NestJS 11+**                  | Modular Monolith (5 tầng: `config`, `common`, `core`, `integrations`, `modules`) |
| **Database & ORM**    | **PostgreSQL 16 + Drizzle ORM** | Hỗ trợ RLS tự nhiên, migration SQL thuần, lightweight connection pool            |
| **Cache**             | **Redis 7**                     | Caching và các tác vụ cần lưu trạng thái ngắn hạn                                |
| **Frontend Web**      | **React 19 + Vite**             | SPA hiệu năng cao, render nhanh, cấu hình build đơn giản                         |
| **UI Kit & Styling**  | **Tailwind CSS v4 + shadcn/ui** | CSS-first `@theme`, copy-paste primitives dựa trên Radix UI                      |
| **Phân quyền**        | **CASL (`@casl/ability`)**      | ABAC (Attribute-Based Access Control) dùng chung Backend & Frontend              |
| **Observability**     | **Pino + OpenTelemetry**        | JSON logging tự động inject `traceId`/`tenantId`, W3C traceparent                |

---

## 3. Cấu trúc Dự án Khung (Monorepo Layout)

```
nest-react-turbo-boilerplate/
├── apps/
│   ├── api/                    # NestJS Backend API (tầng src/integrations/ để trống, sẵn sàng dùng)
│   └── web/                    # React 19 + Vite Frontend SPA
│
├── packages/
│   ├── tsconfig/               # Base tsconfigs (strict, noUncheckedIndexedAccess)
│   ├── eslint-config/          # Quy tắc boundaries và quy chuẩn code
│   ├── shared-types/           # Enums, ApiResponse<T>, RFC 9457, CASL Ability
│   └── api-contract/           # Generated API client từ OpenAPI spec
│
├── docker-compose.yml          # PostgreSQL 16 & Redis 7 (local)
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## 4. Hướng dẫn Nhân bản sang Dự án Mới (Template Reusability)

Khi áp dụng bộ khung này cho một dự án mới (ví dụ: `MyAwesomeProject`):

1. **Clone repository:**
   ```bash
   git clone <boilerplate-repo-url> my-awesome-project
   cd my-awesome-project
   rm -rf .git && git init
   ```
2. **Đổi tên namespace package:**
   - Thay `@repo/` bằng `@myproject/` trong toàn bộ `package.json` và `tsconfig.json`.
3. **Đổi tên Database roles:**
   - Ba role `boilerplate_owner` / `boilerplate_app` / `boilerplate_readonly` xuất hiện trong `docker-compose.yml`, script khởi tạo DB **và trong mệnh đề `TO ...` của mọi RLS policy**. Đổi tên bằng find-and-replace trên toàn repo, bỏ sót một chỗ trong policy là RLS không áp dụng.
   - Đổi tên Database trong `docker-compose.yml` (ví dụ: `myproject_db`).
4. **Cấu hình môi trường:**
   - Sao chép `apps/api/.env.example` thành `apps/api/.env` (và `apps/web/.env.example` thành `apps/web/.env`).
   - Sinh `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET` riêng biệt (`openssl rand -hex 32`), không dùng lại giữa hai biến.
5. **Khởi chạy hạ tầng và cài đặt:**
   ```bash
   just install
   just up
   just db-migrate
   just dev
   ```

---

## 5. Lộ trình Triển khai Các File Kế hoạch Boilerplate

- [01-monorepo-va-tooling.md](01-monorepo-va-tooling.md): Cấu hình Monorepo, Workspaces, Turborepo, TSConfig & ESLint Boundaries (5 tầng).
- [02-backend-core-va-drizzle-rls.md](02-backend-core-va-drizzle-rls.md): Cấu trúc 5 tầng NestJS, Drizzle ORM, Postgres RLS, Envelope & Error filters.
- [03-auth-flow-va-casl-abac.md](03-auth-flow-va-casl-abac.md): Hệ thống xác thực (access token + refresh cookie) và phân quyền CASL ABAC multi-tenant.
- [04-frontend-react-va-shadcn.md](04-frontend-react-va-shadcn.md): React 19 Feature-first, Tailwind v4, shadcn/ui, HTTP Client.
- [06-observability-va-ci-cd.md](06-observability-va-ci-cd.md): Pino Logger mixin, OpenTelemetry W3C, GitHub Actions CI.
