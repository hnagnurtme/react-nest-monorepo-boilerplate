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
  AccountAlreadyExistsError,
  ForbiddenActionError,
  ResourceConflictError,
  ResourceNotFoundError,
} from '@/core/errors/index.js';
import { MailService } from '@/core/mail/index.js';
import { CredentialsService, InvitationService } from '@/modules/auth/index.js';

import type {
  CreateUserDto,
  InviteToTenantDto,
  ListUsersQuery,
  SetUserRolesDto,
  UpdateUserDto,
} from './dto/index.js';
import { TenantInvitationService } from './tenant-invitation.service.js';
import { TenantInvitationsRepository } from './tenant-invitations.repository.js';
import { USER_SORT_FIELDS, UsersRepository, type UserPatch } from './users.repository.js';
import type {
  TenantInvitationPreview,
  TenantInvitationSummary,
  UserResponse,
} from './users.types.js';

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
    @Inject(TenantInvitationService)
    private readonly tenantInvitations: TenantInvitationService,
    @Inject(TenantInvitationsRepository)
    private readonly invitationsRepository: TenantInvitationsRepository,
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

    // An email is one account across the whole platform, so a second tenant
    // cannot create it again. Checked up front to answer with the code the
    // client acts on (invite that account here) instead of a bare unique
    // violation. The lookup is in `admin` mode because the existing account may
    // live in a tenant the caller cannot see.
    await this.assertEmailIsFree(dto.email);

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
      const userId = await this.repository.create(tx, {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber ?? null,
        tenantId,
        isActive: true,
        // An invited user verifies the address by following the emailed link.
        isEmailVerified: !isInvited,
      });
      // Before the roles: the assignment trigger checks the membership, and the
      // deferred home-tenant trigger checks it at commit. Before reading the row
      // back, too — in `tenant` mode the policy only sees an account through its
      // membership, which is why `create` cannot return the row itself.
      if (tenantId !== null) await this.repository.addMembership(tx, userId, tenantId);
      const row = await this.repository.findById(tx, userId);
      if (row === undefined) throw new Error('the created account is not visible to its creator');
      await this.authzRepository.replaceUserRoles(tx, row.id, tenantId, dto.roleIds, actor.id);

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

  /**
   * Invites an account that already exists into a tenant.
   *
   * The account accepts it itself. Attaching it straight away would let a
   * tenant admin pull in any stranger by guessing their address, and the
   * `own_tenant` grants would then give that admin `update:User` over them.
   *
   * Answers 404 for an address with no account: the caller should create one
   * with `POST /users`. That tells an authenticated admin only what the
   * duplicate-email conflict on create already tells them.
   */
  async inviteToTenant(actor: AuthContext, dto: InviteToTenantDto): Promise<void> {
    const tenantId = this.resolveRoleTenantId(actor, dto.tenantId);
    if (tenantId === null) throw new ForbiddenActionError('invite to', 'Tenant');

    this.assertCan(this.authz.current(), 'create', { id: 'new', tenantId });

    const roleIds = await this.transactions.runInRequestContext(async (tx) => {
      const roles = await this.loadRolesOrThrow(tx, dto.roleIds);
      this.assertAssignable(roles, tenantId);
      return roles.map((role) => role.id);
    });

    // `admin` mode throughout: the invitee may live in a tenant this caller
    // cannot see, which is the whole reason the invitation exists.
    const invitation = await this.transactions.runAsAdmin('users:invite-to-tenant', async (tx) => {
      const invitee = await this.repository.findByEmail(tx, dto.email);
      if (!invitee?.isActive) throw new ResourceNotFoundError('User');
      if (invitee.tenantId === null) {
        throw new ResourceConflictError('A platform account cannot join a tenant');
      }
      const memberships = await this.repository.membershipIds(tx, invitee.id);
      if (memberships.includes(tenantId)) {
        throw new ResourceConflictError('This account already belongs to the tenant');
      }

      const tenantName = await this.invitationsRepository.tenantName(tx, tenantId);
      if (tenantName === undefined) throw new ResourceNotFoundError('Tenant', tenantId);

      const token = await this.tenantInvitations.issue(tx, {
        tenantId,
        userId: invitee.id,
        roleIds,
        invitedBy: actor.id,
      });
      const inviter = await this.repository.findById(tx, actor.id);

      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId,
        action: 'user.tenant.invite',
        resourceType: 'User',
        resourceId: invitee.id,
        afterState: { tenantId, roleIds },
      });

      return {
        toEmail: invitee.email,
        recipientName: invitee.fullName,
        inviterName: inviter?.fullName ?? actor.email,
        tenantName,
        token,
      };
    });

    await this.deliverTenantInvitation(invitation);
  }

  /** Invitations still waiting on their invitee, for the tenant's admin UI. */
  async listPendingInvitations(actor: AuthContext): Promise<TenantInvitationSummary[]> {
    const tenantId = this.resolveRoleTenantId(actor, undefined);
    if (tenantId === null) return [];

    return this.transactions.runInRequestContext(async (tx) => {
      const rows = await this.invitationsRepository.listPending(tx, tenantId);
      const roleNames = await this.roleNamesById(
        tx,
        rows.flatMap((row) => row.roleIds),
      );

      return rows.map((row) => ({
        id: row.id,
        email: row.email,
        fullName: row.fullName,
        roles: row.roleIds.map((id) => roleNames.get(id) ?? id),
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      }));
    });
  }

  /** Withdraws an invitation. The right to invite carries the right to take it back. */
  async revokeInvitation(actor: AuthContext, id: string): Promise<void> {
    await this.transactions.runInRequestContext(async (tx) => {
      // RLS hides other tenants' rows, so a foreign id reads as a missing one.
      const invitation = await this.invitationsRepository.findById(tx, id);
      if (invitation === undefined) throw new ResourceNotFoundError('Invitation', id);

      this.assertCan(this.authz.current(), 'create', {
        id: 'new',
        tenantId: invitation.tenantId,
      });

      const revoked = await this.invitationsRepository.revokeById(tx, id);
      if (!revoked) throw new ResourceConflictError('This invitation is no longer pending');

      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: invitation.tenantId,
        action: 'user.tenant.invite.revoke',
        resourceType: 'User',
        resourceId: invitation.userId,
        beforeState: { tenantId: invitation.tenantId, roleIds: invitation.roleIds },
      });
    });
  }

  /** Mints a fresh link for a pending invitation and emails it again. */
  async resendInvitationToTenant(actor: AuthContext, id: string): Promise<void> {
    const invitation = await this.transactions.runInRequestContext(async (tx) => {
      const row = await this.invitationsRepository.findById(tx, id);
      if (row === undefined) throw new ResourceNotFoundError('Invitation', id);
      if (row.acceptedAt !== null || row.revokedAt !== null) {
        throw new ResourceConflictError('This invitation is no longer pending');
      }

      this.assertCan(this.authz.current(), 'create', { id: 'new', tenantId: row.tenantId });
      return row;
    });

    const context = await this.transactions.runAsAdmin(
      'users:resend-tenant-invitation',
      async (tx) => {
        const invitee = await this.repository.findById(tx, invitation.userId);
        if (!invitee?.isActive) throw new ResourceNotFoundError('User');

        const tenantName = await this.invitationsRepository.tenantName(tx, invitation.tenantId);
        if (tenantName === undefined) throw new ResourceNotFoundError('Tenant');

        const token = await this.tenantInvitations.issue(tx, {
          tenantId: invitation.tenantId,
          userId: invitation.userId,
          roleIds: invitation.roleIds,
          invitedBy: actor.id,
        });
        const inviter = await this.repository.findById(tx, actor.id);

        return {
          toEmail: invitee.email,
          recipientName: invitee.fullName,
          inviterName: inviter?.fullName ?? actor.email,
          tenantName,
          token,
        };
      },
    );

    await this.deliverTenantInvitation(context);
  }

  /** What the acceptance screen shows. Public: the token is the credential. */
  async previewTenantInvitation(token: string): Promise<TenantInvitationPreview> {
    return this.transactions.runAsAdmin('users:preview-tenant-invitation', async (tx) => {
      const invitation = await this.tenantInvitations.find(tx, token);
      if (invitation === undefined) throw new ResourceNotFoundError('Invitation');

      const [user, inviter, tenantName, roleNames] = await Promise.all([
        this.repository.findById(tx, invitation.userId),
        invitation.invitedBy === null
          ? undefined
          : this.repository.findById(tx, invitation.invitedBy),
        this.invitationsRepository.tenantName(tx, invitation.tenantId),
        this.roleNamesById(tx, invitation.roleIds),
      ]);
      if (user === undefined || tenantName === undefined) {
        throw new ResourceNotFoundError('Invitation');
      }

      return {
        email: user.email,
        tenantName,
        inviterName: inviter?.fullName ?? '',
        roles: invitation.roleIds.map((id) => roleNames.get(id) ?? id),
      };
    });
  }

  /**
   * Spends the invitation and makes the account a member of the tenant.
   *
   * Runs in `admin` mode with no session: the invitee is not signed in to that
   * tenant yet, and by definition cannot be — the membership is what this
   * creates. Everything the link claims is re-checked here, because it was
   * minted before the roles or the account could have changed.
   */
  async acceptTenantInvitation(token: string): Promise<string> {
    const userId = await this.transactions.runAsAdmin(
      'users:accept-tenant-invitation',
      async (tx) => {
        const invitation = await this.tenantInvitations.find(tx, token);
        if (invitation === undefined) throw new ResourceNotFoundError('Invitation');

        const user = await this.repository.findById(tx, invitation.userId);
        if (!user?.isActive) throw new ResourceNotFoundError('User');

        // Spent first: the update is the lock, so two clicks on the same link
        // cannot both add the membership.
        const spent = await this.invitationsRepository.markAccepted(tx, invitation.id);
        if (!spent) throw new ResourceNotFoundError('Invitation');

        const roles = await this.authzRepository.loadRolesWithGrants(tx, invitation.roleIds);
        if (roles.length !== invitation.roleIds.length) throw new ResourceNotFoundError('Role');

        await this.repository.addMembership(tx, user.id, invitation.tenantId);
        await this.authzRepository.replaceUserRoles(
          tx,
          user.id,
          invitation.tenantId,
          invitation.roleIds,
          invitation.invitedBy ?? user.id,
        );
        await this.audit.record(tx, {
          actorId: invitation.invitedBy ?? user.id,
          tenantId: invitation.tenantId,
          action: 'user.tenant.join',
          resourceType: 'User',
          resourceId: user.id,
          afterState: { tenantId: invitation.tenantId, roles: roles.map((role) => role.key) },
        });

        return user.id;
      },
    );

    await this.authz.invalidateUsers([userId]);
    return userId;
  }

  private async roleNamesById(tx: Tx, roleIds: readonly string[]): Promise<Map<string, string>> {
    const unique = [...new Set(roleIds)];
    const roles = await this.authzRepository.loadRolesWithGrants(tx, unique);
    return new Map(roles.map((role) => [role.id, role.name]));
  }

  private async assertEmailIsFree(email: string): Promise<void> {
    const existing = await this.transactions.runAsAdmin('users:email-uniqueness', async (tx) =>
      this.repository.findByEmail(tx, email),
    );
    if (existing !== undefined) throw new AccountAlreadyExistsError();
  }

  private async deliverTenantInvitation(invitation: {
    toEmail: string;
    recipientName: string;
    inviterName: string;
    tenantName: string;
    token: string;
  }): Promise<void> {
    const acceptUrl = `${this.config.webOrigin}/accept-tenant-invitation?token=${encodeURIComponent(invitation.token)}`;

    await this.mail.sendTenantInvitationMail({
      toEmail: invitation.toEmail,
      recipientName: invitation.recipientName,
      inviterName: invitation.inviterName,
      tenantName: invitation.tenantName,
      acceptUrl,
      ttlHours: this.tenantInvitations.ttlHours,
    });
  }

  /** Issues a fresh link for an account that has not accepted its invitation yet. */
  async resendInvitation(actor: AuthContext, id: string): Promise<void> {
    const { user, tenantIds } = await this.loadOrThrow(id);
    this.assertCan(this.authz.current(), 'update', { ...user, tenantIds });
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
    const { user, roles, tenantIds } = await this.loadOrThrow(id);
    this.assertCan(this.authz.current(), 'read', { ...user, tenantIds });

    return toUserResponse(user, roles);
  }

  async update(actor: AuthContext, id: string, dto: UpdateUserDto): Promise<UserResponse> {
    const { user: existing, roles, tenantIds } = await this.loadOrThrow(id);
    const ability = this.authz.current();
    const target = { ...existing, tenantIds };
    this.assertCan(ability, 'update', target);
    // Activating or deactivating an account is an admin decision, not a
    // profile edit: it needs the `delete` ability, which a member lacks even on
    // its own record.
    if (dto.isActive !== undefined) this.assertCan(ability, 'delete', target);
    if (dto.isActive === false && existing.id === actor.id) {
      throw new ForbiddenActionError('deactivate', 'own account');
    }
    if (dto.isActive === false) await this.assertDeactivationIsVisible(actor, id);

    const updated = await this.transactions.runInRequestContext(async (tx) => {
      // A deactivation reaches every tenant the account administers, not only
      // the one the request acts in.
      if (dto.isActive === false) await this.assertDeactivationKeepsAdmins(tx, existing);

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

  /**
   * Replaces the user's role set *in one tenant*. Nobody edits their own roles,
   * and nobody grants more than they hold.
   *
   * The account's assignments in its other tenants are untouched: a tenant
   * admin administers their tenant, and nothing outside it.
   */
  async setRoles(actor: AuthContext, id: string, dto: SetUserRolesDto): Promise<UserResponse> {
    const { user, roles: before, tenantIds } = await this.loadOrThrow(id);
    this.assertCan(this.authz.current(), 'update', { ...user, tenantIds });
    if (user.id === actor.id) throw new ForbiddenActionError('change roles of', 'own account');

    const tenantId = this.resolveRoleTenantId(actor, dto.tenantId);

    const after = await this.transactions.runInRequestContext(async (tx) => {
      const next = await this.loadRolesOrThrow(tx, dto.roleIds);
      this.assertAssignable(next, tenantId);
      if (tenantId !== null && !(await this.repository.membershipIds(tx, id)).includes(tenantId)) {
        throw new ResourceNotFoundError('User', id);
      }

      const keepsAdmin = next.some((role) => role.key === TENANT_ADMIN_KEY);
      if (!keepsAdmin) await this.assertNotLastTenantAdmin(tx, user, tenantId, before);

      await this.authzRepository.replaceUserRoles(tx, id, tenantId, dto.roleIds, actor.id);
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId,
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

  /**
   * From a tenant, this removes the account from that tenant — membership and
   * the roles it held there — and leaves the account itself alone, because it
   * may still belong elsewhere. A platform caller deletes the account.
   */
  async remove(actor: AuthContext, id: string): Promise<void> {
    const { user: existing, roles, tenantIds } = await this.loadOrThrow(id);
    this.assertCan(this.authz.current(), 'delete', { ...existing, tenantIds });
    if (existing.id === actor.id) throw new ForbiddenActionError('delete', 'own account');

    const activeTenantId = this.authz.activeTenantId();

    await this.transactions.runInRequestContext(async (tx) => {
      if (activeTenantId === undefined) {
        await this.assertNotLastTenantAdmin(tx, existing, existing.tenantId, roles);
        await this.repository.softDelete(tx, id);
        await this.audit.record(tx, {
          actorId: actor.id,
          tenantId: existing.tenantId,
          action: 'user.delete',
          resourceType: 'User',
          resourceId: id,
          beforeState: toUserResponse(existing, roles),
        });
        return;
      }

      await this.assertNotLastTenantAdmin(tx, existing, activeTenantId, roles);
      await this.authzRepository.replaceUserRoles(tx, id, activeTenantId, [], actor.id);
      await this.repository.removeMembership(tx, id, activeTenantId);
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: activeTenantId,
        action: 'user.tenant.remove',
        resourceType: 'User',
        resourceId: id,
        beforeState: toUserResponse(existing, roles),
      });
    });

    await this.authz.invalidateUsers([id]);
  }

  /**
   * Which tenant a role change applies to. A tenant caller is pinned to the
   * tenant the request acts in; a platform caller names it, or omits it for a
   * platform-scope assignment (the same exception `POST /users` makes).
   */
  private resolveRoleTenantId(actor: AuthContext, requested: string | undefined): string | null {
    if (actor.scope === 'platform') return requested ?? null;

    if (actor.tenantId === undefined) throw new ForbiddenActionError('change roles of', 'User');
    if (requested !== undefined && requested !== actor.tenantId) {
      throw new ForbiddenActionError('change roles of', 'User');
    }
    return actor.tenantId;
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
    const held = this.authz.currentGrants();

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

  /**
   * A deactivation reaches every tenant the account belongs to, and a tenant
   * caller can only see its own — so it cannot tell whether it is about to
   * strip another tenant of its last administrator. Rather than guess, the
   * cross-tenant case is refused and left to a platform admin.
   *
   * The membership count is read in `admin` mode for exactly that reason: the
   * caller is not allowed to see it, but the check needs it.
   */
  private async assertDeactivationIsVisible(actor: AuthContext, userId: string): Promise<void> {
    if (actor.scope === 'platform') return;

    const tenantIds = await this.transactions.runAsAdmin('users:deactivation-scope', async (tx) =>
      this.repository.membershipIds(tx, userId),
    );
    if (tenantIds.length > 1) throw new ForbiddenActionError('deactivate', 'User');
  }

  /** Every tenant the account administers must keep another active administrator. */
  private async assertDeactivationKeepsAdmins(tx: Tx, user: User): Promise<void> {
    const tenantIds = await this.authzRepository.tenantIdsWithRoleKey(
      tx,
      user.id,
      TENANT_ADMIN_KEY,
    );

    for (const tenantId of tenantIds) {
      const others = await this.authzRepository.countActiveWithRoleKey(
        tx,
        tenantId,
        TENANT_ADMIN_KEY,
        user.id,
      );
      if (others === 0) {
        throw new ResourceConflictError('A tenant must keep at least one active administrator');
      }
    }
  }

  /**
   * A tenant must always keep at least one active administrator.
   *
   * Counted in the tenant the change is being made in, not the account's home
   * tenant: an account can administer a tenant it does not live in.
   */
  private async assertNotLastTenantAdmin(
    tx: Tx,
    user: User,
    tenantId: string | null,
    roles: readonly RoleSummary[],
  ): Promise<void> {
    if (tenantId === null || !roles.some((role) => role.key === TENANT_ADMIN_KEY)) return;

    const others = await this.authzRepository.countActiveWithRoleKey(
      tx,
      tenantId,
      TENANT_ADMIN_KEY,
      user.id,
    );
    if (others === 0) {
      throw new ResourceConflictError('A tenant must keep at least one active administrator');
    }
  }

  /** RLS hides other tenants' rows, so a foreign id is indistinguishable from a missing one. */
  private async loadOrThrow(
    id: string,
  ): Promise<{ user: User; roles: RoleSummary[]; tenantIds: string[] }> {
    const found = await this.transactions.runInRequestContext(async (tx) => {
      const user = await this.repository.findById(tx, id);
      if (user === undefined) return undefined;
      const roles = (await this.authzRepository.rolesForUsers(tx, [id])).get(id) ?? [];
      const tenantIds = await this.repository.membershipIds(tx, id);
      return { user, roles, tenantIds };
    });
    if (found === undefined) throw new ResourceNotFoundError('User', id);

    return found;
  }

  /**
   * Layer 2: a bare `'User'` string would ignore every condition (see CheckPolicies).
   *
   * `own_tenant` conditions compare against the tenant the request acts in, so
   * the target is judged by that tenant — but only once its own memberships say
   * it belongs there. The membership is re-checked here rather than inferred
   * from RLS having let the row through: that is what makes this a second layer.
   */
  private assertCan(
    ability: AppAbility,
    action: Action,
    target: { id: string; tenantId: string | null; tenantIds?: readonly string[] },
  ): void {
    const activeTenantId = this.authz.activeTenantId();
    const tenantId =
      activeTenantId !== undefined && (target.tenantIds ?? []).includes(activeTenantId)
        ? activeTenantId
        : target.tenantId;
    const entity = subject('User', {
      id: target.id,
      ...(tenantId === null ? {} : { tenantId }),
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
