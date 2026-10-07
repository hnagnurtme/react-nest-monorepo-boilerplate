---
title: API Design
description: Quy tắc thiết kế endpoint HTTP — naming, versioning, envelope, lỗi, phân trang, idempotency
status: stable
updated: 2026-10-07
owner: Platform Team
---

# 06 — API Design

---

## Phần A. URL & Method

### A1. Tài nguyên là danh từ số nhiều, `kebab-case` 👀

```
❌ POST /api/v1/createProject        ❌ GET /api/v1/getProjectById/:id
✅ POST /api/v1/projects             ✅ GET /api/v1/projects/:id
✅ GET  /api/v1/tenant-payout-accounts
```

Hành động nằm ở HTTP method, không nằm trong URL.

### A2. Ngữ nghĩa method 👀

| Method   | Nghĩa                                    | Idempotent |
| :------- | :--------------------------------------- | :--------- |
| `GET`    | Đọc, **không** đổi trạng thái            | ✅         |
| `POST`   | Tạo mới, hoặc hành động không idempotent | ❌         |
| `PATCH`  | Cập nhật một phần                        | ✅         |
| `PUT`    | Thay thế toàn bộ                         | ✅         |
| `DELETE` | Xóa                                      | ✅         |

**`GET` tuyệt đối không được đổi dữ liệu.** Trình duyệt, CDN và trình prefetch gọi `GET` tự do.

### A3. Lồng cấp tối đa 2 tầng 👀

```
✅ GET /api/v1/tenants/:tenantId/projects
❌ GET /api/v1/tenants/:tenantId/projects/:projectId/variants/:variantId/images
✅ GET /api/v1/variants/:variantId/images
```

### A4. Hành động không map được vào CRUD dùng sub-resource 👀

```
✅ POST /api/v1/orders/:id/cancellation
✅ POST /api/v1/projects/:id/publication
❌ POST /api/v1/orders/:id/doCancel
```

### A5. Version trong path, bắt buộc 👀

Mọi endpoint bắt đầu bằng `/api/v1` (trừ `/healthz`, `/readyz`).

---

## Phần B. Request

### B1. Query param `camelCase` 👀

`?page=1&limit=20&sortBy=createdAt&sortOrder=desc`

### B2. Body là JSON, `camelCase` 👀

`multipart/form-data` chỉ dùng cho upload file.

### B3. Client không được gửi trường do server quyết định 🤖

`id`, `createdAt`, `updatedAt`, `status` (khi có state machine) và `tenantId` (ngoại lệ: `POST /users`, xem 02-backend-nestjs E3). DTO Zod `.strict()` từ chối trường lạ bằng `422`.

### B4. Upload file đi qua presigned URL, không qua API 👀

**Vì sao:** file lớn đi qua API chiếm worker, chiếm RAM và chiếm băng thông của server. Luồng đúng: client xin presigned URL ➔ upload thẳng lên object storage ➔ báo lại key cho API.

---

## Phần C. Response

### C1. Thành công luôn bọc envelope 🤖 (`TransformInterceptor`)

```json
{ "data": { "id": "...", "title": "..." } }
```

```json
{
  "data": [{ "id": "..." }],
  "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 }
}
```

`data` **luôn** có mặt, kể cả khi là `null`. Không bao giờ trả mảng trần ở cấp cao nhất.

**Vì sao trả mảng trần là sai:** không còn chỗ nào để thêm `meta` về sau mà không phá vỡ client hiện có.

### C2. Lỗi luôn theo RFC 9457 🤖 (`GlobalExceptionFilter`)

```json
{
  "type": "https://api.example.com/errors/INSUFFICIENT_STOCK",
  "title": "Insufficient Stock",
  "status": 409,
  "detail": "Biến thể 'Áo thun / L' chỉ còn 2 sản phẩm, yêu cầu 5.",
  "instance": "/api/v1/orders",
  "code": "INSUFFICIENT_STOCK",
  "invalidParams": [{ "name": "items[0].quantity", "reason": "Vượt quá tồn kho khả dụng" }],
  "traceId": "0af7651916cd43dd8448eb211c80319c"
}
```

`Content-Type: application/problem+json`.

### C3. `code` là hợp đồng, `detail` là lời giải thích 👀

- `code`: `SCREAMING_SNAKE_CASE`, **ổn định vĩnh viễn**, dùng để client phân nhánh logic.
- `detail`: văn bản cho người đọc, **được phép đổi bất cứ lúc nào**, không bao giờ dùng để so sánh trong code.

