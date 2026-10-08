import { ForbiddenError } from '@casl/ability';
import {
  Catch,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

import { PROBLEM_CONTENT_TYPE, type InvalidParam, type ProblemDetails } from '@repo/shared-types';

import {
  ERROR_CODES,
  ERROR_TYPE_BASE_URI,
  TRACE_ID_HEADER,
  type ErrorCode,
} from '@/common/index.js';
import { AppError } from '@/core/errors/index.js';
import { getActiveTraceId } from '@/core/telemetry/trace.util.js';

export function toInvalidParams(error: ZodError): InvalidParam[] {
  return error.issues.map((issue) => ({
    name: issue.path.length > 0 ? issue.path.join('.') : '(body)',
    reason: issue.message,
  }));
}

const SERVER_ERROR_THRESHOLD = 500;

interface Mapped {
  status: number;
  code: ErrorCode;
  detail: string;
  invalidParams?: InvalidParam[];
}

/** Postgres SQLSTATE codes exposed as stable, client-meaningful API errors. */
const PG_ERROR_MAP: Record<string, Mapped> = {
  '23505': {
    status: HttpStatus.CONFLICT,
    code: ERROR_CODES.RESOURCE_CONFLICT,
    detail: 'A resource with the same unique value already exists',
  },
  '23503': {
    status: HttpStatus.CONFLICT,
    code: ERROR_CODES.REFERENCE_CONSTRAINT,
    detail: 'A referenced resource does not exist or is still in use',
  },
  '23514': {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ERROR_CODES.VALIDATION_FAILED,
    detail: 'A value violates a database constraint',
  },
  /*
   * An RLS policy refused the row, or a trigger raised 42501 because the user or
   * role it was given is not visible to the caller. Either way the request asked
   * for something this caller may not have, which is a 403 — reporting it as a
   * 500 sends an operator hunting for a server fault that does not exist.
   */
  '42501': {
    status: HttpStatus.FORBIDDEN,
    code: ERROR_CODES.FORBIDDEN,
    detail: 'You are not allowed to perform this action',
  },
};

const TIMEOUT_SYSCALL_CODES = new Set(['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ECONNABORTED']);

const STATUS_CODE_FALLBACK: Record<number, ErrorCode> = {
  400: ERROR_CODES.MALFORMED_REQUEST,
  401: ERROR_CODES.UNAUTHENTICATED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.RESOURCE_NOT_FOUND,
  409: ERROR_CODES.RESOURCE_CONFLICT,
  422: ERROR_CODES.VALIDATION_FAILED,
  429: ERROR_CODES.RATE_LIMIT_EXCEEDED,
  502: ERROR_CODES.UPSTREAM_UNAVAILABLE,
  503: ERROR_CODES.SERVICE_UNAVAILABLE,
  504: ERROR_CODES.UPSTREAM_TIMEOUT,
};

function titleFromCode(code: ErrorCode): string {
  return code
    .toLowerCase()
    .split('_')
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function hasStringProp<K extends string>(value: unknown, key: K): value is Record<K, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<K, unknown>)[key] === 'string'
  );
}

/**
 * Every error leaving the API becomes RFC 9457 Problem Details. The
 * infrastructure mapping table lives here and only here, so a driver-specific
 * code never has to be understood in two places
 * (docs/02-backend-core-va-drizzle-rls.md 3.2).
 */
