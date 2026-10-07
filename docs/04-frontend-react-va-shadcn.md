---
title: Frontend Web
description: React 19, Vite, Tailwind v4, HTTP client, TanStack Query, i18n
status: stable
updated: 2026-10-07
owner: Platform Team
---

# Kế hoạch Boilerplate 04: Frontend React 19 & Tailwind v4

> **Mục tiêu:** Ứng dụng Web SPA với React 19, Vite, cấu trúc Feature-first, Tailwind CSS v4 và HTTP client tự động xử lý token, CSRF và refresh. (Tên file giữ `...-va-shadcn` vì lý do lịch sử; repo **không** dùng shadcn CLI, các primitive trong `shared/ui` được viết tay.)

---

## 1. Cấu trúc Thư mục Feature-First (`apps/web/src/`)

```
src/
├── main.tsx                 # Khởi tạo i18n, token provider, refresh handler; render <App />
├── app/                     # Lắp ráp: Providers, Router, Global CSS
│   ├── app.tsx
│   ├── router.tsx           # React Router v7; mọi route dùng lazy() + <Suspense>
│   ├── providers.tsx        # QueryClient, ToastProvider, AbilityProvider
│   ├── components/          # ErrorBoundary, PageLoader, RouteGuard
│   └── styles/globals.css   # Tailwind v4: @import "tailwindcss"; token trong @theme
│
├── config/                  # Biến môi trường validate bằng Zod (VITE_API_URL, VITE_APP_ENV)
│   └── env.ts
│
├── lib/                     # Hạ tầng kỹ thuật (cấm import features)
│   ├── http/                # client.ts (fetch wrapper), refresh.ts, csrf.ts, types.ts
│   ├── i18n/                # i18next + locales/{en,vi}/*.json
│   └── utils.ts             # cn() = clsx + tailwind-merge
│
├── shared/
│   └── ui/                  # Primitive thuần UI: button, input, checkbox-field, toast, page-loader, ...
│
├── entities/
│   └── session/             # Zustand store: user + access token (RAM), đồng bộ giữa các tab
│
└── features/                # Từng slice nghiệp vụ độc lập, tự chứa
    ├── auth/                # Login, quên/đặt lại/đổi mật khẩu, AbilityProvider, CanAction
    ├── users/               # Danh sách + form tạo user (admin), cập nhật, xóa
    ├── tenants/             # Danh sách + tạo/sửa tenant (PLATFORM_ADMIN)
    ├── home/                # Trang chủ
    └── status/              # Trạng thái hệ thống (healthz/readyz)
```

Không có trang đăng ký và không có đăng nhập mạng xã hội: tài khoản do admin tạo trong UI `users`/`tenants` (hoặc dùng tài khoản seed ở dev, xem `setup.md`).

Một feature có thể có `api/` (hook TanStack Query), `components/`, `hooks/`, `pages/`, `schemas/` (Zod cho form), `endpoints.ts`, `types.ts` và `index.ts` (public API duy nhất). Feature khác chỉ import qua `index.ts`. Route mới nối vào `app/router.tsx` **sau cùng**, kèm `RouteGuard` nếu cần đăng nhập/phân quyền.

---

## 2. Tailwind CSS v4 & `shared/ui`

### 2.1 Tailwind CSS v4 (`globals.css`)

Không dùng `tailwind.config.js`, sử dụng cơ chế CSS-first; plugin `@tailwindcss/vite` ở `vite.config.ts`. Màu, font và cỡ chữ ngoài thang chuẩn đều là token trong `@theme`:

```css
@import 'tailwindcss';

@theme {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --text-2xs: 0.6875rem;
  --text-2xs--line-height: 1rem;

  --color-primary: #006a43;
  --color-background: #ffffff;
  --color-foreground: #151e19;
  --color-destructive: #d32f2f;
  /* ... */
}
```

Dùng utility theo token (`bg-primary`, `text-foreground`, `border-border`, `text-2xs`), không dùng màu/pixel tùy ý. Hiện chỉ có giao diện sáng; chưa có dark mode.

### 2.2 `shared/ui`

Tập primitive nhỏ viết tay (`Button`, `Input`, `CheckboxField`, `SegmentedControl`, `DividerLabel`, `IconText`, `PageLoader`, `ToastProvider`/`useToast`), export qua `shared/ui/index.ts`. Quy tắc: không chứa nghiệp vụ, không import `features`/`entities` (ESLint chặn). Cần biến thể mới ➔ thêm vào primitive (ví dụ bằng `cva` nếu bạn thêm thư viện này) hoặc bọc thành component mới; đừng copy style sang từng feature. Muốn dùng shadcn/ui thì chạy CLI của nó và ghi lại quyết định bằng ADR.

### 2.3 i18n

`lib/i18n/index.ts` cấu hình i18next với namespace `auth`, `users`, ... (file `locales/{en,vi}/<ns>.json`). Ngôn ngữ mặc định là **tiếng Anh** (`en`), có sẵn tiếng Việt. Thêm chuỗi mới ➔ thêm vào **cả hai** locale; dùng `useTranslation('<ns>')` trong component sở hữu nội dung.

---

## 3. HTTP Client (`lib/http/client.ts`)

