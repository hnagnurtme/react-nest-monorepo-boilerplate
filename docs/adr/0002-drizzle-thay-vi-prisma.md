# ADR-0002: Drizzle ORM thay vì Prisma

- **Trạng thái:** accepted
- **Ngày:** 2026-09-14

## Bối cảnh

Cần ORM TypeScript cho PostgreSQL. Ràng buộc quyết định: hệ thống dựa vào **Row Level Security** và **session context transaction-local** (`set_config`) làm cơ chế cách ly dữ liệu chính.

## Các phương án đã cân nhắc

| Phương án        | Ưu                                                                                                                                    | Nhược                                                                                                                                              |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma           | DX tốt, hệ sinh thái lớn, Studio đẹp                                                                                                  | Engine nhị phân riêng, kiểm soát connection/session hạn chế, RLS + `set_config` cần workaround `$executeRaw` khó tin cậy, migration SQL bị che bớt |
| TypeORM          | Quen thuộc                                                                                                                            | Decorator nặng, lịch sử migration hay lỗi, kém bảo trì                                                                                             |
| **Drizzle**      | SQL-first, migration là SQL thuần đọc và sửa được, kiểm soát hoàn toàn transaction/connection, không có engine trung gian, bundle nhỏ | Hệ sinh thái trẻ, tài liệu mỏng hơn, API còn đổi                                                                                                   |
| SQL thuần + `pg` | Kiểm soát tuyệt đối                                                                                                                   | Mất type safety, tự viết migration runner                                                                                                          |

## Quyết định

Drizzle ORM.

Yếu tố quyết định là **kiểm soát transaction**: RLS đòi hỏi `set_config('app.access_mode', ..., true)` chạy đúng trong transaction sẽ thực thi truy vấn nghiệp vụ. Drizzle cho điều đó một cách trực tiếp và dễ suy luận; Prisma thì phải lách qua raw query trong interactive transaction.

Lợi ích phụ nhưng quan trọng: migration là file SQL thuần, nên chèn `CREATE POLICY`, `CHECK`, backfill theo lô đều là việc bình thường.

## Hệ quả

**Dễ hơn:** RLS hoạt động đúng như thiết kế; đọc được chính xác SQL sẽ chạy; migration sửa tay được để thêm policy.

**Khó hơn:** ít câu trả lời sẵn trên mạng hơn Prisma; đội ngũ cần biết SQL thật sự; API Drizzle còn breaking change giữa các minor version ➔ pin version chặt.

**Đánh đổi chấp nhận:** hy sinh sự tiện lợi và độ chín của hệ sinh thái để đổi lấy khả năng kiểm soát ranh giới bảo mật quan trọng nhất của hệ thống.
