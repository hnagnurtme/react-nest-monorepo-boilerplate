---
title: Observability & CI/CD
description: Pino structured logging, OpenTelemetry, GitHub Actions
status: draft
updated: 2026-10-07
owner: Platform Team
---

# Kế hoạch Boilerplate 06: Observability, Logging & CI/CD Pipeline

> **Mục tiêu:** Thiết lập hệ thống giám sát phân tán (OpenTelemetry, Pino Structured Logging) và pipeline tự động kiểm thử toàn diện trên GitHub Actions.

---

## 1. Structured Logging với Pino (`nestjs-pino`)

### 1.1 Dynamic Mixin Injection

Mọi log message được xuất ra dưới dạng JSON và tự động inject `traceId` từ W3C context và `tenantId` từ `AsyncLocalStorage`:

```typescript
import { LoggerModule } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import { trace } from '@opentelemetry/api';

export const AppLoggerModule = LoggerModule.forRootAsync({
  inject: [ClsService],
  useFactory: (cls: ClsService) => ({
    pinoHttp: {
      mixin: () => {
        const span = trace.getActiveSpan();
        const traceId = span ? span.spanContext().traceId : cls.get('traceId');
        const tenantId = cls.get('tenantId');
        return { traceId, tenantId };
      },
      redact: ['req.headers.authorization', 'req.headers.cookie', 'body.password'],
      transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
    },
  }),
});
```

---

## 2. OpenTelemetry Tracing

- Tích hợp `@opentelemetry/sdk-node` tại file `src/core/telemetry/tracer.ts`.
- Thực thi khởi động trước khi import bất kỳ NestJS module nào:
  ```typescript
  import { initTracer } from './core/telemetry/tracer';
  initTracer(); // Kích hoạt auto-instrumentation cho HTTP, Express, pg, redis
  ```
- Chuẩn W3C: Tự động trích xuất và truyền `traceparent` header giữa các dịch vụ.

---

## 3. GitHub Actions CI Pipeline (`.github/workflows/ci.yml`)

Pipeline gồm các job sau (`ci-gate` gom kết quả, là check duy nhất cần đặt làm branch protection):

| Job             | Chặn cái gì                                                     | Cưỡng chế quy tắc                                   |
| :-------------- | :-------------------------------------------------------------- | :-------------------------------------------------- |
| `secret-scan`   | Secret lọt vào repo                                             | [rules/07-security.md](rules/07-security.md) A1     |
| `changes`       | Phát hiện phạm vi thay đổi (docs-only thì bỏ qua job code)      | [rules/09-git-va-ci.md](rules/09-git-va-ci.md)      |
| `commitlint`    | Commit không theo Conventional Commits                          | [rules/09-git-va-ci.md](rules/09-git-va-ci.md) B1   |
| `quality`       | Format · Lint (gồm ranh giới kiến trúc)                         | rules 00–04                                         |
| `typecheck`     | Lỗi kiểu TypeScript                                             | [rules/01-typescript.md](rules/01-typescript.md)    |
| `test-unit`     | Unit test và dependency audit                                   | [rules/08-testing.md](rules/08-testing.md)          |
| `integration`   | Lỗi chỉ lộ ra với Postgres thật, kể cả RLS (chạy bằng role app) | [rules/08-testing.md](rules/08-testing.md) C, D     |
| `openapi-drift` | API contract lệch với code                                      | [rules/06-api-design.md](rules/06-api-design.md) F2 |
| `ci-gate`       | Tổng hợp kết quả mọi job                                        | [rules/09-git-va-ci.md](rules/09-git-va-ci.md)      |

File đầy đủ nằm tại [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Các điểm đáng chú ý trong cấu hình:

**1. Integration test chạy bằng role `app`, migration chạy bằng role `owner`.**

```yaml
env:
  MIGRATION_DATABASE_URL: postgres://postgres:postgres@localhost:5432/boilerplate_test
  DATABASE_URL: postgres://boilerplate_app:app@localhost:5432/boilerplate_test
```

> ⚠️ Chạy test bằng role owner sẽ khiến test **xanh trong khi RLS hoàn toàn không hoạt động** — tệ hơn là không có test, vì nó tạo cảm giác an toàn giả.

**2. Cổng RLS coverage — chốt chặn cho việc con người sẽ quên (đề xuất; hiện `ci.yml` chưa có bước này, xem doc 02 mục 2.6).**

```yaml
- name: RLS coverage — không bảng nào bị bỏ sót
  run: |
    MISSING=$(psql "$MIGRATION_DATABASE_URL" -tAc "
      SELECT count(*) FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname='public' AND c.relkind='r'
        AND a.attname='tenant_id' AND a.attnum>0 AND NOT a.attisdropped
        AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);")
    if [ "$MISSING" != "0" ]; then
      echo "::error::Có $MISSING bảng chứa tenant_id chưa bật RLS."
      exit 1
    fi
```

**3. Không job nào được `continue-on-error: true`.** Cổng kiểm tra cho phép thất bại là đồ trang trí. Xem [rules/09-git-va-ci.md](rules/09-git-va-ci.md) E4.

---

## 4. Checklist Thực thi

- [ ] Mọi log ở production là JSON một dòng, có `traceId` và `tenantId`.
- [ ] Gọi 1 request có `Authorization` header ➔ log **không** chứa giá trị token (redact hoạt động).
- [ ] Đăng nhập bằng mật khẩu ➔ grep log không thấy mật khẩu.
- [ ] Một request đi từ `apps/web` ➔ `apps/api` có **cùng** một `traceId`.
- [ ] `/healthz` trả 200 khi process sống; `/readyz` trả 503 khi Postgres hoặc Redis chết.
- [ ] Cố tình push code vi phạm ranh giới tầng ➔ CI fail ở bước lint.
- [ ] Cố tình để 1 lỗi type ➔ CI fail ở bước typecheck.
