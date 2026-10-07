# ADR-0005: Permission lưu trong cơ sở dữ liệu (RBAC trên DB, ABAC bằng preset)

- **Trạng thái:** accepted
- **Ngày:** 2026-10-07
- **Tinh chỉnh:** [ADR-0004](0004-casl-abac-thay-vi-rbac.md) (vẫn dùng CASL; ADR này đổi _nơi lưu_ và _cách khai báo_ quyền)

## Bối cảnh

ADR-0004 chọn CASL và đặt định nghĩa quyền trong một hàm `defineAbilityFor(user)` với ba vai trò viết cứng (`PLATFORM_ADMIN`, `TENANT_ADMIN`, `TENANT_MEMBER`). Cách đó đủ cho khung ban đầu nhưng vỡ khi có yêu cầu thực tế:

- Một tenant muốn tạo vai trò riêng ("Kế toán", "Hỗ trợ khách hàng") mà không chờ deploy.
- Đổi quyền của một vai trò phải có hiệu lực ngay, không đợi access token hết hạn (token cũ mang `role` cố định).
- Quyền phải **an toàn khi giao cho tenant tự cấu hình**: một tenant admin không được tự nâng mình thành người xem được dữ liệu tenant khác, và không được tạo ra quyền mà chính họ không có.

Ràng buộc đang có: RLS ([ADR-0003](0003-rls-thay-vi-loc-o-tang-ung-dung.md)) vẫn là chốt chặn cách ly tenant; frontend vẫn cần biết quyền để ẩn/hiện nút ([ADR-0004](0004-casl-abac-thay-vi-rbac.md)); một user thuộc đúng một tenant.

## Các phương án đã cân nhắc

| Phương án                                                       | Ưu                                                                                             | Nhược                                                                                                                                                     |
| :-------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Giữ vai trò viết cứng trong code (hiện trạng ADR-0004)          | Đơn giản; kiểm tra bằng type; không có bảng nào để hỏng                                        | Thêm/sửa vai trò = deploy; tenant không tự tạo vai trò được; token mang `role` nên đổi quyền chậm hiệu lực                                                |
| ABAC tự do: điều kiện CASL/JSON do tenant tự viết, lưu trong DB | Biểu đạt mọi quy tắc; không cần deploy                                                         | Tenant viết được điều kiện trỏ ra ngoài tenant của mình; khó kiểm chứng và test; UI soạn điều kiện phức tạp; leo thang đặc quyền chỉ là một dòng JSON sai |
| Policy engine theo từng tenant (OPA / Cedar)                    | Rất mạnh, policy tách rời, có công cụ phân tích                                                | Thêm một dịch vụ phải vận hành và một ngôn ngữ phải học; độ trễ mỗi request; frontend không dùng lại được định nghĩa; quá nặng cho một modular monolith   |
| **RBAC trên DB + preset phạm vi khép kín + CASL**               | Tenant tự tạo vai trò; hiệu lực tức thì; tenant không viết được điều kiện; BE và FE dùng chung | Thêm 4 bảng, một lớp cache và một bước đồng bộ catalog; phạm vi biểu đạt hẹp hơn ABAC tự do (chỉ ba preset)                                               |

## Quyết định

Quyền chuyển từ code xuống database, nhưng **danh mục quyền vẫn do code sở hữu**:

