import { type ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Buttons and links, right-aligned next to the title. */
  actions?: ReactNode;
}

/** The title block every list page repeats; keeps the type scale in one place. */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-foreground text-title font-bold">{title}</h1>
        {subtitle === undefined ? null : (
          <p className="text-muted-foreground text-body">{subtitle}</p>
        )}
      </div>
      {actions === undefined ? null : <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
