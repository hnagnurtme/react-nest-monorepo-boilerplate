---
title: Database & Drizzle
description: Quy tắc đặt tên, kiểu dữ liệu, RLS, index và migration
status: stable
updated: 2026-10-07
owner: Platform Team
---

# 03 — Database & Drizzle

---

## Phần A. Đặt tên

### A1. Quy ước 🤖

| Đối tượng  | Quy ước                    | Ví dụ                            |
| :--------- | :------------------------- | :------------------------------- |
| Bảng       | `snake_case`, **số nhiều** | `project_members`                |
| Cột        | `snake_case`, số ít        | `tenant_id`, `is_active`         |
| Khóa chính | luôn là `id`               | `id uuid`                        |
| Khóa ngoại | `<bảng_số_ít>_id`          | `tenant_id`, `project_id`        |
| Index      | `idx_<bảng>_<cột>`         | `idx_projects_tenant_id`         |
| Unique     | `uq_<bảng>_<cột>`          | `uq_tenants_slug`                |
| Check      | `ck_<bảng>_<mô_tả>`        | `ck_projects_price_non_negative` |
| RLS policy | `<bảng>_access_policy`     | `projects_access_policy`         |
| Bảng nối   | ghép 2 tên số nhiều        | `projects_categories`            |

### A2. Cột thời gian có hậu tố `_at`, cột boolean có tiền tố `is_`/`has_` 👀

`created_at`, `archived_at`, `deleted_at` · `is_active`, `has_members`.

### A3. Tên TS suy ra được từ tên DB 🤖

```typescript
export const projectMembers = pgTable('project_members', {
  tenantId: uuid('tenant_id').notNull(), // camelCase ↔ snake_case, 1-1
});
```

Không đổi nghĩa giữa hai phía. `tenantId` trỏ tới `tenant_id`, không phải `owner_id`.

---

## Phần B. Kiểu dữ liệu

### B1. Bảng nào cũng có 3 cột này 🤖

```typescript
id:        uuid('id').primaryKey().defaultRandom(),
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
```

### B2. `timestamptz`, không bao giờ `timestamp` 🤖

**Vì sao:** `timestamp` không mang múi giờ. Server đổi TZ, hoặc có người dùng ở múi giờ khác, là dữ liệu sai lặng lẽ. Luôn lưu UTC, quy đổi ở tầng hiển thị.

**Cưỡng chế:** 🤖 CI grep cấm `timestamp('...')` thiếu `withTimezone: true`.

### B3. Tiền: `bigint` đơn vị nhỏ nhất, kèm mã tiền tệ 🤖

```typescript
// ❌ price: numeric('price', { precision: 12, scale: 2 })  // JS đọc ra thành string hoặc float
// ✅
priceMinor:   bigint('price_minor', { mode: 'bigint' }).notNull(), // VND: 50000 = 50.000₫
currencyCode: char('currency_code', { length: 3 }).notNull().default('VND'),
```

**Vì sao:** `0.1 + 0.2 !== 0.3` trong IEEE-754. Tiền không bao giờ được lưu dưới dạng số thực. Lưu số nguyên đơn vị nhỏ nhất, chia ở tầng hiển thị.

### B4. Khóa chính là `uuid`, không phải `serial` 👀

**Vì sao:** ID tuần tự để lộ khối lượng nghiệp vụ ra ngoài (đối thủ đếm được bạn có bao nhiêu đơn), và tạo va chạm khi merge dữ liệu nhiều nguồn.

### B5. `text` thay cho `varchar(n)` 💡

Postgres không thu lợi gì từ giới hạn độ dài. Ràng buộc độ dài thuộc về Zod ở tầng ứng dụng — nơi sửa được mà không cần migration.

### B6. Enum: cột `text` + `CHECK`, không dùng `pgEnum` 💡

**Vì sao:** `ALTER TYPE ... ADD VALUE` của Postgres không chạy được trong transaction và không thể rollback. Sửa `CHECK` constraint thì dễ hơn nhiều.

### B7. Soft delete dùng `deleted_at`, không dùng `is_deleted` 🤖

Giữ được **thời điểm** xóa. Kèm partial index: `WHERE deleted_at IS NULL`.

---

## Phần C. Ràng buộc toàn vẹn

### C1. Ràng buộc đặt ở DB, không chỉ ở code 👀

```sql
ALTER TABLE projects ADD CONSTRAINT ck_projects_price_non_negative CHECK (price_minor >= 0);
```

**Vì sao:** code ứng dụng không phải con đường duy nhất ghi vào DB — còn migration, script sửa dữ liệu, và tay người trong `psql`. DB là nơi cuối cùng bảo vệ tính đúng đắn.

### C2. Khóa ngoại luôn khai `ON DELETE` tường minh 🤖

```typescript
tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'restrict' }),
```

Mặc định là `NO ACTION` — im lặng và dễ hiểu nhầm. Chọn có ý thức giữa `restrict` / `cascade` / `set null`.

