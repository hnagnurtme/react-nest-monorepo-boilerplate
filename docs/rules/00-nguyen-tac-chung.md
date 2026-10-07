---
title: Nguyên tắc Chung
description: SOLID, naming, readability, error handling áp dụng cho toàn bộ codebase
status: stable
updated: 2026-10-07
owner: Platform Team
---

# 00 — Nguyên tắc Chung

---

## Phần A. SOLID trong ngữ cảnh NestJS + React

SOLID thường bị dạy bằng ví dụ `Animal extends Dog`. Dưới đây là dạng nó thực sự xuất hiện trong codebase này.

### A1. Single Responsibility — một lý do để thay đổi 👀

**Quy tắc:** mỗi class/module chỉ thay đổi khi **một** tác nhân nghiệp vụ thay đổi.

**Vì sao:** `ProjectService` vừa tính giá, vừa gửi email, vừa ghi file Excel thì mỗi lần marketing đổi mẫu email là phải sửa và test lại logic giá.

```typescript
// ❌ Một service, ba lý do để thay đổi
class ProjectService {
  async publish(id: string) {
    const p = await this.repo.findById(id);
    await this.repo.update(id, { isPublished: true });
    await this.mailer.send(p.tenantEmail, renderTemplate('published', p)); // marketing đổi
    await this.excel.appendRow('report.xlsx', p); // kế toán đổi
  }
}

// ✅ Service lo nghiệp vụ, phát sự kiện; người khác lắng nghe
class ProjectService {
  async publish(id: string) {
    await this.repo.update(id, { isPublished: true });
    this.events.emit(new ProjectPublishedEvent(id));
  }
}
```

**Dấu hiệu vi phạm:** mô tả class phải dùng chữ "và"; file service vượt ~300 dòng; import cả `MailerService` lẫn `BillingService` lẫn `ReportService`.

**Cưỡng chế:** 👀 review. (ESLint `max-lines` được cố ý tắt trong `packages/eslint-config`.)

### A2. Open/Closed — mở rộng bằng adapter mới, không sửa code cũ 🤖

**Quy tắc:** thêm nhà cung cấp mới (cổng thanh toán, hãng vận chuyển, provider LLM) phải là **thêm file**, không phải **sửa `switch`**.

```typescript
// ❌ Mỗi lần thêm nhà cung cấp là sửa lại đúng hàm này — nguy cơ hỏng cái đang chạy
async function pay(provider: string, amount: Money) {
  switch (provider) {
    case 'vnpay':
      return payVnpay(amount);
    case 'momo':
      return payMomo(amount);
  }
}

// ✅ Hợp đồng cố định, cài đặt mở
export interface PaymentProvider {
  readonly code: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
}
// integrations/payment/vnpay.provider.ts, momo.provider.ts...
// Thêm nhà cung cấp = thêm 1 file + đăng ký vào module. Không chạm code cũ.
```

**Cưỡng chế:** 🤖 gián tiếp — ESLint cấm `modules/` import `axios`, `node-fetch`, `stripe`, SDK bên thứ ba và `fetch`, buộc phải đi qua adapter ở `integrations/` (job `conventions` của CI cũng grep `axios` trong `modules/`).

### A3. Liskov — implement rồi thì đừng ném "chưa hỗ trợ" 👀

**Quy tắc:** mọi cài đặt của một interface phải dùng thay thế được cho nhau mà caller không cần biết.

```typescript
// ❌ Caller buộc phải biết mình đang cầm provider nào
class CodProvider implements PaymentProvider {
  async refund(): Promise<never> { throw new Error('COD không hỗ trợ hoàn tiền'); }
}

// ✅ Tách khả năng thành interface riêng
interface PaymentProvider { createPayment(...): Promise<PaymentResult>; }
interface RefundablePaymentProvider extends PaymentProvider { refund(...): Promise<RefundResult>; }
```

### A4. Interface Segregation — interface hẹp theo nhu cầu caller 👀

**Quy tắc:** thà 3 interface nhỏ còn hơn 1 interface 20 method mà mỗi nơi chỉ dùng 2.

**Vì sao:** interface rộng làm mọi test phải mock 20 method, và thay đổi ở method không liên quan vẫn buộc mọi implementation sửa theo.

### A5. Dependency Inversion — service phụ thuộc abstraction 🤖

**Quy tắc:** service nghiệp vụ **không bao giờ** `new` một client hạ tầng hay import trực tiếp SDK bên thứ ba. Phụ thuộc được inject qua constructor dưới dạng interface.

```typescript
// ❌ Không test được nếu không có mạng
class ProjectService {
  async describe(id: string) {
    const res = await axios.post('https://ai.domain.com/api/v1/describe', { id });
  }
}

// ✅ Inject qua constructor, test bằng cách thay implementation
class ProjectService {
  constructor(private readonly describer: DescriptionClient) {}
  async describe(id: string) {
    return this.describer.describe({ id });
  }
}
```

