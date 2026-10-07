---
title: Quy tắc Code
description: Bộ quy tắc bắt buộc cho Frontend, Backend, Database và Infra
status: stable
updated: 2026-10-07
owner: Platform Team
---

# Quy tắc Code

## Cách đọc bộ quy tắc này

Mỗi quy tắc được trình bày theo đúng 4 phần:

1. **Quy tắc** — phát biểu ngắn, dứt khoát.
2. **Vì sao** — lý do kỹ thuật. Quy tắc không có lý do là quy tắc sẽ bị phá.
3. **✅ / ❌** — ví dụ ngắn, đối chiếu trực tiếp.
4. **Cưỡng chế** — cơ chế nào chặn vi phạm.

## Ba mức cưỡng chế

| Mức             | Ký hiệu | Nghĩa                                                     |
| :-------------- | :------ | :-------------------------------------------------------- |
| **Tự động**     | 🤖      | ESLint / tsc / test / CI chặn. Vi phạm không merge được.  |
| **Review**      | 👀      | Người review chịu trách nhiệm phát hiện.                  |
| **Khuyến nghị** | 💡      | Mặc định nên theo, được phép lệch nếu nêu lý do trong PR. |

> **Nguyên tắc chủ đạo:** quy tắc nào quan trọng mà chỉ ở mức 👀 thì sớm muộn cũng bị vi phạm. Khi thêm quy tắc mới, câu hỏi đầu tiên phải là _"cưỡng chế bằng gì?"_ — nếu không có câu trả lời, hãy tìm cách biến nó thành 🤖 hoặc chấp nhận rằng nó chỉ là 💡.

## Mục lục

| #   | Quy tắc                                      | Áp dụng cho                                   |
| :-- | :------------------------------------------- | :-------------------------------------------- |
| 00  | [Nguyên tắc chung](00-nguyen-tac-chung.md)   | Toàn bộ codebase — SOLID, naming, readability |
| 01  | [TypeScript & Path Alias](01-typescript.md)  | Toàn bộ code TS                               |
| 02  | [Backend NestJS](02-backend-nestjs.md)       | `apps/api`                                    |
| 03  | [Database & Drizzle](03-database-drizzle.md) | Schema, migration, RLS                        |
| 04  | [Frontend React](04-frontend-react.md)       | `apps/web`                                    |
| 06  | [API Design](06-api-design.md)               | Mọi endpoint HTTP                             |
| 07  | [Security](07-security.md)                   | Toàn bộ codebase                              |
| 08  | [Testing](08-testing.md)                     | Toàn bộ codebase                              |
| 09  | [Git & CI](09-git-va-ci.md)                  | Quy trình làm việc                            |
| 10  | [Infra & DevOps](10-infra-devops.md)         | Hạ tầng, triển khai                           |

> Không có file `05` (từng dành cho mobile, nay không còn trong repo) và không có ADR-0005; số cũ không được tái sử dụng.

## Khi quy tắc cản trở công việc

Quy tắc tồn tại để phục vụ codebase, không phải ngược lại. Gặp trường hợp quy tắc rõ ràng sai:

1. **Không** lặng lẽ vi phạm, cũng **không** cắn răng làm theo.
2. Mở PR sửa chính file quy tắc này, nêu tình huống cụ thể.
3. Trong lúc chờ, dùng `// eslint-disable-next-line <rule> -- <lý do>` kèm link tới PR đó. **Bắt buộc có phần `-- lý do`**; disable trần là lỗi review.