### C3. `NOT NULL` là mặc định 👀

Cho phép `NULL` phải trả lời được: _`NULL` ở cột này nghĩa là gì về mặt nghiệp vụ?_ Không trả lời được ➔ `NOT NULL` kèm `DEFAULT`.

---

## Phần D. RLS

### D1. Mọi bảng có `tenant_id` phải bật RLS 🤖

```sql
ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "<table>" FORCE ROW LEVEL SECURITY;
```

**Cưỡng chế:** 🤖 test CI quét `pg_class` (xem [02-backend-core-va-drizzle-rls.md](../02-backend-core-va-drizzle-rls.md) mục 2.6).

### D2. Đúng **một** policy mỗi bảng 🤖

**Vì sao:** PostgreSQL **OR** các policy PERMISSIVE lại với nhau. Hai policy riêng biệt (ví dụ một cho `tenant`, một cho `admin`) sẽ bị gộp, nên policy thừa mở rộng quyền thay vì thu hẹp và có thể cho tenant này đọc dữ liệu của tenant khác. Đây là lỗi đã từng gây sự cố (xem [ADR-0003](../adr/0003-rls-thay-vi-loc-o-tang-ung-dung.md)) — đừng tái lập.

### D3. Chỉ có hai access mode: `tenant` và `admin` 🤖

Không thêm chế độ `public`/`customer`: nếu cần đọc công khai, hãy thiết kế riêng (view hoặc endpoint dùng `admin` mode có `reason`) và ghi ADR. Mỗi lần dùng `admin` phải truyền `reason` để có dấu vết.

### D4. Mọi cột dùng trong policy phải có index 👀

Policy chạy trên **mọi** truy vấn tới bảng đó. Thiếu index trên `tenant_id` là seq scan toàn bảng ở mọi request.

### D5. Mỗi bảng có RLS phải có integration test cách ly 🤖

Seed 2 tenant, assert tenant A không đọc/ghi được dữ liệu B ở cả 3 access mode. Xem [08-testing.md](08-testing.md).

---

## Phần E. Index

### E1. Mọi khóa ngoại có index 🤖

Postgres **không** tự tạo index cho khóa ngoại (khác MySQL). Thiếu nó thì mọi `JOIN` và mọi lần xóa bản ghi cha đều quét toàn bảng.

### E2. Index khớp với cách truy vấn thật, không đoán 👀

Thêm index kèm output `EXPLAIN ANALYZE` trong PR.

### E3. Index tổ hợp: cột lọc bằng `=` đứng trước 👀

```sql
CREATE INDEX idx_projects_tenant_created ON projects (tenant_id, created_at DESC);
```

### E4. Cấm index dư thừa 👀

Đã có `(tenant_id, created_at)` thì `(tenant_id)` là thừa — Postgres dùng được tiền tố trái. Index thừa làm chậm mọi thao tác ghi.

---

## Phần F. Migration

### F1. Migration do `drizzle-kit` sinh, sửa tay có kiểm soát 👀

Sinh bằng `pnpm db:generate`. Được phép sửa file SQL để thêm RLS policy, `CHECK`, backfill — nhưng **luôn đọc lại toàn bộ** file trước khi commit.

### F2. Migration đã merge là bất biến 🤖

Không bao giờ sửa migration đã lên `main`. Sai ➔ viết migration mới sửa đè.

### F3. Thay đổi phá vỡ tương thích phải theo expand/contract 👀

Đổi tên cột `name` ➔ `display_name` cần **3** lần deploy:

| Giai đoạn   | Migration                                            | Code                               |
| :---------- | :--------------------------------------------------- | :--------------------------------- |
| 1. Expand   | Thêm `display_name`, backfill, trigger đồng bộ 2 cột | Ghi cả hai, đọc `name`             |
| 2. Migrate  | —                                                    | Đọc `display_name`, vẫn ghi cả hai |
| 3. Contract | Xóa `name` và trigger                                | Chỉ dùng `display_name`            |

**Vì sao:** trong lúc rolling deploy, phiên bản cũ và mới cùng chạy trên một DB. Migration một nhịp sẽ làm sập phiên bản cũ.

### F4. Migration phải chạy ngược được hoặc an toàn tuyệt đối 👀

`DROP COLUMN` / `DROP TABLE` là **không hồi phục được**. Chỉ thực hiện ở giai đoạn Contract, sau khi đã xác nhận không còn code nào đọc, và đã có backup.

### F5. Backfill dữ liệu lớn chạy theo lô 👀

`UPDATE` 10 triệu dòng trong một câu sẽ khóa bảng và làm sập projection. Chia lô theo `id`, ngủ giữa các lô.

### F6. Migration chạy bằng role `owner`, ứng dụng chạy bằng role `app` 🤖

`DATABASE_URL` và `MIGRATION_DATABASE_URL` là hai biến khác nhau. Dùng chung là mở đường cho ứng dụng bỏ qua RLS.
