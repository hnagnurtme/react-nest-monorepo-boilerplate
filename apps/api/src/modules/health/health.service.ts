import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { TransactionManager } from '@/core/database/transaction.manager.js';
import { RedisService } from '@/core/redis/index.js';

export interface DependencyStatus {
  name: string;
  status: 'up' | 'down';
}

export interface ReadinessReport {
  service: string;
  status: 'ok' | 'degraded';
  dependencies: DependencyStatus[];
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(TransactionManager) private readonly transactions: TransactionManager,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  /** Liveness: the process is up. Deliberately touches nothing else — a probe
   * that fails when the database blinks gets the container killed for someone
   * else's outage. */
  getLiveness(): { service: string; status: 'ok' } {
    return { service: 'api', status: 'ok' };
  }

  /** Readiness: the process can actually serve traffic. */
  async getReadiness(): Promise<ReadinessReport> {
    const [database, cache] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const dependencies = [database, cache];

    return {
      service: 'api',
      status: dependencies.every((dependency) => dependency.status === 'up') ? 'ok' : 'degraded',
      dependencies,
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      // `raw`, not a tenant transaction: a probe has no access context and
      // must not need one.
      await this.transactions.raw.execute(sql`SELECT 1`);
      return { name: 'postgres', status: 'up' };
    } catch {
      return { name: 'postgres', status: 'down' };
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    try {
      await this.redis.ping();
      return { name: 'redis', status: 'up' };
    } catch {
      return { name: 'redis', status: 'down' };
    }
  }
}
