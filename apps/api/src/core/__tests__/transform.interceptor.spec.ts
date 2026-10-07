import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { TransformInterceptor } from '@/core/interceptors/transform.interceptor.js';

class FakeController {
  handle(): void {
    // Only ever used as a metadata lookup key.
  }
}

function makeContext(statusCode = 200): ExecutionContext {
  return {
    switchToHttp: () => ({ getResponse: () => ({ statusCode, setHeader: vi.fn() }) }),
    getHandler: () => () => undefined,
    getClass: () => FakeController,
  } as unknown as ExecutionContext;
}

function makeInterceptor(skip = false): TransformInterceptor<unknown> {
  const reflector = { getAllAndOverride: () => skip } as unknown as Reflector;
  return new TransformInterceptor(reflector);
}

const handlerReturning = (value: unknown): CallHandler => ({ handle: () => of(value) });

describe('TransformInterceptor', () => {
  it('wraps a plain body in the data envelope', async () => {
    const result = await firstValueFrom(
      makeInterceptor().intercept(makeContext(), handlerReturning({ id: 'v-1' })),
    );

    expect(result).toEqual({ data: { id: 'v-1' } });
  });

  it('keeps data present even when the value is null', async () => {
    const result = await firstValueFrom(
      makeInterceptor().intercept(makeContext(), handlerReturning(null)),
    );

    // `data: null` rather than an empty body: there must always be somewhere to
    // add `meta` later without breaking existing clients.
    expect(result).toEqual({ data: null });
  });

  it('never returns a bare array at the top level', async () => {
    const result = await firstValueFrom(
      makeInterceptor().intercept(makeContext(), handlerReturning([{ id: 'v-1' }])),
    );

    expect(result).toEqual({ data: [{ id: 'v-1' }] });
  });

  it('lifts pagination meta out of a paginated result', async () => {
    const meta = { page: 1, limit: 20, total: 2, totalPages: 1 };
    const result = await firstValueFrom(
      makeInterceptor().intercept(makeContext(), handlerReturning({ items: ['a', 'b'], meta })),
    );

    expect(result).toEqual({ data: ['a', 'b'], meta });
  });

  it('leaves a 204 body alone, since wrapping it would make it a 200', async () => {
    const result = await firstValueFrom(
      makeInterceptor().intercept(makeContext(204), handlerReturning(undefined)),
    );

    expect(result).toBeUndefined();
  });

  it('respects @NoEnvelope()', async () => {
    const result = await firstValueFrom(
      makeInterceptor(true).intercept(makeContext(), handlerReturning('raw')),
    );

    expect(result).toBe('raw');
  });

  it('does not buffer a stream into JSON', async () => {
    const stream = { pipe: () => undefined };
    const result = await firstValueFrom(
      makeInterceptor().intercept(makeContext(), handlerReturning(stream)),
    );

    expect(result).toBe(stream);
  });
});
