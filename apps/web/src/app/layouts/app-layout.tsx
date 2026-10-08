import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';

import { Header } from '@/app/navigation/header';
import { Sidebar } from '@/app/navigation/sidebar';
import { cn } from '@/lib/utils';
import { Drawer } from '@/shared/ui';

import { useSidebarCollapsed } from './use-sidebar-collapsed';

const CONTENT_ID = 'main-content';

/**
 * The frame every signed-in working page sits in: one sidebar, one header, and
 * the page itself. Below `lg` the sidebar is a drawer — a 16rem column leaves a
 * phone nothing to work in.
 */
export function AppLayout() {
  const { t } = useTranslation('nav');
  const location = useLocation();
  const { isCollapsed, toggle } = useSidebarCollapsed();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="bg-background min-h-screen">
      {/* First tab stop on every page: skipping a repeated sidebar is a WCAG requirement. */}
      <a
        href={`#${CONTENT_ID}`}
        className="text-primary focus:bg-card focus:shadow-overlay focus:rounded-control sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:p-3"
      >
        {t('skipToContent')}
      </a>

      <div className="flex min-h-screen">
        <aside
          className={cn(
            'border-border bg-card sticky top-0 hidden h-screen shrink-0 border-r lg:block',
            isCollapsed ? 'w-rail' : 'w-sidebar',
          )}
        >
          <Sidebar isCollapsed={isCollapsed} onToggleCollapsed={toggle} />
        </aside>

        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
          }}
          label={t('sidebar.label')}
        >
          <Sidebar
            isCollapsed={false}
            onToggleCollapsed={toggle}
            onNavigate={() => {
              setIsDrawerOpen(false);
            }}
          />
        </Drawer>

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            onOpenSidebar={() => {
              setIsDrawerOpen(true);
            }}
          />
          {/*
            Keyed by pathname so focus and scroll start fresh on each page: a
            shared frame otherwise leaves the reader half-way down the last one.
          */}
          <main id={CONTENT_ID} key={location.pathname} className="grid min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
