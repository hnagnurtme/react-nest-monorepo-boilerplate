<!--
Quy ước đánh dấu mức cưỡng chế:
  🤖 = có lint/CI chặn
  👀 = review bắt buộc kiểm
  💡 = khuyến nghị
-->

# 11 — UI & Design System (`apps/web`)

Tài liệu này là nguồn sự thật cho **tầng trình bày**: token, primitive, cách viết Tailwind, icon, chữ viết trên giao diện. Phần F của `04-frontend-react.md` nay chỉ còn trỏ về đây.

Nguyên tắc nền: **một quyết định thiết kế chỉ được tồn tại ở một chỗ.** Chỗ đó là `@theme` (giá trị) hoặc `shared/ui` (hình dạng). Call site chỉ được chọn, không được định nghĩa.

---

## Phần A. Token

### A1. Mọi giá trị thị giác đều là token trong `@theme` 🤖

`apps/web/src/app/styles/globals.css` khai báo toàn bộ token. Không có giá trị thị giác nào được viết thẳng trong JSX.

Năm nhóm token bắt buộc:

| Nhóm       | Tiền tố         | Utility sinh ra                                      |
| :--------- | :-------------- | :--------------------------------------------------- |
| Màu        | `--color-*`     | `bg-*`, `text-*`, `border-*`, `ring-*`               |
| Bán kính   | `--radius-*`    | `rounded-control`, `rounded-surface`, ...            |
| Đổ bóng    | `--shadow-*`    | `shadow-raised`, `shadow-floating`, `shadow-overlay` |
| Cỡ chữ     | `--text-*`      | `text-display` … `text-caption`                      |
| Vòng focus | `--color-ring`  | `ring-ring` (qua `FOCUS_RING`)                       |
| Bề rộng    | `--container-*` | `max-w-form`, `max-w-page`                           |

### A2. Token phải mang tên ngữ nghĩa, không mang tên hình dạng 👀

Tên token nói công dụng, không nói kích thước. Khi thiết kế đổi, giá trị đổi mà call site không phải sửa.

```css
/* ❌ --radius-xl: 0.75rem;        tên nói hình dạng */
/* ✅ --radius-control: 0.75rem;   tên nói công dụng */
```

Bộ bán kính chuẩn hoá — thay cho việc trộn `rounded-md/lg/xl/2xl` tuỳ chỗ:

```css
@theme {
  --radius-control: 0.75rem; /* button, input, select  */
  --radius-surface: 0.75rem; /* card, panel            */
  --radius-overlay: 1rem; /* dialog, popover        */
  --radius-pill: 9999px; /* badge, avatar          */
  --radius-inner: 0.5rem; /* phần tử lồng trong card */
}
```

Dùng: `rounded-control`, `rounded-surface`, `rounded-overlay`, `rounded-pill`, `rounded-inner`. Năm lựa chọn, hết. Không có `rounded-md` trong code sản phẩm.

Đổ bóng cũng vậy — ba bậc, gắn với độ cao. **Không khai trong `@theme`:**

```css
:root {
  --elevation-raised: 0 1px 2px 0 rgb(9 20 15 / 0.06);
  --elevation-floating: 0 4px 12px -2px rgb(9 20 15 / 0.1);
  --elevation-overlay: 0 16px 40px -8px rgb(9 20 15 / 0.25);
}

@utility shadow-raised {
  box-shadow: var(--elevation-raised);
}
```

**Bẫy Tailwind v4:** một `--shadow-*` khai trong `@theme` bị **inline giá trị lúc build** (để modifier `shadow-color` hoạt động được), nên `:root.dark` override biến đó sẽ không bao giờ được đọc — dark mode giữ nguyên bóng của light mode và không ai thấy. Vì thế elevation dùng custom property thường cộng `@utility`: giá trị được giải quyết lúc dùng. Các nhóm còn lại (`--color-*`, `--radius-*`, `--text-*`, `--container-*`) biên dịch thành `var(...)` nên khai trong `@theme` là đúng.

### A3. Mỗi token phải có cả giá trị light và dark 🤖

Khai trong `@theme` (light) **và** `:root.dark`. Thêm token mới mà quên nhánh dark là lỗi: component sẽ đúng ở một theme và sai ở theme kia mà không ai thấy.

Áp dụng cho cả `--shadow-*`: bóng đen trên nền tối là vô hình, nền tối dùng viền sáng thay cho bóng.

### A4. Tuyệt đối không hard-code màu 🤖

