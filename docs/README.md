---
title: Tài liệu Kỹ thuật
description: Mục lục tài liệu thiết kế và quy tắc code của boilerplate
status: stable
updated: 2026-10-07
owner: Platform Team
---

# Tài liệu Kỹ thuật

Tài liệu viết bằng tiếng Việt (README, `setup.md` và `AGENTS.md` ở thư mục gốc viết bằng tiếng Anh). Ba nhóm, đọc theo thứ tự khi onboard:

1. **Thiết kế** (`00`–`06`, không có `05`) — kiến trúc hệ thống hoạt động _như thế nào_.
2. **Quy tắc** ([`rules/`](rules/)) — code phải viết _ra sao_. Bắt buộc đọc trước PR đầu tiên.
3. **Quyết định** ([`adr/`](adr/)) — _vì sao_ chọn phương án này thay vì phương án khác.

---

## 1. Tài liệu Thiết kế

| #   | Tài liệu                                                | Phạm vi                                                  | Trạng thái |
| :-- | :------------------------------------------------------ | :------------------------------------------------------- | :--------- |
| 00  | [Tổng quan Boilerplate](00-tong-quan-boilerplate.md)    | Triết lý, tech stack, layout monorepo, nhân bản dự án    | ✅ stable  |
| 01  | [Monorepo & Tooling](01-monorepo-va-tooling.md)         | Turborepo, pnpm, tsconfig, ESLint boundaries             | ✅ stable  |
| 02  | [Backend Core & RLS](02-backend-core-va-drizzle-rls.md) | 5 tầng NestJS, Drizzle, Postgres RLS, envelope, RFC 9457 | ✅ stable  |
| 03  | [Auth & Phân quyền](03-auth-flow-va-casl-abac.md)       | Xác thực, token rotation, CASL ABAC multi-tenant         | ✅ stable  |
| 04  | [Frontend Web](04-frontend-react-va-shadcn.md)          | React 19, Vite, Tailwind v4, HTTP client, TanStack Query | ✅ stable  |
| 06  | [Observability & CI](06-observability-va-ci-cd.md)      | Pino, OpenTelemetry, GitHub Actions (repo chỉ có CI)     | ✅ stable  |

## 2. Quy tắc Code — [`rules/`](rules/)

| #   | Quy tắc                                            | Áp dụng cho         |
| :-- | :------------------------------------------------- | :------------------ |
| 00  | [Nguyên tắc chung](rules/00-nguyen-tac-chung.md)   | Toàn bộ codebase    |
| 01  | [TypeScript & Path Alias](rules/01-typescript.md)  | Toàn bộ code TS     |
| 02  | [Backend NestJS](rules/02-backend-nestjs.md)       | `apps/api`          |
| 03  | [Database & Drizzle](rules/03-database-drizzle.md) | Schema, migration   |
| 04  | [Frontend React](rules/04-frontend-react.md)       | `apps/web`          |
| 06  | [API Design](rules/06-api-design.md)               | Mọi endpoint HTTP   |
| 07  | [Security](rules/07-security.md)                   | Toàn bộ codebase    |
| 08  | [Testing](rules/08-testing.md)                     | Toàn bộ codebase    |
| 09  | [Git & CI](rules/09-git-va-ci.md)                  | Quy trình làm việc  |
| 10  | [Infra & DevOps](rules/10-infra-devops.md)         | Hạ tầng, triển khai |

## 3. Quyết định Kiến trúc — [`adr/`](adr/)

Xem [adr/README.md](adr/README.md).

## 4. Tham khảo

- [Bảng thuật ngữ](glossary.md) — chốt từ vựng để tên bảng, tên API và tên biến không loạn.

---

## Quy ước của chính tài liệu này

- Mỗi file có frontmatter: `title`, `description`, `status` (`draft` | `stable`), `updated`, `owner`.
- Mỗi tài liệu thiết kế kết thúc bằng một **Checklist Thực thi** để kiểm chứng được, không dừng ở mô tả.
- Sửa hành vi hệ thống ➔ cập nhật tài liệu **trong cùng PR**, và cập nhật `updated`.
- Tài liệu mâu thuẫn với code ➔ **code đúng, tài liệu sai**; sửa tài liệu ngay, đừng để trôi.
