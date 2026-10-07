import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads `apps/api/.env` into `process.env` when present.
 *
 * Deliberately silent when the file is missing: in production the environment
 * is injected by the orchestrator and there is no file to read, which is the
 * normal case rather than an error.
 */
export function loadEnvFile(): void {
  const path = resolve(process.cwd(), '.env');
  if (!existsSync(path)) return;

  process.loadEnvFile(path);
}
