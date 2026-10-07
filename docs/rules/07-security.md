---
title: Security
description: Quy tắc bảo mật bắt buộc — secrets, authz, input, logging, upload, dependency
status: stable
updated: 2026-10-07
owner: Platform Team
---

# 07 — Security

> Nguyên tắc nền: **không tin bất cứ thứ gì đến từ bên ngoài process của bạn** — kể cả client của chính mình, kể cả service nội bộ.

---

## Phần A. Secrets

### A1. Không có secret trong mã nguồn 🤖

```typescript
// ❌ const JWT_SECRET = 'super-secret-key-123';
// ❌ const apiKey = process.env.API_KEY || 'sk-fallback-dev-key';   // fallback là secret
// ✅ Đọc từ config đã validate bằng Zod, không có giá trị mặc định
```

**Cưỡng chế:** 🤖 `gitleaks` chạy trong pre-commit hook **và** trong CI.

### A2. `.env` không bao giờ được commit 🤖

Chỉ commit `.env.example` với **tên biến và mô tả**, giá trị để trống.

### A3. Secret khác nhau cho mỗi môi trường và mỗi mục đích 👀

`JWT_ACCESS_SECRET` ≠ `JWT_REFRESH_SECRET` ≠ secret của cookie/CSRF. Lộ một cái không được kéo theo cái còn lại.

### A4. Độ dài tối thiểu cưỡng chế bằng Zod 🤖

```typescript
JWT_ACCESS_SECRET: z.string().min(32),
JWT_REFRESH_SECRET: z.string().min(32),
```

### A5. Không có secret ở phía client 🤖

Mọi thứ trong bundle web đều đọc được. Biến `VITE_*` là **công khai** theo định nghĩa.

---

## Phần B. Phân quyền

### B1. Ba lớp độc lập, không lớp nào thay thế lớp nào 👀

| Lớp                            | Chặn             | Ghi chú                                   |
| :----------------------------- | :--------------- | :---------------------------------------- |
| `PoliciesGuard`                | Sai vai trò      | Không chặn được sai tenant                |
| `throwUnlessCan(subject(...))` | Sai quyền sở hữu | Phụ thuộc dev nhớ gọi                     |
| **Postgres RLS**               | Mọi thứ          | Chốt chặn cuối, không phụ thuộc con người |

### B2. `ability.can(action, 'TypeName')` không kiểm tra điều kiện 🤖

Đây là cạm bẫy nghiêm trọng nhất của CASL. Kiểm tra quyền sở hữu **bắt buộc** dùng `subject('Project', entity)`. Xem [03-auth-flow-va-casl-abac.md](../03-auth-flow-va-casl-abac.md).

### B3. `tenantId` luôn lấy từ JWT, không bao giờ từ client 🤖

### B4. Frontend authz chỉ là UX 👀

Ẩn nút không phải bảo mật. Mọi thứ phải được thực thi lại ở backend.

### B5. Endpoint mặc định là cần xác thực 🤖

`JwtAuthGuard` đăng ký ở cấp global; endpoint công khai phải khai báo `@Public()` **tường minh**.

**Vì sao:** quên thêm guard ➔ endpoint hở. Quên thêm `@Public()` ➔ endpoint bị khóa, phát hiện ngay khi test. Chọn cái hỏng an toàn.

---

## Phần C. Input

### C1. Validate mọi input tại ranh giới 🤖

HTTP body/query/param/header, webhook payload, response của service ngoài, dữ liệu đọc từ Redis/S3. Tất cả vào dưới dạng `unknown`, qua Zod mới thành type.

### C2. Cấm nối chuỗi vào SQL 🤖

```typescript
// ❌ db.execute(`SELECT * FROM projects WHERE title = '${search}'`);
// ❌ db.execute(`SELECT set_config('app.tenant_id', '${tenantId}', true)`);
// ✅ db.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
```

**Cưỡng chế:** 🤖 `no-restricted-syntax` cấm template literal trong `db.execute()`.

### C3. Cột sắp xếp và lọc phải whitelist 🤖

`ORDER BY ${req.query.sortBy}` là SQL injection ngay cả khi dùng ORM.

### C4. Chống SSRF khi nhận URL từ người dùng 👀

Cấm IP nội bộ (`127.0.0.0/8`, `10.0.0.0/8`, `169.254.169.254`), cấm chuyển hướng, chỉ cho phép `https`, đặt timeout.

### C5. Giới hạn kích thước body 🤖

`bodyParser` giới hạn 1MB cho JSON. File lớn đi qua presigned URL.

