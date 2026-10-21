import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const PLATFORM_WIDE_KEY = 'platformWide';

/**
 * Keeps a platform-scope caller in `admin` mode even when they have chosen a
 * tenant to look at.
 *
 * A platform account may act inside one tenant — it sends `x-tenant-id` like
 * anybody else, and the request then runs under that tenant's RLS policies, so
 * the dashboard it reads is that tenant's dashboard. The endpoints that
 * administer the platform itself cannot work under those policies: listing every
 * tenant, creating one, or answering the picker all need rows the active
 * tenant's policy hides. They say so with this decorator.
 *
 * It changes nothing for a tenant-scope caller: their mode comes from their
 * memberships either way.
 */
export const PlatformWide = (): CustomDecorator => SetMetadata(PLATFORM_WIDE_KEY, true);
