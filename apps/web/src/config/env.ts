import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:3000'),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
});

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parseEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse({
    VITE_API_URL: stringOrUndefined(import.meta.env['VITE_API_URL']),
    VITE_APP_ENV:
      stringOrUndefined(import.meta.env['VITE_APP_ENV']) ?? stringOrUndefined(import.meta.env.MODE),
  });

  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  return result.data;
}

export const env = parseEnv();
