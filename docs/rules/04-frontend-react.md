---
title: Frontend React
description: Quy tắc cấu trúc, component, state, data fetching và styling cho apps/web
status: stable
updated: 2026-10-07
owner: Platform Team
---

# 04 — Frontend React (`apps/web`)

---

## Phần A. Ranh giới thư mục

### A1. Chiều phụ thuộc 🤖

```
app ──▶ features ──▶ entities ──▶ shared ──▶ lib ──▶ config
```

| Tầng       | Được import từ     | Chứa gì                                                  |
| :--------- | :----------------- | :------------------------------------------------------- |
| `config`   | —                  | Biến môi trường đã validate bằng Zod                     |
| `lib`      | `config`           | Hạ tầng kỹ thuật: http client, query client, `cn()`      |
| `shared`   | `lib`, `config`    | UI primitive, hook dùng chung — **không dính nghiệp vụ** |
| `entities` | `shared` trở xuống | Domain model dùng chung nhiều feature                    |
| `features` | tất cả tầng trên   | Lát cắt nghiệp vụ tự chứa                                |
| `app`      | tất cả             | Lắp ráp: provider, router, layout                        |

**Cưỡng chế:** 🤖 `eslint-plugin-boundaries`.

### A2. Feature không import ruột feature khác 🤖

```typescript
// ❌ import { OrderTable } from '@/features/orders/components/OrderTable';
// ✅ import { OrderTable } from '@/features/orders';
```

Hai feature cần dùng chung một thứ ➔ đẩy xuống `entities` hoặc `shared`, **không** import chéo.

### A3. Cấu trúc bên trong một feature 👀

```
features/projects/
├── index.ts              # API công khai duy nhất
├── api/                  # hook gọi API + query key factory
├── components/
├── hooks/
├── schemas/              # Zod schema cho form
└── types.ts
```

### A4. `shared/` phải sạch nghiệp vụ 🤖

`shared/ui/Button.tsx` không được biết tới `Project`. Component nào nhắc tên thực thể nghiệp vụ thì thuộc về `features/` hoặc `entities/`.

### A5. Shared primitive trước, feature compose sau 👀

Nếu nhiều feature hoặc nhiều component cùng lặp lại một hình dạng UI, tạo primitive ở `shared/ui` hoặc asset ở `shared/icons` rồi để feature truyền text, icon và handler vào.

```tsx
// ❌ Feature tự copy cùng một button style ở nhiều nơi
<button className="border-border bg-card text-foreground hover:bg-muted ...">Export</button>

// ✅ Shared primitive giữ hình dạng; feature giữ nội dung/nghiệp vụ
<Button variant="outline" size="xs">
  <DownloadIcon />
  {t('actions.export')}
</Button>
```

`shared/icons` chỉ chứa icon/brand asset không biết nghiệp vụ. Màu hard-code chỉ được chấp nhận trong brand asset cố định như logo của đối tác; màu UI còn lại phải đi qua token trong `@theme`.

---

## Phần B. Component

### B1. Function component + hook, không class 🤖

### B2. Giới hạn kích thước 🤖

Component quá **200 dòng** ➔ tách. Quá **5 mức JSX lồng nhau** ➔ tách.

### B3. Một component đáng kể, một file 👀

**Quy tắc:** mỗi component được export, được reuse, có props riêng, hoặc vượt khoảng **40 dòng** nên nằm trong file riêng đặt tên theo vai trò: `login-form.tsx`, `password-input.tsx`, `project-card.tsx`.

Component helper rất nhỏ, không export và chỉ phục vụ đúng một component cha có thể đặt cùng file, nhưng khi file bắt đầu có nhiều component có tên riêng thì tách ra để review và test dễ hơn.

**Lưu ý:** tách file giúp đọc hiểu và ownership rõ hơn, **không** phải tối ưu render performance. Performance đến từ state đúng chỗ, selector hẹp, code-splitting, virtualization và đo bằng profiler.

### B4. Tách logic ra custom hook khi JSX bị lấp 👀

