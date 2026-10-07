import { type INestApplication, RequestMethod, VersioningType } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

import { JSON_BODY_LIMIT, TRACE_ID_HEADER } from '@/common/index.js';
import type { EnvConfig } from '@/config/index.js';
import { GlobalExceptionFilter } from '@/core/filters/global-exception.filter.js';
import { TransformInterceptor } from '@/core/interceptors/transform.interceptor.js';
import {
  addSwaggerCsrfHeader,
  createSwaggerCsrfConfigScript,
} from '@/core/openapi/swagger-csrf-request.interceptor.js';

import { ACCESS_TOKEN_SECURITY_SCHEME } from './modules/auth/auth.constants.js';

export function setupSecurity(app: INestApplication, env: EnvConfig): void {
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    exposedHeaders: [
      TRACE_ID_HEADER,
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'Retry-After',
    ],
  });
}

export function setupRouting(app: INestApplication, env: EnvConfig): void {
  app.setGlobalPrefix(env.API_PREFIX, {
    exclude: [
      { path: 'healthz', method: RequestMethod.GET },
      { path: 'readyz', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}

export function setupGlobals(app: INestApplication): void {
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(app.get(GlobalExceptionFilter));
  app.useGlobalInterceptors(app.get(TransformInterceptor));
  app.enableShutdownHooks();
}

export async function setupSwagger(app: INestApplication, env: EnvConfig): Promise<void> {
  if (env.NODE_ENV !== 'production') {
    const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
    const { cleanupOpenApiDoc } = await import('nestjs-zod');
    const swaggerPath = `${env.API_PREFIX}/docs`;
    const csrfConfigPath = `/${swaggerPath}/csrf-config.js`;

    app.getHttpAdapter().get(csrfConfigPath, (_request: unknown, response: Response) => {
      response
        .type('application/javascript')
        .send(createSwaggerCsrfConfigScript(env.CSRF_COOKIE_NAME));
    });

    const options = new DocumentBuilder()
      .setTitle(`${env.APP_NAME} API`)
      .setDescription('API documentation.')
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
    SwaggerModule.setup(swaggerPath, app, document, {
      customJs: csrfConfigPath,
      swaggerOptions: {
        persistAuthorization: true,
        requestInterceptor: addSwaggerCsrfHeader,
      },
    });
  }
}

export async function setupApp(app: INestApplication, env: EnvConfig): Promise<void> {
  setupGlobals(app);
  setupSecurity(app, env);
  setupRouting(app, env);
  await setupSwagger(app, env);
}
