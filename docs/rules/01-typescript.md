---
title: TypeScript & Path Alias
description: Quy tắc dùng TypeScript, cấu hình strict, và chuẩn path alias cho toàn monorepo
status: stable
updated: 2026-10-07
owner: Platform Team
---

# 01 — TypeScript & Path Alias

---

## Phần A. Path Alias

### A1. Cấm đường dẫn tương đối leo cấp 🤖

**Quy tắc:** cấm mọi import chứa `../`. Ra khỏi thư mục hiện tại ➔ dùng alias. Trong cùng thư mục thì `./x` vẫn hợp lệ.

**Vì sao:** `../../../lib/utils` không cho biết mình đang ở đâu, gãy ngay khi di chuyển file, và làm mọi thao tác refactor thành thủ công.

```typescript
// ❌
import { cn } from '../../../lib/utils';
import { UsersTable } from '../../users/components/users-table';
// ✅
import { cn } from '@/lib/utils';
import { UsersPage } from '@/features/users';
```

**Cưỡng chế:** 🤖 `no-restricted-imports` với pattern `../*` và `../../*` (`packages/eslint-config/base.js`).

### A2. Bảng alias chuẩn

Alias được cố định cho toàn monorepo. **Không tự chế alias mới** mà không sửa file quy tắc này.

#### `apps/api` (NestJS)

| Alias            | Trỏ tới            | Tầng |
| :--------------- | :----------------- | :--- |
| `@/config`       | `src/config`       | 1    |
| `@/common`       | `src/common`       | 2    |
| `@/core`         | `src/core`         | 3    |
| `@/integrations` | `src/integrations` | 4    |
| `@/modules`      | `src/modules`      | 5    |

API là ESM (`NodeNext`): import tương đối và import alias tới file đều kèm đuôi `.js` (ví dụ `@/core/errors/index.js`); riêng `@/config` và `@/common` còn có alias tới `index.ts`.

#### `apps/web` (React + Vite)

| Alias | Trỏ tới | Ghi chú                                                                                                                                      |
| :---- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `@/*` | `src/*` | Một alias duy nhất; các thư mục `app`, `config`, `lib`, `shared`, `entities`, `features` đi sau nó (`@/lib/http/client`, `@/features/users`) |

#### Toàn monorepo

| Alias                | Trỏ tới                     |
| :------------------- | :-------------------------- |
| `@repo/shared-types` | `packages/shared-types/src` |
| `@repo/api-contract` | `packages/api-contract/src` |

> Khi nhân bản boilerplate sang dự án mới, đổi `@repo/` thành namespace của dự án (xem [00-tong-quan-boilerplate.md](../00-tong-quan-boilerplate.md)).

### A3. Alias phải khai đồng bộ ở mọi nơi dùng nó 👀

Đây là lỗi hay gặp nhất: khai trong `tsconfig` nên IDE và `tsc` không báo đỏ, nhưng bundler/test runner không hiểu ➔ **fail lúc chạy**.

