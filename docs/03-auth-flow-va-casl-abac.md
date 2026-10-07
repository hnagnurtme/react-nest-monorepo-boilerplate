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
- Refresh Token lưu trong cookie **`refresh_token`** với `HttpOnly`, `SameSite=Lax`, `Secure` (bật theo `COOKIE_SECURE`; bắt buộc `true` ở production) (xem mục 1.4) để triệt tiêu nguy cơ XSS trộm token.
- Access token mang các claim: `sub`, `email`, `role`, `tenantId?` (vắng với `PLATFORM_ADMIN`), `jti`. Không có danh sách membership hay cơ chế chuyển tenant: **1 user = 1 tenant**.

### 1.2 Luồng Đăng nhập, Làm mới Token & Quản lý Tài khoản (`apps/api`)

Các endpoint dưới `/api/v1/auth`: `login`, `refresh`, `logout`, `logout-all`, `me`, `forgot-password`, `reset-password`, `change-password`.

**Không có tự đăng ký.** Không có `register`, `verify-email`, `resend-otp`; web không có trang đăng ký hay đăng nhập mạng xã hội. Tài khoản chỉ được tạo bởi admin, qua `POST /tenants` (chỉ `PLATFORM_ADMIN`) và `POST /users`:

| Người gọi        | Tạo được                                                            | `tenantId` trong body                                           |
| :--------------- | :------------------------------------------------------------------ | :-------------------------------------------------------------- |
| `PLATFORM_ADMIN` | `PLATFORM_ADMIN` (không tenant), hoặc user bất kỳ trong tenant chọn | bắt buộc với user thuộc tenant; bị từ chối với `PLATFORM_ADMIN` |
| `TENANT_ADMIN`   | `TENANT_ADMIN` / `TENANT_MEMBER` trong **tenant của chính mình**    | tùy chọn; khác tenant trong token ➔ `403`; vắng ➔ lấy từ token  |
| `TENANT_MEMBER`  | không tạo được (`403` ở `PoliciesGuard`)                            | —                                                               |

User mới `isActive = true`, `isEmailVerified = true`, với mật khẩu admin đặt (băm Argon2id). Mỗi lần tạo/sửa/xóa user và tạo/sửa tenant đều ghi `audit_logs` (xem doc 02, mục 5). Email trùng ➔ `409 RESOURCE_CONFLICT`.

0. `POST /auth/refresh` và `/auth/logout` chấp nhận request không có body (trình duyệt không gửi body; token nằm trong cookie `refresh_token`).
1. **Đăng nhập:** backend set hai cookie — `refresh_token` (`HttpOnly; SameSite=Lax; Path=/api/v1/auth`, `Secure` theo `COOKIE_SECURE`) và `csrf_token` (đọc được từ JS, `Path=/`) — rồi trả body `{ data: { accessToken, user, csrfToken } }`. Refresh token không xuất hiện trong body với client web. (Client gửi header `x-client-type: mobile` sẽ nhận `refreshToken` trong body và không có cookie; repo này không có app mobile.)
2. **Quên mật khẩu:** `forgot-password` gửi OTP 6 số qua email (SMTP; không cấu hình SMTP thì OTP chỉ hiện trong log API), hiệu lực 5 phút, cooldown 60 giây; luôn trả cùng một thông báo dù email có tồn tại hay không. `reset-password` kiểm OTP (lưu trong Redis dưới dạng hash, dùng một lần), đổi mật khẩu và **thu hồi mọi session** của user. Chỉ có OTP reset mật khẩu; không còn OTP xác minh email.
3. **Đổi mật khẩu:** `change-password` (cần access token) cũng thu hồi mọi session.
4. **Giới hạn tốc độ** (theo IP, lưu ở Redis): `login` 5/phút, `refresh` 30/phút, `forgot-password` và `reset-password` 5/phút, mặc định 120/phút.
5. **Single-flight Refresh Token Lock (Phía Client):**
   - Khi có nhiều request đồng thời bị `401 Unauthorized`, chỉ cho phép đúng **1 request refresh duy nhất** được gọi lên backend (`apps/web/src/lib/http/refresh.ts`), kèm khóa liên tab bằng `navigator.locks` để hai tab không refresh cùng lúc.
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
├─ token_hash    text          -- HMAC-SHA256 (khóa = JWT_REFRESH_SECRET) của refresh token, KHÔNG lưu token gốc
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
- Refresh token là chuỗi ngẫu nhiên 32 byte (không phải JWT), nên mỗi lần refresh đều là một lần tra DB để phát hiện token đã dùng.
- Access token mang `jti`; `logout` và `logout-all` đưa `jti` của token hiện tại vào denylist Redis (`auth:denylist:<jti>`, TTL = thời gian sống của access token), và `JwtAuthGuard` từ chối token nằm trong denylist.
- `reset-password` và `change-password` thu hồi mọi family của user.

