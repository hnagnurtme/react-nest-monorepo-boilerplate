import { SetMetadata, type CustomDecorator } from '@nestjs/common';

import type { AppAbility } from '@repo/shared-types';

export const CHECK_POLICIES_KEY = 'checkPolicies';

export type PolicyHandler = (ability: AppAbility) => boolean;

/**
 * Declares the role-level check for a route.
 *
 * This is layer 1 only. `ability.can('update', 'User')` passes a bare type
 * string, which CASL cannot match conditions against — so it answers "yes" for
 * any tenant that may update any user. Ownership has to be re-checked in the
 * service against the loaded record (docs/03-auth-flow-va-casl-abac.md 3.1).
 */
export const CheckPolicies = (...handlers: PolicyHandler[]): CustomDecorator =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
