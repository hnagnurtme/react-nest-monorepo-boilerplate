# ADR-0003: Postgres RLS thay vì lọc ở tầng ứng dụng

- **Trạng thái:** accepted
- **Ngày:** 2026-10-07

## Bối cảnh

Nền tảng multi-tenant: dữ liệu của tenant này tuyệt đối không được lọt sang tenant khác. Rò rỉ dữ liệu ở đây không phải bug thông thường — nó là sự cố mất niềm tin của khách hàng.

## Các phương án đã cân nhắc

| Phương án                         | Ưu                                                                                      | Nhược                                                                                       |
| :-------------------------------- | :-------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| `WHERE tenant_id = ?` thủ công    | Đơn giản, không cần biết gì thêm                                                        | **Quên một lần là rò rỉ.** Không có cách nào kiểm chứng đã phủ hết mọi truy vấn             |
| Base repository tự chèn điều kiện | Tập trung một chỗ                                                                       | Bị vượt qua bởi raw query, JOIN, view, subquery; và bởi bất kỳ ai không dùng base class     |
| Tách database cho mỗi tenant      | Cách ly tuyệt đối                                                                       | Không khả thi với hàng nghìn tenant; migration và truy vấn tổng hợp thành ác mộng           |
| **Postgres RLS**                  | Cưỡng chế ở tầng dưới cùng, không thể vượt qua từ code ứng dụng; áp dụng cho cả raw SQL | Cần hiểu RLS; debug khó hơn ("dữ liệu biến mất"); chi phí đánh giá policy trên mỗi truy vấn |

## Quyết định

Postgres RLS, đúng **một** policy mỗi bảng, điều khiển bằng `app.access_mode` (`tenant` | `admin`) và `app.tenant_id`, thiết lập transaction-local.

Lý do cốt lõi: mọi phương án ở tầng ứng dụng đều phụ thuộc vào việc **lập trình viên nhớ**. RLS không phụ thuộc vào trí nhớ ai cả. Nó vẫn chặn khi có người viết raw query để tối ưu, khi có người thêm endpoint mới lúc 11 giờ đêm, và khi có người dùng `db.execute()` để debug.

Phân quyền ở tầng ứng dụng (CASL) vẫn tồn tại — nhưng vai trò của nó là trả về `403` tường minh, **không** phải là cơ chế cách ly.

## Hệ quả

**Dễ hơn:** cách ly dữ liệu kiểm chứng được bằng test; thêm bảng mới là thêm policy theo mẫu; audit bảo mật chỉ cần soi một lớp.

**Khó hơn:** mọi truy vấn phải nằm trong transaction có context — quên thì "dữ liệu biến mất" và mất thời gian truy; cần index trên mọi cột dùng trong policy, nếu không mọi truy vấn thành seq scan; PgBouncer phải chạy transaction pooling mode.

**Đánh đổi chấp nhận:** nhận thêm độ phức tạp vận hành và một lớp debug khó hơn, để đổi lấy việc loại bỏ hoàn toàn cả một nhóm lỗi bảo mật. Với hệ thống multi-tenant, đây là đánh đổi đúng.

**Rủi ro đã gặp:** bản thiết kế đầu tiên dùng **hai** policy PERMISSIVE (tenant + public) và bị thủng, vì Postgres OR chúng lại. Đó là lý do quy tắc "một policy mỗi bảng" được ghi thành luật cứng ở [rules/03-database-drizzle.md](../rules/03-database-drizzle.md).