**Vì sao:** so chuỗi tiếng Việt sẽ vỡ ngay khi có người sửa chính tả.

### C4. Mã trạng thái HTTP 👀

| Mã    | Dùng khi                                                        |
| :---- | :-------------------------------------------------------------- |
| `200` | GET / PATCH / PUT thành công                                    |
| `201` | POST tạo mới thành công, kèm header `Location`                  |
| `202` | Đã nhận, xử lý bất đồng bộ (job AI)                             |
| `204` | DELETE thành công, không có body                                |
| `400` | Request sai cú pháp                                             |
| `401` | Chưa xác thực hoặc token hỏng/hết hạn                           |
| `403` | Đã xác thực nhưng **không có quyền**                            |
| `404` | Không tồn tại, **hoặc** tồn tại nhưng người gọi không được biết |
| `409` | Xung đột trạng thái (đơn đã hủy, hết hàng)                      |
| `422` | Đúng cú pháp nhưng sai nghiệp vụ / validation                   |
| `429` | Vượt rate limit, kèm `Retry-After`                              |
| `500` | Lỗi không lường trước — **không bao giờ** rò rỉ stack trace     |

### C5. `403` hay `404`: cân nhắc rò rỉ thông tin 👀

Trả `403` khi truy cập tài nguyên của tenant khác là **xác nhận tài nguyên đó tồn tại**. Với tài nguyên nhạy cảm, trả `404`.

Quy ước: `403` cho lỗi **permission** (người không có grant tương ứng, ví dụ `TENANT_MEMBER`, gọi endpoint quản trị), `404` cho lỗi **quyền sở hữu** (tenant A chạm dữ liệu tenant B).

### C6. Không rò rỉ trường nội bộ 👀

`passwordHash`, `internalNote`, `deletedAt`, cột dùng cho debug. Whitelist ở tầng serialize, không blacklist.

---

## Phần D. Phân trang, lọc, sắp xếp

### D1. Offset pagination là mặc định 👀

`?page=1&limit=20`. `limit` mặc định 20, tối đa **100** — cưỡng chế ở DTO, không tin client.

### D2. Cursor pagination cho danh sách lớn hoặc realtime 💡

`?cursor=<opaque>&limit=20`, trả `meta.nextCursor`. Cursor là **chuỗi opaque** — client không được phép hiểu hay tự dựng.

### D3. Sắp xếp qua `sortBy` + `sortOrder`, whitelist cột 🤖 (`parseSort`)

```
✅ ?sortBy=createdAt&sortOrder=desc
```

Cột sắp xếp **phải** nằm trong danh sách cho phép — nhận chuỗi tùy ý là mở đường cho SQL injection và cho việc quét toàn bảng.

### D4. Lọc qua query param có tên rõ ràng 👀

`?status=PENDING&tenantId=...&createdFrom=2026-01-01`. Không nhồi JSON vào query string.

---

## Phần E. Idempotency & thao tác ghi

### E1. Thao tác ghi tốn kém phải nhận `Idempotency-Key` 👀

Boilerplate chưa có thao tác nào cần (chưa cài đặt cơ chế này). Bắt buộc với thanh toán, hoàn tiền, gửi hàng loạt và mọi thao tác ghi tốn kém bạn thêm vào.

**Vì sao:** mạng di động timeout rồi người dùng bấm lại. Không có idempotency = hai bản ghi, hai lần trừ tiền.

### E2. Webhook phải idempotent 👀 (chưa có webhook)

Cổng thanh toán **sẽ** gửi lặp. Lưu `provider_event_id` với ràng buộc unique; gặp lại ➔ trả `200` và bỏ qua.

### E3. Webhook verify chữ ký trước khi parse body 👀 (chưa có webhook)

Xem [07-security.md](07-security.md).

---

## Phần F. Tài liệu API

### F1. Mọi endpoint có OpenAPI decorator 👀

`@ApiTags`, `@ApiOperation({ summary })`, `@ApiResponse` cho **mọi** mã trạng thái có thể trả.

### F2. `packages/api-contract` sinh tự động, không sửa tay 🤖

File sinh ra được commit để có thể review diff, nhưng CI kiểm tra sinh lại không tạo diff.

### F3. Thay đổi phá vỡ tương thích phải lên version mới 👀

Xóa field, đổi kiểu, đổi ngữ nghĩa `code` ➔ `/api/v2`. Thêm field tùy chọn thì không.
