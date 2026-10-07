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

`.env*` bị `.gitignore`, chỉ `.env.example` được commit, chỉ chứa placeholder cho dev (không phải secret thật).

### A3. Secret khác nhau cho mỗi môi trường và mỗi mục đích 👀

`JWT_ACCESS_SECRET` ≠ `JWT_REFRESH_SECRET` ≠ secret của cookie/CSRF. Lộ một cái không được kéo theo cái còn lại.

### A4. Độ dài tối thiểu cưỡng chế bằng Zod 🤖

```typescript
JWT_ACCESS_SECRET: z.string().min(32),
JWT_REFRESH_SECRET: z.string().min(32),
```

### A5. Không có secret ở phía client 👀

Mọi thứ trong bundle web đều đọc được. Biến `VITE_*` là **công khai** theo định nghĩa.

---

## Phần B. Phân quyền

### B1. Ba lớp độc lập, không lớp nào thay thế lớp nào 👀

| Lớp                            | Chặn             | Ghi chú                                   |
| :----------------------------- | :--------------- | :---------------------------------------- |
| `PoliciesGuard`                | Thiếu permission | Không chặn được sai tenant                |
| `throwUnlessCan(subject(...))` | Sai quyền sở hữu | Phụ thuộc dev nhớ gọi                     |
| **Postgres RLS**               | Mọi thứ          | Chốt chặn cuối, không phụ thuộc con người |

### B2. `ability.can(action, 'TypeName')` không kiểm tra điều kiện 👀

Đây là cạm bẫy nghiêm trọng nhất của CASL. Kiểm tra quyền sở hữu **bắt buộc** dùng `subject('Project', entity)`. Xem [03-auth-flow-va-casl-abac.md](../03-auth-flow-va-casl-abac.md).

### B3. `tenantId` luôn lấy từ hồ sơ của người gọi, không bao giờ từ client 👀 (ngoại lệ: `POST /users` và `POST /roles` cho người dùng platform)

Access token không còn mang `tenantId`: `JwtAuthGuard` nạp tenant từ hồ sơ quyền (DB) và `@CurrentUser()` trả giá trị đó.

### B4. Frontend authz chỉ là UX 👀

Ẩn nút không phải bảo mật. Mọi thứ phải được thực thi lại ở backend.

### B5. Endpoint mặc định là cần xác thực 🤖

`JwtAuthGuard` đăng ký ở cấp global; endpoint công khai phải khai báo `@Public()` **tường minh**.

**Vì sao:** quên thêm guard ➔ endpoint hở. Quên thêm `@Public()` ➔ endpoint bị khóa, phát hiện ngay khi test. Chọn cái hỏng an toàn.

### B6. Quyền đến từ DB; không bao giờ tin claim trong token để phân quyền 👀

Access token chỉ định danh (`sub`, `email`, `jti`). Vai trò, tenant và grant lấy từ `AuthzService.loadProfile` trên mỗi request. Không thêm claim `role`/`tenantId` để "tiết kiệm một lượt đọc": đổi quyền hoặc khóa tài khoản sẽ không còn có hiệu lực ngay.

### B7. Chống leo thang quyền là bất biến, không phải tùy chọn 👀

Không ai cấp hoặc gán nhiều hơn mình đang giữ (`grantsCover`); không ai sửa vai trò của chính mình; tenant luôn còn ít nhất một `TENANT_ADMIN` active; vai trò hệ thống bất biến (kể cả với platform admin). Tenant không bao giờ viết điều kiện CASL: chỉ chọn preset `own_tenant`/`own_record`, còn `any` và mục `platformOnly` dành riêng cho vai trò scope `platform`. Chi tiết: [03-auth-flow-va-casl-abac.md](../03-auth-flow-va-casl-abac.md) mục 2.5, [ADR-0005](../adr/0005-permission-luu-trong-co-so-du-lieu.md).

### B8. Một catalog entry mới phải đi cùng `just db-migrate` 👀

Catalog nằm trong code nhưng được đồng bộ vào DB bởi `migrate.ts`, không phải lúc app khởi động. Thêm entry mà không chạy migrate ➔ entry chưa tồn tại trong `permissions`.

---

## Phần C. Input

### C1. Validate mọi input tại ranh giới 👀

HTTP body/query/param/header, webhook payload, response của service ngoài, dữ liệu đọc từ Redis/S3. Tất cả vào dưới dạng `unknown`, qua Zod mới thành type.

### C2. Cấm nối chuỗi vào SQL 🤖

```typescript
// ❌ db.execute(`SELECT * FROM projects WHERE title = '${search}'`);
// ❌ db.execute(`SELECT set_config('app.tenant_id', '${tenantId}', true)`);
// ✅ db.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
```

**Cưỡng chế:** 🤖 `no-restricted-syntax` cấm template literal trong `db.execute()`.

### C3. Cột sắp xếp và lọc phải whitelist 🤖 (`parseSort`)

`ORDER BY ${req.query.sortBy}` là SQL injection ngay cả khi dùng ORM.

### C4. Chống SSRF khi nhận URL từ người dùng 👀