| App        | Nơi khai                                                                                                                                                   |
| :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api` | `tsconfig.json` ➔ `paths` (cũng được `tsc-alias` dùng khi build) · `vitest.config.ts` ➔ `resolve.alias` · `vitest.integration.config.ts` ➔ `resolve.alias` |
| `apps/web` | `tsconfig.json` ➔ `paths` · `vite.config.ts` ➔ `resolve.alias` (vitest dùng chung file này)                                                                |

ESLint (`import/no-unresolved`) phân giải alias qua `eslint-import-resolver-typescript` đọc `tsconfig.json`, nên chỉ bắt được alias thiếu ở tsconfig.

```jsonc
// tsconfig.json — apps/web
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
  },
}
```

```typescript
// vite.config.ts — phải khớp với tsconfig ở trên
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
```

**Cưỡng chế:** 🤖 một phần: `import/no-unresolved` + `tsc` bắt alias thiếu ở tsconfig; thiếu ở vitest/vite chỉ lộ khi chạy test/build.

### A4. Import xuyên feature chỉ qua public entry 🤖

```typescript
// ❌ Thò tay vào ruột feature khác
import { CreateUserForm } from '@/features/users/components/create-user-form';
// ✅ Chỉ lấy thứ feature đó chủ động công bố
import { UsersPage } from '@/features/users';
```

**Cưỡng chế:** 🤖 `boundaries/entry-point`.

### A5. Thứ tự nhóm import 🤖

1. Built-in Node (`node:*`)
2. Package bên ngoài
3. `@repo/*`
4. Alias nội bộ (`@/...`)
5. Tương đối cùng thư mục (`./...`)

Mỗi nhóm cách nhau 1 dòng trắng, trong nhóm sắp theo alphabet.

**Cưỡng chế:** 🤖 `import/order` với `newlines-between: 'always'`.

---

## Phần B. Cấu hình Compiler

### B1. Cờ bắt buộc 🤖

```jsonc
// packages/tsconfig/base.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true, // arr[0] có kiểu T | undefined
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true, // catch (e: unknown)
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true, // obj['key'] thay vì obj.key
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
  },
}
```

**Vì sao `noUncheckedIndexedAccess`:** không có nó, `const first = items[0]` được suy ra là `T` kể cả khi mảng rỗng ➔ `undefined is not an object` lúc runtime. Đây là cờ đắt giá nhất trong danh sách.

**Không được tắt bất kỳ cờ nào ở cấp app.** Cần ngoại lệ ➔ sửa file quy tắc này. Ngoại lệ hiện có, nằm ở preset chứ không ở app: `packages/tsconfig/nest.json` tắt `verbatimModuleSyntax` (decorator metadata của Nest cần import giá trị) và dùng `module: NodeNext`.

---

## Phần C. Quy tắc dùng Type

### C1. Cấm `any` 🤖

```typescript
// ❌ function parse(input: any) {}
// ✅ function parse(input: unknown) { const parsed = schema.parse(input); }
```

Dữ liệu từ bên ngoài (HTTP body, `JSON.parse`, `localStorage`) vào hệ thống dưới dạng `unknown`, và **chỉ** trở thành type cụ thể sau khi qua Zod.

**Cưỡng chế:** 🤖 `@typescript-eslint/no-explicit-any: 'error'`.

### C2. Cấm ép kiểu `as` để dập lỗi 🤖

```typescript
// ❌ const user = data as User;                    // nói dối compiler
// ❌ const el = document.querySelector('#x') as HTMLInputElement;
// ✅ const user = userSchema.parse(data);          // kiểm chứng lúc runtime
// ✅ if (el instanceof HTMLInputElement) { ... }   // thu hẹp kiểu
```

**Ngoại lệ được phép:** `as const`, ép kiểu trong test fixture, và type predicate (`x is T`).

**Cưỡng chế:** 🤖 `@typescript-eslint/consistent-type-assertions` với `objectLiteralTypeAssertions: 'never'`.

### C3. `type` hay `interface` 🤖

- **`interface`** cho hình dạng object có thể được mở rộng (DTO, props, hợp đồng service).
- **`type`** cho union, intersection, mapped type, tuple, hàm.

**Cưỡng chế:** 🤖 `@typescript-eslint/consistent-type-definitions: ['error', 'interface']`.

### C4. Suy ra kiểu ở nơi hiển nhiên, khai báo tường minh ở ranh giới 👀

```typescript
// ❌ Thừa
const count: number = 0;
// ✅ Để compiler tự suy
const count = 0;

// ✅ Nhưng LUÔN khai báo kiểu trả về của hàm export
export function calculateCommission(order: Order): Money { ... }
```

**Vì sao:** kiểu trả về tường minh biến thay đổi ngoài ý muốn thành lỗi compile ngay tại hàm đó, thay vì lan ra 20 nơi gọi.

**Cưỡng chế:** 🤖 `@typescript-eslint/explicit-module-boundary-types`.

### C5. Union tốt hơn boolean cho trạng thái 💡

```typescript
// ❌ 4 tổ hợp nhưng chỉ 3 hợp lệ — trạng thái "vừa loading vừa error" là không thể
interface State {
  isLoading: boolean;
  isError: boolean;
  data?: Data;
}
// ✅ Chỉ những trạng thái hợp lệ mới biểu diễn được
type State = { status: 'loading' } | { status: 'error'; error: AppError } | { status: 'success'; data: Data };
```

### C6. `import type` cho import chỉ dùng làm kiểu 🤖

```typescript
import type { Project } from '@repo/shared-types';
```

**Vì sao:** `verbatimModuleSyntax` (ở web) yêu cầu điều này, và nó tránh import vòng lúc runtime với decorator của NestJS; ở API ESLint `consistent-type-imports` thay thế vai trò đó.

**Cưỡng chế:** 🤖 `@typescript-eslint/consistent-type-imports`.

### C7. Zod là nguồn sự thật cho dữ liệu ngoài 👀

```typescript
const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  priceMinor: z.number().int().nonnegative(),
});
// Suy type từ schema, KHÔNG khai báo interface song song rồi tự giữ đồng bộ
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
```

### C8. Cấm non-null assertion `!` 🤖

```typescript
// ❌ const tenant = user.tenantId!;
// ✅ if (!user.tenantId) throw new MissingTenantContextError(user.id);
//    const tenant = user.tenantId;
```

Không có ngoại lệ trong lint. Với React context, dùng giá trị mặc định thật thay vì `createContext(null!)` (xem `AbilityContext`, mặc định là ability rỗng).

**Cưỡng chế:** 🤖 `@typescript-eslint/no-non-null-assertion`.
