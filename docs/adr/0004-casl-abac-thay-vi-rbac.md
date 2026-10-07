# ADR-0004: CASL ABAC thay vì RBAC thuần

- **Trạng thái:** accepted
- **Ngày:** 2026-10-07
- **Được tinh chỉnh bởi:** [ADR-0005](0005-permission-luu-trong-co-so-du-lieu.md) — vẫn dùng CASL, nhưng quyền nay lưu trong DB và `defineAbilityFor` được thay bằng `buildAbility(grants, user)`.

## Bối cảnh

Quyền trong hệ thống multi-tenant không chỉ phụ thuộc vai trò mà còn phụ thuộc **quan hệ**: TENANT_ADMIN quản lý được user _của tenant mình_, TENANT_MEMBER chỉ sửa được hồ sơ _của mình_. RBAC thuần không biểu diễn được chữ "của mình".

Thêm một yêu cầu: frontend cần biết quyền để ẩn/hiện nút, và định nghĩa quyền không được viết hai lần ở hai nơi.

## Các phương án đã cân nhắc

| Phương án                             | Ưu                                                                                                  | Nhược                                                                                        |
| :------------------------------------ | :-------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| RBAC thuần (`@Roles('TENANT_ADMIN')`) | Rất đơn giản                                                                                        | Không biểu diễn được quyền sở hữu; phải rải `if (x.tenantId !== user.tenantId)` khắp service |
| **CASL ABAC**                         | Rule có điều kiện trên thuộc tính; **cùng một định nghĩa chạy được ở BE và FE**; tích hợp React sẵn | Cạm bẫy kiểm tra ở mức type; cần hiểu `subject()`                                            |
| OPA / Cedar                           | Rất mạnh, policy tách rời                                                                           | Cần dựng thêm dịch vụ; quá nặng cho nhu cầu hiện tại                                         |
| Tự viết                               | Vừa đủ nhu cầu                                                                                      | Rồi sẽ tự viết lại CASL, kém hơn                                                             |

## Quyết định

CASL (`@casl/ability`), hàm `defineAbilityFor(user)` đặt trong `packages/shared-types` để backend và frontend dùng chung **đúng một** định nghĩa.

## Hệ quả

**Dễ hơn:** thêm vai trò mới là sửa một hàm; frontend và backend không bao giờ lệch nhau về quy tắc quyền; quyền sở hữu biểu diễn khai báo thay vì rải `if`.

**Khó hơn — và đây là rủi ro chính:** `ability.can('update', 'User')` với subject là **chuỗi** sẽ **bỏ qua** mọi điều kiện và trả `true`. Viết như vậy tưởng là đã chặn mà thực ra không chặn gì cả.

**Biện pháp giảm thiểu:**

1. Ghi thành quy tắc cứng ở [rules/07-security.md](../rules/07-security.md): kiểm tra quyền sở hữu **bắt buộc** dùng `subject('X', entity)`.
2. RLS là lớp phòng thủ độc lập — CASL sai thì database vẫn chặn (xem [ADR-0003](0003-rls-thay-vi-loc-o-tang-ung-dung.md)).
