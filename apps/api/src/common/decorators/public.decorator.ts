import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the globally registered `JwtAuthGuard`.
 *
 * The guard is global and this decorator is the only way past it, so the
 * fail-safe direction is correct: forgetting the decorator makes an endpoint
 * inaccessible, never unprotected (docs/rules/07-security.md B5).
 */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