### 1.4 Lựa chọn `SameSite` cho Refresh Cookie

`SameSite=Strict` an toàn nhất nhưng **cookie sẽ không được gửi kèm khi trình duyệt quay về từ domain khác** — ví dụ redirect từ trang thanh toán hay từ một liên kết ngoài. Người dùng sẽ thấy mình bị đăng xuất.

Quy ước của boilerplate:

| Thuộc tính | Giá trị                                      | Lý do                                                     |
| :--------- | :------------------------------------------- | :-------------------------------------------------------- |
| `HttpOnly` | `true`                                       | JavaScript không đọc được ➔ XSS không trộm được token     |
| `Secure`   | `COOKIE_SECURE` (production bắt buộc `true`) | Chỉ gửi qua HTTPS; dev trên `http://localhost` để `false` |
| `SameSite` | `Lax`                                        | Sống sót qua điều hướng từ liên kết ngoài                 |
| `Path`     | `/api/v1/auth`                               | Cookie không bị gửi kèm mọi request API khác              |
| CSRF       | **Bắt buộc** double-submit token             | Bù lại phần `Lax` nới lỏng hơn `Strict`                   |

Chọn `Lax` **bắt buộc** đi kèm CSRF token — thiếu một trong hai là lỗi bảo mật.

**Cách `CsrfMiddleware` hoạt động** (global, `core/middleware/csrf.middleware.ts`): bỏ qua `GET/HEAD/OPTIONS`; nếu request **không có** cookie `csrf_token` thì cho qua (không có session cookie để lợi dụng, ví dụ request bearer thuần hoặc lần đăng nhập đầu); nếu có cookie thì header `x-csrf-token` phải khớp (so sánh constant-time) **và** header `Origin` (nếu có) phải bằng `WEB_ORIGIN`. Hệ quả vận hành: `WEB_ORIGIN` sai ➔ đăng nhập vẫn được nhưng mọi POST/PATCH/DELETE sau đó bị `403 CSRF_VALIDATION_FAILED`; cookie `csrf_token` cũ của dự án khác trên `localhost` gây lỗi tương tự (client web tự xóa cookie và thử lại một lần cho `login`/`refresh`). Xem `setup.md`, mục Troubleshooting.

---

## 2. Phân quyền CASL ABAC Dùng Chung (`packages/shared-types`)

### 2.1 Định nghĩa Ability Builder

