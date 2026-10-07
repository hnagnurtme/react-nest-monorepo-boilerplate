---
title: Auth & Phân quyền
description: Xác thực web, token rotation, vai trò/permission lưu trong DB + CASL ABAC multi-tenant
status: stable
updated: 2026-10-07
owner: Platform Team
---

# Kế hoạch Boilerplate 03: Xác thực & Phân quyền (RBAC trên DB + CASL ABAC) Multi-tenant

> **Mục tiêu:** Xây dựng cơ chế xác thực an toàn cho web SPA (access token trong RAM, refresh token trong cookie `httpOnly`), kết hợp phân quyền lưu trong database (vai trò, permission, preset phạm vi) được đánh giá bằng CASL (`@casl/ability`), dùng chung BE/FE, trên mô hình multi-tenant. Lý do chọn: [ADR-0005](adr/0005-permission-luu-trong-co-so-du-lieu.md).

---

## 1. Mô hình Xác thực

### 1.1 Lưu trữ Token ở Web (`apps/web`)

- Access Token lưu trong bộ nhớ RAM (`Zustand store`, không persist).
- Refresh Token lưu trong cookie **`refresh_token`** với `HttpOnly`, `SameSite=Lax`, `Secure` (bật theo `COOKIE_SECURE`; bắt buộc `true` ở production) (xem mục 1.4) để triệt tiêu nguy cơ XSS trộm token.
- Access token chỉ mang `sub`, `email`, `jti` — **không** có `role`, `tenantId` hay `scope`. Tenant, scope, vai trò và grant được `JwtAuthGuard` nạp từ database (cache Redis) trên **mọi** request, nên đổi vai trò hay khóa tài khoản có hiệu lực ngay (mục 2.4). Không có danh sách membership hay cơ chế chuyển tenant: **1 user = 1 tenant** (user nền tảng không thuộc tenant nào).

### 1.2 Luồng Đăng nhập, Làm mới Token & Quản lý Tài khoản (`apps/api`)

Các endpoint dưới `/api/v1/auth`: `login`, `refresh`, `logout`, `logout-all`, `me`, `me/abilities`, `forgot-password`, `reset-password`, `change-password`. `GET /auth/me` trả `PublicUser = { id, email, fullName, tenantId?, scope, roles: [{ key, name }] }`; `GET /auth/me/abilities` trả rule CASL đã nén cho web (mục 4.1).

**Không có tự đăng ký.** Không có `register`, `verify-email`, `resend-otp`; web không có trang đăng ký hay đăng nhập mạng xã hội. Tài khoản chỉ được tạo bởi người có quyền `create:User`, qua `POST /tenants` (cần `create:Tenant`, chỉ platform giữ được) và `POST /users`. Body `POST /users` nhận `roleIds` (tối thiểu 1) thay cho `role` cũ:

| Người gọi                          | Tạo được                                                                                          | `tenantId` trong body                                                |
| :--------------------------------- | :------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------- |
| Người dùng scope `platform`        | User nền tảng (vai trò scope `platform`, không tenant) hoặc user trong tenant được chọn           | bắt buộc với user thuộc tenant; bị từ chối (`403`) với user nền tảng |
| Người dùng tenant có `create:User` | User trong **tenant của chính mình**, chỉ với vai trò họ được phép gán (chống leo thang, mục 2.5) | tùy chọn; khác tenant của mình ➔ `403`; vắng ➔ lấy từ hồ sơ          |
| Người dùng không có `create:User`  | không tạo được (`403` ở `PoliciesGuard`)                                                          | —                                                                    |

User mới `isActive = true`, `isEmailVerified = true`, với mật khẩu admin đặt (băm Argon2id). Mỗi lần tạo/sửa/xóa user, đổi vai trò, và tạo/sửa tenant đều ghi `audit_logs` (xem doc 02, mục 5). Email trùng ➔ `409 RESOURCE_CONFLICT`.

