import { randomBytes } from 'node:crypto';

import { subject } from '@casl/ability';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { grantsCover, type Action, type AppAbility } from '@repo/shared-types';

import {
  buildPaginationMeta,
  parseSort,
  toOffset,
  type AuthContext,
  type PaginationMeta,
} from '@/common/index.js';
import { AppConfig } from '@/config/index.js';
import { AuditService } from '@/core/audit/audit.service.js';
import {
  AuthzRepository,
  AuthzService,
  type RoleSummary,
  type RoleWithGrants,
} from '@/core/authz/index.js';
import type { Tx } from '@/core/database/drizzle.module.js';
import type { User } from '@/core/database/schema/index.js';
import { TransactionManager } from '@/core/database/transaction.manager.js';
import {
  ForbiddenActionError,
  ResourceConflictError,
  ResourceNotFoundError,
} from '@/core/errors/index.js';
import { MailService } from '@/core/mail/index.js';
import { CredentialsService, InvitationService } from '@/modules/auth/index.js';

import type { CreateUserDto, ListUsersQuery, SetUserRolesDto, UpdateUserDto } from './dto/index.js';
import { USER_SORT_FIELDS, UsersRepository, type UserPatch } from './users.repository.js';
import type { UserResponse } from './users.types.js';

const TENANT_ADMIN_KEY = 'TENANT_ADMIN';
/** Length of the unusable password an invited account is parked on. */
const PLACEHOLDER_PASSWORD_BYTES = 32;