Đặt tại `packages/shared-types/src/auth/ability.ts`. Mỗi entity nghiệp vụ là một khóa trong `SubjectShapes`; entity thuộc tenant luôn mang `tenantId` để kiểm tra chủ sở hữu bằng `subject('Name', entity)`. Tóm tắt quyền: `PLATFORM_ADMIN` ➔ `manage all`; `TENANT_ADMIN` ➔ đọc tenant mình, sửa tenant mình, tạo/sửa/xóa/đọc user trong tenant mình; `TENANT_MEMBER` ➔ đọc tenant mình, đọc user trong tenant mình, sửa hồ sơ chính mình.

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
// ❌ SAI cho quyền phụ thuộc điều kiện — tưởng là đã chặn, thực ra không chặn gì cả
@CheckPolicies((ability) => ability.can('update', 'User'))
```

Rule `can('update', 'User', { id: user.id })` mang **điều kiện trên thuộc tính**. Khi gọi `ability.can('update', 'User')` với subject là **chuỗi type**, CASL không có instance để so điều kiện ➔ trả `true` nếu tồn tại _bất kỳ_ rule nào cho `User`. Nghĩa là **TENANT_MEMBER vẫn qua được guard ở mức type dù chỉ được sửa hồ sơ của chính mình**.

➔ Guard chỉ là **lớp 1: chặn sớm theo vai trò**. Bắt buộc phải có **lớp 2** sau khi đã load entity.

### 3.2 Lớp 1 — `PoliciesGuard` (chặn sớm, trước khi vào service)

```typescript
@Controller({ path: 'users', version: '1' })
@UseGuards(PoliciesGuard) // JwtAuthGuard là guard toàn cục
export class UsersController {
  @Get()
  @CheckPolicies((ability) => ability.can('read', 'User'))
  list(@Query() query: ListUsersDto) { ... }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'User')) // TENANT_MEMBER không có rule `create` ➔ 403
  create(@CurrentUser() actor: AuthContext, @Body() dto: CreateUserDto, ...) { ... }

  // GET/PATCH/DELETE :id không gắn @CheckPolicies: quyền phụ thuộc bản ghi cụ thể,
  // nên chỉ lớp 2 (service) mới trả lời được.
}
```

Tác dụng: loại bỏ ngay các vai trò hoàn toàn không có quyền (ví dụ ngữ cảnh không có tenant, hay `TENANT_MEMBER` gọi `POST /users` ➔ `403` mà không tốn một truy vấn DB nào). `tenants` làm tương tự (`POST /tenants` chỉ `PLATFORM_ADMIN` qua được).

### 3.3 Lớp 2 — Kiểm tra trên instance (bắt buộc)

```typescript
import { subject } from '@casl/ability';

@Injectable()
export class UsersService {
  async update(actor: AuthContext, id: string, dto: UpdateUserDto) {
    const existing = await this.loadOrThrow(id); // RLS: user của tenant khác ➔ 404

    // ✅ ĐÚNG — CASL so điều kiện { tenantId } / { id } với dữ liệu thật
    this.assertCan(actor, 'update', existing); // bên trong: ability.can(action, subject('User', {...}))
    // đổi isActive cần quyền `delete` — `TENANT_MEMBER` không tự khóa/mở tài khoản của mình
    if (dto.isActive !== undefined) this.assertCan(actor, 'delete', existing);

    return this.transactions.runInRequestContext(async (tx) => {
      const row = await this.repository.update(tx, id, toPatch(dto));
      await this.audit.record(tx, { actorId: actor.id, action: 'user.update', ... });
      return row;
    });
  }
}
```

Service ném domain error (`ForbiddenActionError`, `ResourceNotFoundError`), không ném `HttpException`; `GlobalExceptionFilter` ánh xạ sang RFC 9457.

`subject('User', user)` gắn nhãn type cho object thuần để CASL biết áp rule nào. Thiếu bước này, CASL không nhận diện được object ➔ ném lỗi hoặc trả sai.

Với `create`, service còn tự tính tenant đích (`resolveTenantId`) từ actor + DTO rồi mới kiểm tra `subject('User', { id: 'new', tenantId })`, vì quyền tạo của `TENANT_ADMIN` bị ràng buộc theo `tenantId`.

### 3.4 Ba lớp phòng thủ độc lập

| Lớp                                    | Vị trí           | Chặn được gì                                | Chặn hụt gì                               |
| :------------------------------------- | :--------------- | :------------------------------------------ | :---------------------------------------- |
| 1. `PoliciesGuard`                     | Trước controller | Sai vai trò                                 | Sai tenant/chủ sở hữu (không có instance) |
| 2. `ability.can(action, subject(...))` | Trong service    | Sai tenant, sai chủ sở hữu                  | Lỗi dev quên gọi                          |
| 3. **Postgres RLS**                    | Trong database   | Mọi truy vấn, kể cả khi dev quên lớp 1 và 2 | —                                         |

Lớp 3 là **chốt chặn cuối cùng và là lớp đáng tin nhất** vì nó không phụ thuộc vào việc lập trình viên có nhớ hay không. Xem [02-backend-core-va-drizzle-rls.md](02-backend-core-va-drizzle-rls.md). Hai lớp trên tồn tại để trả về mã lỗi `403` tường minh thay vì rỗng khó hiểu do RLS lọc mất. Lưu ý quy ước: bản ghi của tenant khác bị RLS ẩn nên service trả `404`, còn `403` dành cho sai vai trò hoặc sai quyền sở hữu trong cùng tenant.

## 4. Thực thi Phân quyền tại Frontend (`apps/web`)

### 4.1 `AbilityProvider` & `CanAction`

Cùng hàm `defineAbilityFor` của backend chạy ở web (`apps/web/src/features/auth/ability/`). User lấy từ store Zustand `entities/session` (access token và user chỉ nằm trong RAM).

```tsx
// ability-context.tsx (rút gọn)
export function AbilityProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);

  // useMemo là BẮT BUỘC: thiếu nó, mỗi lần render tạo một object ability mới
  // ➔ context đổi tham chiếu ➔ toàn bộ cây con re-render vô ích.
  const ability = useMemo<AppAbility>(
    () => (user ? defineAbilityFor(toUserContext(user)) : defineAnonymousAbility()),
    [user],
  );

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
}
```

Sử dụng trong giao diện (`CanAction`, export từ `@/features/auth`):

```tsx
<CanAction I="create" a="User">
  <Button onClick={openCreateUserForm}>{t('actions.create')}</Button>