@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const mapped = this.map(exception);
    const traceId = getActiveTraceId();

    const problem: ProblemDetails = {
      type: `${ERROR_TYPE_BASE_URI}${mapped.code}`,
      title: titleFromCode(mapped.code),
      status: mapped.status,
      detail: mapped.detail,
      instance: request.originalUrl,
      code: mapped.code,
      ...(traceId === undefined ? {} : { traceId }),
      ...(mapped.invalidParams === undefined ? {} : { invalidParams: mapped.invalidParams }),
    };

    // 5xx means the system failed and someone should look; 4xx means the client
    // sent something wrong, which is the system working as designed.
    if (mapped.status >= SERVER_ERROR_THRESHOLD) {
      const payload = { err: exception, code: mapped.code, status: mapped.status, traceId };
      this.logger.error(payload, 'Request failed');
    } else {
      const payload = { code: mapped.code, problem, status: mapped.status, traceId };
      this.logger.warn(payload, 'Request rejected');
    }

    if (traceId !== undefined) response.setHeader(TRACE_ID_HEADER, traceId);
    response.status(mapped.status).type(PROBLEM_CONTENT_TYPE).send(problem);
  }

  private map(exception: unknown): Mapped {
    if (exception instanceof ZodValidationException) {
      return this.validationFailure(toInvalidParams(exception.getZodError() as ZodError));
    }

    if (exception instanceof ZodError) {
      return this.validationFailure(toInvalidParams(exception));
    }

    // Covers every deliberate domain error: each one carries its own code and
    // status, so there is no per-error branch to keep in sync here.
    if (exception instanceof AppError) {
      return { status: exception.status, code: exception.code, detail: exception.message };
    }

    if (exception instanceof ForbiddenError) {
      return {
        status: HttpStatus.FORBIDDEN,
        code: ERROR_CODES.FORBIDDEN,
        detail: 'You are not allowed to perform this action',
      };
    }

    const code = errorCodeOf(exception);
    if (code !== undefined) {
      const pg = PG_ERROR_MAP[code];
      if (pg !== undefined) return pg;

      if (TIMEOUT_SYSCALL_CODES.has(code)) {
        return {
          status: HttpStatus.BAD_GATEWAY,
          code: ERROR_CODES.UPSTREAM_TIMEOUT,
          detail: 'An upstream service did not respond in time',
        };
      }
    }

    if (exception instanceof HttpException) return this.fromHttpException(exception);

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      // Never `exception.message`: it leaks table names, SQL and file paths
      // (docs/rules/07-security.md E2).
      detail: 'An unexpected error occurred',
    };
  }

  private validationFailure(invalidParams: InvalidParam[]): Mapped {
    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: ERROR_CODES.VALIDATION_FAILED,
      detail: 'The request payload failed validation',
      invalidParams,
    };
  }

  private fromHttpException(exception: HttpException): Mapped {
    const status = exception.getStatus();
    const body: unknown = exception.getResponse();

    if (status >= SERVER_ERROR_THRESHOLD) {
      return {
        status,
        code: ERROR_CODES.INTERNAL_ERROR,
        detail: 'An unexpected error occurred',
      };
    }

    const code =
      (hasStringProp(body, 'code') ? (body.code as ErrorCode) : undefined) ??
      STATUS_CODE_FALLBACK[status] ??
      ERROR_CODES.MALFORMED_REQUEST;

    let detail = exception.message;
    let invalidParams: InvalidParam[] | undefined = undefined;

    if (typeof body === 'object' && body !== null) {
      const message = (body as Record<string, unknown>)['message'];

      if (Array.isArray(message) && message.every((m) => typeof m === 'string')) {
        detail = 'The request payload failed validation';
        invalidParams = message.map((msg) => ({
          name: '(body)',
          reason: msg,
        }));
      } else if (typeof message === 'string') {
        detail = message;
      }
    } else if (typeof body === 'string') {
      detail = body;
    }

    return {
      status,
      code,
      detail,
      ...(invalidParams !== undefined ? { invalidParams } : {}),
    };
  }
}

const MAX_CAUSE_DEPTH = 3;

/**
 * The string `code` of an error or of the error that caused it.
 *
 * Drizzle wraps the driver's error in a `DrizzleQueryError` and keeps the
 * Postgres SQLSTATE (23505, ...) on `cause`, so reading only the top-level
 * `code` turned every unique-violation into a 500.
 */
function errorCodeOf(exception: unknown): string | undefined {
  let current: unknown = exception;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof current !== 'object' || current === null) return undefined;
    const candidate = (current as { code?: unknown }).code;
    if (typeof candidate === 'string') return candidate;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}