```tsx
// ❌ <div className="bg-[#1a1a1a] text-[#fff]">
// ❌ <div className="bg-slate-900">        // palette gốc Tailwind cũng là hard-code
// ✅ <div className="bg-background text-foreground">
```

Palette mặc định của Tailwind (`slate-*`, `blue-*`, `red-*`) **bị cấm như hex**: nó không theo theme. Chỉ token `--color-*` của dự án được dùng.

**Cưỡng chế:** 🤖 `scripts/check-ui-conventions.mjs` chặn `[#...]` và toàn bộ 22 họ màu gốc Tailwind (`bg-slate-500`, `text-red-600`, ...).

### A5. Không viết pixel; không viết arbitrary value 🤖

Thang spacing của Tailwind đã là `rem` (`p-4` = `1rem`). Không thay bằng pixel. Giá trị ngoài thang: khai token trước, dùng utility token sau.

```tsx
// ❌ <span className="text-[11px]" />
// ❌ <div className="max-w-[420px]" />
// ✅ <span className="text-2xs" />
// ✅ <div className="max-w-form" />   // --container-form: 26rem;
```

Ngoại lệ duy nhất cho arbitrary value: giá trị gắn với viewport mà token không mô tả được (`max-h-[90vh]` của `Dialog`). Phải có comment giải thích. Dòng cần miễn một check khai `ui-conventions-allow` kèm lý do, giống `eslint-disable`.

**Cưỡng chế:** 🤖 `scripts/check-ui-conventions.mjs` chặn `-[Npx]`, `-[Nrem]`, `-[Nem]`.

### A6. Chỉ `rem`, không `px` 👀

Người dùng tăng cỡ chữ hệ thống thì giao diện phải giãn theo. `px` chỉ được dùng cho đường kẻ 1px (`border`, `ring`) — Tailwind đã lo phần đó.

---

## Phần B. Thang đo

### B1. Thang spacing: bốn bậc cho khoảng cách giữa các khối 👀

Không tự chọn số. Dùng đúng bốn bậc:

| Dùng cho                       | Class     | Qua `Stack`    |
| :----------------------------- | :-------- | :------------- |
| Trong một nhóm (label ↔ input) | `gap-1.5` | `gap="tight"`  |
| Giữa các phần tử cùng cấp      | `gap-2`   | `gap="snug"`   |
| Giữa các khối trong trang      | `gap-4`   | `gap="normal"` |
| Giữa các vùng lớn              | `gap-6`   | `gap="loose"`  |

Padding bề mặt: `p-4` (card), `p-6` (dialog, page shell), `p-8` (trang trống / trạng thái rỗng). Không có `p-5`, `p-7`.

### B2. Thang cỡ chữ ngữ nghĩa 👀

Khai token theo vai trò, không theo cỡ:

```css
@theme {
  --text-display: 1.875rem; /* số liệu lớn, hero */
  --text-title: 1.5rem; /* tiêu đề trang (PageHeader) */
  --text-heading: 1.125rem; /* tiêu đề khối, tiêu đề dialog */
  --text-body: 0.875rem; /* nội dung, nhãn control md/lg */
  --text-label: 0.75rem; /* nhãn field, badge, nhãn control sm */
  --text-caption: 0.6875rem; /* chú thích, divider */
}
```

Sáu bậc, mỗi bậc kèm `--text-*--line-height`. Hai bậc chủ lực `text-body` và `text-label` phủ phần lớn giao diện. Cỡ chữ của tiêu đề trang do `PageHeader` quyết định, trang không tự viết.

### B3. Thang chiều cao control 👀

Mọi phần tử tương tác dùng một trong ba chiều cao: `h-8` (sm), `h-10` (md, mặc định), `h-12` (lg). Thang này sống trong `shared/ui/control.ts` (`CONTROL_HEIGHT`, `CONTROL_PADDING`, `CONTROL_TEXT`) và `Button`, `Input`, `Select` đều lấy từ đó, nên một `Button size="md"` cạnh một `Input size="md"` tự khớp hàng. Chiều cao là `size` variant của primitive — call site **không** được override bằng `className="h-11"`.

### B4. Thang kích thước icon 🤖

Bốn bậc, dùng utility `size-*` (một class, không phải `h-4 w-4`):

| Ngữ cảnh                   | Class     |
| :------------------------- | :-------- |
| Trong chữ, trong nút nhỏ   | `size-4`  |
| Nút biểu tượng, header     | `size-5`  |
| Trạng thái rỗng, hộp thoại | `size-8`  |
| Minh hoạ                   | `size-12` |

