import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { CLIENT_TYPE_HEADER } from '@/common/constants/index.js';
import type { ClientInfo } from '@/common/types/index.js';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string | undefined;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Extracts the device facts auth needs (client type, IP, user agent) without
 * letting the controller import `Request` (docs/rules/02-backend-nestjs.md B2).
 */
export const ClientInfoParam = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClientInfo => {
    const request = context.switchToHttp().getRequest<RequestLike>();

    return {
      isMobile: firstHeader(request.headers[CLIENT_TYPE_HEADER]) === 'mobile',
      ipAddress: request.ip,
      userAgent: firstHeader(request.headers['user-agent']),
    };
  },
);