**Cưỡng chế:** 🤖 `no-restricted-imports` cấm import `axios` và SDK bên thứ ba trong `modules/` (xem A2); việc inject qua constructor là 👀.

---

## Phần B. Đặt tên

### B1. Tuân thủ bảng thuật ngữ 👀

Mọi tên phải lấy từ [glossary.md](../glossary.md). Thuật ngữ miền là `Tenant`; các từ đồng nghĩa trong cột "Không dùng" của glossary là **cấm**. Thêm entity nghiệp vụ mới ➔ thêm dòng vào glossary.

### B2. Quy ước theo ngữ cảnh 🤖

| Đối tượng                | Quy ước                                            | Ví dụ                                                |
| :----------------------- | :------------------------------------------------- | :--------------------------------------------------- |
| File TS                  | `kebab-case` + hậu tố vai trò                      | `project.service.ts`, `use-projects.ts`              |
| Component React          | `PascalCase.tsx`                                   | `ProjectCard.tsx`                                    |
| Class / Type / Interface | `PascalCase`, **không** tiền tố `I`                | `ProjectRepository`, không phải `IProjectRepository` |
| Biến / hàm               | `camelCase`                                        | `activeTenantCount`                                  |
| Hằng số module-level     | `SCREAMING_SNAKE_CASE`                             | `MAX_UPLOAD_SIZE_BYTES`                              |
| Biến boolean             | tiền tố `is` / `has` / `can` / `should`            | `isPublished`, `canRefund`                           |
| Hàm async trả 1 bản ghi  | `findX` (trả `null`) hoặc `findXOrThrow` (ném lỗi) | `findByIdOrThrow`                                    |
| Enum                     | `PascalCase`, giá trị `SCREAMING_SNAKE_CASE`       | `OrderStatus.AWAITING_PAYMENT`                       |

**Cưỡng chế:** 🤖 `unicorn/filename-case`, `@typescript-eslint/naming-convention`.

### B3. Tên phải nói _cái gì_, không nói _kiểu gì_ 👀

```typescript
// ❌
const userArray = [];
const dataObj = {};
const str = name;
// ✅
const activeTenants = [];
const shippingAddress = {};
const displayName = name;
```

### B4. Đơn vị nằm trong tên 👀

```typescript
// ❌  timeout = 30;  price = 50000;  size = 10;
// ✅  timeoutMs = 30_000;  priceInVndMinorUnits = 50_000;  maxSizeBytes = 10 * 1024 * 1024;
```

**Vì sao:** `timeout = 30` — giây hay mili giây? Đoán sai là lệch 1000 lần.

---

## Phần C. Viết code dễ đọc

### C1. Early return, không lồng sâu 👀

**Quy tắc:** độ sâu lồng tối đa **3**. Vượt quá ➔ tách hàm hoặc dùng early return.

```typescript
// ❌
function process(order) {
  if (order) {
    if (order.isPaid) {
      if (order.items.length > 0) {
        return ship(order);
      }
    }
  }
}
// ✅
function process(order: Order) {
  if (!order.isPaid) throw new OrderNotPaidError(order.id);
  if (order.items.length === 0) throw new EmptyOrderError(order.id);
  return ship(order);
}
```

**Cưỡng chế:** 👀 review (`max-depth` và `complexity` được cố ý tắt trong ESLint config).

### C2. Cấm magic number và magic string 👀

```typescript
// ❌
if (attempts > 5) { ... }
setTimeout(fn, 86400000);
// ✅
const MAX_LOGIN_ATTEMPTS = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
if (attempts > MAX_LOGIN_ATTEMPTS) { ... }
```

**Ngoại lệ được phép:** `0`, `1`, `-1`, và `2` trong ngữ cảnh toán học hiển nhiên; chuỗi thuộc một union literal có kiểu (ví dụ `user.role === 'TENANT_ADMIN'` với `UserRole` từ `@repo/shared-types`) vì compiler đã kiểm tra.

**Cưỡng chế:** 👀 review (`no-magic-numbers` được cố ý tắt trong ESLint config).

### C3. Immutability mặc định 🤖

**Quy tắc:** `const` mặc định; không mutate tham số đầu vào; không mutate state React.

```typescript
// ❌
function addTax(order: Order) {
  order.total += order.total * 0.1;
  return order;
}
// ✅
function withTax(order: Order): Order {
  return { ...order, total: order.total + Math.round(order.total * 0.1) };
}
```

**Vì sao:** mutate tham số làm caller nhận về object đã bị đổi sau lưng — nguồn của loại bug khó tái hiện nhất.

