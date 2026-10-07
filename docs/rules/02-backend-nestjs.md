---
title: Backend NestJS
description: Quy tắc 5 tầng, DI, DTO, transaction và ranh giới kiến trúc cho apps/api
status: stable
updated: 2026-10-07
owner: Platform Team
---

# 02 — Backend NestJS (`apps/api`)

---

## Phần A. Ranh giới 5 tầng

### A1. Chiều phụ thuộc chỉ đi một hướng 🤖

```
config ◀── common ◀── core ◀── integrations ◀── modules
```

| Tầng           | Được import từ                    | Chứa gì                                                       | Tuyệt đối không chứa        |
| :------------- | :-------------------------------- | :------------------------------------------------------------ | :-------------------------- |
| `config`       | —                                 | Zod env schema, giá trị cấu hình                              | Logic nghiệp vụ             |
| `common`       | `config`                          | Hàm thuần, decorator, DTO dùng chung                          | DB, Redis, HTTP, filesystem |
| `core`         | `config`, `common`                | Drizzle, logger, telemetry, filter, interceptor               | Nghiệp vụ cụ thể            |
| `integrations` | `config`, `common`, `core`        | Outbound adapter (email, thanh toán, lưu trữ... khi bạn thêm) | Quy tắc nghiệp vụ           |
| `modules`      | tất cả tầng trên + `modules` khác | Lát cắt nghiệp vụ                                             | Lời gọi HTTP trực tiếp      |

**Vì sao:** `common` lỡ import `core` là kéo theo cả Drizzle vào mọi unit test của hàm `formatMoney`. Một mũi tên sai chiều làm sập toàn bộ lợi ích của phân tầng.

**Cưỡng chế:** 🤖 `eslint-plugin-boundaries` (xem [01-monorepo-va-tooling.md](../01-monorepo-va-tooling.md)). Vi phạm = CI đỏ.

### A2. Cấm gọi HTTP ra ngoài từ `modules` 🤖

**Quy tắc:** `axios`, `fetch`, `node-fetch` và mọi SDK bên thứ ba (ví dụ Stripe, AWS SDK) **chỉ** được import trong `src/integrations/`.

```javascript
// eslint.config.js
{
  files: ['apps/api/src/modules/**'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        { name: 'axios',  message: 'Gọi hệ thống ngoài phải qua adapter trong src/integrations/.' },
        { name: 'stripe', message: 'Dùng StripeService trong src/integrations/stripe.' },
      ],
      patterns: ['@aws-sdk/*'],
    }],
    'no-restricted-globals': ['error', { name: 'fetch', message: 'Dùng adapter trong src/integrations/.' }],
  },
}
```

### A3. Module nghiệp vụ giao tiếp qua service công khai hoặc event 👀

```typescript
// ❌ Thò tay vào repository của module khác
import { OrderRepository } from '@/modules/orders/order.repository';
// ✅ Dùng service được module đó công bố
import { OrdersService } from '@/modules/orders';
```

Phụ thuộc vòng giữa 2 module ➔ dấu hiệu ranh giới sai. Giải quyết bằng domain event, không bằng `forwardRef`.

---

## Phần B. Controller

### B1. Controller mỏng 👀

Controller chỉ được làm **4** việc: khai báo route, khai báo guard/decorator, validate input, gọi đúng **một** service. Không `if` nghiệp vụ, không truy vấn DB, không gọi 2 service rồi tự ghép kết quả.

```typescript
// ✅
@Post()
@CheckPolicies((a) => a.can('create', 'Project'))
async create(@Body() dto: CreateProjectDto, @CurrentUser() user: UserContext) {
  return this.projectsService.create(dto, user);
}
```

**Cưỡng chế:** 🤖 `max-lines-per-function: 15` cho file `*.controller.ts`.

### B2. Controller không biết tới `Request` / `Response` 🤖

```typescript
// ❌ Buộc phải dựng cả HTTP server mới test được
async find(@Req() req: Request, @Res() res: Response) { res.json(...); }
// ✅ Trả object; TransformInterceptor lo phần envelope
async find(@CurrentUser() user: UserContext) { return this.service.find(user); }
```

**Ngoại lệ:** webhook cần raw body để verify chữ ký — phải kèm comment giải thích.

### B3. Mọi endpoint khai báo OpenAPI 🤖

`@ApiOperation`, `@ApiResponse`, `@ApiTags`. `packages/api-contract` sinh từ spec này; endpoint thiếu decorator ➔ frontend mất type.

**Cưỡng chế:** 🤖 CI kiểm tra spec sinh ra không có `unknown` response.

---

## Phần C. Service

### C1. Service không biết mình đang phục vụ HTTP 👀

Không nhận `Request`, không ném `HttpException`. Ném **lỗi domain**; `GlobalExceptionFilter` map sang mã HTTP.

```typescript
// ❌ throw new NotFoundException('Project not found');
// ✅ throw new ProjectNotFoundError(id);
```

**Vì sao:** service phải dùng lại được từ job nền, CLI command, cron job — những nơi không có HTTP.

### C2. Service nhận và trả type domain, không trả entity DB thô 👀

Không rò rỉ cột nội bộ (`passwordHash`, `internalNote`) ra ngoài. Map ở ranh giới service.