Cấm IP nội bộ (`127.0.0.0/8`, `10.0.0.0/8`, `169.254.169.254`), cấm chuyển hướng, chỉ cho phép `https`, đặt timeout.

### C5. Giới hạn kích thước body 🤖

`express.json` giới hạn 1MB cho JSON. File lớn đi qua presigned URL.

---

## Phần D. Auth

### D1. Mật khẩu băm bằng Argon2id 🤖

Không MD5, không SHA-256 trần, không bcrypt cho code mới. Tham số tối thiểu: `memoryCost: 19456, timeCost: 2, parallelism: 1`.

### D2. So sánh secret bằng hàm constant-time 👀

`crypto.timingSafeEqual`. Toán tử `===` trên chữ ký làm rò rỉ thông tin qua thời gian phản hồi.

### D3. Access token ngắn hạn, refresh token xoay vòng 👀

Access 15 phút. Refresh one-time-use kèm phát hiện tái sử dụng.

### D4. Rate limit trên endpoint xác thực 🤖

`/auth/login` (5/phút), `/auth/refresh` (30/phút), `/auth/forgot-password`, `/auth/reset-password` (5/phút), theo IP, lưu ở Redis. Hiện **chưa** giới hạn theo tài khoản; chỉ theo IP thì bị vượt qua bằng proxy xoay vòng, hãy thêm nếu cần.

### D5. Thông báo lỗi đăng nhập không tiết lộ tài khoản có tồn tại hay không 👀

```
❌ "Email không tồn tại" / "Mật khẩu sai"
✅ "Email hoặc mật khẩu không đúng"
```

Tương tự, `/auth/forgot-password` **luôn** trả cùng một thông báo, bất kể email có tồn tại.

### D6. Cookie: `HttpOnly` + `Secure` + `SameSite=Lax` + CSRF token 🤖 (`Secure` theo `COOKIE_SECURE`, bắt buộc ở production)

### D7. Thao tác nhạy cảm yêu cầu xác thực lại 👀

Đổi mật khẩu, đổi email, đổi tài khoản nhận payout, xóa tài khoản ➔ nhập lại mật khẩu hiện tại.

---

## Phần E. Logging & Lộ thông tin

### E1. Cấm log dữ liệu nhạy cảm 🤖

Không bao giờ log: mật khẩu (kể cả sai), token, cookie, số thẻ, CVV, CCCD/CMND, khóa API, toàn bộ body của request auth.

**Cưỡng chế:** 🤖 `redact` của Pino (danh sách ở `logger.module.ts`). Không có CI grep log. Lưu ý: OTP reset mật khẩu hiện vẫn được `MailService` ghi vào log (xem doc 06).

### E2. Lỗi trả cho client không chứa chi tiết nội bộ 🤖 (`GlobalExceptionFilter`)

Không stack trace, không câu SQL, không tên bảng, không đường dẫn file. Những thứ đó vào log, kèm `traceId` để đối chiếu.

### E3. Mọi response lỗi có `traceId` 👀

Người dùng báo lỗi kèm `traceId` ➔ tìm được log trong vài giây.

### E4. Ghi audit log cho hành động nhạy cảm 👀

Đã cài đặt cho `user.create|update|delete` và `tenant.create|update` qua `AuditService` (cùng transaction). Hành động nhạy cảm mới (đình chỉ tenant, đổi quyền, ...) phải gọi `AuditService.record`. Bản ghi gồm: ai, làm gì, lúc nào, tenant, giá trị trước/sau (không chứa secret).

---

## Phần F. Upload

### F1. Kiểm tra kiểu file bằng magic bytes, không bằng đuôi file 👀 (chưa có upload)

`.jpg` có thể là bất cứ thứ gì.

### F2. Không bao giờ dùng tên file do người dùng đặt 👀 (chưa có upload)

Sinh UUID. Tên file người dùng gửi có thể chứa `../../etc/passwd` hoặc ký tự điều khiển.

### F3. File người dùng tải lên phục vụ từ domain riêng 👀

HTML/SVG độc hại chạy trên chính domain của bạn = XSS có đầy đủ quyền cookie.

### F4. Presigned URL thời hạn ngắn 👀

Upload 5–15 phút; download 2–5 phút. Không bao giờ để URL vĩnh viễn cho tài liệu riêng tư.

---

## Phần G. Giao tiếp với hệ thống ngoài

### G1. Mọi lời gọi ra ngoài có timeout 👀

Không có timeout = một service ngoài treo kéo sập cả hệ thống.

### G2. Webhook: verify chữ ký trên **raw body** 👀 (chưa có webhook)

Parse JSON rồi serialize lại sẽ đổi bytes ➔ chữ ký không bao giờ khớp. Phải giữ raw body.

---

## Phần H. Dependency

### H1. Lockfile được commit, CI dùng `--frozen-lockfile` 🤖

### H2. Quét lỗ hổng trong CI 🤖

`node scripts/audit.mjs` (qua `just audit` / `pnpm audit:ci`). Lỗ hổng `high`/`critical` ➔ CI đỏ.

### H3. Thêm dependency mới cần lý do trong PR 👀

Kiểm tra: còn được bảo trì không, bao nhiêu dependency con, giấy phép gì. Thư viện 3 dòng thì tự viết.
