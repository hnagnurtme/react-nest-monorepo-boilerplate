import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const NO_TENANT_CONTEXT_KEY = 'noTenantContext';

/**
 * Lets an authenticated route run before the caller has chosen a tenant.
 *
 * An account can belong to several tenants, so the one a request acts in is
 * picked by the caller (`x-tenant-id`) — but the endpoints that let them pick,
 * and the ones that are about the account rather than a tenant, have to work
 * without it. Those routes get no access context at all, so a stray query on
 * them reads zero rows; they must open their own transaction with an explicit
 * reason (`transactions.runAsAdmin`).
 *
 * This is not `@Public()`: the token is still required.
 */
export const NoTenantContext = (): CustomDecorator => SetMetadata(NO_TENANT_CONTEXT_KEY, true);
