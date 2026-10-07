import { HttpStatus } from '@nestjs/common';

import { ERROR_CODES, type ErrorCode } from '@/common/index.js';

/**
 * Base class for errors the domain raises deliberately.
 *
 * Carrying the `ErrorCode` and HTTP status on the error itself lets the global
 * filter translate without a chain of `instanceof` checks, and keeps services
 * free of `HttpException` — a service must not know it is behind HTTP, because
 * the same service has to work from a worker or a CLI command
 * (docs/rules/02-backend-nestjs.md C1).
 */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly status: number;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace(this, new.target);
  }
}

/**
 * A query was attempted with no access context bound to the execution.
 * Fail-closed: better a 403 than a query whose RLS scope is whatever the
 * previous request on this pooled connection happened to leave behind.
 */
export class MissingAccessContextError extends AppError {
  readonly code = ERROR_CODES.ACCESS_CONTEXT_REQUIRED;
  readonly status = HttpStatus.FORBIDDEN;

  constructor() {
    super('No access context is bound to this execution');
  }
}

export class ResourceNotFoundError extends AppError {
  readonly code = ERROR_CODES.RESOURCE_NOT_FOUND;
  readonly status = HttpStatus.NOT_FOUND;

  constructor(resourceType: string, resourceId?: string) {
    super(`${resourceType}${resourceId === undefined ? '' : ` "${resourceId}"`} was not found`, {
      resourceType,
      ...(resourceId === undefined ? {} : { resourceId }),
    });
  }
}

export class ResourceConflictError extends AppError {
  readonly code = ERROR_CODES.RESOURCE_CONFLICT;
  readonly status = HttpStatus.CONFLICT;
}

export class ForbiddenActionError extends AppError {
  readonly code = ERROR_CODES.FORBIDDEN;
  readonly status = HttpStatus.FORBIDDEN;

  constructor(action: string, subject: string) {
    // The message names the attempted action, never the rule that blocked it:
    // explaining the denial leaks the authorization model.
    super(`Not allowed to ${action} ${subject}`, { action, subject });
  }
}

export class InvalidCredentialsError extends AppError {
  readonly code = ERROR_CODES.INVALID_CREDENTIALS;
  readonly status = HttpStatus.UNAUTHORIZED;

  constructor() {
    // Identical message for "no such email" and "wrong password" on purpose
    // (docs/rules/07-security.md D5): distinguishing them turns the login form
    // into an account-enumeration oracle.
    super('Invalid email or password');
  }
}

export class RefreshTokenInvalidError extends AppError {
  readonly code = ERROR_CODES.UNAUTHENTICATED;
  readonly status = HttpStatus.UNAUTHORIZED;

  constructor() {
    super('Refresh token is invalid or expired');
  }
}

/**
 * A refresh token that was already rotated came back a second time — the exact
 * signal the rotation scheme exists to catch. Either it leaked, or a
 * legitimate client retried a request whose response never arrived; either way
 * the whole family is revoked (docs/03-auth-flow-va-casl-abac.md 1.3).
 */
export class TokenReuseDetectedError extends AppError {
  readonly code = ERROR_CODES.TOKEN_REUSE_DETECTED;
  readonly status = HttpStatus.UNAUTHORIZED;

  constructor() {
    super('Refresh token reuse detected; the session has been revoked');
  }
}

export class UnauthenticatedError extends AppError {
  readonly code = ERROR_CODES.UNAUTHENTICATED;
  readonly status = HttpStatus.UNAUTHORIZED;

  constructor(message = 'Authentication is required') {
    super(message);
  }
}

export class CsrfValidationFailedError extends AppError {
  readonly code = ERROR_CODES.CSRF_VALIDATION_FAILED;
  readonly status = HttpStatus.FORBIDDEN;

  constructor() {
    super('CSRF token missing or did not match');
  }
}

export class ServiceUnavailableError extends AppError {
  readonly code = ERROR_CODES.SERVICE_UNAVAILABLE;
  readonly status = HttpStatus.SERVICE_UNAVAILABLE;

  constructor(dependency: string) {
    super(`Dependency "${dependency}" is unavailable`, { dependency });
  }
}

export class InvalidOtpError extends AppError {
  readonly code = ERROR_CODES.VALIDATION_FAILED;
  readonly status = HttpStatus.BAD_REQUEST;

  constructor(message = 'Invalid or expired OTP code') {
    super(message);
  }
}

export class OtpCooldownActiveError extends AppError {
  readonly code = ERROR_CODES.RATE_LIMIT_EXCEEDED;
  readonly status = HttpStatus.TOO_MANY_REQUESTS;

  constructor(secondsRemaining: number) {
    super(`Please wait ${String(secondsRemaining)} seconds before requesting another OTP`, {
      secondsRemaining,
    });
  }
}

export class AccountNotVerifiedError extends AppError {
  readonly code = ERROR_CODES.FORBIDDEN;
  readonly status = HttpStatus.FORBIDDEN;

  constructor() {
    super('Account not activated. Please verify your email to log in.');
  }
}