1. **Bốn bảng** — `permissions` (bản sao của catalog), `roles`, `role_permissions` (kèm `scope_preset`), `user_roles`. Cột `users.role` bị gỡ: user của nền tảng là user có `tenant_id` NULL và một vai trò scope `platform`. Cả bốn bảng đều có RLS (`ENABLE` + `FORCE`, đúng một policy mỗi bảng).
2. **Code là nguồn sự thật của catalog.** `PERMISSION_CATALOG` và `SYSTEM_ROLES` (id cố định) nằm trong `packages/shared-types`. `migrate.ts` chạy `syncAuthzCatalog` sau migration và grant; bước này idempotent, chạy dưới role `boilerplate_app` ở `admin` mode và **không** chạy lúc app khởi động (nhiều replica sẽ đua nhau). Một permission mới ra đời cùng PR thêm entity và cùng PR đó có catalog entry.
3. **ABAC bằng preset khép kín.** Mỗi grant có `scope_preset` thuộc `any` | `own_tenant` | `own_record`. Hàm `conditionsFor()` ánh xạ preset sang điều kiện CASL (`{ tenantId }`, `{ id }`...). Tenant chọn _phạm vi với tới_ của quyền, **không bao giờ** soạn điều kiện. Vai trò của tenant không được dùng `any` hay các mục `platformOnly` (`manage:all`, tạo/xóa `Tenant`). Một rule cố định `cannot update/delete Role { isSystem: true }` luôn được thêm vào.
4. **Hồ sơ quyền nạp từ DB trên mọi request.** `AuthzService.loadProfile(userId)` đọc vai trò + grant (cache Redis `authz:profile:<id>`, TTL 300 giây, xóa chủ động khi vai trò/quyền/gán vai trò/trạng thái active đổi). Access token chỉ còn `sub`, `email`, `jti`; tenant, scope, vai trò và grant lấy từ hồ sơ. User không active ➔ không có hồ sơ ➔ `401`. Scope `platform` ➔ RLS `admin` mode; ngược lại `tenant` mode với `tenantId` của hồ sơ.
5. **Chống leo thang quyền**, thực thi ở cả service và database: không ai gán/cấp nhiều hơn mình đang có (`grantsCover`); không ai sửa vai trò của chính mình; tenant luôn còn ít nhất một `TENANT_ADMIN` active; vai trò hệ thống bất biến (trigger `guard_system_roles` chỉ cho phép khi `app.system_roles_write = 'on'`, tức chỉ job migrate), kể cả với platform admin; vai trò đang được gán không xóa được; trigger `check_user_role_assignment` kiểm tra scope vai trò khớp user và gán `tenant_id` cho `user_roles`.

CASL vẫn là engine đánh giá: `buildAbility(grants, user)` là hàm thuần chạy giống nhau ở API và trình duyệt (web nhận rule đã nén từ `GET /auth/me/abilities`).

## Hệ quả

**Dễ hơn:** tenant tự tạo và chỉnh vai trò qua API/UI, hiệu lực ở request kế tiếp; thu hồi quyền hoặc khóa tài khoản có tác dụng ngay mà không cần chờ token hết hạn; thêm entity là thêm catalog entry thay vì sửa hàm `defineAbilityFor`; mọi thay đổi vai trò/quyền đều có `audit_logs`.

**Khó hơn và các rủi ro chấp nhận:**

- **Thêm một lượt đọc hồ sơ mỗi request** (Redis hit trong trường hợp thường). Cache miss ➔ một transaction `admin` mode đọc DB; chấp nhận vì bảng nhỏ và có cache.
- **Cache cũ tối đa 300 giây** nếu việc xóa chủ động bị lỡ (ví dụ sửa trực tiếp trong DB). TTL là lưới an toàn, không phải cơ chế chính.
- **Catalog entry mới vô hình cho tới khi chạy `just db-migrate`** (đồng bộ nằm ở đó): quên chạy ➔ không có hàng `permissions`, vai trò không gán được quyền đó. Checklist "Thêm một entity mới có phân quyền" nhắc bước này.
- **Biểu đạt hẹp hơn ABAC tự do.** Quy tắc cần điều kiện mới (ví dụ "chỉ bản ghi do mình tạo") phải thêm preset hoặc nhánh trong `conditionsFor()` bằng code, kèm test; đổi lại tenant không thể tạo điều kiện vượt tenant.
- **Cạm bẫy CASL của ADR-0004 vẫn nguyên:** `ability.can('update', 'User')` với subject chuỗi bỏ qua điều kiện. Kiểm tra quyền sở hữu vẫn **bắt buộc** `subject('User', entity)`.
- **Hai hệ thống phân quyền phải khớp nhau:** CASL quyết định hành động được thử; RLS quyết định hàng nào nhìn thấy. `JwtAuthGuard` là nơi duy nhất nối hai hệ thống (scope ➔ access mode). Mọi bảng quyền mới đều phải qua test cách ly RLS bằng role `boilerplate_app`.

**Biện pháp giảm thiểu:** `grantsCover` + trigger DB cho chống leo thang; test tích hợp RLS cho `roles`, `role_permissions`, `user_roles`, `permissions`; test `coverage` bắt bảng thiếu RLS hoặc thừa policy; tài liệu [03-auth-flow-va-casl-abac.md](../03-auth-flow-va-casl-abac.md) mô tả mô hình và checklist thêm entity.