/** What the invitation email needs, gathered while the transaction is open. */
interface InvitationContext {
  userId: string;
  email: string;
  fullName: string;
  inviterName: string;
  tenantName: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(TransactionManager) private readonly transactions: TransactionManager,
    @Inject(UsersRepository) private readonly repository: UsersRepository,
    @Inject(CredentialsService) private readonly credentials: CredentialsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AuthzService) private readonly authz: AuthzService,
    @Inject(AuthzRepository) private readonly authzRepository: AuthzRepository,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(InvitationService) private readonly invitations: InvitationService,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  async list(query: ListUsersQuery): Promise<{ items: UserResponse[]; meta: PaginationMeta }> {
    const sort = parseSort(query, USER_SORT_FIELDS);
    const filter = { search: query.search };

    const [rows, total, roles] = await this.transactions.runInRequestContext(async (tx) => {
      const page = await this.repository.list(
        tx,
        { limit: query.limit, offset: toOffset(query.page, query.limit) },
        sort,
        filter,
      );
      return [
        page,
        await this.repository.count(tx, filter),
        await this.authzRepository.rolesForUsers(
          tx,
          page.map((u) => u.id),
        ),
      ] as const;
    });

    return {
      items: rows.map((row) => toUserResponse(row, roles.get(row.id) ?? [])),
      meta: buildPaginationMeta(query, total),
    };
  }

  /**
   * Accounts are created by admins only; there is no self sign-up. The account
   * is born active and verified, with the password the admin chose and the
   * roles the admin is itself allowed to hand out.
   */
  async create(actor: AuthContext, dto: CreateUserDto): Promise<UserResponse> {
    const ability = this.authz.current();
    const isInvited = dto.password === undefined;

    const { summary, invitation } = await this.transactions.runInRequestContext(async (tx) => {
      const roles = await this.loadRolesOrThrow(tx, dto.roleIds);
      const tenantId = this.resolveTenantId(actor, dto, roles);
      this.assertCan(ability, 'create', { id: 'new', tenantId });
      this.assertAssignable(roles, tenantId);

      // An invited account is parked on a random hash rather than a null one:
      // `password_hash` is NOT NULL, and a value nobody can produce fails the
      // login comparison exactly like a wrong password.
      const passwordHash = await this.credentials.hash(
        dto.password ?? randomBytes(PLACEHOLDER_PASSWORD_BYTES).toString('base64url'),
      );
      const row = await this.repository.create(tx, {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber ?? null,
        tenantId,
        isActive: true,
        // An invited user verifies the address by following the emailed link.
        isEmailVerified: !isInvited,
      });
      await this.authzRepository.replaceUserRoles(tx, row.id, dto.roleIds, actor.id);

      const created = toUserResponse(row, roles);
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId,
        action: 'user.create',
        resourceType: 'User',
        resourceId: row.id,
        afterState: created,
      });

      return {
        summary: created,
        invitation: isInvited ? await this.invitationContext(tx, actor, row) : undefined,
      };
    });

    // Outside the transaction on purpose: an SMTP outage must not roll back an
    // account that was created correctly. The admin resends instead.
    if (invitation !== undefined) await this.deliverInvitation(invitation);

    return summary;
  }

  /** Issues a fresh link for an account that has not accepted its invitation yet. */
  async resendInvitation(actor: AuthContext, id: string): Promise<void> {
    const { user } = await this.loadOrThrow(id);
    this.assertCan(this.authz.current(), 'update', user);
    if (user.isEmailVerified) {
      throw new ResourceConflictError('This account has already accepted its invitation');
    }

    const invitation = await this.transactions.runInRequestContext(async (tx) =>
      this.invitationContext(tx, actor, user),
    );

    await this.deliverInvitation(invitation);
  }

  private async invitationContext(
    tx: Tx,
    actor: AuthContext,
    user: User,
  ): Promise<InvitationContext> {
    const inviter = await this.repository.findById(tx, actor.id);
    const tenantName =
      user.tenantId === null ? undefined : await this.repository.findTenantName(tx, user.tenantId);

    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      inviterName: inviter?.fullName ?? actor.email,
      tenantName: tenantName ?? this.config.appName,
    };
  }

  private async deliverInvitation(invitation: InvitationContext): Promise<void> {
    try {
      const token = await this.invitations.issue(invitation.userId);
      const acceptUrl = `${this.config.webOrigin}/accept-invitation?token=${encodeURIComponent(token)}`;

      await this.mail.sendInvitationMail({
        toEmail: invitation.email,
        recipientName: invitation.fullName,
        inviterName: invitation.inviterName,
        tenantName: invitation.tenantName,
        acceptUrl,
        ttlHours: this.invitations.ttlHours,
      });
    } catch (error) {
      // The account exists either way; a failed send is an operational problem,
      // not a reason to fail the request the admin already succeeded at.
      this.logger.error(
        `Failed to send the invitation for user [${invitation.userId}]: ${String(error)}`,
      );
    }
  }

  async findOrThrow(id: string): Promise<UserResponse> {
    const { user, roles } = await this.loadOrThrow(id);
    this.assertCan(this.authz.current(), 'read', user);

    return toUserResponse(user, roles);
  }

  async update(actor: AuthContext, id: string, dto: UpdateUserDto): Promise<UserResponse> {
    const { user: existing, roles } = await this.loadOrThrow(id);
    const ability = this.authz.current();
    this.assertCan(ability, 'update', existing);
    // Activating or deactivating an account is an admin decision, not a
    // profile edit: it needs the `delete` ability, which a member lacks even on
    // its own record.
    if (dto.isActive !== undefined) this.assertCan(ability, 'delete', existing);
    if (dto.isActive === false && existing.id === actor.id) {
      throw new ForbiddenActionError('deactivate', 'own account');
    }

    const updated = await this.transactions.runInRequestContext(async (tx) => {
      if (dto.isActive === false) await this.assertNotLastTenantAdmin(tx, existing, roles);

      const row = await this.repository.update(tx, id, toPatch(dto));
      if (row === undefined) return undefined;
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: row.tenantId,
        action: 'user.update',
        resourceType: 'User',
        resourceId: id,
        beforeState: toUserResponse(existing, roles),
        afterState: toUserResponse(row, roles),
      });
      return row;
    });
    if (updated === undefined) throw new ResourceNotFoundError('User', id);

    // The profile of a deactivated user must stop resolving immediately.
    await this.authz.invalidateUsers([id]);
    return toUserResponse(updated, roles);
  }

  /** Replaces the user's role set. Nobody edits their own roles, and nobody grants more than they hold. */
  async setRoles(actor: AuthContext, id: string, dto: SetUserRolesDto): Promise<UserResponse> {
    const { user, roles: before } = await this.loadOrThrow(id);
    this.assertCan(this.authz.current(), 'update', user);
    if (user.id === actor.id) throw new ForbiddenActionError('change roles of', 'own account');

    const after = await this.transactions.runInRequestContext(async (tx) => {
      const next = await this.loadRolesOrThrow(tx, dto.roleIds);
      this.assertAssignable(next, user.tenantId);

      const keepsAdmin = next.some((role) => role.key === TENANT_ADMIN_KEY);
      if (!keepsAdmin) await this.assertNotLastTenantAdmin(tx, user, before);

      await this.authzRepository.replaceUserRoles(tx, id, dto.roleIds, actor.id);
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: user.tenantId,
        action: 'user.roles.update',
        resourceType: 'User',
        resourceId: id,
        beforeState: { roles: before.map((r) => r.key) },
        afterState: { roles: next.map((r) => r.key) },
      });
      return next;
    });

    await this.authz.invalidateUsers([id]);
    return toUserResponse(user, after);
  }

  async remove(actor: AuthContext, id: string): Promise<void> {
    const { user: existing, roles } = await this.loadOrThrow(id);
    this.assertCan(this.authz.current(), 'delete', existing);
    if (existing.id === actor.id) throw new ForbiddenActionError('delete', 'own account');

    await this.transactions.runInRequestContext(async (tx) => {
      await this.assertNotLastTenantAdmin(tx, existing, roles);
      await this.repository.softDelete(tx, id);
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: 'user.delete',
        resourceType: 'User',
        resourceId: id,
        beforeState: toUserResponse(existing, roles),
      });
    });

    await this.authz.invalidateUsers([id]);
  }

  /**
   * A platform user (or a platform role) has no tenant; a platform actor must
   * name the tenant for everyone else; a tenant actor is pinned to its own.
   */
  private resolveTenantId(
    actor: AuthContext,
    dto: CreateUserDto,
    roles: readonly RoleWithGrants[],
  ): string | null {
    const isPlatformUser = roles.some((role) => role.scope === 'platform');

    if (actor.scope === 'platform') {
      if (isPlatformUser) {
        if (dto.tenantId !== undefined) throw new ForbiddenActionError('create', 'User');
        return null;
      }
      if (dto.tenantId === undefined) throw new ForbiddenActionError('create', 'User');
      return dto.tenantId;
    }

    if (isPlatformUser || actor.tenantId === undefined) {
      throw new ForbiddenActionError('create', 'User');
    }
    if (dto.tenantId !== undefined && dto.tenantId !== actor.tenantId) {
      throw new ForbiddenActionError('create', 'User');
    }
    return actor.tenantId;
  }

  /** Every requested role must be visible to the caller (RLS); one that is not reads as missing. */
  private async loadRolesOrThrow(tx: Tx, roleIds: readonly string[]): Promise<RoleWithGrants[]> {
    const roles = await this.authzRepository.loadRolesWithGrants(tx, roleIds);
    const found = new Set(roles.map((role) => role.id));
    const missing = roleIds.find((id) => !found.has(id));
    if (missing !== undefined) throw new ResourceNotFoundError('Role', missing);

    return roles;
  }

  /**
   * Anti-escalation: the caller must already hold everything a role grants, and
   * the role must fit the target (platform roles only for tenant-less users,
   * a custom role only inside its own tenant). The database triggers re-check
   * the fit, so a bug here still cannot produce an inconsistent assignment.
   */
  private assertAssignable(roles: readonly RoleWithGrants[], tenantId: string | null): void {
    const profile = this.authz.currentProfile();
    const held = profile?.grants ?? [];

    for (const role of roles) {
      if (!role.grants.every((grant) => grantsCover(held, grant))) {
        throw new ForbiddenActionError('assign role', role.key);
      }
      if (role.scope === 'platform' && tenantId !== null) {
        throw new ForbiddenActionError('assign role', role.key);
      }
      if (role.scope === 'tenant' && tenantId === null) {
        throw new ForbiddenActionError('assign role', role.key);
      }
      if (role.tenantId !== null && role.tenantId !== tenantId) {
        throw new ForbiddenActionError('assign role', role.key);
      }
    }
  }

  /** A tenant must always keep at least one active administrator. */
  private async assertNotLastTenantAdmin(
    tx: Tx,
    user: User,
    roles: readonly RoleSummary[],
  ): Promise<void> {
    if (user.tenantId === null || !roles.some((role) => role.key === TENANT_ADMIN_KEY)) return;

    const others = await this.authzRepository.countActiveWithRoleKey(
      tx,
      user.tenantId,
      TENANT_ADMIN_KEY,
      user.id,
    );
    if (others === 0) {
      throw new ResourceConflictError('A tenant must keep at least one active administrator');
    }
  }

  /** RLS hides other tenants' rows, so a foreign id is indistinguishable from a missing one. */
  private async loadOrThrow(id: string): Promise<{ user: User; roles: RoleSummary[] }> {
    const found = await this.transactions.runInRequestContext(async (tx) => {
      const user = await this.repository.findById(tx, id);
      if (user === undefined) return undefined;
      const roles = (await this.authzRepository.rolesForUsers(tx, [id])).get(id) ?? [];
      return { user, roles };
    });
    if (found === undefined) throw new ResourceNotFoundError('User', id);

    return found;
  }

  /** Layer 2: a bare `'User'` string would ignore every condition (see CheckPolicies). */
  private assertCan(
    ability: AppAbility,
    action: Action,
    target: { id: string; tenantId: string | null },
  ): void {
    const entity = subject('User', {
      id: target.id,
      ...(target.tenantId === null ? {} : { tenantId: target.tenantId }),
    });

    if (!ability.can(action, entity)) throw new ForbiddenActionError(action, 'User');
  }
}

function toPatch(dto: UpdateUserDto): UserPatch {
  return {
    ...(dto.fullName === undefined ? {} : { fullName: dto.fullName }),
    ...(dto.phoneNumber === undefined ? {} : { phoneNumber: dto.phoneNumber }),
    ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
  };
}

function toUserResponse(user: User, roles: readonly RoleSummary[]): UserResponse {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    roles: roles.map((role) => ({ id: role.id, key: role.key, name: role.name })),
    tenantId: user.tenantId,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt.toISOString(),
  };
}