### C3. Không tự khởi tạo phụ thuộc 🤖

```typescript
// ❌ private readonly client = new Redis(process.env.REDIS_URL!);
// ✅ constructor(private readonly redis: RedisService) {}
```

---

## Phần D. Transaction & Database

### D1. Mọi truy vấn nghiệp vụ nằm trong transaction có context 🤖

**Quy tắc:** dùng `TransactionManager`; cấm gọi thẳng `db.select()` trong `modules/`.

**Vì sao:** RLS đọc `app.access_mode` từ session transaction-local. Query ngoài transaction không có context ➔ trả rỗng (fail-closed). Bug này biểu hiện là "dữ liệu biến mất", rất tốn thời gian truy.

```typescript
// ✅
return this.txManager.run({ accessMode: 'tenant', tenantId: user.tenantId }, async (tx) => {
  const project = await tx.query.projects.findFirst({ where: eq(projects.id, id) });
  await tx.update(projects).set({ isPublished: true }).where(eq(projects.id, id));
  return project;
});
```

### D2. Ranh giới transaction đặt ở service, không ở repository 👀

Repository nhận `tx` được truyền vào. Repository tự mở transaction ➔ không thể ghép nhiều thao tác thành một đơn vị nguyên tử.

### D3. Không gọi I/O ngoài bên trong transaction 👀

```typescript
// ❌ Giữ connection DB trong 30 giây chờ dịch vụ ngoài ➔ cạn pool
await this.txManager.run(ctx, async (tx) => {
  const p = await tx.insert(projects).values(dto).returning();
  await this.mailer.sendWelcome(p.id); // ❌
});
// ✅ Commit trước, gọi ngoài sau (hoặc qua outbox)
const project = await this.txManager.run(ctx, (tx) => tx.insert(projects).values(dto).returning());
await this.mailer.sendWelcome(project.id);
```

### D4. Cấm N+1 👀

Dùng `with` của Drizzle hoặc gom thành một truy vấn `inArray`. Vòng lặp chứa `await` truy vấn DB là lỗi review.

---

## Phần E. DTO & Validation

### E1. Validate **mọi** input từ ngoài 🤖

`ValidationPipe` bật `whitelist: true` và `forbidNonWhitelisted: true` ở cấp global — trường không khai báo trong DTO bị loại bỏ, không âm thầm đi tiếp.

### E2. DTO đầu vào ≠ schema DB 👀

Không dùng type suy từ Drizzle làm DTO request. Client không được phép gửi `id`, `tenantId`, `createdAt` — những trường này do server quyết định.

### E3. Không bao giờ tin `tenantId` do client gửi 🤖

**Quy tắc:** `tenantId` **luôn** lấy từ JWT qua `@CurrentUser()`, không bao giờ từ body hay query.

```typescript
// ❌ Tenant A gửi tenantId của B ➔ ghi đè dữ liệu người khác
async create(@Body() dto: { tenantId: string; title: string }) { ... }
// ✅
async create(@Body() dto: CreateProjectDto, @CurrentUser() user: UserContext) {
  return this.service.create(dto, user.tenantId);
}
```

**Cưỡng chế:** 🤖 CI grep cấm trường tên `tenantId` xuất hiện trong file `*.dto.ts` của request.

### E4. Tiền tệ là số nguyên đơn vị nhỏ nhất 🤖

```typescript
// ❌ price: z.number()              // 0.1 + 0.2 = 0.30000000000000004
// ✅ priceMinor: z.number().int()   // VND: 50000 = 50.000₫
```

Chi tiết: [03-database-drizzle.md](03-database-drizzle.md).

---

## Phần F. Module & DI

### F1. Một module nghiệp vụ, một thư mục 👀

```
modules/projects/
├── projects.module.ts
├── projects.controller.ts
├── projects.service.ts
├── projects.repository.ts
├── dto/
├── errors/
└── index.ts          # API công khai duy nhất của module
```

### F2. `exports` là hợp đồng công khai 👀

Chỉ export thứ module khác thực sự cần. Repository **không bao giờ** được export.

### F3. Cấm inject bằng string token trần 🤖

Dùng `Symbol` hoặc hằng số có kiểu, để đổi tên là lỗi compile chứ không phải lỗi runtime.

### F4. Module hạ tầng dùng `forRoot` / `forRootAsync`, nạp đúng một lần tại `AppModule` 👀

---

## Phần G. Logging

### G1. Logger inject qua DI 🤖

Dùng `nestjs-pino`, không `new Logger()` rải rác, không `console.log`.

**Cưỡng chế:** 🤖 `no-console: 'error'` cho `apps/api/src/**`.

### G2. Log có cấu trúc, không nối chuỗi 👀

```typescript
// ❌ logger.log(`Đã tạo đơn ${id} cho tenant ${tenantId}`);
// ✅ logger.info({ orderId: id, tenantId }, 'Đã tạo đơn hàng');
```

**Vì sao:** không lọc được `tenantId` trong log tổng hợp nếu nó bị nhét vào giữa câu.

### G3. Không log dữ liệu nhạy cảm 🤖

Mật khẩu, token, số thẻ, CCCD. Cấu hình `redact` của Pino là lưới an toàn, **không** phải lý do để log bừa. Chi tiết: [07-security.md](07-security.md).