**Cưỡng chế:** 🤖 `scripts/check-ui-conventions.mjs` chặn cặp `h-N w-N` trùng nhau (dùng `size-N`).

---

## Phần C. Icon

### C1. Một bộ icon duy nhất: `lucide-react` 🤖

Không thêm bộ icon thứ hai (`react-icons`, `heroicons`, `@tabler/icons`). Hai bộ icon trong một sản phẩm = hai ngôn ngữ thị giác, nét và bán kính không khớp.

**Cưỡng chế:** 🤖 `no-restricted-imports` trong `packages/eslint-config/react.js` chặn `react-icons`, `@heroicons/react`, `@tabler/icons-react`, `@radix-ui/react-icons`, `react-feather`, `phosphor-react`, `@phosphor-icons/react`.

### C2. Cấm SVG inline trong component 👀

Cần icon lucide chưa có: thêm một file vào `shared/ui/icons/`, export qua `shared/ui/icons/index.ts`, vẽ theo đúng grid 24 và `stroke-width: 2` của lucide. Không dán `<svg>` vào JSX nghiệp vụ.

### C3. Icon luôn `aria-hidden`, nghĩa nằm ở chữ 🤖

Icon là trang trí cho một nhãn. Nút chỉ có icon phải có `aria-label`.

```tsx
<X className="size-4" aria-hidden="true" />
```

### C4. Cấm emoji trên giao diện, trong code, trong locale 🤖

Lý do, không phải thẩm mỹ: emoji render khác nhau trên từng hệ điều hành, không theo được màu theme, không đổi theo ngôn ngữ, và trình đọc màn hình đọc ra tên dài vô nghĩa giữa câu. Trạng thái, mức độ, chiều hướng đều diễn đạt bằng icon lucide + token màu.

```tsx
// ❌ <span>✅ Đã kích hoạt</span>
// ❌ toast({ message: '🎉 Lưu thành công' })
// ✅ <Badge tone="success">Đã kích hoạt</Badge>
```

Phạm vi lệnh cấm: `apps/web/src/**`, `apps/web/src/lib/i18n/locales/**`, và mọi chuỗi API trả ra cho người dùng. Tài liệu `docs/` không bị ràng buộc.

**Cưỡng chế:** 🤖 `scripts/check-ui-conventions.mjs` quét dải pictograph và dingbat trên `apps/web/src` (gồm `lib/i18n/locales`). Mũi tên và dấu câu thường không bị tính là emoji.

---

## Phần D. Viết Tailwind

### D1. Thứ tự class do máy quyết định 🤖

Không tranh luận thứ tự class trong review. `prettier-plugin-tailwindcss` (đã cấu hình trong `.prettierrc.json`) sắp lại khi format; `just format-check` chặn file chưa sắp.

### D2. Ghép class bằng `cn()`, không nối chuỗi 🤖

Nối chuỗi thủ công làm xung đột utility không được `tailwind-merge` giải quyết theo đúng thứ tự ưu tiên.

### D3. Chuỗi class dài là tín hiệu thiếu primitive 👀

Trên ~8 utility trong một `className` ở `features/`: dừng lại. Hoặc thêm variant vào primitive, hoặc tách component. Mười hai utility lặp ở ba trang nghĩa là primitive đang thiếu.

### D4. Biến thể khai bằng `cva`, không bằng `if` 👀

Primitive có nhiều hình dạng thì dùng `class-variance-authority`: toàn bộ ma trận nằm trong một khai báo, mặc định được giải quyết sẵn, caller không thể quên.

### D5. Component chỉ nhận `className` để _định vị_, không để _tạo kiểu_ 👀

`className` của caller dùng cho margin, width, grid placement. Không dùng để đổi màu, đổi radius, đổi chiều cao — đó là `variant`/`size` của primitive. Thấy `<Button className="h-11 bg-white rounded-sm">` là primitive thiếu variant, không phải call site sáng tạo.

### D6. Mobile-first 👀

Class không tiền tố là điện thoại; `sm:` `md:` `lg:` mở rộng lên. Không dùng `max-*` breakpoint.

### D7. Bảng phải có cách trình bày cho điện thoại 👀

`overflow-x-auto` không phải thiết kế responsive. `DataTable` giải quyết sẵn bằng hai cơ chế, không cần trang tự lo:

- Mỗi `<td>` mang `data-label` là tiêu đề cột; dưới `md`, CSS trong `globals.css` (`table[data-stacked]`) xếp mỗi dòng thành danh sách nhãn/giá trị. Đây là một trong vài chỗ buộc phải viết CSS toàn cục: `content: attr(data-label)` không diễn đạt được bằng utility.
- Cột khai `priority: 'secondary'` bị ẩn hẳn trên điện thoại (`hidden md:table-cell`) thay vì đẩy bảng tràn ngang.

Chỉ một cây DOM cho cả hai bố cục, nên không có nội dung nhân đôi cho trình đọc màn hình.

---

## Phần E. Primitive

### E1. `shared/ui/` là nơi duy nhất chứa primitive 🤖

`shared/components/` đã được gộp vào `shared/ui/`; không tạo lại thư mục primitive thứ hai. Primitive = không biết gì về nghiệp vụ, không gọi API, không đọc store.

**Cưỡng chế:** 🤖 `no-restricted-imports` chặn `@/features/*` và `@/entities/*` trong `src/shared/**` (rule A4 của `04`).

### E2. Bộ primitive tối thiểu 👀

Không được viết giao diện khi primitive tương ứng còn thiếu — viết primitive trước.

| Nhóm       | Primitive                                                                                    |
| :--------- | :------------------------------------------------------------------------------------------- |
| Hành động  | `Button`, `IconButton`, `LinkButton`, `TEXT_LINK`                                            |
| Nhập liệu  | `Input`, `Textarea`, `Select`, `CheckboxField`, `Label`, `FieldError`                        |
| Bề mặt     | `Card`, `Dialog`, `ConfirmDialog`, `Divider`, `DividerLabel`                                 |
| Hiển thị   | `Badge`, `DataTable`, `Pagination`, `IconText`, `SegmentedControl`                           |
| Trạng thái | `Spinner`, `Skeleton`, `SkeletonTable`, `EmptyState`, `ErrorState`, `Alert`, `ToastProvider` |
| Bố cục     | `PageShell`, `PageHeader`, `Stack`                                                           |

### E3. Mọi trạng thái đều có giao diện riêng 👀

Bốn trạng thái, bốn primitive: `SkeletonTable` (đang tải, giữ nguyên bố cục để không nhảy layout), `ErrorState` (lỗi, kèm hành động thử lại), `EmptyState` (rỗng), và nội dung. `<p>Đang tải...</p>` không phải trạng thái tải.

`EmptyState` nhận `action`, nhưng **đừng** nhân bản hành động chính nếu header trang đã có: hai nút cùng tên trên một trang làm trình đọc màn hình và test đều phải đoán. Trang `users` vì vậy để `EmptyState` không có nút.

Lần tải đầu mới được xoá nội dung; `refetch` phải giữ dòng cũ trên màn hình.

### E4. Trạng thái tương tác phải đầy đủ năm bậc 👀

Mọi phần tử bấm được khai `default`, `hover`, `active`, `focus-visible`, `disabled`. Thiếu `focus-visible` là lỗi khả năng tiếp cận, không phải lỗi thẩm mỹ.

Một định nghĩa vòng focus duy nhất, export từ `shared/ui`:

```ts
export const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
```

Định nghĩa thật nằm ở `shared/ui/focus-ring.ts`, kèm biến thể `FOCUS_RING_INSET` cho control nằm sát trong khung bao (ring có offset sẽ bị cắt). Primitive nào bấm được thì nối một trong hai. Không có primitive tự chọn độ mờ vòng focus riêng.

### E5. `cursor-pointer` và `transition` thuộc primitive 👀

Không rải ở call site. Thấy `cursor-pointer` trong `features/` nghĩa là ở đó có một `<button>` thô đáng ra phải là `Button` hoặc `IconButton`.

### E6. `<button>`, `<input>`, `<select>`, `<textarea>` thô chỉ được xuất hiện trong `shared/ui/` 🤖

Trong `features/`, `entities/`, `app/`: dùng `Button`, `IconButton`, `LinkButton`, `Input`, `Select`, `Textarea`, `CheckboxField`. Control thô tự dựng style sẽ lệch focus ring, lệch disabled, lệch chiều cao.

Hai trường hợp không phải `<button>` nhưng vẫn phải trông như nút hoặc như link:

- `Link` của router trông như nút: `className={buttonVariants({ isFullWidth: true })}` — lấy đúng chuỗi class của `Button`, không copy.
- `Link` hoặc `<a>` trông như link văn bản: `className={TEXT_LINK}`.

**Cưỡng chế:** 🤖 `no-restricted-syntax` trên `src/app/**`, `src/entities/**`, `src/features/**`.

### E7. Primitive chịu đúng bộ rule như mọi file khác 🤖

