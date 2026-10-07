import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClsService } from 'nestjs-cls';
import { PinoLogger } from 'nestjs-pino';

import { MissingAccessContextError } from '@/core/errors/index.js';

import { DATABASE, type AppDatabase, type Tx } from './drizzle.module.js';
import {
  ACCESS_MODE_SETTING,
  CLS_KEYS,
  TENANT_SETTING,
  type AccessContext,
  type AppClsStore,
} from './request-context.js';

/**
 * The single gateway to the database (docs/rules/02-backend-nestjs.md D1).
 *
 * Nothing queries the connection directly: every statement runs inside a
 * transaction that has already declared its access mode, because that
 * declaration is what the RLS policies match on. A query issued outside one
 * sees `app.access_mode` unset, every policy branch evaluates false, and it
 * returns zero rows — the deliberate fail-closed behaviour.
 */
@Injectable()
export class TransactionManager {
  constructor(
    @Inject(DATABASE) private readonly db: AppDatabase,
    @Inject(ClsService) private readonly cls: ClsService<AppClsStore>,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TransactionManager.name);
  }

  /**
   * Runs `fn` in a transaction bound to an explicit access context.
   *
   * The third argument to `set_config` is `true` (is_local): the setting lives
   * and dies with this transaction. Without it the value would survive on the
   * pooled connection and silently apply to whichever request borrows it next.
   */
  async run<T>(context: AccessContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
    if (context.accessMode === 'admin') {
      // Every crossing of the isolation boundary leaves a trail.
      this.logger.warn({ reason: context.reason }, 'Executing cross-tenant operation');
    }

    const tenantId = context.accessMode === 'tenant' ? context.tenantId : '';

    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config(${ACCESS_MODE_SETTING}, ${context.accessMode}, true),
                   set_config(${TENANT_SETTING}, ${tenantId}, true)`,
      );
      return fn(tx);
    });
  }

  /** Runs `fn` under the access context the current request established. */
  async runInRequestContext<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const context = this.cls.get(CLS_KEYS.accessContext);
    if (context === undefined) throw new MissingAccessContextError();

    return this.run(context, fn);
  }

  /** Run `fn` in an admin-mode transaction */
  async runAsAdmin<T>(reason: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.run({ accessMode: 'admin', reason }, fn);
  }

  /** Run `fn` for a tenant */
  async runInTenantContext<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.run({ accessMode: 'tenant', tenantId }, fn);
  }

  /**
   * Escape hatch for statements that must not be wrapped — health probes, and
   * the migration runner. Business code must never reach for this.
   */
  get raw(): AppDatabase {
    return this.db;
  }
}
