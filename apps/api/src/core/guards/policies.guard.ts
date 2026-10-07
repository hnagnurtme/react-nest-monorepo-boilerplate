import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthzService } from '@/core/authz/index.js';
import { ForbiddenActionError } from '@/core/errors/index.js';

import { CHECK_POLICIES_KEY, type PolicyHandler } from './check-policies.decorator.js';

/**
 * Layer 1 of three: rejects a caller whose role has no business on this route
 * at all, before a single database query is spent on them.
 *
 * Layers 2 (`throwUnlessCan(subject(...))` in the service) and 3 (RLS) do the
 * ownership work this guard structurally cannot.
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthzService) private readonly authz: AuthzService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const handlers =
      this.reflector.getAllAndOverride<PolicyHandler[] | undefined>(CHECK_POLICIES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (handlers.length === 0) return true;

    const ability = this.authz.current();
    const denied = handlers.some((handler) => !handler(ability));
    if (denied) {
      throw new ForbiddenActionError(context.getHandler().name, context.getClass().name);
    }

    return true;
  }
}
