---
title: Architecture Decision Records
description: Nhật ký các quyết định kiến trúc và lý do đằng sau
status: stable
updated: 2026-10-07
owner: Platform Team
---

# Architecture Decision Records

ADR ghi lại **vì sao** một quyết định được đưa ra, không phải hệ thống hoạt động **thế nào** (đó là việc của tài liệu thiết kế) hay code phải viết **ra sao** (việc của [rules/](../rules/)).

## Vì sao cần ADR

Sáu tháng nữa sẽ có người hỏi _"sao lại dùng Drizzle mà không dùng Prisma?"_. Không có ADR thì câu trả lời là "không ai nhớ", và người đó sẽ hoặc âm thầm chịu đựng, hoặc đổi sang Prisma mà không biết những đánh đổi đã từng được cân nhắc.

## Quy tắc

- ADR là **bất biến**. Đổi ý ➔ viết ADR mới với `status: superseded by ADR-00XX` trên bản cũ.
- Đánh số tăng dần, không tái sử dụng số.
- Mỗi ADR đủ ngắn để đọc trong 3 phút.
- Viết ADR khi quyết định **khó đảo ngược** hoặc **gây tranh luận**. Chọn thư viện format ngày thì không cần.

## Mẫu

```markdown
# ADR-00XX: <Tiêu đề>

- **Trạng thái:** proposed | accepted | superseded by ADR-00YY
- **Ngày:** YYYY-MM-DD

## Bối cảnh

Vấn đề gì cần giải quyết? Ràng buộc nào đang có?

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |

## Quyết định

Chọn gì, và vì sao chọn cái đó thay vì các phương án còn lại.

## Hệ quả

Điều gì trở nên dễ hơn? Điều gì trở nên khó hơn? Ta đang chấp nhận đánh đổi gì?
```

## Danh sách

| #                                               | Quyết định                               | Trạng thái |
| :---------------------------------------------- | :--------------------------------------- | :--------- |
| [0001](0001-modular-monolith.md)                | Modular Monolith thay vì Microservices   | accepted   |
| [0002](0002-drizzle-thay-vi-prisma.md)          | Drizzle ORM thay vì Prisma               | accepted   |
| [0003](0003-rls-thay-vi-loc-o-tang-ung-dung.md) | Postgres RLS thay vì lọc ở tầng ứng dụng | accepted   |
| [0004](0004-casl-abac-thay-vi-rbac.md)          | CASL ABAC thay vì RBAC thuần             | accepted   |
| [0006](0006-spa-cho-toan-bo-web.md)             | SPA cho toàn bộ web, chưa dùng SSR       | accepted   |