---

## Phần D. Auth

### D1. Mật khẩu băm bằng Argon2id 🤖

Không MD5, không SHA-256 trần, không bcrypt cho code mới. Tham số tối thiểu: `memoryCost: 19456, timeCost: 2, parallelism: 1`.

### D2. So sánh secret bằng hàm constant-time 🤖

`crypto.timingSafeEqual`. Toán tử `===` trên chữ ký làm rò rỉ thông tin qua thời gian phản hồi.

### D3. Access token ngắn hạn, refresh token xoay vòng 👀

Access 15 phút. Refresh one-time-use kèm phát hiện tái sử dụng.

### D4. Rate limit trên endpoint xác thực 🤖

`/auth/login`, `/auth/refresh`, `/auth/forgot-password`, `/auth/verify-otp`. Giới hạn theo **IP và theo tài khoản** — chỉ theo IP thì bị vượt qua bằng proxy xoay vòng.

### D5. Thông báo lỗi đăng nhập không tiết lộ tài khoản có tồn tại hay không 👀

```
❌ "Email không tồn tại" / "Mật khẩu sai"
✅ "Email hoặc mật khẩu không đúng"
```

Tương tự, `/auth/forgot-password` **luôn** trả cùng một thông báo, bất kể email có tồn tại.

### D6. Cookie: `HttpOnly` + `Secure` + `SameSite=Lax` + CSRF token 🤖

### D7. Thao tác nhạy cảm yêu cầu xác thực lại 👀

Đổi mật khẩu, đổi email, đổi tài khoản nhận payout, xóa tài khoản ➔ nhập lại mật khẩu hiện tại.

---

## Phần E. Logging & Lộ thông tin

### E1. Cấm log dữ liệu nhạy cảm 🤖

Không bao giờ log: mật khẩu (kể cả sai), token, cookie, số thẻ, CVV, CCCD/CMND, khóa API, toàn bộ body của request auth.

**Cưỡng chế:** 🤖 `redact` của Pino + CI grep các pattern quen thuộc trong log mẫu.

### E2. Lỗi trả cho client không chứa chi tiết nội bộ 🤖

Không stack trace, không câu SQL, không tên bảng, không đường dẫn file. Những thứ đó vào log, kèm `traceId` để đối chiếu.

### E3. Mọi response lỗi có `traceId` 👀

Người dùng báo lỗi kèm `traceId` ➔ tìm được log trong vài giây.

### E4. Ghi audit log cho hành động nhạy cảm 👀

Đổi giá, duyệt/từ chối sản phẩm, đổi tài khoản payout, đình chỉ tenant, admin đăng nhập thay người dùng. Bản ghi gồm: ai, làm gì, lúc nào, IP, giá trị trước/sau.

---

## Phần F. Upload

### F1. Kiểm tra kiểu file bằng magic bytes, không bằng đuôi file 🤖

`.jpg` có thể là bất cứ thứ gì.

### F2. Không bao giờ dùng tên file do người dùng đặt 🤖

Sinh UUID. Tên file người dùng gửi có thể chứa `../../etc/passwd` hoặc ký tự điều khiển.

### F3. File người dùng tải lên phục vụ từ domain riêng 👀

HTML/SVG độc hại chạy trên chính domain của bạn = XSS có đầy đủ quyền cookie.

### F4. Presigned URL thời hạn ngắn 👀

Upload 5–15 phút; download 2–5 phút. Không bao giờ để URL vĩnh viễn cho tài liệu riêng tư.

---

## Phần G. Giao tiếp với hệ thống ngoài

### G1. Mọi lời gọi ra ngoài có timeout 🤖

Không có timeout = một service ngoài treo kéo sập cả hệ thống.

### G2. Webhook: verify chữ ký trên **raw body** 🤖

Parse JSON rồi serialize lại sẽ đổi bytes ➔ chữ ký không bao giờ khớp. Phải giữ raw body.

---

## Phần H. Dependency

### H1. Pin version chính xác cho dependency runtime 🤖

Lockfile được commit. CI dùng `--frozen-lockfile`.

### H2. Quét lỗ hổng trong CI 🤖

`pnpm audit --audit-level=high` (qua `just audit`). Lỗ hổng `high`/`critical` ➔ CI đỏ.

### H3. Thêm dependency mới cần lý do trong PR 👀

Kiểm tra: còn được bảo trì không, bao nhiêu dependency con, giấy phép gì. Thư viện 3 dòng thì tự viết.