0. `POST /auth/refresh` và `/auth/logout` chấp nhận request không có body (trình duyệt không gửi body; token nằm trong cookie `refresh_token`).
1. **Đăng nhập:** backend set hai cookie — `refresh_token` (`HttpOnly; SameSite=Lax; Path=/api/v1/auth`, `Secure` theo `COOKIE_SECURE`) và `csrf_token` (đọc được từ JS, `Path=/`) — rồi trả body `{ data: { accessToken, user, csrfToken } }`. Refresh token không xuất hiện trong body với client web. (Client gửi header `x-client-type: mobile` sẽ nhận `refreshToken` trong body và không có cookie; repo này không có app mobile.)
2. **Quên mật khẩu:** `forgot-password` gửi OTP 6 số qua email (SMTP; không cấu hình SMTP thì OTP chỉ hiện trong log API), hiệu lực 5 phút, cooldown 60 giây; luôn trả cùng một thông báo dù email có tồn tại hay không. `reset-password` kiểm OTP (lưu trong Redis dưới dạng hash, dùng một lần), đổi mật khẩu và **thu hồi mọi session** của user. Chỉ có OTP reset mật khẩu; không còn OTP xác minh email.
3. **Đổi mật khẩu:** `change-password` (cần access token) cũng thu hồi mọi session.
4. **Giới hạn tốc độ** (theo IP, lưu ở Redis): `login` 5/phút, `refresh` 30/phút, `forgot-password` và `reset-password` 5/phút, mặc định 120/phút.
5. **Single-flight Refresh Token Lock (Phía Client):**
   - Khi có nhiều request đồng thời bị `401 Unauthorized`, chỉ cho phép đúng **1 request refresh duy nhất** được gọi lên backend (`apps/web/src/lib/http/refresh.ts`), kèm khóa liên tab bằng `navigator.locks` để hai tab không refresh cùng lúc.
   - Các request còn lại xếp hàng đợi và tự động thử lại khi có token mới.

---

### 1.3 Refresh Token Rotation & Reuse Detection

Cất token an toàn (httpOnly cookie) mới giải quyết được **nơi để**, chưa giải quyết **vòng đời**. Không có phần này thì một refresh token bị lộ = 7 ngày toàn quyền.

**Mô hình token family** (bảng `sessions` không có `tenant_id`, chỉ truy cập được ở `admin` mode — xem doc 02):

```
sessions
├─ id            uuid pk
├─ user_id       uuid
├─ family_id     uuid          -- 1 lần đăng nhập = 1 family
├─ token_hash    text          -- HMAC-SHA256 (khóa = JWT_REFRESH_SECRET) của refresh token, KHÔNG lưu token gốc
├─ parent_id     uuid null     -- token trước đó trong chuỗi rotation
├─ used_at       timestamptz null
├─ revoked_at    timestamptz null
├─ expires_at    timestamptz
└─ user_agent, ip_address      -- hiển thị "thiết bị đang đăng nhập"
```

**Luồng `POST /auth/refresh`:**

1. Hash token nhận được, tra trong `sessions`. Không thấy ➔ `401`.
2. **Nếu bản ghi đã có `used_at`** ➔ token đang bị dùng lại. Đây là dấu hiệu token bị đánh cắp:
   - **Thu hồi toàn bộ family** (`UPDATE sessions SET revoked_at = now() WHERE family_id = ...`).
   - Ghi log cảnh báo mức `warn` kèm `userId`, `ip`, `userAgent`.
   - Trả `401`, buộc đăng nhập lại trên mọi thiết bị của family đó.
3. Nếu hợp lệ: đánh dấu `used_at`, phát hành **cặp token mới** cùng `family_id`, `parent_id` trỏ về token vừa dùng.

**Quy tắc bắt buộc:**

- Refresh token là **one-time use**. Không bao giờ trả lại đúng refresh token cũ.
- Chỉ lưu `token_hash`, không lưu token gốc — DB bị lộ thì token vẫn vô dụng.
- `POST /auth/logout` thu hồi 1 family; `POST /auth/logout-all` thu hồi mọi family của user.
- Refresh token là chuỗi ngẫu nhiên 32 byte (không phải JWT), nên mỗi lần refresh đều là một lần tra DB để phát hiện token đã dùng.
- Access token mang `jti`; `logout` và `logout-all` đưa `jti` của token hiện tại vào denylist Redis (`auth:denylist:<jti>`, TTL = thời gian sống của access token), và `JwtAuthGuard` từ chối token nằm trong denylist. Sau khi verify token, guard còn nạp hồ sơ quyền của user (mục 2.4); user không còn active ➔ `401`, không đợi token hết hạn.
- `reset-password` và `change-password` thu hồi mọi family của user.

### 1.4 Lựa chọn `SameSite` cho Refresh Cookie

`SameSite=Strict` an toàn nhất nhưng **cookie sẽ không được gửi kèm khi trình duyệt quay về từ domain khác** — ví dụ redirect từ trang thanh toán hay từ một liên kết ngoài. Người dùng sẽ thấy mình bị đăng xuất.

Quy ước của boilerplate:

| Thuộc tính | Giá trị                                      | Lý do                                                     |
| :--------- | :------------------------------------------- | :-------------------------------------------------------- |
| `HttpOnly` | `true`                                       | JavaScript không đọc được ➔ XSS không trộm được token     |
| `Secure`   | `COOKIE_SECURE` (production bắt buộc `true`) | Chỉ gửi qua HTTPS; dev trên `http://localhost` để `false` |
| `SameSite` | `Lax`                                        | Sống sót qua điều hướng từ liên kết ngoài                 |
| `Path`     | `/api/v1/auth`                               | Cookie không bị gửi kèm mọi request API khác              |
| CSRF       | **Bắt buộc** double-submit token             | Bù lại phần `Lax` nới lỏng hơn `Strict`                   |

Chọn `Lax` **bắt buộc** đi kèm CSRF token — thiếu một trong hai là lỗi bảo mật.

**Cách `CsrfMiddleware` hoạt động** (global, `core/middleware/csrf.middleware.ts`): bỏ qua `GET/HEAD/OPTIONS`; nếu request **không có** cookie `csrf_token` thì cho qua (không có session cookie để lợi dụng, ví dụ request bearer thuần hoặc lần đăng nhập đầu); nếu có cookie thì header `x-csrf-token` phải khớp (so sánh constant-time) **và** header `Origin` (nếu có) phải bằng `WEB_ORIGIN`. Hệ quả vận hành: `WEB_ORIGIN` sai ➔ đăng nhập vẫn được nhưng mọi POST/PATCH/DELETE sau đó bị `403 CSRF_VALIDATION_FAILED`; cookie `csrf_token` cũ của dự án khác trên `localhost` gây lỗi tương tự (client web tự xóa cookie và thử lại một lần cho `login`/`refresh`). Xem `setup.md`, mục Troubleshooting.

---

## 2. Mô hình Phân quyền: Vai trò lưu trong DB, CASL đánh giá

Quyết định và các phương án đã loại: [ADR-0005](adr/0005-permission-luu-trong-co-so-du-lieu.md). Tóm tắt: **vai trò và permission nằm trong database** (tenant tự tạo vai trò), **danh mục permission nằm trong code**, và **CASL** biến grant thành ability, chạy giống hệt ở API và trình duyệt.

### 2.1 Các khái niệm

| Khái niệm            | Ý nghĩa                                                                                                                                                                                       |
| :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Permission**       | Một cặp `(action, subject)`, ví dụ `update:User`. Danh mục đầy đủ là `PERMISSION_CATALOG` (`packages/shared-types/src/authz/catalog.ts`), được đồng bộ vào bảng `permissions`.                |
| **Action**           | `manage` \| `create` \| `read` \| `update` \| `delete` (`manage` = mọi action).                                                                                                               |
| **Preset (phạm vi)** | Độ với tới của một grant: `any` (mọi bản ghi, chỉ platform), `own_tenant` (bản ghi cùng tenant), `own_record` (chỉ bản ghi của chính mình). Từ vựng khép kín, tenant không tự viết điều kiện. |
| **Grant**            | `{ action, subject, preset }` gắn vào một vai trò (bảng `role_permissions`).                                                                                                                  |
| **Vai trò (Role)**   | Tập grant có tên. `scope` là `platform` hoặc `tenant`. Vai trò hệ thống có `tenant_id` NULL, vai trò tùy biến có `tenant_id` của tenant tạo ra nó.                                            |
| **Vai trò hệ thống** | `PLATFORM_ADMIN` (scope `platform`, `manage:all`), `TENANT_ADMIN`, `TENANT_MEMBER` (scope `tenant`). Định nghĩa trong `SYSTEM_ROLES` với id cố định; bất biến qua API.                        |
| **Hồ sơ (Profile)**  | `AuthzProfile` của một user: `userId`, `email`, `tenantId`, `scope`, `roles`, `grants`. Nạp từ DB mỗi request (cache Redis), không lấy từ token.                                              |

Một user có thể giữ nhiều vai trò; grant là hợp của các vai trò. Một user nền tảng là user có `tenant_id` NULL và ít nhất một vai trò scope `platform`; `scope` của hồ sơ là `platform` khi user giữ bất kỳ vai trò `platform` nào.

Quyền của các vai trò hệ thống (từ `SYSTEM_ROLES`):

| Vai trò          | Grant                                                                                                        |
| :--------------- | :----------------------------------------------------------------------------------------------------------- |
| `PLATFORM_ADMIN` | `manage:all` (`any`)                                                                                         |
| `TENANT_ADMIN`   | `read/create/update/delete User`, `read/update Tenant`, `read/create/update/delete Role` — đều `own_tenant`  |
| `TENANT_MEMBER`  | `read User` (`own_tenant`), `update User` (`own_record`: sửa hồ sơ chính mình), `read Tenant` (`own_tenant`) |

