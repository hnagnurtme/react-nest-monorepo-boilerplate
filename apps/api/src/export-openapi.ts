import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Placeholders for the variables the config schema requires.
 *
 * Generating the spec only needs the DI container to build; it never opens a
 * socket (the pg pool and the Redis client both connect lazily). Supplying
 * throwaway values here is what lets CI regenerate the contract without
 * standing up Postgres and Redis just to read route metadata.
 */
const PLACEHOLDER_ENV: Record<string, string> = {
  DATABASE_URL: 'postgres://app@localhost:5432/openapi',
  MIGRATION_DATABASE_URL: 'postgres://owner@localhost:5432/openapi',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'openapi-placeholder-access-secret-0000',
  JWT_REFRESH_SECRET: 'openapi-placeholder-refresh-secret-000',
};

for (const [key, value] of Object.entries(PLACEHOLDER_ENV)) {
  process.env[key] ??= value;
}

const { NestFactory } = await import('@nestjs/core');
const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
const { VersioningType } = await import('@nestjs/common');
const { cleanupOpenApiDoc } = await import('nestjs-zod');
const { AppModule } = await import('./app.module.js');
const { ACCESS_TOKEN_SECURITY_SCHEME } = await import('./modules/auth/auth.openapi.js');

async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api', { exclude: ['healthz', 'readyz'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const options = new DocumentBuilder()
    .setTitle(`${process.env['APP_NAME'] ?? 'Starter App'} API`)
    .setDescription(
      'Success responses are wrapped in `{ data, meta? }`; errors follow RFC 9457 Problem Details with `application/problem+json`.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the access token only. Swagger adds the Bearer prefix.',
      },
      ACCESS_TOKEN_SECURITY_SCHEME,
    )
    .build();

  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, options));
  const outputPath = resolve(process.cwd(), '../../packages/api-contract/openapi.json');

  await writeFile(outputPath, `${JSON.stringify(document, undefined, 2)}\n`);
  await app.close();
}

await exportOpenApi();