```tsx
// ❌ 80 dòng logic rồi mới tới return
// ✅
function ProjectList() {
  const { projects, isLoading, filters, setFilters } = useProjectList();
  if (isLoading) return <ProjectListSkeleton />;
  return <DataTable data={projects} onFilter={setFilters} />;
}
```

### B5. Props tường minh, để TS suy return của component 👀

```tsx
// ❌ const Card: React.FC<Props> = ({ title }) => ...
// ✅
interface ProjectCardProps { project: Project; onSelect?: (id: string) => void }
export function ProjectCard({ project, onSelect }: ProjectCardProps) { ... }
```

Không dùng `React.FC`. Với component `.tsx`, ưu tiên để TypeScript suy return type thay vì viết `React.JSX.Element` ở mọi nơi; annotation này thường chỉ thêm nhiễu và khiến diff nặng hơn khi component chuyển sang trả `null`, `string`, `children` hoặc fragment.

Ngoại lệ: hook, util, service, factory và hàm export trong file `.ts` vẫn khai báo return type tường minh theo [01-typescript.md](./01-typescript.md#c4-suy-ra-kiểu-ở-nơi-hiển-nhiên-khai-báo-tường-minh-ở-ranh-giới). Component wrapper/pass-through dùng `ReactNode` cho prop `children`, không dùng nó làm return type trừ khi thật sự trả trực tiếp `children`.

### B6. Cấm `index` làm `key` khi danh sách thay đổi thứ tự 🤖

**Vì sao:** React ghép nhầm state giữa các phần tử — người dùng gõ vào ô này, chữ nhảy sang dòng khác sau khi sắp xếp lại.

**Cưỡng chế:** 🤖 `react/no-array-index-key`.

### B7. Mỗi trạng thái đều phải có giao diện 👀

Bốn trạng thái bắt buộc xử lý: **loading**, **empty**, **error**, **success**. Thiếu `empty` là lỗi review — màn hình trắng không giải thích gì là lỗi UX thường gặp nhất.

---

## Phần C. State

### C1. Bốn loại state, bốn công cụ 👀

| Loại                  | Công cụ        | Ví dụ                            |
| :-------------------- | :------------- | :------------------------------- |
| Server state          | TanStack Query | Danh sách sản phẩm, chi tiết đơn |
| Client state toàn cục | Zustand        | Access token, theme, sidebar     |
| State cục bộ          | `useState`     | Dialog đang mở, tab đang chọn    |
| State trên URL        | search params  | Bộ lọc, trang, từ khóa           |

### C2. Cấm nhân bản server state vào Zustand 🤖

```typescript
// ❌ Hai nguồn sự thật ➔ lệch nhau, và bạn phải tự viết lại cache invalidation
const useProjectStore = create((set) => ({ projects: [], fetchProjects: async () => { ... } }));
// ✅
const { data: projects } = useQuery({ queryKey: projectKeys.list(f), queryFn: ... });
```

### C3. Bộ lọc và phân trang sống trên URL 👀

**Vì sao:** người dùng cần copy link gửi đồng nghiệp, cần F5 không mất bộ lọc, cần nút Back hoạt động đúng.

### C4. Zustand: selector hẹp 🤖

```typescript
// ❌ const { user } = useAuthStore();            // re-render khi BẤT KỲ field nào đổi
// ✅ const user = useAuthStore((s) => s.user);
```

---

## Phần D. Data fetching

### D1. Mọi lời gọi API đi qua `lib/http` 🤖

Cấm `fetch` trần và `axios` trực tiếp trong component — bỏ qua auth header, refresh token và chuẩn hóa lỗi.

### D2. Endpoint danh sách dùng `getPaginated` 👀

`get()` nuốt mất `meta` ➔ không vẽ được pagination. Xem [04-frontend-react-va-shadcn.md](../04-frontend-react-va-shadcn.md).

### D3. Query key factory, không viết chuỗi thủ công 🤖

```typescript
// ❌ useQuery({ queryKey: ['projects', page, search] })   // sai chính tả ở một nơi = cache không bao giờ khớp
// ✅ useQuery({ queryKey: projectKeys.list({ page, search }) })
```

### D4. Invalidate hẹp nhất có thể 👀

```typescript
// ❌ queryClient.invalidateQueries();                                  // refetch toàn bộ app
// ✅ queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
```

### D5. Hook gọi API nằm trong `features/<x>/api/`, không nằm trong component 👀

### D6. Mutation phải xử lý lỗi 🤖

`onError` bắt buộc — ít nhất là một toast. Mutation thất bại trong im lặng làm người dùng bấm lại nhiều lần.

---

## Phần E. Form

### E1. `react-hook-form` + Zod resolver 👀

Cấm form điều khiển bằng `useState` cho mỗi ô input.

### E2. Zod schema của form đặt trong `features/<x>/schemas/` và dùng lại được với backend 💡

### E3. Map `invalidParams` từ RFC 9457 vào lỗi từng field 👀

```typescript
onError: (error: AppError) => {
  error.invalidParams?.forEach((p) => form.setError(p.name, { message: p.reason }));
};
```

### E4. Vô hiệu hóa nút submit khi đang gửi 🤖

Chống double-submit tạo hai đơn hàng.

---

## Phần F. Styling

### F1. Tailwind utility là mặc định 👀

`styled-components`, CSS module, file `.css` riêng: chỉ khi thật sự cần (animation phức tạp, `@layer` toàn cục).

### F2. Cấm màu hard-code 🤖

```tsx
// ❌ <div className="bg-[#1a1a1a] text-[#fff]">   // hỏng ở dark mode
// ✅ <div className="bg-background text-foreground">
```

Màu **chỉ** được lấy từ token khai trong `@theme`.

**Cưỡng chế:** 🤖 `tailwindcss/no-arbitrary-value` giới hạn cho nhóm màu.

### F2b. Token thay cho pixel tuỳ ý 👀

Tailwind spacing mặc định như `p-4`, `h-4`, `py-2.5` đã là `rem`. Không thay chúng bằng pixel thủ công. Với kích thước chữ/spacing ngoài thang Tailwind, khai token trong `@theme` trước rồi dùng utility token.

```css
@theme {
  --text-2xs: 0.6875rem;
  --text-2xs--line-height: 1rem;
}
```

```tsx
// ❌ <span className="text-[11px]" />
// ✅ <span className="text-2xs" />
```

### F3. Ghép class bằng `cn()` 🤖

Nối chuỗi thủ công làm class Tailwind xung đột không được giải quyết đúng thứ tự.

### F4. Không sửa trực tiếp file trong `shared/ui/` 👀

Đó là shadcn primitive. Cần biến thể ➔ dùng `cva` variant, hoặc bọc thành component mới ở `shared/components/`.

### F5. Mobile-first 👀

Class không tiền tố là giao diện điện thoại; `md:`, `lg:` để mở rộng lên. Phần lớn người dùng web truy cập từ điện thoại.

---

## Phần G. Hiệu năng

### G1. Tối ưu khi đo được, không đoán 👀

`memo`, `useMemo`, `useCallback` chỉ thêm khi React DevTools Profiler chỉ ra vấn đề thật. Thêm bừa làm code khó đọc và đôi khi chậm hơn.

**Ngoại lệ luôn cần memo:** giá trị đưa vào Context Provider (xem `AbilityProvider`), và dependency của `useEffect`.

### G2. Code-split theo route 🤖

Mọi route dùng `lazy()` + `<Suspense>`. Tenant Portal không nên tải kèm bundle của Platform Admin.

### G3. Danh sách dài phải ảo hóa 👀

Trên ~100 dòng ➔ `@tanstack/react-virtual`.

### G4. Ảnh khai `width`/`height` và `loading="lazy"` 🤖

Chống layout shift.

---

## Phần H. Khả năng tiếp cận

### H1. Thao tác được bằng bàn phím 👀

Mọi thứ bấm được phải focus được. `onClick` trên `<div>` là lỗi — dùng `<button>`.

### H2. Icon-only button phải có `aria-label` 🤖

### H3. Form control phải có `<label>` liên kết 🤖

**Cưỡng chế:** 🤖 `eslint-plugin-jsx-a11y` ở mức `recommended`.
