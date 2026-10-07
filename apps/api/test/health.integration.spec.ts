// Same rule as main.ts: the tracer patches `http` and `pg` at import time, so
// it has to come first or the spans (and the x-trace-id header) never exist.
import '../src/core/telemetry/tracer.js';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { GlobalExceptionFilter } from '../src/core/filters/global-exception.filter.js';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor.js';

/**
 * Boots the real container, so it needs the real Postgres and Redis — hence
 * `*.integration.spec.ts` rather than a unit test. The point is exactly that
 * the probes talk to live dependencies; a version with both mocked would answer
 * "ok" during an outage.
 */
describe('health endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ bufferLogs: true });
    app.useGlobalFilters(app.get(GlobalExceptionFilter));
    app.useGlobalInterceptors(app.get(TransformInterceptor));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports liveness without touching any dependency', async () => {
    const response = await request(app.getHttpServer()).get('/healthz').expect(200);

    expect(response.body).toEqual({ data: { service: 'api', status: 'ok' } });
  });

  it('reports readiness with every dependency up', async () => {
    // Poll rather than assert immediately: readiness legitimately answers 503
    // while the Redis connection is still being established, which is the
    // whole point of having a readiness probe separate from liveness. An
    // orchestrator retries too.
    const response = await waitForReady();

    expect(response.body.data).toMatchObject({
      service: 'api',
      status: 'ok',
      dependencies: [
        { name: 'postgres', status: 'up' },
        { name: 'redis', status: 'up' },
      ],
    });
  });

  async function waitForReady(): Promise<request.Response> {
    const attempts = 20;
    let last = await request(app.getHttpServer()).get('/readyz');

    for (let attempt = 0; attempt < attempts && last.status !== 200; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      last = await request(app.getHttpServer()).get('/readyz');
    }

    expect(last.status).toBe(200);
    return last;
  }

  it('answers with a trace id a user can quote to support', async () => {
    const response = await request(app.getHttpServer()).get('/healthz').expect(200);

    expect(response.headers['x-trace-id']).toMatch(/^[0-9a-f]{32}$/u);
  });
});
