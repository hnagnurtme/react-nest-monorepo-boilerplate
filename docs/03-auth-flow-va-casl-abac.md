---
title: Auth & Phân quyền
description: Xác thực web, token rotation, CASL ABAC multi-tenant
status: stable
updated: 2026-10-07
owner: Platform Team
---

# Kế hoạch Boilerplate 03: Xác thực & Phân quyền CASL ABAC Multi-tenant

> **Mục tiêu:** Xây dựng cơ chế xác thực an toàn cho web SPA (access token trong RAM, refresh token trong cookie `httpOnly`), kết hợp phân quyền ABAC dùng chung bằng CASL (`@casl/ability`) trên mô hình multi-tenant.

---

## 1. Mô hình Xác thực

### 1.1 Lưu trữ Token ở Web (`apps/web`)

- Access Token lưu trong bộ nhớ RAM (`Zustand store`, không persist).
- Refresh Token lưu trong **`httpOnly`, `Secure`, `SameSite=Lax` Cookie** (xem mục 1.4) để triệt tiêu nguy cơ XSS trộm token.
- Access token mang các claim: `sub`, `email`, `role`, `tenantId?` (vắng với `PLATFORM_ADMIN`), `jti`. Không có danh sách membership hay cơ chế chuyển tenant: **1 user = 1 tenant**.

### 1.2 Luồng Đăng ký, Đăng nhập & Làm mới Token (`apps/api`)

Các endpoint dưới `/api/v1/auth`: `register`, `verify-email`, `resend-otp`, `login`, `refresh`, `forgot-password`, `reset-password`, `change-password`, `logout`, `logout-all`, `me`.

1. **Đăng ký** (`POST /auth/register`): tạo một tenant tên `"<name>'s workspace"` và user đầu tiên với role `TENANT_ADMIN`, sau đó xác minh email bằng OTP. Việc này chạy trong transaction `admin` mode có `reason` (chưa có tenant context nào để dùng).
2. **Đăng nhập:** backend set cookie `refreshToken=...; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth` và trả body `{ data: { accessToken, user } }`. Refresh token không xuất hiện trong body.
3. **Single-flight Refresh Token Lock (Phía Client):**
   - Khi có nhiều request đồng thời bị `401 Unauthorized`, chỉ cho phép đúng **1 request refresh duy nhất** được gọi lên backend.
   - Các request còn lại xếp hàng đợi và tự động thử lại khi có token mới.

---

### 1.3 Refresh Token Rotation & Reuse Detection

Cất token an toàn (httpOnly cookie) mới giải quyết được **nơi để**, chưa giải quyết **vòng đời**. Không có phần này thì một refresh token bị lộ = 7 ngày toàn quyền.

**Mô hình token family** (bảng `sessions` không có `tenant_id`, chỉ truy cập được ở `admin` mode — xem doc 02):

```
sessions
├─ id            uuid pk
├─ user_id       uuid
├─ family_id     uuid          -- 1 lần đăng nhập = 1 family
├─ token_hash    text          -- SHA-256 của refresh token, KHÔNG lưu token gốc
├─ parent_id     uuid null     -- token trước đó trong chuỗi rotation
├─ used_at       timestamptz null
├─ revoked_at    timestamptz null
├─ expires_at    timestamptz
└─ user_agent, ip_address      -- hiển thị "thiết bị đang đăng nhập"
```

**Luồng `POST /auth/refresh`:**

1. Hash token nhận được, tra trong `sessions`. Không thấy ➔ `401`.
2. **Nếu bản ghi đã có `used_at`** ➔ token đang bị dùng lại. Đây là dấu hiệu token bị đánh cắp:
   - **Thu hồi toàn bộ family** (`UPDATE sessions SET revoked_at = now() WHERE family_id = ...`).
   - Ghi log cảnh báo mức `warn` kèm `userId`, `ip`, `userAgent`.
   - Trả `401`, buộc đăng nhập lại trên mọi thiết bị của family đó.
3. Nếu hợp lệ: đánh dấu `used_at`, phát hành **cặp token mới** cùng `family_id`, `parent_id` trỏ về token vừa dùng.

**Quy tắc bắt buộc:**

- Refresh token là **one-time use**. Không bao giờ trả lại đúng refresh token cũ.
- Chỉ lưu `token_hash`, không lưu token gốc — DB bị lộ thì token vẫn vô dụng.
- `POST /auth/logout` thu hồi 1 family; `POST /auth/logout-all` thu hồi mọi family của user.
- Access token mang `jti` để có thể chặn ngay khi cần (denylist Redis, TTL = thời gian sống còn lại của token).

### 1.4 Lựa chọn `SameSite` cho Refresh Cookie

