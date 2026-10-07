import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { AppConfig } from '@/config/index.js';

import * as schema from './schema/index.js';

/** Injection token for the Drizzle instance. */
export const DATABASE = Symbol('DATABASE');
/** Injection token for the raw pg pool (health probes, shutdown). */
export const PG_POOL = Symbol('PG_POOL');

export type AppSchema = typeof schema;
export type AppDatabase = NodePgDatabase<AppSchema>;

/**
 * `tx` as handed to a `db.transaction` callback. Derived from the database type
 * rather than importing Drizzle's internal generics, so it survives a Drizzle
 * upgrade.
 */
export type Tx = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];

const IDLE_TIMEOUT_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 5_000;

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [AppConfig],
      useFactory: (config: AppConfig): Pool =>
        new Pool({
          // The app role: DML only, NOBYPASSRLS. Pointing this at the owner
          // role would make every RLS policy advisory.
          connectionString: config.database.url,
          max: config.database.poolMax,
          idleTimeoutMillis: IDLE_TIMEOUT_MS,
          connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
          application_name: config.telemetry.serviceName,
        }),
    },
    {
      provide: DATABASE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): AppDatabase => drizzle(pool, { schema, casing: 'snake_case' }),
    },
  ],
  exports: [DATABASE, PG_POOL],
})
export class DrizzleModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Paired with `enableShutdownHooks()`: drain in-flight queries before exit. */
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