Quy tắc của catalog: mục `platformOnly` (`manage:all`, `create`/`delete` `Tenant`) chỉ vai trò scope `platform` mới giữ được; mỗi mục khai báo các preset mà vai trò tenant được dùng (`any` không bao giờ nằm trong đó).

### 2.2 Schema (migration `0001_*`)

| Bảng               | Nội dung chính                                                                                                                                                                                             |
| :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissions`      | `action`, `subject`, `description`; unique `(action, subject)`. Bản sao của catalog trong code.                                                                                                            |
| `roles`            | `tenant_id` (NULL = vai trò hệ thống dùng chung), `key`, `name`, `scope` (`platform`\|`tenant`), `is_system`, `deleted_at`. CHECK: `is_system` ⇔ `tenant_id IS NULL`; vai trò `platform` luôn là hệ thống. |
| `role_permissions` | `(role_id, permission_id)` + `scope_preset` (CHECK `any`\|`own_tenant`\|`own_record`).                                                                                                                     |
| `user_roles`       | `(user_id, role_id)`, `tenant_id` (trigger tự gán theo user), `granted_by`, `granted_at`.                                                                                                                  |

Cột `users.role` đã bị gỡ (migration backfill `user_roles` từ cột cũ trước khi `DROP COLUMN`). Chi tiết RLS của bốn bảng: doc 02, mục 2.4.

### 2.3 Đồng bộ catalog — `syncAuthzCatalog`

Code là nguồn sự thật. `migrate.ts` (lệnh `just db-migrate`) gọi `syncAuthzCatalog` **sau** khi chạy migration và `99-grants.sql`:

- upsert mọi mục `PERMISSION_CATALOG` vào `permissions`; mục bị xóa khỏi catalog thì bị xóa khỏi bảng (kèm grant của nó);
- upsert các vai trò hệ thống (`SYSTEM_ROLES`) và đặt lại grant của chúng đúng như trong code;
- idempotent, chạy trong một transaction dưới role `boilerplate_app` ở `admin` mode với `app.system_roles_write = 'on'` (công tắc duy nhất mà trigger `guard_system_roles` chấp nhận). `00-roles.sql` cấp cho user migrate quyền `SET ROLE boilerplate_app` để làm được việc này.

**Không** chạy lúc app khởi động: nhiều replica boot cùng lúc sẽ đua nhau ([rules/10-infra-devops.md](rules/10-infra-devops.md)). Hệ quả: **thêm catalog entry mà chưa chạy `just db-migrate` thì entry đó chưa tồn tại trong DB**, vai trò chưa gán được quyền đó.

### 2.4 Chạy lúc request: nạp hồ sơ, ability, access mode

1. `JwtAuthGuard` (global) verify access token (chữ ký, hạn, denylist `jti`) rồi gọi `AuthzService.loadProfile(payload.sub)`.
2. `loadProfile` đọc cache Redis `authz:profile:<userId>` (TTL **300 giây**); miss ➔ đọc DB trong transaction `admin` mode (reason `authz:load-profile`) rồi ghi cache. User không tồn tại hoặc không active ➔ `undefined` ➔ `401`.
3. Cache bị **xóa chủ động** (`invalidateUsers` / `invalidateRole`) khi đổi grant của vai trò, đổi vai trò của user, hoặc vô hiệu hóa/xóa user. TTL chỉ là lưới an toàn nếu thay đổi diễn ra ngoài API (ví dụ sửa tay trong DB).
4. Guard lưu hồ sơ vào CLS và suy ra **access mode RLS**: `scope = 'platform'` ➔ `admin` (reason `platform-user:<id>`); ngược lại ➔ `tenant` với `profile.tenantId`; không có tenant ➔ `401`. Đây là nơi duy nhất nối hai hệ thống phân quyền: CASL quyết định hành động nào được thử, RLS quyết định hàng nào nhìn thấy.
5. `AuthzService.current()` dựng ability từ hồ sơ trong CLS bằng `buildAbility(grants, { id, tenantId })`; `PoliciesGuard` và service dùng cùng ability đó. Route `@Public()` không có token ➔ không có hồ sơ ➔ ability rỗng.

`buildAbility` là hàm thuần (cùng grant + cùng user ➔ cùng ability). `conditionsFor(grant, user)` ánh xạ preset sang điều kiện CASL:

| Preset       | `User`           | `Tenant`           | `Role` (action `read`)                    | `Role` (action khác) |
| :----------- | :--------------- | :----------------- | :---------------------------------------- | :------------------- |
| `any`        | không điều kiện  | không điều kiện    | không điều kiện                           | không điều kiện      |
| `own_tenant` | `{ tenantId }`   | `{ id: tenantId }` | `{ tenantId: { $in: [tenantId, null] } }` | `{ tenantId }`       |
| `own_record` | `{ id: userId }` | (bỏ grant)         | (bỏ grant)                                | (bỏ grant)           |

Tổ hợp vô nghĩa hoặc user không có tenant mà dùng preset khác `any` ➔ grant bị **bỏ** (fail closed). Ngoài grant, `buildAbility` luôn thêm rule bất biến `cannot('update' | 'delete', 'Role', { isSystem: true })`: ngay cả `manage:all` cũng không sửa/xóa được vai trò hệ thống qua API.

### 2.5 Chống leo thang quyền

| Quy tắc                                                                                                                                                     | Thực thi ở                                                        | Lỗi                    |
| :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------- | :--------------------- |
| Không ai cấp/gán nhiều hơn mình đang giữ: mỗi grant phải được `grantsCover` (cùng action+subject, preset bằng hoặc rộng hơn; `manage:all` bao tất cả)       | `RolesService` (tạo/sửa permission), `UsersService` (gán vai trò) | `403`                  |
| Vai trò tenant không dùng `any`, mục `platformOnly`, hoặc preset ngoài danh sách của catalog                                                                | `RolesService.validateGrants`                                     | `422`                  |
| Không ai sửa vai trò của **chính mình**                                                                                                                     | `UsersService.setRoles`                                           | `403`                  |
| Tenant luôn còn ít nhất một `TENANT_ADMIN` active (khi gỡ vai trò, khóa hoặc xóa user)                                                                      | `UsersService`                                                    | `409`                  |
| Vai trò hệ thống bất biến, kể cả với platform admin                                                                                                         | rule CASL `cannot ... isSystem` + trigger `guard_system_roles`    | `403` / SQLSTATE 42501 |
| Vai trò đang được gán không xóa được                                                                                                                        | `RolesService.remove`                                             | `409`                  |
| Scope vai trò phải khớp user (platform ⇔ user không tenant); vai trò tùy biến chỉ gán trong tenant của nó; `user_roles.tenant_id` luôn bằng tenant của user | trigger `check_user_role_assignment`                              | SQLSTATE 23514 ➔ `422` |

Các thay đổi đều ghi `audit_logs`: `role.create`, `role.update`, `role.permissions.update`, `role.delete`, `user.roles.update`.

### 2.6 API quản lý vai trò

| Endpoint                       | Mô tả                                                                                                              | Quyền route           |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------------- | :-------------------- |
| `GET /permissions`             | Các permission (kèm preset) mà **người gọi được phép đưa vào vai trò** = catalog thu hẹp theo những gì họ đang giữ | `read:Role`           |
| `GET /roles`, `GET /roles/:id` | Vai trò hệ thống tenant-scope dùng chung + vai trò của tenant, kèm grant (platform thấy tất cả)                    | `read:Role`           |
| `POST /roles`                  | Tạo vai trò tùy biến (`name`, `permissions`, `tenantId` — chỉ platform chọn tenant)                                | `create:Role`         |
| `PATCH /roles/:id`             | Đổi tên vai trò tùy biến                                                                                           | `update:Role` (lớp 2) |
| `PUT /roles/:id/permissions`   | Thay toàn bộ tập permission; xóa cache của mọi user giữ vai trò                                                    | `update:Role` (lớp 2) |
| `DELETE /roles/:id`            | Xóa (soft) vai trò chưa gán cho ai                                                                                 | `delete:Role` (lớp 2) |
| `PUT /users/:id/roles`         | Thay tập vai trò của user (`roleIds`)                                                                              | `update:User` (lớp 2) |

`tenantId` chỉ xuất hiện trong DTO của `POST /users` và `POST /roles`: platform chọn tenant, người dùng tenant bị ghim vào tenant của mình và giá trị khác bị `403`.

### 2.7 Checklist "Thêm một entity mới có phân quyền"

Ví dụ thêm `Project` (thuộc tenant). Phần schema/RLS chi tiết ở doc 02, mục 7; dưới đây là phần phân quyền:

1. **`SubjectShapes`** (`packages/shared-types/src/authz/ability.ts`): thêm `Project: { id: string; tenantId: string }`.
2. **`conditionsFor`** (cùng file): thêm nhánh `Project` cho từng preset được hỗ trợ (`own_tenant` ➔ `{ tenantId }`, `own_record` nếu có nghĩa). Thiếu nhánh ➔ grant bị bỏ (fail closed) và quyền "biến mất" một cách im lặng.
3. **Catalog** (`catalog.ts`): thêm `entry(action, 'Project', mô tả, presets)` cho từng action; đánh dấu `platformOnly` nếu chỉ nền tảng được giữ; khai báo preset mà vai trò tenant được dùng.
4. **`SYSTEM_ROLES`**: nếu vai trò hệ thống cần quyền mới (ví dụ `TENANT_ADMIN` quản lý `Project`), thêm grant vào định nghĩa. `PLATFORM_ADMIN` đã có `manage:all`.
5. **Chạy `just db-migrate`** để đồng bộ catalog vào `permissions` và grant vào vai trò hệ thống. Không chạy ➔ entry chưa tồn tại trong DB. Hồ sơ đã cache tối đa 300 giây mới thấy quyền mới của vai trò hệ thống (hoặc chờ cache bị xóa).
6. **Bảng + RLS**: cột `tenant_id`, `ENABLE` + `FORCE`, đúng một policy, index, integration test cách ly (doc 02, mục 2.5 và 7).
7. **Service**: lấy ability bằng `AuthzService.current()` và kiểm tra từng bản ghi bằng `ability.can(action, subject('Project', entity))` — không dùng subject chuỗi. Truy vấn qua `TransactionManager.runInRequestContext`.
8. **Controller**: `@CheckPolicies((ability) => ability.can('create', 'Project'))` cho lớp 1; DTO không chứa `tenantId`.
9. **Contract**: `just contract`, commit `openapi.json` và `generated.ts`.
10. **Web**: ẩn/hiện bằng `<CanAction I="create" a="Project">` hoặc `this={subject('Project', entity)}`, route guard bằng ability; kiểu lấy từ `@repo/api-contract`. Nếu entity cần hiện trong ma trận permission của trang quản lý vai trò thì nó đã tự có mặt nhờ `GET /permissions`.

---

## 3. Thực thi Phân quyền tại Backend (`apps/api`)

### 3.1 Cạm bẫy số 1 của CASL: kiểm tra ở mức _type_ không đủ

```typescript
// ❌ SAI cho quyền phụ thuộc điều kiện — tưởng là đã chặn, thực ra không chặn gì cả
@CheckPolicies((ability) => ability.can('update', 'User'))
```

Grant `update:User` với preset `own_record` sinh rule `{ id: userId }`, tức là có **điều kiện trên thuộc tính**. Khi gọi `ability.can('update', 'User')` với subject là **chuỗi type**, CASL không có instance để so điều kiện ➔ trả `true` nếu tồn tại _bất kỳ_ rule nào cho `User`. Nghĩa là một thành viên chỉ được sửa hồ sơ chính mình vẫn qua được guard ở mức type.

➔ Guard chỉ là **lớp 1: chặn sớm theo permission**. Bắt buộc phải có **lớp 2** sau khi đã load entity.

### 3.2 Lớp 1 — `PoliciesGuard` (chặn sớm, trước khi vào service)

```typescript
@Controller({ path: 'users', version: '1' })
@UseGuards(PoliciesGuard) // JwtAuthGuard là guard toàn cục
export class UsersController {
  @Get()
  @CheckPolicies((ability) => ability.can('read', 'User'))
  list(@Query() query: ListUsersDto) { ... }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'User')) // không có grant create:User ➔ 403
  create(@CurrentUser() actor: AuthContext, @Body() dto: CreateUserDto, ...) { ... }

  // GET/PATCH/DELETE :id không gắn @CheckPolicies: quyền phụ thuộc bản ghi cụ thể,
  // nên chỉ lớp 2 (service) mới trả lời được.
}
```

`PoliciesGuard` lấy ability từ `AuthzService.current()` — **cùng** ability mà service dùng, dựng từ hồ sơ trong DB. Tác dụng: loại ngay người hoàn toàn không có permission đó (ví dụ không có grant `create:User` gọi `POST /users` ➔ `403` mà không tốn truy vấn nghiệp vụ nào). `tenants` làm tương tự (`POST /tenants` cần `create:Tenant`, chỉ platform giữ được); `roles` dùng `read:Role` / `create:Role`.

### 3.3 Lớp 2 — Kiểm tra trên instance (bắt buộc)

```typescript
import { subject } from '@casl/ability';

