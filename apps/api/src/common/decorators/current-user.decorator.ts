import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthContext } from '@/common/types/index.js';

interface RequestWithUser {
  user?: AuthContext;
}

/**
 * Hands the handler the verified caller.
 *
 * Everything tenant-scoped must read `tenantId` from here, never from the body
 * or the query string — a client-supplied tenantId is a client-supplied
 * authorization decision (docs/rules/02-backend-nestjs.md E3).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext | undefined =>
    context.switchToHttp().getRequest<RequestWithUser>().user,
);
