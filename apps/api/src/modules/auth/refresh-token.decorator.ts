import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { REFRESH_COOKIE_NAME } from './auth-cookie.factory.js';

interface RequestWithCookies {
  cookies?: Record<string, string | undefined>;
}

/**
 * Reads the httpOnly refresh cookie. A param decorator rather than `@Req()` so
 * the controller still never sees the request object.
 */
export const RefreshCookie = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    context.switchToHttp().getRequest<RequestWithCookies>().cookies?.[REFRESH_COOKIE_NAME],
);