@Injectable()
export class UsersService {
  async update(actor: AuthContext, id: string, dto: UpdateUserDto) {
    const { user: existing, roles } = await this.loadOrThrow(id); // RLS: user của tenant khác ➔ 404
    const ability = this.authz.current(); // ability dựng từ hồ sơ trong DB

    // ✅ ĐÚNG — CASL so điều kiện { tenantId } / { id } với dữ liệu thật
    this.assertCan(ability, 'update', existing); // bên trong: ability.can(action, subject('User', {...}))
    // đổi isActive cần quyền `delete` — người chỉ có `update:User` preset `own_record` không tự khóa/mở tài khoản
    if (dto.isActive !== undefined) this.assertCan(ability, 'delete', existing);

    return this.transactions.runInRequestContext(async (tx) => {
      const row = await this.repository.update(tx, id, toPatch(dto));
      await this.audit.record(tx, { actorId: actor.id, action: 'user.update', ... });
      return row;
    });
  }
}
```

Service ném domain error (`ForbiddenActionError`, `ResourceNotFoundError`), không ném `HttpException`; `GlobalExceptionFilter` ánh xạ sang RFC 9457.

`subject('User', user)` gắn nhãn type cho object thuần để CASL biết áp rule nào. Thiếu bước này, CASL không nhận diện được object ➔ ném lỗi hoặc trả sai.

Với `create`, service tự tính tenant đích (`resolveTenantId`) từ actor + DTO + vai trò được chọn rồi mới kiểm tra `subject('User', { id: 'new', tenantId })`, vì grant `own_tenant` bị ràng buộc theo `tenantId`. Sau đó `assertAssignable` kiểm tra các vai trò được gán (mục 2.5).

### 3.4 Ba lớp phòng thủ độc lập

| Lớp                                    | Vị trí           | Chặn được gì                                | Chặn hụt gì                               |
| :------------------------------------- | :--------------- | :------------------------------------------ | :---------------------------------------- |
| 1. `PoliciesGuard`                     | Trước controller | Thiếu permission                            | Sai tenant/chủ sở hữu (không có instance) |
| 2. `ability.can(action, subject(...))` | Trong service    | Sai tenant, sai chủ sở hữu                  | Lỗi dev quên gọi                          |
| 3. **Postgres RLS**                    | Trong database   | Mọi truy vấn, kể cả khi dev quên lớp 1 và 2 | —                                         |

Lớp 3 là **chốt chặn cuối cùng và là lớp đáng tin nhất** vì nó không phụ thuộc vào việc lập trình viên có nhớ hay không. Xem [02-backend-core-va-drizzle-rls.md](02-backend-core-va-drizzle-rls.md). Hai lớp trên tồn tại để trả về mã lỗi `403` tường minh thay vì rỗng khó hiểu do RLS lọc mất. Lưu ý quy ước: bản ghi của tenant khác bị RLS ẩn nên service trả `404`, còn `403` dành cho thiếu permission hoặc sai quyền sở hữu trong cùng tenant.

## 4. Thực thi Phân quyền tại Frontend (`apps/web`)

### 4.1 `AbilityProvider` & `CanAction`

Web **không** tự định nghĩa quyền. Sau khi đăng nhập, `AbilityProvider` (`apps/web/src/features/auth/ability/`) gọi `GET /auth/me/abilities`, nhận rule CASL đã nén (`PackedRules`) và dựng ability bằng `abilityFromPacked` của `@repo/shared-types` — cùng rule mà backend vừa dùng để đánh giá. Query được nạp lại khi session đổi (đăng nhập, refresh token, đổi user).

```tsx
// ability-context.tsx (rút gọn)
const query = useQuery<PackedRules>({
  queryKey: abilityKeys.session(userId, accessToken),
  enabled: isSignedIn,
  queryFn: async () => (await apiClient.get(AUTH_ENDPOINTS.ABILITIES)).rules,
});

