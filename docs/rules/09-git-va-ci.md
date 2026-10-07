---
title: Git & CI
description: Quy ước branch, commit, pull request, code review và cổng CI
status: stable
updated: 2026-10-07
owner: Platform Team
---

# 09 — Git & CI

---

## Phần A. Branch

### A1. Quy ước đặt tên 🤖

```
<loại>/<mã-issue>-<mô-tả-ngắn>

feat/142-tenant-payout-account
fix/158-rls-leak-published-projects
chore/161-bump-turbo
```

Loại: `feat` · `fix` · `chore` · `refactor` · `docs` · `test` · `perf`.

### A2. Không push thẳng vào `main` 🤖

Branch protection: bắt buộc PR, bắt buộc CI xanh, bắt buộc 1 approval.

### A3. Branch sống ngắn 👀

Dưới 3 ngày. Lâu hơn ➔ tách nhỏ task. Branch sống lâu sinh conflict lớn và review không nổi.

---

## Phần B. Commit

### B1. Conventional Commits 🤖

```
<loại>(<phạm vi>): <mô tả>

feat(projects): thêm endpoint xuất bản sản phẩm
fix(rls): gộp 2 policy permissive làm rò dữ liệu giữa tenant
refactor(auth): tách logic rotation ra khỏi AuthService
```

**Cưỡng chế:** 🤖 `commitlint` trong `commit-msg` hook + kiểm tra lại trong CI.

### B2. Mô tả ở thể mệnh lệnh, không viết hoa, không dấu chấm cuối 🤖

```
✅ feat(auth): thêm phát hiện tái sử dụng refresh token
❌ feat(auth): Đã thêm phát hiện tái sử dụng refresh token.
```

### B3. Một commit — một thay đổi logic 👀

Đổi tên biến + sửa bug + thêm tính năng trong một commit là không revert được từng phần.

### B4. Breaking change phải đánh dấu 🤖

`feat(api)!: ...` hoặc footer `BREAKING CHANGE: ...`.

---

## Phần C. Pull Request

### C1. Kích thước tối đa 👀

Dưới **400 dòng** thay đổi (không tính file sinh tự động và lockfile). Lớn hơn ➔ tách.

**Vì sao:** chất lượng review sụt thẳng đứng sau ~400 dòng. PR 2000 dòng nhận được "LGTM" chứ không nhận được review.

### C2. Mô tả PR trả lời 4 câu hỏi 👀

```markdown
## Thay đổi gì

## Vì sao

## Kiểm chứng thế nào

## Rủi ro & cách rollback
```

### C3. Checklist bắt buộc trong template 👀

- [ ] Tự review diff của chính mình trước khi mở PR.
- [ ] Đã thêm/cập nhật test.
- [ ] Đã cập nhật tài liệu nếu đổi hành vi.
- [ ] Không có `console.log`, `TODO` không gán người, code bị comment lại.
- [ ] Thay đổi schema có migration và đã chạy thử cả chiều lên.
- [ ] Bảng mới có `tenant_id` đã bật RLS **và có test cách ly**.
- [ ] Không có secret trong diff.

### C4. Thay đổi chạm bảo mật cần review từ người thứ hai 👀

Auth, RLS, phân quyền, xử lý thanh toán, upload file, giao tiếp M2M.

---

## Phần D. Code review

### D1. Người review chịu trách nhiệm ngang người viết 👀

Approve nghĩa là "tôi cũng chịu trách nhiệm cho code này".

### D2. Phân loại comment 💡

| Tiền tố       | Nghĩa                           |
| :------------ | :------------------------------ |
| `blocking:`   | Phải sửa mới merge              |
| `suggestion:` | Nên sửa, tác giả quyết định     |
| `nit:`        | Vụn vặt, không chặn merge       |
| `question:`   | Hỏi để hiểu, không phải yêu cầu |

**Vì sao:** không phân loại thì tác giả không biết cái nào bắt buộc, và một góp ý về khoảng trắng bị hiểu thành yêu cầu chặn.

### D3. Review nội dung, không review phong cách 👀

Format đã có Prettier lo. Review dành cho: tính đúng đắn, bảo mật, ranh giới kiến trúc, khả năng bảo trì.

### D4. Phản hồi trong một ngày làm việc 👀

---

## Phần E. CI

### E1. Các cổng bắt buộc 🤖

Pipeline được cấu hình chạy song song, phân vùng theo phạm vi thay đổi (Path Filtering) và nhánh:

```yaml
jobs:
  secret-scan: # Gitleaks fail-fast
  changes: # dorny/paths-filter phân tích vùng thay đổi
  commitlint: # Conventional Commits trên PR (không cần install monorepo)
  quality: # Format check + Lint kiến trúc (chạy song song)
  typecheck: # tsc --noEmit (chạy song song)
  test-unit: # Vitest unit test + pnpm audit:ci (chạy song song)
  integration: # Postgres 16 + Redis test RLS & migrations
  openapi-drift: # Sinh lại OpenAPI spec, kiểm tra không có git diff
  ci-gate: # Cổng tổng hợp trạng thái cho GitHub Branch Protection
```

### E2. CI đỏ là dừng mọi việc 👀

`main` đỏ ➔ ưu tiên cao nhất là làm nó xanh. Không merge chồng lên nhánh đang đỏ.

### E3. CI dưới 10 phút & Phân vùng thông minh 💡

- Dùng GitHub Actions cache cho `.turbo` và `pnpm store`.
- **PR vào `develop`**: Lọc đường dẫn thông minh — sửa tài liệu/docs thì bỏ qua build code; sửa Frontend Web thì không kích hoạt DB test .
- **PR vào `main`**: Bắt buộc chạy 100% test suite không skip.
- **Branch Protection**: Chỉ cần chọn duy nhất check `CI Gate`.

### E4. Không có bước nào được phép "cho phép thất bại" 🤖

`continue-on-error: true` biến cổng kiểm tra thành đồ trang trí.

---

## Phần F. Phát hành

### F1. Tag theo SemVer 👀

`v1.4.0`. Breaking change ➔ major.

### F2. CHANGELOG sinh từ conventional commit 🤖

### F3. Deploy được thì rollback được 👀

Mọi lần deploy phải có đường lùi đã kiểm chứng. Migration bất khả nghịch (`DROP COLUMN`) tách thành lần deploy riêng.
