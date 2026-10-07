import { Inject, Injectable, Optional } from '@nestjs/common';

import { getEnv, type EnvConfig } from './env.schema.js';

/** Injection token used only to hand a fixture environment to tests. */
export const ENV_CONFIG = Symbol('ENV_CONFIG');

export interface DatabaseSettings {
  url: string;
  migrationUrl: string;
  poolMax: number;
}

export interface JwtSettings {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
}

export interface CookieSettings {
  domain: string | undefined;
  secure: boolean;
  csrfName: string;
}

export interface TelemetrySettings {
  serviceName: string;
  otlpEndpoint: string | undefined;
}

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * Typed façade over the validated environment. Injecting this instead of
 * reading `process.env` keeps the variable list discoverable and turns a typo
 * into a compile error rather than an `undefined` at 3am.
 */
@Injectable()
export class AppConfig {
  private readonly env: EnvConfig;

  // @Optional so Nest does not try to resolve a plain object as a provider; in
  // production nothing supplies ENV_CONFIG and the memoised env is used.
  constructor(@Optional() @Inject(ENV_CONFIG) env?: EnvConfig) {
    this.env = env ?? getEnv();
  }

  get nodeEnv(): EnvConfig['NODE_ENV'] {
    return this.env.NODE_ENV;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get port(): number {
    return this.env.PORT;
  }

  get apiPrefix(): string {
    return this.env.API_PREFIX;
  }

  get logLevel(): EnvConfig['LOG_LEVEL'] {
    return this.env.LOG_LEVEL;
  }

  get database(): DatabaseSettings {
    return {
      url: this.env.DATABASE_URL,
      migrationUrl: this.env.MIGRATION_DATABASE_URL,
      poolMax: this.env.DATABASE_POOL_MAX,
    };
  }

  get redisUrl(): string {
    return this.env.REDIS_URL;
  }

  get jwt(): JwtSettings {
    return {
      accessSecret: this.env.JWT_ACCESS_SECRET,
      refreshSecret: this.env.JWT_REFRESH_SECRET,
      accessTtl: this.env.JWT_ACCESS_TTL,
      refreshTtl: this.env.JWT_REFRESH_TTL,
    };
  }

  get argon2MemoryCost(): number {
    return this.env.ARGON2_MEMORY_COST;
  }

  get appName(): string {
    return this.env.APP_NAME;
  }

  get corsOrigins(): string[] {
    return this.env.CORS_ORIGINS;
  }

  get webOrigin(): string {
    return this.env.WEB_ORIGIN;
  }

  get cookie(): CookieSettings {
    return {
      domain: this.env.COOKIE_DOMAIN,
      secure: this.env.COOKIE_SECURE,
      csrfName: this.env.CSRF_COOKIE_NAME,
    };
  }

  get telemetry(): TelemetrySettings {
    return {
      serviceName: this.env.OTEL_SERVICE_NAME,
      otlpEndpoint: this.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    };
  }

  get smtp(): SmtpSettings {
    return {
      host: this.env.SMTP_HOST,
      port: this.env.SMTP_PORT,
      secure: this.env.SMTP_SECURE,
      user: this.env.SMTP_USER,
      pass: this.env.SMTP_PASS,
      from: this.env.SMTP_FROM,
    };
  }
}