`shared/ui` từng được miễn `max-lines` với lý do "output sinh bởi shadcn CLI" — lý do đó sai: đây là primitive viết tay. Khối miễn trừ đã bị xoá, chỉ còn miễn annotation kiểu trả về của component. Primitive quá dài = đang gánh nhiều hơn một trách nhiệm.

### E8. Thêm variant, không fork component 👀

Cần hình dạng mới: thêm vào ma trận `cva` của primitive, hoặc bọc primitive thành component cấp cao hơn. Không copy primitive sang `features/` rồi sửa.

---

## Phần F. Chữ viết trên giao diện

### F1. Mọi chuỗi đi qua i18n, cả `en` và `vi` 🤖

Không có chuỗi cứng trong JSX. Thêm khoá là thêm ở cả hai locale. Mặc định tiếng Anh.

### F2. Nhãn hành động là động từ mệnh lệnh 👀

"Lưu", "Mời người dùng", "Xoá vai trò". Không "OK", không "Gửi đi", không "Nhấn vào đây".

### F3. Thông báo lỗi nói việc cần làm 👀

Lỗi phải cho người dùng biết bước tiếp theo. Không lộ mã lỗi, SQLSTATE, hay tên bảng ra giao diện.

---

## Phần G. Khả năng tiếp cận

### G1. Tương phản tối thiểu AA 🤖

Chữ thường 4.5:1, chữ lớn và thành phần giao diện 3:1. **Ở cả hai theme.** Khi thêm hoặc đổi token màu, ghi tỉ lệ đo được vào comment cạnh token — `globals.css` đã làm vậy, giữ tiếp lệ đó.

**Cưỡng chế:** 🤖 `apps/web/test/theme-contrast.test.ts` đọc trực tiếp `globals.css`, tính tỉ lệ WCAG cho từng cặp màu mà giao diện thật sự vẽ, và bắt lỗi khi dark palette không override một token nào đó.

### G2. Không dùng riêng màu để truyền tin 👀

Trạng thái luôn có chữ hoặc icon kèm màu. Người mù màu chiếm ~8% nam giới.

### G3. Bấm được thì focus được 🤖

`onClick` trên `<div>` là lỗi. Dùng `<button>`.

### G4. Vùng bấm tối thiểu 2.75rem trên cảm ứng 👀

Nút `size="xs"`/`"sm"` chỉ dùng trên desktop hoặc trong bảng. Hành động chính trên điện thoại dùng `md` trở lên.

### G5. Tôn trọng `prefers-reduced-motion` 👀

Animation phải tắt được. Đã khai một lần trong `globals.css` cho toàn bộ cây DOM; không xử lý lại ở từng component. Thời lượng đặt `0.01ms` chứ không phải `0` để `transitionend`/`animationend` vẫn bắn, tránh treo component nào chờ sự kiện đó.

---

## Phần H. Cưỡng chế bằng công cụ

Mỗi mục 🤖 ở trên gắn với một cơ chế cụ thể, không phải nguyện vọng:

| Cơ chế                                                      | Chặn rule              |
| :---------------------------------------------------------- | :--------------------- |
| `prettier-plugin-tailwindcss` (`.prettierrc.json`)          | D1                     |
| `scripts/check-ui-conventions.mjs`                          | A2, A4, A5, B2, B4, C4 |
| `no-restricted-imports` (`packages/eslint-config/react.js`) | C1, E1, D1 của rule 04 |
| `no-restricted-syntax` (cùng file)                          | E6                     |
| `eslint-plugin-boundaries`                                  | E1 (hướng phụ thuộc)   |
| `apps/web/test/theme-contrast.test.ts`                      | A3, G1                 |
| `eslint-plugin-jsx-a11y` ở mức `recommended`                | C3, G3                 |

Chạy tại máy: `just lint-ui` (hoặc `pnpm lint:ui`). Trong CI: job `conventions`, bước _UI design-system conventions_, kích hoạt khi PR có đổi `apps/web/**`. `just verify` đã bao gồm bước này.

`scripts/check-ui-conventions.mjs` chỉ là grep theo dòng, nên nó không hiểu ngữ cảnh: một dòng cần miễn khai `ui-conventions-allow` kèm lý do. Lạm dụng cơ chế miễn là lỗi review.

Chưa làm: `eslint-plugin-better-tailwindcss` (hiểu AST, bắt được class trùng và class không tồn tại). Đáng thêm khi script grep bắt đầu báo nhầm; hôm nay nó chưa báo nhầm lần nào.
