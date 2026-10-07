---
title: Bảng Thuật ngữ
description: Từ vựng thống nhất cho tên bảng, tên API, tên biến và giao tiếp trong team
status: stable
updated: 2026-10-07
owner: Platform Team
---

# Bảng Thuật ngữ

> **Vì sao cần file này:** một khái niệm gọi bằng ba cái tên khác nhau sẽ sinh ra ba cái tên bảng, ba tên endpoint và ba tên biến. Chốt từ vựng sớm rẻ hơn đổi tên 40 bảng về sau.
>
> Quy tắc: **cột "Dùng" là từ duy nhất được phép xuất hiện** trong tên bảng, tên API, tên biến, tên type và tên branch. Các từ ở cột "Không dùng" chỉ được xuất hiện trong văn nói.

## 1. Chủ thể

| Dùng            | Không dùng                       | Nghĩa                                                                                                                    |
| :-------------- | :------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| `Tenant`        | Organization, Workspace, Account | Một không gian làm việc độc lập; đơn vị cách ly dữ liệu. Mỗi user (trừ `PLATFORM_ADMIN`) thuộc đúng 1 tenant             |
| `PlatformAdmin` | SuperAdmin, Root, Owner          | Vai trò hệ thống `PLATFORM_ADMIN` (scope `platform`, `manage:all`); người giữ nó không thuộc tenant nào, thấy mọi tenant |
| `TenantAdmin`   | Owner, Manager                   | Vai trò hệ thống `TENANT_ADMIN` (quản trị user, tenant, vai trò của tenant mình)                                         |
| `TenantMember`  | Employee, Staff                  | Vai trò hệ thống `TENANT_MEMBER` (đọc user/tenant của tenant mình, sửa hồ sơ chính mình)                                 |
| `User`          | Account                          | Bản ghi danh tính gốc; quyền của user đến từ các vai trò gán qua `user_roles` (không còn cột `users.role`)               |

> Thuật ngữ nghiệp vụ riêng của dự án (ví dụ `Project`, `Invoice`) được thêm vào bảng này khi bạn thêm entity mới, kèm cột "Không dùng".

## 1b. Phân quyền

| Dùng                          | Không dùng              | Nghĩa                                                                                                                                                     |
| :---------------------------- | :---------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Role`                        | Group                   | Tập permission có tên, lưu ở bảng `roles`. `scope` là `platform` hoặc `tenant`                                                                            |
| `System role`                 | Built-in, Default role  | Vai trò do code định nghĩa (`SYSTEM_ROLES`), `tenant_id` NULL, `is_system = true`, bất biến qua API; chỉ job migrate sửa được                             |
| `Custom role`                 | —                       | Vai trò do một tenant tự tạo (`tenant_id` của tenant đó)                                                                                                  |
| `Permission`                  | Right, Privilege        | Một cặp `(action, subject)` trong `PERMISSION_CATALOG`, ví dụ `update:User`; bảng `permissions` là bản sao do `migrate.ts` đồng bộ                        |
| `Grant`                       | —                       | Một permission gắn vào một vai trò kèm preset (`role_permissions`)                                                                                        |
| `Preset`                      | Condition, Rule, Filter | Phạm vi của một grant, từ vựng khép kín: `any`, `own_tenant`, `own_record`. `conditionsFor()` đổi nó thành điều kiện CASL; tenant không tự viết điều kiện |
| `Profile`                     | Session (authz)         | `AuthzProfile` của user (tenant, scope, vai trò, grant), nạp từ DB mỗi request và cache Redis `authz:profile:<id>` (TTL 300 giây)                         |
| `Scope` (của vai trò / hồ sơ) | Level, Tier             | `platform` (giữ vai trò nền tảng ➔ RLS `admin` mode) hoặc `tenant` (RLS `tenant` mode)                                                                    |
| `Catalog`                     | —                       | `PERMISSION_CATALOG` trong `shared-types`: nguồn sự thật của mọi permission hệ thống biết tới                                                             |

## 2. Trạng thái & Ngữ cảnh truy cập

| Dùng          | Nghĩa                                                                                    |
| :------------ | :--------------------------------------------------------------------------------------- |
| `access_mode` | Biến session Postgres điều khiển RLS. Hai giá trị: `tenant`, `admin`                     |
| `tenant_id`   | Cột (và biến session `app.tenant_id`) xác định tenant sở hữu bản ghi                     |
| `isActive`    | Bản ghi còn hiệu lực (đối lập với bị đình chỉ/vô hiệu hóa)                               |
| `deletedAt`   | Soft delete. **Không** dùng cột `isDeleted`                                              |
| `audit_logs`  | Bảng ghi ai làm gì (`user.create`, `role.permissions.update`, ...), ghi cùng transaction |

## 3. Hạ tầng

| Dùng           | Nghĩa                                                         |
| :------------- | :------------------------------------------------------------ |
| `apps/api`     | NestJS backend                                                |
| `apps/web`     | React SPA                                                     |
| `integrations` | Tầng outbound adapter gọi hệ thống bên ngoài (hiện trống)     |
| `modules`      | Tầng lát cắt nghiệp vụ (`auth`, `users`, `tenants`, `health`) |

## 4. Quy ước đặt tên theo ngữ cảnh

Cùng một khái niệm được viết khác nhau tùy nơi, nhưng **luôn suy ra được từ nhau**:

| Ngữ cảnh        | Quy ước                       | Ví dụ                       |
| :-------------- | :---------------------------- | :-------------------------- |
| Tên bảng DB     | `snake_case`, **số nhiều**    | `project_members`           |
| Tên cột DB      | `snake_case`, số ít           | `tenant_id`, `is_active`    |
| Type / Class TS | `PascalCase`, số ít           | `ProjectMember`             |
| Biến / hàm TS   | `camelCase`                   | `projectMember`, `isActive` |
| Đường dẫn API   | `kebab-case`, **số nhiều**    | `/api/v1/project-members`   |
| Tên file TS     | `kebab-case` + hậu tố vai trò | `project-member.service.ts` |
| Biến môi trường | `SCREAMING_SNAKE_CASE`        | `JWT_ACCESS_SECRET`         |

Chi tiết ràng buộc naming: [rules/00-nguyen-tac-chung.md](rules/00-nguyen-tac-chung.md) và [rules/03-database-drizzle.md](rules/03-database-drizzle.md).
