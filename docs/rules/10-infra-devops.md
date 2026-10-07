---
title: Infra & DevOps
description: Quy tắc Docker, cấu hình môi trường, triển khai, migration và vận hành
status: draft
updated: 2026-10-07
owner: Platform Team
---

# 10 — Infra & DevOps

---

## Phần A. Cấu hình

### A1. Cấu hình đến từ biến môi trường, không từ file được commit 🤖

Nguyên tắc 12-factor. Một artifact build chạy được ở mọi môi trường.

### A2. Validate toàn bộ env lúc khởi động, fail-fast 🤖

Thiếu biến ➔ `process.exit(1)` kèm bảng lỗi rõ ràng. **Không** chạy nửa vời rồi hỏng lúc 3 giờ sáng.

### A3. Cấm giá trị mặc định cho biến bảo mật 🤖

```typescript
// ❌ JWT_SECRET: z.string().default('dev-secret')   // sẽ theo lên production
// ✅ JWT_SECRET: z.string().min(32)                 // thiếu là crash
```

### A4. `.env.example` luôn đồng bộ với schema 🤖

Thêm biến vào Zod schema ➔ thêm vào `.env.example` trong cùng PR. CI kiểm tra hai bên khớp nhau.

---

## Phần B. Docker

### B1. Multi-stage build 👀

Image production không chứa devDependencies, source TS, hay công cụ build.

### B2. Không chạy bằng `root` 🤖

```dockerfile
RUN addgroup -S app && adduser -S app -G app
USER app
```

### B3. Pin base image theo digest 👀

`node:20-alpine` thay đổi theo thời gian ➔ build không tái lập được.

### B4. Không có secret trong image 🤖

`ARG` và `ENV` lúc build đều nằm trong lịch sử layer, ai kéo image về cũng đọc được.

### B5. Có `HEALTHCHECK` 👀

### B6. `.dockerignore` đầy đủ 🤖

`node_modules`, `.git`, `.env`, `dist`, `coverage`.

---

## Phần C. Triển khai

### C1. Một artifact, nhiều môi trường 👀

- **Frontend (`apps/web`)**: Phân phối và hosting trực tiếp qua Cloudflare Pages (tự động theo dõi git branch).
- **Backend (`apps/api`)**: Build Docker image một lần và phát hành lên **GitHub Container Registry (GHCR)** qua workflow CD. Production chạy bằng `docker-compose.prod.yml` (service `api` + `cloudflared`); API không publish port ra host, chỉ truy cập được qua **Cloudflare Tunnel**.
  - Merge `develop`: tag `develop`, `sha-<commit>` (Staging).
  - Merge `main` / Tag `v*`: tag `latest`, `<version>`, `sha-<commit>` (Production).
- Build một lần, promote artifact qua staging rồi production. Build lại cho từng môi trường nghĩa là thứ đã test không phải thứ đang chạy.

### C2. Rolling deploy, zero-downtime 👀

Kéo theo: hai phiên bản code cùng chạy trên một DB trong vài phút ➔ **bắt buộc** migration expand/contract (xem [03-database-drizzle.md](03-database-drizzle.md)).

### C3. Migration chạy tách biệt, trước khi deploy code mới 👀

Không chạy migration trong lệnh khởi động container — nhiều replica sẽ chạy đồng thời.

### C4. Có đường rollback đã kiểm chứng 👀

"Deploy lại phiên bản cũ" chỉ hợp lệ nếu schema DB vẫn tương thích ngược.

### C5. Graceful shutdown 🤖

Nhận `SIGTERM` ➔ ngừng nhận request mới, hoàn tất request đang chạy, đóng pool DB, rồi thoát. Thiếu bước này, mỗi lần deploy là một số người dùng nhận lỗi.

---

## Phần D. Vận hành

### D1. `/healthz` và `/readyz` là hai thứ khác nhau 🤖

| Endpoint   | Trả lời                         | Ai dùng                                        |
| :--------- | :------------------------------ | :--------------------------------------------- |
| `/healthz` | Process còn sống?               | Liveness probe — fail ➔ **restart**            |
| `/readyz`  | Phụ thuộc (DB, Redis) sẵn sàng? | Readiness probe — fail ➔ **ngừng đẩy traffic** |

**Vì sao phải tách:** nếu `/healthz` kiểm tra cả DB, thì Postgres chết một phút sẽ làm **mọi** container bị restart liên tục — biến sự cố nhỏ thành sự cố lớn.

### D2. Log ra stdout, không ghi file 👀

Việc thu gom thuộc về hạ tầng.

### D3. Cảnh báo dựa trên triệu chứng người dùng cảm nhận được 💡

Cảnh báo theo tỉ lệ lỗi và độ trễ p99, không theo CPU. CPU 90% mà người dùng vẫn mượt thì không phải sự cố.

### D4. Mỗi cảnh báo phải có runbook 👀

Cảnh báo không kèm hướng dẫn xử lý thì người trực chỉ biết nhìn.

---

## Phần E. Dữ liệu

### E1. Backup tự động, và **kiểm chứng khôi phục được** 👀

**Vì sao:** backup chưa từng thử restore không phải là backup. Đặt lịch diễn tập khôi phục định kỳ.

### E2. Point-in-time recovery cho production 👀

### E3. Không dùng dữ liệu production cho môi trường dev 🤖

Cần dữ liệu thật ➔ ẩn danh trước (email, số điện thoại, địa chỉ, thông tin thanh toán).

### E4. Quyền truy cập DB production theo nguyên tắc tối thiểu 👀

Không ai dùng role `owner` cho công việc hàng ngày. Truy vấn phân tích dùng `readonly`.

---

## Phần F. Mạng

### F1. Chỉ mở port thực sự cần 🤖

Mặc định `deny incoming`. Postgres và Redis **không bao giờ** lộ ra Internet.

### F2. Không publish port của API ra host 👀

Traffic vào qua Cloudflare Tunnel (`cloudflared`), nên không cần mở port inbound nào; API chỉ nằm trong mạng nội bộ của compose.

### F3. TLS ở mọi nơi, kể cả giữa các service nội bộ 🤖

### F4. Chứng chỉ tự động gia hạn, kèm cảnh báo sắp hết hạn 👀

Chứng chỉ hết hạn là nguyên nhân downtime phổ biến và hoàn toàn tránh được.

---

## Phần G. Chi phí

### G1. Mọi tài nguyên có tag `env` và `project` 💡

### G2. Đặt hạn mức chi tiêu cho dịch vụ trả phí theo mức dùng 🤖

Một vòng lặp retry hỏng có thể đốt hết ngân sách trong một đêm. Đặt hạn mức cứng ở phía provider, không chỉ cảnh báo.