`SameSite=Strict` an toàn nhất nhưng **cookie sẽ không được gửi kèm khi trình duyệt quay về từ domain khác** — ví dụ redirect trở lại sau OAuth callback. Người dùng vừa trả tiền xong sẽ thấy mình bị đăng xuất.

Quy ước của boilerplate:

| Thuộc tính | Giá trị                          | Lý do                                                  |
| :--------- | :------------------------------- | :----------------------------------------------------- |
| `HttpOnly` | `true`                           | JavaScript không đọc được ➔ XSS không trộm được token  |
| `Secure`   | `true`                           | Chỉ gửi qua HTTPS                                      |
| `SameSite` | `Lax`                            | Sống sót qua redirect trả về từ OAuth / liên kết ngoài |
| `Path`     | `/api/v1/auth`                   | Cookie không bị gửi kèm mọi request API khác           |
| CSRF       | **Bắt buộc** double-submit token | Bù lại phần `Lax` nới lỏng hơn `Strict`                |

Chọn `Lax` **bắt buộc** đi kèm CSRF token — thiếu một trong hai là lỗi bảo mật.

---

## 2. Phân quyền CASL ABAC Dùng Chung (`packages/shared-types`)

### 2.1 Định nghĩa Ability Builder

Đặt tại `packages/shared-types/src/auth/ability.ts`. Mỗi entity nghiệp vụ là một khóa trong `SubjectShapes`; entity thuộc tenant luôn mang `tenantId` để kiểm tra chủ sở hữu bằng `subject('Name', entity)`.

```typescript
export interface SubjectShapes {
  User: { id: string; tenantId?: string };
  Tenant: { id: string };
  // Thêm entity của bạn ở đây, ví dụ: Project: { id: string; tenantId: string };
}

export const USER_ROLES = ['PLATFORM_ADMIN', 'TENANT_ADMIN', 'TENANT_MEMBER'] as const;

export function defineAbilityFor(user: UserContext): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (user.role === 'PLATFORM_ADMIN') {
    can('manage', 'all'); // Platform Admin toàn quyền
    return build();
  }

  const tenantId = user.tenantId;
  if (tenantId === undefined) return build(); // không có tenant ➔ không có quyền

  can('read', 'Tenant', { id: tenantId });
  can('read', 'User', { tenantId });
  can('update', 'User', { id: user.id }); // tự sửa hồ sơ của mình

  if (user.role === 'TENANT_ADMIN') {
    can('update', 'Tenant', { id: tenantId });
    can(['create', 'update', 'delete'], 'User', { tenantId });
  }

  return build();
}
```

`defineAnonymousAbility()` trả ability rỗng cho khách chưa đăng nhập.

---

## 3. Thực thi Phân quyền tại Backend (`apps/api`)

### 3.1 Cạm bẫy số 1 của CASL: kiểm tra ở mức _type_ không đủ

```typescript
// ❌ SAI — tưởng là đã chặn, thực ra không chặn gì cả
@CheckPolicies((ability) => ability.can('update', 'User'))
```

Rule `can('update', 'User', { tenantId })` mang **điều kiện trên thuộc tính**. Khi gọi `ability.can('update', 'User')` với subject là **chuỗi type**, CASL không có instance để so điều kiện ➔ trả `true` nếu tồn tại _bất kỳ_ rule nào cho `User`. Nghĩa là **TENANT_MEMBER vẫn qua được guard ở mức type dù chỉ được sửa hồ sơ của chính mình**.

➔ Guard chỉ là **lớp 1: chặn sớm theo vai trò**. Bắt buộc phải có **lớp 2** sau khi đã load entity.

### 3.2 Lớp 1 — `PoliciesGuard` (chặn sớm, trước khi vào service)

```typescript
@Controller({ path: 'users', version: '1' })
@UseGuards(PoliciesGuard) // JwtAuthGuard là guard toàn cục
export class UsersController {
  @Get()
  @CheckPolicies((ability) => ability.can('read', 'User'))
  list(@Query() query: ListUsersDto) { ... }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'User')) // lớp 1: lọc vai trò không có quyền gì
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) { ... }
}
```

Tác dụng: loại bỏ ngay các vai trò hoàn toàn không có quyền (ví dụ ngữ cảnh không có tenant ➔ `403` mà không tốn một truy vấn DB nào).

### 3.3 Lớp 2 — Kiểm tra trên instance (bắt buộc)

```typescript
import { subject } from '@casl/ability';
import { ForbiddenError } from '@casl/ability';

@Injectable()
export class UsersService {
  async update(actor: AuthContext, id: string, dto: UpdateUserDto) {
    const existing = await this.loadOrThrow(id);

    // ✅ ĐÚNG — CASL so điều kiện { tenantId } / { id } với dữ liệu thật
    this.assertCan(actor, 'update', existing); // dùng subject('User', existing) bên trong

    return this.transactions.runInRequestContext((tx) => this.repository.update(tx, id, toPatch(dto)));
  }
}
```

