import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { useAbility, useTenantHref } from '@/features/auth';
import { cn } from '@/lib/utils';
import { useBrand } from '@/shared/hooks';
import { IconButton, NavGroup, NavItem } from '@/shared/ui';

import { visibleNav, visiblePrimary } from './nav';
import { useOpenSections } from './use-open-sections';

export interface SidebarProps {
  /** Rail mode: icons only. Ignored inside the mobile drawer, which is never a rail. */
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  /** Called after a link is followed, so the mobile drawer can close itself. */
  onNavigate?: (() => void) | undefined;
}

export function Sidebar({ isCollapsed, onToggleCollapsed, onNavigate }: SidebarProps) {
  const { t } = useTranslation('nav');
  const location = useLocation();
  const ability = useAbility();
  const tenantHref = useTenantHref();
  const brand = useBrand();

  const primary = useMemo(() => visiblePrimary(ability), [ability]);
  const sections = useMemo(() => visibleNav(ability), [ability]);
  // The URL decides what is current, so there is no state to fall out of step.
  const activeSection =
    sections.find((section) => section.children.some((leaf) => leaf.path === location.pathname)) ??
    null;
  const { isOpen, toggle } = useOpenSections(activeSection?.id ?? null);

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className={cn('flex items-center gap-2', isCollapsed ? 'justify-center' : '')}>
        {isCollapsed ? null : (
          <Link
            to={tenantHref('/')}
            onClick={onNavigate}
            className="text-foreground text-heading min-w-0 flex-1 truncate font-bold"
          >
            {brand.name}
          </Link>
        )}
        {/* Hidden on phones: there the sidebar is a drawer, which closes instead. */}
        <IconButton
          variant="ghost"
          size="sm"
          className="hidden lg:inline-flex"
          onClick={onToggleCollapsed}
          label={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          icon={
            isCollapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            )
          }
        />
      </div>

      <nav aria-label={t('sidebar.label')} className="min-h-0 flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {primary.map((leaf) => {
            const LeafIcon = leaf.icon;
            return (
              <li key={leaf.path}>
                <NavItem
                  to={tenantHref(leaf.path)}
                  label={t(leaf.labelKey)}
                  icon={<LeafIcon className="size-4" aria-hidden="true" />}
                  isActive={leaf.path === location.pathname}
                  isIconOnly={isCollapsed}
                  onNavigate={onNavigate}
                />
              </li>
            );
          })}
          {sections.map((section) => {
            const SectionIcon = section.icon;
            const hasActiveChild = section.children.some((leaf) => leaf.path === location.pathname);

            return (
              <li key={section.id}>
                <NavGroup
                  label={t(section.labelKey)}
                  icon={<SectionIcon className="size-4" aria-hidden="true" />}
                  isOpen={isOpen(section.id)}
                  onToggle={() => {
                    // In rail mode the only sensible answer to a click is to give
                    // the labels back, rather than open a panel with no room.
                    if (isCollapsed) onToggleCollapsed();
                    else toggle(section.id);
                  }}
                  hasActiveChild={hasActiveChild}
                  isIconOnly={isCollapsed}
                >
                  {section.children.map((leaf) => {
                    const LeafIcon = leaf.icon;
                    return (
                      <li key={leaf.path}>
                        <NavItem
                          to={tenantHref(leaf.path)}
                          label={t(leaf.labelKey)}
                          icon={<LeafIcon className="size-4" aria-hidden="true" />}
                          isActive={leaf.path === location.pathname}
                          onNavigate={onNavigate}
                        />
                      </li>
                    );
                  })}
                </NavGroup>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
