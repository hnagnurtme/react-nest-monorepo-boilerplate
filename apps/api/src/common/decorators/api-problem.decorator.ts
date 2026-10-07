import { HttpStatus, applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

const DESCRIPTIONS: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Malformed request',
  [HttpStatus.UNAUTHORIZED]: 'Not authenticated, or the token is invalid or expired',
  [HttpStatus.FORBIDDEN]: 'Authenticated, but not allowed to do this',
  [HttpStatus.NOT_FOUND]: 'No such resource, or the caller may not know it exists',
  [HttpStatus.CONFLICT]: 'The resource is in a state that forbids this change',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'The payload failed validation',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Rate limit exceeded; see Retry-After',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'A dependency is unavailable',
};

/**
 * Declares the RFC 9457 error responses an endpoint can return.
 *
 * Every endpoint has to document every status it answers with
 * (docs/rules/02-backend-nestjs.md B3), and spelling out five `@ApiResponse`
 * decorators per handler pushes controllers past the line limit that keeps them
 * thin. One decorator, one list of statuses.
 */
export const ApiProblemResponses = (...statuses: HttpStatus[]): MethodDecorator =>
  applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: DESCRIPTIONS[status] ?? 'Error',
        content: { 'application/problem+json': {} },
      }),
    ),
  );