**Cưỡng chế:** 🤖 `prefer-const`, `no-param-reassign` (kèm `props: true`), `react-hooks/exhaustive-deps`.

### C4. Một hàm — một mức trừu tượng 👀

Không trộn lời gọi nghiệp vụ cấp cao với thao tác chuỗi/byte cấp thấp trong cùng một hàm.

### C5. Giới hạn tham số 👀

Quá **3** tham số ➔ gom thành object có tên.

```typescript
// ❌ createOrder(userId, tenantId, items, address, coupon, note, isGift)
// ✅ createOrder(input: CreateOrderInput)
```

**Cưỡng chế:** 👀 review (`max-params` được cố ý tắt trong ESLint config).

---

## Phần D. Comment

### D1. Comment giải thích _vì sao_, không giải thích _cái gì_ 👀

```typescript
// ❌ Tăng biến đếm lên 1
count += 1;

// ✅ VNPay trả về số tiền đã nhân 100; chia lại để về đơn vị VND.
const amountVnd = payload.vnp_Amount / 100;
```

**Vì sao:** code đã nói _cái gì_ rồi. Comment mô tả lại code sẽ lệch pha ngay lần refactor đầu tiên và trở thành thông tin sai.

### D2. Bắt buộc comment ở 4 chỗ 👀

1. Đoạn code trông như thừa/sai nhưng cố ý (workaround, thứ tự bắt buộc).
2. Công thức nghiệp vụ (làm tròn, tính thuế, tỉ giá).
3. Mọi `eslint-disable` — bắt buộc có `-- lý do`.
4. Việc tồn đọng ghi thành issue, không để `TODO` trong code. Nếu buộc phải để, kèm tên người và issue: `// TODO(anh): xử lý refund một phần — #142`.

**Cưỡng chế:** 🤖 `no-warning-comments` cảnh báo mọi comment bắt đầu bằng `todo`/`fixme`; vì CI chạy lint với `--max-warnings=0`, nó thực tế chặn merge.

### D3. Cấm code chết 👀

Code bị comment lại **phải xóa**. Git nhớ hộ rồi.

**Cưỡng chế:** 👀 review (`no-unused-vars`/`@typescript-eslint` bắt biến và import thừa, không bắt code bị comment).

---

## Phần E. Xử lý lỗi

### E1. Không nuốt lỗi 🤖

```typescript
// ❌
try {
  await risky();
} catch (e) {
  /* bỏ qua */
}
// ✅
try {
  await risky();
} catch (error) {
  this.logger.error({ err: error, orderId }, 'Không đồng bộ được đơn hàng');
  throw new OrderSyncFailedError(orderId, { cause: error });
}
```

**Cưỡng chế:** 🤖 `no-empty` (kèm `allowEmptyCatch: false`).

### E2. Lỗi nghiệp vụ là class riêng, không phải string 👀

```typescript
// ❌ throw new Error('Không đủ hàng');
// ✅ throw new InsufficientStockError({ variantId, requested, available });
```

**Vì sao:** exception filter cần `code` ổn định để map sang RFC 9457, và frontend cần `code` để hiển thị thông báo đã dịch. So sánh chuỗi tiếng Việt là không bền.

### E3. Bắt lỗi ở đúng ranh giới 👀

Chỉ bắt lỗi khi **thực sự xử lý được** (retry, fallback, bổ sung ngữ cảnh). Còn lại để `GlobalExceptionFilter` lo.

### E4. `catch (error: unknown)` 🤖

Không giả định `error` là `Error`. Thu hẹp kiểu trước khi đọc `.message`.

**Cưỡng chế:** 🤖 `useUnknownInCatchVariables: true` trong tsconfig.

---

## Phần F. Cấu trúc file

### F1. Một export chính mỗi file 💡

Tên file khớp export chính. `project.service.ts` export `ProjectService`.

### F2. Thứ tự trong file 👀

`import` ➔ `type`/`interface` ➔ hằng số ➔ export chính ➔ hàm phụ.

### F3. Barrel file chỉ ở ranh giới public 👀

`index.ts` chỉ tồn tại ở ranh giới module/feature để khai báo API công khai. **Cấm** barrel trong thư mục nội bộ — nó tạo import vòng và phá tree-shaking.

**Cưỡng chế:** 🤖 `import/no-cycle` và `boundaries/entry-point` (module/feature khác chỉ import qua `index.ts`); việc không tạo barrel nội bộ là 👀.

### F4. Giới hạn kích thước 👀

- File: nên dưới ~300 dòng.
- Hàm: nên dưới ~50 dòng.
- Component React: quá 200 dòng ➔ tách.

**Cưỡng chế:** 👀 review (`max-lines` và `max-lines-per-function` được cố ý tắt trong ESLint config).
