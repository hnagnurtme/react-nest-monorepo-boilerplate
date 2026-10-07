import { HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { ProblemDetails } from '@repo/shared-types';

import { InvalidCredentialsError, ResourceNotFoundError } from '@/core/errors/index.js';
import { GlobalExceptionFilter } from '@/core/filters/global-exception.filter.js';

function makeHost(): { host: ArgumentsHost; sent: () => ProblemDetails; status: () => number } {
  let body: ProblemDetails | undefined;
  let statusCode = 0;

  const response = {
    setHeader: vi.fn(),
    status: (code: number) => {
      statusCode = code;
      return response;
    },
    type: () => response,
    send: (payload: ProblemDetails) => {
      body = payload;
      return response;
    },
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl: '/api/v1/things' }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return {
    host,
    sent: () => body!,
    status: () => statusCode,
  };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    const logger = { setContext: vi.fn(), error: vi.fn(), warn: vi.fn() };
    filter = new GlobalExceptionFilter(logger as never);
  });

  it('renders a domain error with its own code and status', () => {
    const { host, sent, status } = makeHost();

    filter.catch(new ResourceNotFoundError('User', 'u-1'), host);

    expect(status()).toBe(HttpStatus.NOT_FOUND);
    expect(sent()).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      title: 'Resource Not Found',
      type: 'https://api.boilerplate.com/errors/RESOURCE_NOT_FOUND',
      instance: '/api/v1/things',
    });
  });

  it('maps a Postgres unique violation wrapped by Drizzle to 409', () => {
    const { host, status } = makeHost();
    const wrapped = Object.assign(new Error('Failed query'), {
      cause: Object.assign(new Error('duplicate key'), { code: '23505' }),
    });

    filter.catch(wrapped, host);

    expect(status()).toBe(HttpStatus.CONFLICT);
  });

  it('turns a validation failure into 422 with invalidParams', () => {
    const { host, sent, status } = makeHost();

    const zodError = new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Invalid email',
      },
    ]);

    filter.catch(new ZodValidationException(zodError), host);

    expect(status()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(sent().invalidParams).toEqual([{ name: 'email', reason: 'Invalid email' }]);
  });

  it('handles a raw ZodError that escaped the pipe', () => {
    const { host, status } = makeHost();
    const error = z.object({ age: z.number() }).safeParse({ age: 'x' });

    filter.catch(error.success ? new Error('unreachable') : error.error, host);

    expect(status()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('maps a foreign-key violation to its stable reference-constraint code', () => {
    const { host, sent, status } = makeHost();

    filter.catch({ code: '23503', detail: 'Key (user_id)=(abc) is not present.' }, host);

    expect(status()).toBe(HttpStatus.CONFLICT);
    expect(sent().code).toBe('REFERENCE_CONSTRAINT');
    expect(JSON.stringify(sent())).not.toContain('user_id');
  });

  it('never leaks the message of an unexpected error', () => {
    const { host, sent, status } = makeHost();

    filter.catch(new Error('relation "users" does not exist at /srv/app/db.ts:42'), host);

    expect(status()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(sent().detail).toBe('An unexpected error occurred');
    expect(JSON.stringify(sent())).not.toContain('users');
  });

  it('never leaks the message of a 5xx HttpException either', () => {
    const { host, sent } = makeHost();

    filter.catch(new HttpException('upstream said: secret', 502), host);

    expect(sent().detail).toBe('An unexpected error occurred');
  });

  it('keeps the message of a 4xx HttpException, which is meant for the caller', () => {
    const { host, sent } = makeHost();

    filter.catch(new HttpException('Too many requests', 429), host);

    expect(sent()).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', detail: 'Too many requests' });
  });

  it('gives the same answer for a bad email as for a bad password', () => {
    const { host, sent } = makeHost();

    filter.catch(new InvalidCredentialsError(), host);

    // Two different causes, one indistinguishable response: anything else lets
    // a caller enumerate which addresses are registered.
    expect(sent().detail).toBe('Invalid email or password');
  });

  it('maps array messages from NestJS pipes to invalidParams', () => {
    const { host, sent } = makeHost();

    const response = {
      message: ['email must be a string', 'password is too short'],
      error: 'Bad Request',
      statusCode: 400,
    };
    filter.catch(new HttpException(response, HttpStatus.BAD_REQUEST), host);

    expect(sent()).toMatchObject({
      code: 'MALFORMED_REQUEST',
      detail: 'The request payload failed validation',
    });
    expect(sent().invalidParams).toEqual([
      { name: '(body)', reason: 'email must be a string' },
      { name: '(body)', reason: 'password is too short' },
    ]);
  });
});