// useMemo là BẮT BUỘC: thiếu nó, mỗi lần render tạo một object ability mới
// ➔ context đổi tham chiếu ➔ toàn bộ cây con re-render vô ích.
const ability = useMemo(() => (rules ? abilityFromPacked(rules) : defineAnonymousAbility()), [rules]);
```

Sử dụng trong giao diện (`CanAction`, export từ `@/features/auth`):

```tsx
<CanAction I="create" a="User">
  <Button onClick={openCreateUserForm}>{t('actions.create')}</Button>
</CanAction>
```

Với kiểm tra trên bản ghi cụ thể, dùng `this` thay vì `a` (và gắn nhãn bằng `subject('User', user)`):

```tsx
<CanAction I="update" this={subject('User', user)}>
  <Button onClick={openEditModal}>{t('actions.edit')}</Button>
</CanAction>
```

`RouteGuard` (`app/components/route-guard.tsx`) bọc các route cần đăng nhập và quyết định theo **ability** (không còn danh sách role viết cứng); trong lúc rule chưa nạp xong thì chờ (`useAbilityLoading`) thay vì chuyển hướng nhầm. Trang quản lý vai trò (`features/roles`: danh sách vai trò và ma trận permission theo preset) dùng `GET /permissions` để chỉ hiện những ô người dùng được phép cấp.

### 4.2 Frontend authz chỉ là UX, không phải bảo mật

Ẩn nút bấm **không** là biện pháp bảo mật — người dùng vẫn gọi được API bằng `curl`. `<CanAction>` tồn tại để giao diện không hiển thị hành động sẽ thất bại. Quyền thật sự được thực thi ở backend (mục 3) và database (RLS). Rule trong trình duyệt có thể cũ tới lần nạp lại kế tiếp; backend luôn đọc quyền mới nhất.

Hệ quả thực tế: **cấm** dùng `<CanAction>` làm nơi duy nhất quyết định logic nghiệp vụ, và **cấm** đưa dữ liệu nhạy cảm xuống client rồi ẩn bằng CSS/điều kiện render.

---

## 5. Checklist Thực thi

- [ ] Đăng nhập trên web ➔ refresh token nằm trong cookie `refresh_token` (`HttpOnly; SameSite=Lax; Path=/api/v1/auth`, `Secure` ở production), **không** xuất hiện trong response body.
- [ ] Không có route đăng ký: `POST /api/v1/auth/register` trả `404`.
- [ ] `PLATFORM_ADMIN` tạo tenant rồi tạo user với `roleIds` của `TENANT_ADMIN` cho tenant đó; `TENANT_ADMIN` tạo user trong tenant mình thì được, truyền `tenantId` của tenant khác thì nhận `403`; `TENANT_MEMBER` gọi `POST /users` nhận `403`.
- [ ] `document.cookie` trong DevTools **không** đọc được refresh token.
- [ ] Gọi `/auth/refresh` 2 lần với **cùng** một refresh token ➔ lần 2 trả `401` **và** toàn bộ family bị thu hồi (kiểm tra `revoked_at` trong bảng `sessions`).
- [ ] Bắn 5 request đồng thời khi access token hết hạn ➔ log xác nhận chỉ có **1** lần gọi `/auth/refresh`.
- [ ] `TENANT_MEMBER` gọi `PATCH /users/:id` với `id` của user khác trong cùng tenant ➔ nhận `403` từ lớp 2; với `id` của user ở tenant khác ➔ `404` (RLS).
- [ ] Access token đã giải mã chỉ có `sub`, `email`, `jti` (không `role`/`tenantId`).
- [ ] Khóa một user (`PATCH /users/:id` với `isActive: false`) ➔ request kế tiếp của họ với access token cũ nhận `401`.
- [ ] Tenant admin tạo vai trò tùy biến (`POST /roles`), thử đưa vào một permission mình không giữ ➔ `403`; dùng mục `platformOnly` hoặc preset `any` ➔ `422`; `PATCH`/`DELETE` vai trò hệ thống ➔ `403`.
- [ ] Đổi permission của một vai trò (`PUT /roles/:id/permissions`) ➔ user giữ vai trò đó thấy thay đổi ở request kế tiếp (không đợi 300 giây của cache).
- [ ] Gỡ `TENANT_ADMIN` cuối cùng của tenant (đổi vai trò, khóa hoặc xóa) ➔ `409`; tự đổi vai trò của chính mình ➔ `403`.
- [ ] Thêm một mục vào `PERMISSION_CATALOG` rồi `just db-migrate` ➔ mục xuất hiện trong bảng `permissions` và trong `GET /permissions` của platform admin; chạy lần hai không đổi gì (idempotent).
- [ ] Đăng nhập thành công rồi `POST` với `Origin` khác `WEB_ORIGIN` ➔ `403 CSRF_VALIDATION_FAILED`.
- [ ] Xóa lớp 2 tạm thời ➔ vẫn không sửa được dữ liệu của tenant khác (chứng minh RLS là chốt chặn độc lập).
- [ ] Bảng `sessions` chỉ chứa `token_hash`, grep toàn bảng không thấy token dạng gốc.
- [ ] `reset-password` thành công ➔ mọi refresh token cũ của user bị thu hồi.