Service ném domain error (`ForbiddenActionError`, `ResourceNotFoundError`), không ném `HttpException`; `GlobalExceptionFilter` ánh xạ sang RFC 9457.

`subject('User', user)` gắn nhãn type cho object thuần để CASL biết áp rule nào. Thiếu bước này, CASL không nhận diện được object ➔ ném lỗi hoặc trả sai.

### 3.4 Ba lớp phòng thủ độc lập

| Lớp                               | Vị trí           | Chặn được gì                                | Chặn hụt gì                               |
| :-------------------------------- | :--------------- | :------------------------------------------ | :---------------------------------------- |
| 1. `PoliciesGuard`                | Trước controller | Sai vai trò                                 | Sai tenant/chủ sở hữu (không có instance) |
| 2. `throwUnlessCan(subject(...))` | Trong service    | Sai tenant, sai chủ sở hữu                  | Lỗi dev quên gọi                          |
| 3. **Postgres RLS**               | Trong database   | Mọi truy vấn, kể cả khi dev quên lớp 1 và 2 | —                                         |

Lớp 3 là **chốt chặn cuối cùng và là lớp đáng tin nhất** vì nó không phụ thuộc vào việc lập trình viên có nhớ hay không. Xem [02-backend-core-va-drizzle-rls.md](02-backend-core-va-drizzle-rls.md). Hai lớp trên tồn tại để trả về mã lỗi `403` tường minh thay vì `404`/rỗng khó hiểu do RLS lọc mất.

## 4. Thực thi Phân quyền tại Frontend (`apps/web`)

### 4.1 `AbilityProvider` & `<Can>` Component

```tsx
import { createContext, useMemo } from 'react';
import { createContextualCan } from '@casl/react';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { useAuthStore } from '@/features/auth/store';
import { defineAbilityFor, type AppAbility } from '@repo/shared-types';

/** Ability rỗng cho khách chưa đăng nhập — không bao giờ để context là null. */
const anonymousAbility = new AbilityBuilder<AppAbility>(createMongoAbility).build();

export const AbilityContext = createContext<AppAbility>(anonymousAbility);
export const Can = createContextualCan(AbilityContext.Consumer);

export function AbilityProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);

  // useMemo là BẮT BUỘC: thiếu nó, mỗi lần render tạo một object ability mới
  // ➔ context thay đổi tham chiếu ➔ toàn bộ cây <Can> re-render vô ích.
  const ability = useMemo(() => (user ? defineAbilityFor(user) : anonymousAbility), [user]);

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
}
```

Sử dụng trong giao diện:

```tsx
<Can I="create" a="User">
  <Button onClick={openCreateModal}>Thêm người dùng</Button>
</Can>
```

Với kiểm tra trên bản ghi cụ thể, dùng `this` thay vì `a`:

```tsx
<Can I="update" this={subject('User', user)}>
  <Button onClick={openEditModal}>Sửa</Button>
</Can>
```

### 4.2 Frontend authz chỉ là UX, không phải bảo mật

Ẩn nút bấm **không** là biện pháp bảo mật — người dùng vẫn gọi được API bằng `curl`. `<Can>` tồn tại để giao diện không hiển thị hành động sẽ thất bại. Quyền thật sự được thực thi ở backend (mục 3) và database (RLS).

Hệ quả thực tế: **cấm** dùng `<Can>` làm nơi duy nhất quyết định logic nghiệp vụ, và **cấm** đưa dữ liệu nhạy cảm xuống client rồi ẩn bằng CSS/điều kiện render.

---

## 5. Checklist Thực thi

- [ ] Đăng nhập trên web ➔ refresh token nằm trong cookie `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth`, **không** xuất hiện trong response body.
- [ ] Đăng ký ➔ tạo đúng 1 tenant `"<name>'s workspace"` và 1 user `TENANT_ADMIN` thuộc tenant đó.
- [ ] `document.cookie` trong DevTools **không** đọc được refresh token.
- [ ] Gọi `/auth/refresh` 2 lần với **cùng** một refresh token ➔ lần 2 trả `401` **và** toàn bộ family bị thu hồi (kiểm tra `revoked_at` trong bảng `sessions`).
- [ ] Bắn 5 request đồng thời khi access token hết hạn ➔ log xác nhận chỉ có **1** lần gọi `/auth/refresh`.
- [ ] `TENANT_MEMBER` gọi `PATCH /users/:id` với `id` của user khác trong cùng tenant ➔ nhận `403` từ lớp 2.
- [ ] Xóa lớp 2 tạm thời ➔ vẫn không sửa được dữ liệu của tenant khác (chứng minh RLS là chốt chặn độc lập).
- [ ] Bảng `sessions` chỉ chứa `token_hash`, grep toàn bảng không thấy token dạng gốc.
