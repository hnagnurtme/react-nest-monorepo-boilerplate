# ADR-0006: SPA cho toàn bộ web, chưa dùng SSR

- **Trạng thái:** accepted
- **Ngày:** 2026-10-07

## Bối cảnh

`apps/web` phục vụ người dùng đã đăng nhập: thành viên tenant, quản trị tenant và Platform Admin. Các màn hình này nằm sau đăng nhập nên không cần SEO; nếu sau này có trang công khai (landing, marketing) thì có thể cần.

## Các phương án đã cân nhắc

| Phương án                                                   | Ưu                                                          | Nhược                                                                         |
| :---------------------------------------------------------- | :---------------------------------------------------------- | :---------------------------------------------------------------------------- |
| **React 19 + Vite SPA cho tất cả**                          | Một app, một mô hình tư duy, build nhanh, cấu hình đơn giản | Trang công khai (nếu có) không index được tốt; LCP kém hơn trên mạng chậm     |
| Next.js cho tất cả                                          | SSR sẵn cho mọi thứ                                         | SSR vô ích cho các màn hình sau đăng nhập; thêm tầng server phải vận hành     |
| Tách 2 app: Next.js cho trang công khai + Vite cho ứng dụng | Mỗi phần dùng đúng công cụ                                  | Hai app, hai pipeline, hai bộ cấu hình; nhiều việc hơn ở giai đoạn dựng khung |

## Quyết định

Giữ **SPA thuần (React 19 + Vite)** cho toàn bộ `apps/web`, triển khai trên Cloudflare Pages.

Lý do: boilerplate chưa có trang công khai nào cần SEO. Dựng thêm một app Next.js bây giờ là trả chi phí cho thứ chưa dùng tới, trong khi ràng buộc SEO thật sự sẽ rõ hơn khi nghiệp vụ định hình.

## Hệ quả

**Dễ hơn:** một mô hình duy nhất cho toàn bộ frontend; build và deploy đơn giản; team không phải chuyển qua lại giữa hai framework.

**Khó hơn — cần biết trước:** khi có trang công khai cần lưu lượng tìm kiếm, SPA thuần khiến trang đó index kém và LCP chậm trên mạng di động.

**Kế hoạch khi tới lúc đó:** thêm một app Next.js (ví dụ `apps/site`) như một app **riêng**, dùng lại `@repo/api-contract` và `@repo/shared-types`; `apps/web` giữ nguyên vai trò ứng dụng sau đăng nhập. Quyết định này được ghi lại để lúc đó không ai phải tranh luận lại từ đầu — và để biết rằng đây là **hoãn có ý thức**, không phải bỏ sót.

**Điều kiện kích hoạt xem xét lại:** khi bắt đầu xây trang công khai, hoặc khi có yêu cầu SEO/marketing cụ thể.