</CanAction>
```

Với kiểm tra trên bản ghi cụ thể, dùng `this` thay vì `a` (và gắn nhãn bằng `subject('User', user)`):

```tsx
<CanAction I="update" this={subject('User', user)}>
  <Button onClick={openEditModal}>{t('actions.edit')}</Button>
</CanAction>
```

`RouteGuard` (`app/components/route-guard.tsx`) bọc các route cần đăng nhập, nhận `allowedRoles` và/hoặc `checkAbility`.

### 4.2 Frontend authz chỉ là UX, không phải bảo mật

Ẩn nút bấm **không** là biện pháp bảo mật — người dùng vẫn gọi được API bằng `curl`. `<Can>` tồn tại để giao diện không hiển thị hành động sẽ thất bại. Quyền thật sự được thực thi ở backend (mục 3) và database (RLS).

Hệ quả thực tế: **cấm** dùng `<Can>` làm nơi duy nhất quyết định logic nghiệp vụ, và **cấm** đưa dữ liệu nhạy cảm xuống client rồi ẩn bằng CSS/điều kiện render.

---

## 5. Checklist Thực thi

- [ ] Đăng nhập trên web ➔ refresh token nằm trong cookie `refresh_token` (`HttpOnly; SameSite=Lax; Path=/api/v1/auth`, `Secure` ở production), **không** xuất hiện trong response body.
- [ ] Không có route đăng ký: `POST /api/v1/auth/register` trả `404`.
- [ ] `PLATFORM_ADMIN` tạo tenant rồi tạo `TENANT_ADMIN` cho tenant đó; `TENANT_ADMIN` tạo user trong tenant mình thì được, truyền `tenantId` của tenant khác thì nhận `403`; `TENANT_MEMBER` gọi `POST /users` nhận `403`.
- [ ] `document.cookie` trong DevTools **không** đọc được refresh token.
- [ ] Gọi `/auth/refresh` 2 lần với **cùng** một refresh token ➔ lần 2 trả `401` **và** toàn bộ family bị thu hồi (kiểm tra `revoked_at` trong bảng `sessions`).
- [ ] Bắn 5 request đồng thời khi access token hết hạn ➔ log xác nhận chỉ có **1** lần gọi `/auth/refresh`.
- [ ] `TENANT_MEMBER` gọi `PATCH /users/:id` với `id` của user khác trong cùng tenant ➔ nhận `403` từ lớp 2; với `id` của user ở tenant khác ➔ `404` (RLS).
- [ ] Đăng nhập thành công rồi `POST` với `Origin` khác `WEB_ORIGIN` ➔ `403 CSRF_VALIDATION_FAILED`.
- [ ] Xóa lớp 2 tạm thời ➔ vẫn không sửa được dữ liệu của tenant khác (chứng minh RLS là chốt chặn độc lập).
- [ ] Bảng `sessions` chỉ chứa `token_hash`, grep toàn bảng không thấy token dạng gốc.
- [ ] `reset-password` thành công ➔ mọi refresh token cũ của user bị thu hồi.
