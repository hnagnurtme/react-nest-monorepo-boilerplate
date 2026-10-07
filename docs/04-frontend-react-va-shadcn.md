---
title: Frontend Web
description: React 19, Vite, Tailwind v4, shadcn/ui, HTTP client, TanStack Query
status: stable
updated: 2026-10-07
owner: Platform Team
---

# Kế hoạch Boilerplate 04: Frontend React 19, Tailwind v4 & shadcn/ui

> **Mục tiêu:** Xây dựng ứng dụng Web SPA chuẩn mực với React 19, Vite, cấu trúc Feature-first, Tailwind CSS v4, thư viện thành phần shadcn/ui và HTTP client tự động xử lý token.

---

## 1. Cấu trúc Thư mục Feature-First (`apps/web/src/`)

```
src/
├── main.tsx
├── app/                     # Lắp ráp: Providers, Router, Global CSS
│   ├── routes.tsx           # React Router v7 hoặc TanStack Router
│   ├── providers.tsx        # QueryClient, AbilityProvider, ThemeProvider
│   └── styles/
│       └── globals.css      # Tailwind v4 @import "tailwindcss";
│
├── config/                  # Biến môi trường validate bằng Zod
│   └── env.ts
│
├── lib/                     # Hạ tầng kỹ thuật (cấm import features)
│   ├── http/                # Axios client bọc sẵn interceptor
│   ├── query/               # TanStack Query client configuration
│   └── utils.ts             # cn() helper kết hợp clsx & tailwind-merge
│
├── shared/                  # Dùng chung, hoàn toàn không dính nghiệp vụ
│   ├── ui/                  # shadcn/ui primitives (button, dialog, input, table)
│   ├── hooks/               # useDebounce, useMediaQuery
│   └── components/          # PageHeader, DataTable, EmptyState
│
├── entities/                # Domain models dùng chung giữa nhiều features
│   └── user/
│
└── features/                # Từng slice nghiệp vụ độc lập, tự chứa
    ├── auth/                # Login, Register, ForgotPassword, useAuth
    ├── home/                # Trang chủ
    ├── status/              # Trạng thái hệ thống
    └── <feature>/           # Slice nghiệp vụ của bạn (ví dụ users/, projects/)
```

---

## 2. Thiết lập Tailwind CSS v4 & shadcn/ui

### 2.1 Tailwind CSS v4 (`globals.css`)

Không dùng `tailwind.config.js` kiểu cũ, sử dụng cơ chế CSS-first:

```css
@import 'tailwindcss';

@theme {
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}
```

### 2.2 Thành phần shadcn/ui

Cài đặt sẵn các primitive cơ bản thông qua CLI:

- Button, Input, Label, Textarea, Select, Checkbox.
- Dialog, Sheet, DropdownMenu, Tooltip, Popover.
- Table, Badge, Card, Skeleton.
- Sonner (Toaster notification hiện đại).

---

## 3. Tinh chỉnh HTTP Client (`lib/http/httpClient.ts`)

### 3.1 Hai hàm truy cập, không phải một

Backend luôn trả envelope `{ data, meta }`. Nếu client unwrap thẳng `response.data.data` cho mọi lời gọi thì **`meta` bị vứt đi** — và `meta.total` chính là thứ phân trang cần. Vì vậy tách đôi:

```typescript
import { http } from './axios-instance';
import type { ApiResponse, PaginatedData } from '@repo/shared-types';

/** Tài nguyên đơn lẻ — trả thẳng payload, caller không phải viết `.data.data`. */
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await http.get<ApiResponse<T>>(url, config);
  return res.data.data;
}

/** Danh sách phân trang — GIỮ LẠI meta, caller cần total để vẽ pagination. */
export async function getPaginated<T>(url: string, config?: AxiosRequestConfig): Promise<PaginatedData<T>> {
  const res = await http.get<ApiResponse<T[]>>(url, config);
  return { items: res.data.data, meta: res.data.meta };
}
```

Quy tắc: endpoint trả danh sách ➔ **luôn** dùng `getPaginated`. Không có ngoại lệ "danh sách này chắc chắn ngắn" — rồi nó sẽ dài.

### 3.2 Axios instance

```typescript
export const http = axios.create({
  baseURL: env.VITE_API_URL,
  timeout: 15_000, // timeout bắt buộc, không để mặc định vô hạn
  withCredentials: true, // gửi kèm refresh cookie httpOnly
});
```

Các interceptor được gắn:

1. **Auto Authorization Header:** tự lấy `accessToken` từ Zustand store (RAM) gắn vào `Authorization: Bearer <token>`.
2. **Silent Single-flight Refresh Token:**
   - Bắt mã lỗi `401`.
   - Giữ các request tiếp theo trong hàng đợi (`failedQueue`).
   - Gọi `/api/v1/auth/refresh` **đúng 1 lần**.
   - Thử lại toàn bộ request đang chờ với token mới; nếu refresh thất bại ➔ xóa store và điều hướng về `/login`.
   - Không retry request `/auth/refresh` (tránh vòng lặp vô tận).
3. **Chuẩn hóa lỗi RFC 9457:** parse `application/problem+json` thành `AppError { code, title, detail, invalidParams }` để tầng UI chỉ xử lý một kiểu lỗi duy nhất, và map `invalidParams` vào `setError` của react-hook-form.

---

## 4. Quản trị Phân trang & Server State (TanStack Query v5)

- Sử dụng `useQuery` / `useMutation` cho **toàn bộ** server state. Không bao giờ nhân bản dữ liệu server vào Zustand.
- Zustand chỉ giữ client state thuần: access token, trạng thái sidebar, theme.
- Phân trang mượt: dùng `placeholderData: keepPreviousData` (API của v5; `keepPreviousData: true` là cú pháp v4 đã bỏ).

```typescript
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => getPaginated<User>('/api/v1/users', { params }),
    placeholderData: keepPreviousData,
  });
}
```

- **Query key factory** đặt cạnh feature, không rải chuỗi thủ công khắp nơi:

```typescript
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: UserListParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};
```

- Mutation thành công ➔ `invalidateQueries({ queryKey: userKeys.lists() })`, không invalidate toàn bộ cache.

---

## 5. Checklist Thực thi

- [ ] Import sai tầng (`lib/` import từ `features/`) ➔ `pnpm lint` báo lỗi.
- [ ] Import xuyên vào nội bộ feature khác (`features/auth/components/Foo`) ➔ `pnpm lint` báo lỗi.
- [ ] Grep toàn bộ `apps/web/src` không còn đường dẫn `../../`.
- [ ] Trang danh sách hiển thị đúng tổng số bản ghi (chứng minh `meta` không bị nuốt).
- [ ] Chuyển trang 1 ➔ 2 không nhấp nháy về trạng thái loading (`placeholderData` hoạt động).
- [ ] Backend trả `422` với `invalidParams` ➔ lỗi hiển thị đúng dưới từng ô input tương ứng.
- [ ] Access token hết hạn giữa chừng ➔ UI tự phục hồi, người dùng không bị đá về `/login`.
- [ ] Bật chế độ dark mode ➔ mọi shadcn primitive hiển thị đúng, không có màu hard-code.
