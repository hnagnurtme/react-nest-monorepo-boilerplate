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

**Vì sao:** `../../../shared/utils/money` không cho biết mình đang ở đâu, gãy ngay khi di chuyển file, và làm mọi thao tác refactor thành thủ công.

```typescript
// ❌
import { formatMoney } from '../../../shared/utils/money';
import { ProjectCard } from '../../projects/components/ProjectCard';
// ✅
import { formatMoney } from '@/shared/utils/money';
import { ProjectCard } from '@/features/projects';
```

**Cưỡng chế:** 🤖

```javascript
'no-restricted-imports': ['error', {
  patterns: [{ group: ['../*'], message: 'Dùng path alias (@/...) thay cho đường dẫn leo cấp.' }],
}]
```

### A2. Bảng alias chuẩn

Alias được cố định cho toàn monorepo. **Không tự chế alias mới** mà không sửa file quy tắc này.

#### `apps/api` (NestJS)

| Alias              | Trỏ tới              | Tầng |
| :----------------- | :------------------- | :--- |
| `@/config/*`       | `src/config/*`       | 1    |
| `@/common/*`       | `src/common/*`       | 2    |
| `@/core/*`         | `src/core/*`         | 3    |
| `@/integrations/*` | `src/integrations/*` | 4    |
| `@/modules/*`      | `src/modules/*`      | 5    |

#### `apps/web` (React + Vite)

| Alias          | Trỏ tới          |
| :------------- | :--------------- |
| `@/app/*`      | `src/app/*`      |
| `@/config/*`   | `src/config/*`   |
| `@/lib/*`      | `src/lib/*`      |
| `@/shared/*`   | `src/shared/*`   |
| `@/entities/*` | `src/entities/*` |
| `@/features/*` | `src/features/*` |

#### Toàn monorepo

| Alias                | Trỏ tới                     |
| :------------------- | :-------------------------- |
| `@repo/shared-types` | `packages/shared-types/src` |
| `@repo/api-contract` | `packages/api-contract/src` |

> Khi nhân bản boilerplate sang dự án mới, đổi `@repo/` thành namespace của dự án (xem [00-tong-quan-boilerplate.md](../00-tong-quan-boilerplate.md)).

### A3. Alias phải khai đồng bộ ở 3 nơi 🤖

Đây là lỗi hay gặp nhất: khai trong `tsconfig` nên IDE không báo đỏ, nhưng bundler không hiểu ➔ **fail lúc runtime**.

| Nơi khai             | File                                                                    | Ai dùng            |
| :------------------- | :---------------------------------------------------------------------- | :----------------- |
| 1. TypeScript        | `tsconfig.json` ➔ `compilerOptions.paths`                               | `tsc`, IDE         |
| 2. Bundler / runtime | `vite.config.ts` (`resolve.alias`) · `nest-cli.json` + `tsconfig-paths` | Lúc build và chạy  |
| 3. ESLint            | `eslint-import-resolver-typescript`                                     | Quy tắc `import/*` |

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

**Cưỡng chế:** 🤖 `import/no-unresolved` phát hiện alias khai thiếu ở bất kỳ nơi nào.

### A4. Import xuyên feature chỉ qua public entry 🤖

```typescript
// ❌ Thò tay vào ruột feature khác
import { OrderTable } from '@/features/orders/components/OrderTable';
// ✅ Chỉ lấy thứ feature đó chủ động công bố
import { OrderTable } from '@/features/orders';
```

**Cưỡng chế:** 🤖 `boundaries/entry-point`.

### A5. Thứ tự nhóm import 🤖

1. Built-in Node (`node:*`)
2. Package bên ngoài
3. `@repo/*`
4. Alias nội bộ (`@/...`)
5. Tương đối cùng thư mục (`./...`)
6. Import kiểu CSS

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
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true, // catch (e: unknown)
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
  },
}
```

**Vì sao `noUncheckedIndexedAccess`:** không có nó, `const first = items[0]` được suy ra là `T` kể cả khi mảng rỗng ➔ `undefined is not an object` lúc runtime. Đây là cờ đắt giá nhất trong danh sách.

**Không được tắt bất kỳ cờ nào ở cấp app.** Cần ngoại lệ ➔ sửa file quy tắc này.

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

**Vì sao:** `verbatimModuleSyntax` yêu cầu điều này, và nó tránh import vòng lúc runtime với decorator của NestJS.

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

**Ngoại lệ:** `createContext(null!)` cho React context — nhưng xem [04-frontend-react.md](04-frontend-react.md), cách tốt hơn là dùng giá trị mặc định thật.

**Cưỡng chế:** 🤖 `@typescript-eslint/no-non-null-assertion`.
