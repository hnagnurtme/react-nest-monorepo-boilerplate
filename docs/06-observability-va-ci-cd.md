---
title: Observability & CI/CD
description: Pino structured logging, OpenTelemetry, GitHub Actions CI (repo không có CD)
status: stable
updated: 2026-10-07
owner: Platform Team
---

# Kế hoạch Boilerplate 06: Observability, Logging & CI Pipeline

> **Mục tiêu:** Giám sát phân tán (OpenTelemetry, Pino Structured Logging) và pipeline kiểm thử tự động trên GitHub Actions. Repo này **chỉ có CI**; không có workflow CD (tự thêm pipeline deploy phù hợp hạ tầng của bạn; `apps/api/Dockerfile` build image API).

---

## 1. Structured Logging với Pino (`nestjs-pino`)

### 1.1 Dynamic Mixin & Redact

`core/logger/logger.module.ts`: mọi log được xuất dưới dạng JSON (production) hoặc `pino-pretty` một dòng (dev), và tự động inject `traceId`, `userId`, `tenantId` lấy từ `AsyncLocalStorage` (`nestjs-cls`). `traceId` là W3C trace id gieo vào CLS khi request vào, nên khớp với header `x-trace-id` phía client.

```typescript
mixin: () => ({
  traceId: cls.get(CLS_KEYS.traceId) ?? cls.getId(),
  userId: cls.get(CLS_KEYS.userId),
  tenantId: cls.get(CLS_KEYS.tenantId),
}),
redact: {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
    '*.password', '*.passwordHash', '*.token', '*.accessToken', '*.refreshToken', '*.tokenHash',
  ],
  censor: '[redacted]',
},
```

`redact` là lưới an toàn, không phải lý do để log bừa. **Lưu ý đã biết:** `MailService.sendResetPasswordMail` hiện ghi OTP reset mật khẩu vào log ở mọi môi trường (tiện cho dev khi chưa cấu hình SMTP). Đừng để hành vi này lên production; xem xét bỏ dòng log đó hoặc chỉ bật khi `NODE_ENV !== 'production'`.

---

## 2. OpenTelemetry Tracing

- `src/core/telemetry/tracer.ts` khởi tạo `NodeSDK` với `getNodeAutoInstrumentations()` (HTTP, Express, `pg`, `ioredis`; tắt instrumentation `fs`). File này **phải là import đầu tiên** của `main.ts`: auto-instrumentation vá module lúc require, import sai thứ tự ➔ trace rỗng mà không có lỗi.
- Không đặt `OTEL_EXPORTER_OTLP_ENDPOINT` ➔ span vẫn được tạo (nên `traceId` vẫn có trong log và header) nhưng không xuất đi đâu cả.
- Chuẩn W3C: tự động trích xuất và truyền `traceparent`.
- `/healthz` (liveness, không chạm DB) và `/readyz` (kiểm tra Postgres + Redis, `503` khi một phụ thuộc chết) nằm ngoài tiền tố `/api` và không bị throttle.

---

## 3. GitHub Actions CI Pipeline (`.github/workflows/ci.yml`)

Chạy khi push/PR vào `main` và `develop`. `ci-gate` gom kết quả mọi job và là check duy nhất cần đặt làm branch protection.

| Job             | Chặn cái gì                                                                            | Cưỡng chế quy tắc                                                   |
| :-------------- | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------ |
| `secret-scan`   | Secret lọt vào repo (gitleaks)                                                         | [rules/07-security.md](rules/07-security.md) A1                     |
| `changes`       | Phát hiện phạm vi thay đổi (docs-only thì bỏ qua job code)                             | [rules/09-git-va-ci.md](rules/09-git-va-ci.md)                      |
| `commitlint`    | Commit không theo Conventional Commits (chỉ trên PR)                                   | [rules/09-git-va-ci.md](rules/09-git-va-ci.md) B1                   |
| `quality`       | `format:check` + lint `--max-warnings=0` (gồm ranh giới kiến trúc)                     | rules 00–04                                                         |
| `typecheck`     | Lỗi kiểu TypeScript                                                                    | [rules/01-typescript.md](rules/01-typescript.md)                    |
| `test-unit`     | Unit test và dependency audit (`pnpm audit:ci`)                                        | [rules/08-testing.md](rules/08-testing.md)                          |
| `integration`   | Postgres 16 + Redis 7 thật: migrate (hai lần), integration test bằng role app, RLS     | [rules/08-testing.md](rules/08-testing.md) C, D                     |
| `openapi-drift` | API contract lệch với code                                                             | [rules/06-api-design.md](rules/06-api-design.md) F2                 |
| `conventions`   | Grep nhanh: `timestamp()` thiếu `withTimezone`, `pgEnum`, import `axios` trong modules | [rules/03-database-drizzle.md](rules/03-database-drizzle.md) B2, B6 |
| `ci-gate`       | Tổng hợp kết quả mọi job                                                               | [rules/09-git-va-ci.md](rules/09-git-va-ci.md)                      |

File đầy đủ nằm tại [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Các điểm đáng chú ý:

**1. Integration test chạy bằng role `app`, migration chạy bằng role `owner`.**

```yaml
env:
  MIGRATION_DATABASE_URL: postgres://postgres:postgres@localhost:5432/boilerplate_test
  DATABASE_URL: postgres://boilerplate_app:app@localhost:5432/boilerplate_test
```

> ⚠️ Chạy test bằng role owner sẽ khiến test **xanh trong khi RLS hoàn toàn không hoạt động** — tệ hơn là không có test, vì nó tạo cảm giác an toàn giả.

**2. Migration chạy hai lần.** Lần hai chứng minh `migrate.ts` idempotent (deploy luôn chạy lại trên DB đã có role và bảng).

**3. Chốt chặn RLS nằm trong integration test, không phải một bước shell.** `rls-isolation.integration.spec.ts` (describe `coverage`) kiểm tra mọi bảng `public` đã `ENABLE` + `FORCE` RLS và mỗi bảng tối đa một policy — xem [02-backend-core-va-drizzle-rls.md](02-backend-core-va-drizzle-rls.md) mục 2.6. Không có bước `psql` riêng trong `ci.yml`.

**4. Job `conventions`** là ba lệnh `grep` rẻ tiền (không cần `pnpm install`) bắt những quy ước mà ESLint/test không phủ. Chúng là **các kiểm tra grep duy nhất** của CI; mọi chỗ khác trong tài liệu từng nhắc "CI grep ..." đã được đính chính.

**5. Không job nào được `continue-on-error: true`.** Cổng kiểm tra cho phép thất bại là đồ trang trí. Xem [rules/09-git-va-ci.md](rules/09-git-va-ci.md) E4.

---

## 4. Checklist Thực thi

- [ ] Log ở production là JSON một dòng, có `traceId` và (khi đã đăng nhập) `userId`/`tenantId`.
- [ ] Gọi 1 request có `Authorization` header ➔ log **không** chứa giá trị token (redact hoạt động).
- [ ] Đăng nhập bằng mật khẩu ➔ grep log không thấy mật khẩu.
- [ ] Response lỗi có `traceId` trùng header `x-trace-id` và tìm được dòng log tương ứng.
- [ ] `/healthz` trả 200 khi process sống; `/readyz` trả 503 khi Postgres hoặc Redis chết.
- [ ] Cố tình push code vi phạm ranh giới tầng ➔ CI fail ở bước lint.
- [ ] Cố tình để 1 lỗi type ➔ CI fail ở bước typecheck.
- [ ] Thêm `timestamp('x')` không có `withTimezone` vào schema ➔ job `conventions` fail.
