import type { ParseKeys } from 'i18next';
import { Building2, House, ShieldCheck, Users, type LucideIcon } from 'lucide-react';

import type { Action, AppAbility, Subject } from '@repo/shared-types';

/** What the caller must be allowed to do for the entry to appear at all. */
export interface NavRequirement {
  action: Action;
  subject: Subject;
}

/** A key of the `nav` namespace, so a typo is a type error, not a visible one. */
export type NavLabelKey = ParseKeys<'nav'>;

export interface NavLeaf {
  path: string;
  labelKey: NavLabelKey;
  icon: LucideIcon;
  can?: NavRequirement;
}

export interface NavSection {
  id: string;
  labelKey: NavLabelKey;
  icon: LucideIcon;
  children: NavLeaf[];
}

/**
 * The one description of the product's navigation.
 *
 * Both the sidebar and the router read it, so a page cannot appear in the menu
 * while the guard turns it away — the previous shape of this, with the checks
 * written out in `router.tsx` and the links written out in the home page, had
 * exactly that failure available.
 *
 * There is no branch on scope. A platform account sees `Tenants` because it
 * holds `create:Tenant`, not because the code asks who it is; that is the whole
 * point of keeping permissions in the database (ADR-0005).
 */
/**
 * Entries that stand above the sections. Home is one because it belongs to no
 * group, and burying it under a heading to keep the shape uniform would cost a
 * click on the most-visited page.
 */
export const NAV_PRIMARY: NavLeaf[] = [{ path: '/', labelKey: 'items.home', icon: House }];

export const NAV: NavSection[] = [
  {
    id: 'access',
    labelKey: 'sections.access',
    icon: ShieldCheck,
    children: [
      {
        path: '/users',
        labelKey: 'items.users',
        icon: Users,
        can: { action: 'read', subject: 'User' },
      },
      {
        path: '/roles',
        labelKey: 'items.roles',
        icon: ShieldCheck,
        can: { action: 'read', subject: 'Role' },
      },
    ],
  },
  {
    id: 'organisation',
    labelKey: 'sections.organisation',
    icon: Building2,
    children: [
      {
        path: '/tenants',
        labelKey: 'items.tenants',
        icon: Building2,
        // Only a platform account may create a tenant, which is what makes the
        // whole section platform-only without naming the scope.
        can: { action: 'create', subject: 'Tenant' },
      },
    ],
  },
];

/**
 * A string subject on purpose: this answers "may the caller ever open this
 * page", which is a permission question. Per-record ownership is settled by the
 * page itself with `subject()`, as CASL requires.
 */
export function isLeafAllowed(leaf: NavLeaf, ability: AppAbility): boolean {
  if (leaf.can === undefined) return true;
  return ability.can(leaf.can.action, leaf.can.subject);
}

export function visiblePrimary(ability: AppAbility): NavLeaf[] {
  return NAV_PRIMARY.filter((leaf) => isLeafAllowed(leaf, ability));
}

/** Every entry, flat — for resolving the current page's title. */
export function allLeaves(): NavLeaf[] {
  return [...NAV_PRIMARY, ...NAV.flatMap((section) => section.children)];
}

/** Sections with nothing the caller may open are dropped, not shown empty. */
export function visibleNav(ability: AppAbility): NavSection[] {
  return NAV.map((section) => ({
    ...section,
    children: section.children.filter((leaf) => isLeafAllowed(leaf, ability)),
  })).filter((section) => section.children.length > 0);
}

/**
 * The ability check for a guarded page, resolved from this registry so the
 * sidebar and the router can never disagree about who may open it. Adding a
 * page means adding one entry here, not an entry here and a predicate in the
 * router too.
 *
 * It reads `allLeaves()`, so a primary entry that grows a `can` is guarded as
 * well — searching the sections alone left such a page open while hiding it
 * from the menu. An unknown path throws for the same reason: returning
 * `undefined` for a typo would publish the page to everyone and still typecheck.
 */
export function guardFor(path: string): ((ability: AppAbility) => boolean) | undefined {
  const leaf = allLeaves().find((entry) => entry.path === path);
  if (leaf === undefined) throw new Error(`guardFor: no navigation entry for "${path}"`);
  if (leaf.can === undefined) return undefined;
  return (ability: AppAbility) => isLeafAllowed(leaf, ability);
}
