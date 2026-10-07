---
title: Testing
description: Chiến lược test, ngưỡng coverage, test RLS bắt buộc và quy tắc viết test
status: stable
updated: 2026-10-07
owner: Platform Team
---

# 08 — Testing

---

## Phần A. Chiến lược

### A1. Kim tự tháp test 👀

| Loại        | Tỉ lệ | Công cụ                 | Chạy khi                               |
| :---------- | :---- | :---------------------- | :------------------------------------- |
| Unit        | ~60%  | Vitest                  | Mỗi lần lưu file                       |
| Integration | ~30%  | Vitest + Testcontainers | Mỗi PR                                 |
| E2E         | ~10%  | Playwright              | Mỗi PR (luồng chính), nightly (đầy đủ) |

### A2. Cái gì bắt buộc phải có test 🤖

- **Mọi RLS policy** — không có ngoại lệ (mục C).
- Mọi hàm tính toán tiền, thuế, hoa hồng, làm tròn.
- Mọi chuyển trạng thái nghiệp vụ.
- Mọi lỗi bảo mật từng xảy ra — test hồi quy trước khi vá.
- Mọi bug đã sửa — test tái hiện được bug, viết **trước** khi sửa.

### A3. Cái gì không cần test 💡

Getter/setter thuần, code chỉ gọi thẳng thư viện, DTO chỉ khai báo type, file cấu hình.

**Vì sao:** test không tạo giá trị vẫn tốn chi phí bảo trì và làm chậm CI.

### A4. Ngưỡng coverage 🤖

| Phạm vi                        | Ngưỡng |
| :----------------------------- | :----- |
| `apps/api/src/modules/**`      | 80%    |
| `apps/api/src/common/utils/**` | 95%    |
| `packages/shared-types/**`     | 90%    |
| Toàn repo                      | 70%    |

Coverage là **sàn**, không phải mục tiêu. 100% coverage với `expect(true).toBe(true)` là vô giá trị.

---

## Phần B. Viết test

### B1. Tên test mô tả hành vi, không mô tả hàm 👀

```typescript
// ❌ it('test createProject', ...)
// ✅ it('từ chối tạo sản phẩm khi giá âm', ...)
// ✅ it('tenant không đọc được sản phẩm chưa xuất bản của tenant khác', ...)
```

Test đỏ trong CI phải cho biết **cái gì hỏng** mà không cần mở file.

### B2. Arrange – Act – Assert, tách rõ 👀

### B3. Một hành vi mỗi test 👀

Nhiều `expect` là được, nhưng chỉ một hành động. Test hỏng phải chỉ ra đúng một nguyên nhân.

### B4. Test không phụ thuộc thứ tự và không dùng chung state 🤖

Mỗi test tự dựng dữ liệu của nó. Chạy `--shuffle` phải vẫn xanh.

**Cưỡng chế:** 🤖 CI chạy Vitest với `--sequence.shuffle`.

### B5. Không mock cái mình đang test 👀

Mock ranh giới (HTTP ngoài, đồng hồ, random), không mock nội bộ. Phải mock nhiều thứ nội bộ ➔ thiết kế sai, không phải test sai.

### B6. Dùng factory, không dùng fixture cứng 👀

```typescript
// ✅ Test chỉ khai phần nó quan tâm; phần còn lại là mặc định hợp lệ
const project = makeProject({ priceMinor: -1n });
```

### B7. Thời gian và ngẫu nhiên phải kiểm soát được 🤖

`vi.useFakeTimers()`, seed cho random. Test phụ thuộc `Date.now()` thật sẽ đỏ lúc nửa đêm hoặc vào ngày 29/2.

### B8. Cấm `sleep` trong test 🤖

Chờ điều kiện (`waitFor`), không chờ thời gian. `sleep` là nguồn gốc của test flaky.

---

## Phần C. Test RLS — bắt buộc

### C1. Mỗi bảng có RLS phải có test cách ly 🤖

RLS là **ranh giới bảo mật**. Không thể review bằng mắt, chỉ có thể kiểm chứng bằng test.

```typescript
describe('RLS: projects', () => {
  it('tenant A không thấy dữ liệu tenant B', async () => {
    const [a, b] = await seedTenants(2);
    await seedProject({ tenantId: b.id });

    const rows = await withContext({ accessMode: 'tenant', tenantId: a.id }, (tx) => tx.select().from(projects));
    expect(rows).toHaveLength(0);
  });

  it('tenant A không sửa được dữ liệu tenant B', async () => {
    const [a, b] = await seedTenants(2);
    const p = await seedProject({ tenantId: b.id });

    const result = await withContext({ accessMode: 'tenant', tenantId: a.id }, (tx) =>
      tx.update(projects).set({ title: 'hacked' }).where(eq(projects.id, p.id)),
    );
    expect(result.rowCount).toBe(0);
  });

  it('tenant A không chèn được dòng cho tenant B', async () => {
    const [a, b] = await seedTenants(2);
    await expect(
      withContext({ accessMode: 'tenant', tenantId: a.id }, (tx) =>
        tx.insert(projects).values(makeProjectRow({ tenantId: b.id })),
      ),
    ).rejects.toThrow();
  });

  it('thiếu access_mode thì trả rỗng (fail-closed)', async () => {
    await seedProject();
    const rows = await withoutContext((tx) => tx.select().from(projects));
    expect(rows).toHaveLength(0);
  });
});
```

### C2. Test RLS chạy bằng role `app`, không phải role `owner` 🤖

**Vì sao:** role owner bỏ qua RLS. Test chạy bằng owner sẽ **xanh trong khi policy hoàn toàn không hoạt động** — tệ hơn là không có test, vì nó tạo cảm giác an toàn giả.

### C3. Test quét bảng quên bật RLS chạy trong mọi lần CI 🤖

Xem [02-backend-core-va-drizzle-rls.md](../02-backend-core-va-drizzle-rls.md) mục 2.6.

---

## Phần D. Integration test

### D1. Dùng Testcontainers, không dùng DB dùng chung 🤖

**Vì sao:** DB dùng chung làm test phụ thuộc nhau, không chạy song song được, và đỏ ngẫu nhiên khi hai nhánh CI chạy cùng lúc. Postgres thật trong container mới kiểm chứng được RLS — SQLite in-memory thì không.

### D2. Migration chạy trên container, không seed schema bằng tay 👀

Test luôn chạy trên đúng schema mà projection sẽ có.

### D3. Mỗi test tự dọn dẹp 🤖

Truncate trong `afterEach`, hoặc bọc mỗi test trong transaction rồi rollback.

---

## Phần E. E2E

### E1. Chỉ test luồng người dùng thật sự quan trọng 👀

Đăng ký, đăng nhập, quản lý user trong tenant. Không E2E cho mọi ô input.

### E2. Page Object Model 👀

### E3. Selector dùng `data-testid`, không dùng class hay text 🤖

Class CSS và text hiển thị thay đổi liên tục.

### E4. Test flaky bị vô hiệu hóa trong 24 giờ, kèm issue 👀

**Vì sao:** test đỏ ngẫu nhiên dạy cả team thói quen bấm "retry" — rồi một ngày nó đỏ thật và không ai để ý.

---