Client là một wrapper mỏng quanh `fetch` (không dùng axios). Mọi lời gọi API trong `features/entities/shared` **phải** đi qua nó; ESLint cấm `fetch` trần và `axios` ở đó.

### 3.1 Hai hàm truy cập, không phải một

Backend luôn trả envelope `{ data, meta }`. Unwrap thẳng `data` cho mọi lời gọi thì **`meta` bị vứt đi** — mà `meta.total` chính là thứ phân trang cần. Vì vậy tách đôi:

```typescript
// Tài nguyên đơn lẻ: unwrap { data }
const user = await rawRequest<UserResponse>('/api/v1/users/' + id);

// Danh sách phân trang: GIỮ LẠI { data, meta }
const page = await rawPagedRequest<UserListItem>('/api/v1/users', { params: { page, limit } });
```

`apiClient.get/post/put/delete` là biến thể có type chặt: tham số `endpoint` là khóa của `paths` trong `@repo/api-contract`, body và kết quả suy ra từ contract (`lib/http/types.ts`: `ApiRequestBody`, `ApiResponseData`). Quy tắc: endpoint trả danh sách ➔ **luôn** dùng `rawPagedRequest`. Không có ngoại lệ "danh sách này chắc chắn ngắn".

### 3.2 Những gì client tự làm

1. **Authorization:** gắn `Authorization: Bearer <accessToken>` từ store (`setTokenProvider`, gọi ở `main.tsx`).
2. **CSRF:** với `POST/PUT/PATCH/DELETE`, đọc cookie `csrf_token` và gửi header `x-csrf-token` (khớp `CsrfMiddleware` phía API). Nếu `login`/`refresh` nhận `403 CSRF_VALIDATION_FAILED` do cookie cũ, client xóa cookie rồi thử lại đúng một lần.
3. **Silent single-flight refresh:** gặp `401` ➔ gọi `refreshSession()` (`lib/http/refresh.ts`) **đúng 1 lần** dù có nhiều request đồng thời (có khóa liên tab bằng `navigator.locks`), rồi thử lại request gốc một lần; refresh thất bại ➔ `main.tsx` xóa session và phát `broadcastLogout()`. `skipAuthRefresh` ngăn vòng lặp.
4. **Chuẩn hóa lỗi RFC 9457:** non-2xx ném `ApiError { status, code, invalidParams, details }` để UI chỉ xử lý một kiểu lỗi và map `invalidParams` vào `setError` của react-hook-form.
5. `credentials: 'include'` để cookie `refresh_token` được gửi tới `/api/v1/auth/*`.

---

## 4. Server State (TanStack Query v5)

- `useQuery` / `useMutation` cho **toàn bộ** server state. Không bao giờ nhân bản dữ liệu server vào Zustand.
- Zustand chỉ giữ client state thuần: session (user + access token trong RAM). Bộ lọc/phân trang nằm trên URL (`useSearchParams`).
- Hook API đặt ở `features/<x>/api/`, kèm query key factory cùng file, ví dụ:

```typescript
export const usersKeys = {
  all: ['users'] as const,
  list: (page: number, limit: number) => [...usersKeys.all, 'list', page, limit] as const,
};

export function useUsers(page: number, limit: number) {
  return useQuery<UsersPage, ApiError>({
    queryKey: usersKeys.list(page, limit),
    queryFn: async () => {
      const response = await rawPagedRequest<UserListItem>('/api/v1/users', { params: { page, limit } });
      return { items: response.data, meta: response.meta };
    },
  });
}
```

- `QueryClient` mặc định: `staleTime` 60 phút, `retry: 1`, `refetchOnWindowFocus: false` (`app/providers.tsx`). Mutation thành công ➔ `invalidateQueries({ queryKey: <factory>.all })` của đúng feature, không invalidate toàn bộ cache.
- Phân trang mượt: dùng `placeholderData: keepPreviousData` (API của v5; `keepPreviousData: true` là cú pháp v4 đã bỏ) khi cần giữ dữ liệu trang cũ.

---

## 5. Checklist Thực thi

- [ ] Import sai tầng (`lib/` import từ `features/`) ➔ `just lint` báo lỗi.
- [ ] Import xuyên vào nội bộ feature khác (`features/auth/components/foo`) ➔ `just lint` báo lỗi.
- [ ] Không còn đường dẫn `../` trong `apps/web/src` (ESLint `no-restricted-imports`).
- [ ] Trang danh sách hiển thị đúng tổng số bản ghi (chứng minh `meta` không bị nuốt).
- [ ] Backend trả `422` với `invalidParams` ➔ lỗi hiển thị đúng dưới từng ô input tương ứng.
- [ ] Access token hết hạn giữa chừng ➔ UI tự refresh, người dùng không bị đá về `/login`.
- [ ] Hai tab cùng hết hạn token ➔ chỉ một tab gọi `/auth/refresh` (không có `TOKEN_REUSE_DETECTED`).
- [ ] Màu và cỡ chữ lấy từ token `@theme`, không có giá trị hard-code (`bg-[#...]`, `text-[11px]`).
- [ ] Chuỗi mới có mặt ở cả `locales/en` và `locales/vi`.
