import { z } from 'zod';

import { loadEnvFile } from './load-env-file.js';

const DEFAULT_PORT = 3000;
const DEFAULT_POOL_MAX = 10;
const MIN_SECRET_LENGTH = 32;
/** OWASP minimum for Argon2id, in KiB (19 MiB). */
const MIN_ARGON2_MEMORY_COST = 19_456;
const DEFAULT_INVITATION_TTL_HOURS = 72;
const MAX_INVITATION_TTL_HOURS = 168;
const ERROR_COLUMN_WIDTH = 40;

/**
 * A documented-but-blank .env line arrives as '' rather than missing, and ''
 * fails `.url()` before `.optional()` can skip it. Coerce it to undefined.
 */
const blankToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

const csvToArray = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

/**
 * The single source of truth for every environment variable the API reads
 * (docs/02-backend-core-va-drizzle-rls.md section 4). `.env.example` must stay
 * in sync with this object.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** Product name shown in emails and the API docs. */
    APP_NAME: z.string().trim().min(1).default('Starter App'),
    PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
    API_PREFIX: z.string().min(1).default('api'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    /** Runtime role `boilerplate_app`: DML only, NOBYPASSRLS. */
    DATABASE_URL: z.string().url(),
    /** Owner role `boilerplate_owner`: DDL. Used by migrations only. */
    MIGRATION_DATABASE_URL: z.string().url(),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(DEFAULT_POOL_MAX),

    REDIS_URL: z.string().url(),

    JWT_ACCESS_SECRET: z.string().min(MIN_SECRET_LENGTH),
    JWT_REFRESH_SECRET: z.string().min(MIN_SECRET_LENGTH),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('7d'),

    ARGON2_MEMORY_COST: z.coerce
      .number()
      .int()
      .min(MIN_ARGON2_MEMORY_COST)
      .default(MIN_ARGON2_MEMORY_COST),

    CORS_ORIGINS: z.string().default('http://localhost:5173').transform(csvToArray),
    /** Origin of the SPA, used for the CSRF `Origin` allowlist check. */
    WEB_ORIGIN: z.string().url().default('http://localhost:5173'),

    COOKIE_DOMAIN: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().optional(),
    ),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    CSRF_COOKIE_NAME: z.string().min(1).default('csrf_token'),

    OTEL_SERVICE_NAME: z.string().min(1).default('api'),
    // `z.string().url().optional()` only treats a MISSING key as absent — the
    // empty string from a documented-blank .env line (the default, export off)
    // still fails `.url()` before `.optional()` can skip it. Coerce '' first.
    OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().url().optional(),
    ),

    // Email Configuration
    SMTP_HOST: z.string().default('smtp.gmail.com'),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_USER: z.string().default(''),
    SMTP_PASS: z.string().default(''),
    SMTP_FROM: z.string().default('Starter App <no-reply@example.com>'),

    /** How long an invitation link stays usable. One week is the hard ceiling. */
    INVITATION_TTL_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_INVITATION_TTL_HOURS)
      .default(DEFAULT_INVITATION_TTL_HOURS),

    // Email branding. Every URL has to be absolute and publicly reachable:
    // mail clients fetch them from the recipient's network, not from ours.
    // Blank is allowed everywhere — the templates fall back to text.
    MAIL_LOGO_URL: blankToUndefined(z.string().url().optional()),
    MAIL_BACKGROUND_URL: blankToUndefined(z.string().url().optional()),
    MAIL_BRAND_COLOR: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex colour such as #2563eb')
      .default('#2563eb'),
    MAIL_SUPPORT_EMAIL: blankToUndefined(z.string().email().optional()),
  })
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message:
          'Must differ from JWT_ACCESS_SECRET so a leaked access secret cannot mint refresh tokens',
      });
    }

    if (env.DATABASE_URL === env.MIGRATION_DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message:
          'Must differ from MIGRATION_DATABASE_URL: running the app as the owner role silently disables RLS',
      });
    }

    if (env.NODE_ENV !== 'production') return;

    if (!env.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'Must be true in production: refresh cookies may not travel over plain HTTP',
      });
    }

    if (env.COOKIE_DOMAIN === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_DOMAIN'],
        message: 'Required in production',
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parses and validates the environment. On failure it prints one row per bad
 * variable and exits: a half-configured process is worse than no process
 * (docs/00 section 1.3).
 */
export function validateEnv(raw: NodeJS.ProcessEnv): EnvConfig {
  const result = envSchema.safeParse(raw);
  if (result.success) return result.data;

  const rows = result.error.issues.map((issue) => ({
    variable: issue.path.join('.') || '(root)',
    problem: issue.message,
  }));
  const width = Math.max(...rows.map((row) => row.variable.length), 'VARIABLE'.length);

  // process.stderr, not the Nest logger: this runs before the DI container.
  const lines = [
    '',
    'Invalid environment configuration:',
    '',
    `  ${'VARIABLE'.padEnd(width)}  PROBLEM`,
    `  ${'-'.repeat(width)}  ${'-'.repeat(ERROR_COLUMN_WIDTH)}`,
    ...rows.map((row) => `  ${row.variable.padEnd(width)}  ${row.problem}`),
    '',
    'See apps/api/.env.example for the full list.',
    '',
  ];
  process.stderr.write(`${lines.join('\n')}\n`);
  process.exit(1);
}

let cached: EnvConfig | undefined;

/**
 * Memoised accessor.
 *
 * Loads `.env` itself rather than trusting the caller to have done it. The
 * telemetry bootstrap has to be the very first import of `main.ts` and it needs
 * configuration, so "call loadEnvFile() first" is a rule that cannot be kept —
 * better to make the ordering irrelevant.
 */
export function getEnv(): EnvConfig {
  if (cached === undefined) {
    loadEnvFile();
    cached = validateEnv(process.env);
  }

  return cached;
}

/** Test seam: drops the memoised environment so a fixture can be installed. */
export function resetEnvCache(): void {
  cached = undefined;
}
