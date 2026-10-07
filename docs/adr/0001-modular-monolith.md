# ADR-0001: Modular Monolith thay vì Microservices

- **Trạng thái:** accepted
- **Ngày:** 2026-10-07

## Bối cảnh

Nền tảng SaaS multi-tenant sẽ lớn dần thành nhiều miền nghiệp vụ (xác thực, quản lý user/tenant, và các miền riêng của từng dự án). Câu hỏi đặt ra từ đầu: tách microservices ngay, hay giữ một deployable duy nhất?

Ràng buộc: team nhỏ, chưa có nền tảng vận hành phân tán (service mesh, distributed tracing đầy đủ, saga orchestrator), và nghiệp vụ còn đang định hình.

## Các phương án đã cân nhắc

| Phương án                | Ưu                                                                                                             | Nhược                                                                                   |
| :----------------------- | :------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| Microservices ngay       | Scale độc lập, ranh giới cứng                                                                                  | Cần distributed transaction, ranh giới sai lúc đầu rất đắt để sửa, chi phí vận hành lớn |
| Monolith không phân tầng | Nhanh lúc đầu                                                                                                  | Sau 1 năm thành đống code không tách nổi                                                |
| **Modular Monolith**     | Một deployable, transaction ACID, ranh giới cưỡng chế bằng linter, tách service sau khi đã biết ranh giới đúng | Vẫn scale theo cả khối; kỷ luật phụ thuộc vào công cụ                                   |

## Quyết định

Modular Monolith 5 tầng, ranh giới cưỡng chế bằng `eslint-plugin-boundaries`.

Boilerplate chỉ có một deployable backend (`apps/api`) và một SPA (`apps/web`). Nếu sau này có workload khác hẳn về ngôn ngữ hoặc hồ sơ tài nguyên, hãy tách riêng bằng ADR mới.

## Hệ quả

**Dễ hơn:** transaction ACID xuyên nghiệp vụ; refactor ranh giới chỉ là di chuyển thư mục; một pipeline, một lần deploy.

**Khó hơn:** không scale riêng một miền nghiệp vụ khi nó nóng; một lỗi nghiêm trọng ảnh hưởng toàn hệ thống; kỷ luật phân tầng sẽ trôi nếu có ai tắt linter.

**Đánh đổi chấp nhận:** trả giá bằng khả năng scale chi tiết để đổi lấy tốc độ phát triển và sự đơn giản khi vận hành, ở giai đoạn mà ranh giới nghiệp vụ còn chưa ổn định. Tách service khi có **dữ liệu** chỉ ra nút thắt, không tách theo linh cảm.
